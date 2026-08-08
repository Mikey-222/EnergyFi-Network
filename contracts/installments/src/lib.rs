#![no_std]
use soroban_sdk::{
    contract, contractevent, contractimpl, contracttype, token, Address, Env, IntoVal, Symbol, Vec,
};

const VERSION: u32 = 7;
/// Platform fee applied to each installment (basis points, 100 = 1%).
const FEE_BPS: i128 = 100;
/// Soft-collateral multiple: the principal of any loan is capped at 4x the
/// borrower's savings pool shares (i.e. a 25% pledge is required).
const LOAN_MULTIPLE: i128 = 4;

#[contractevent(topics = ["product", "register"])]
struct ProductRegistered {
    provider: Address,
    product_id: Symbol,
    price: i128,
    monthly: i128,
    months: u32,
}

#[contractevent(topics = ["product", "withdraw"])]
struct Withdrawal {
    provider: Address,
    product_id: Symbol,
    payout: i128,
    fee: i128,
}

#[contractevent(topics = ["loan", "disbursed"])]
struct LoanDisbursed {
    buyer: Address,
    product_id: Symbol,
    principal: i128,
}

#[contractevent(topics = ["admin", "fees_claimed"])]
struct FeeClaimed {
    admin: Address,
    amount: i128,
}

#[contractevent(topics = ["loan", "late"])]
struct LoanMarkedLate {
    buyer: Address,
    product_id: Symbol,
    late: u32,
}

#[contractevent(topics = ["loan", "defaulted"])]
struct LoanDefaulted {
    buyer: Address,
    product_id: Symbol,
    outstanding: i128,
}

#[contractevent(topics = ["loan", "default_cleared"])]
struct DefaultCleared {
    buyer: Address,
}

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Admin,
    PaymentAsset,
    /// Savings pool contract used to verify the borrower's pledge.
    ProjectContract,
    /// product_id -> Product
    Product(Symbol),
    /// (buyer, product_id) -> Financing
    Financing(Address, Symbol),
    /// Platform fees accrued (1% of settled withdrawals), claimable by admin.
    FeePool,
    /// buyer -> () — default flag; permanent until cleared by the admin.
    Defaulted(Address),
    /// Index of every wallet that started a financing (admin console).
    Borrowers,
    /// Index of defaulted wallets (admin console).
    DefaultedAccounts,
}

/// Shape of the savings pool's `get_investor` result (cross-contract read).
#[derive(Clone)]
#[contracttype]
pub struct ProjectInvestorState {
    pub shares: i128,
    pub snapshot: i128,
    pub claimed: i128,
    pub invested: i128,
}

#[derive(Clone)]
#[contracttype]
pub struct EligibilityResult {
    pub eligible: bool,
    pub defaulted: bool,
    pub already_started: bool,
    /// Borrower's pool savings in stroops.
    pub savings: i128,
    /// Max principal allowed at the 4x multiple, in stroops.
    pub max_principal: i128,
    /// Loan principal for this product, in stroops.
    pub principal: i128,
    /// Minimum pool savings required (25% of principal), in stroops.
    pub required_pledge: i128,
}

#[derive(Clone)]
#[contracttype]
pub struct Product {
    pub provider: Address,
    pub price: i128,
    pub monthly: i128,
    pub months: u32,
    pub deposit: i128,
    /// Whether the borrower must already hold a 25% pool-savings pledge to
    /// start this financing. Secured (loan) products enforce the pledge at
    /// `start_financing`; unsecured (BNPL) products never disburse principal.
    pub secured: bool,
    /// Sum of installments settled towards the provider's corpus (the routed
    /// saver-interest is excluded — it never enters this account).
    pub total_paid: i128,
    /// Amount the provider has withdrawn from the escrow.
    pub withdrawn: i128,
    pub active: bool,
}

#[derive(Clone)]
#[contracttype]
pub struct Financing {
    pub buyer: Address,
    pub product_id: Symbol,
    /// Installments paid so far.
    pub installments_paid: u32,
    /// USDC already paid in.
    pub total_paid: i128,
    /// Installments due but late (for display).
    pub late: u32,
    /// Whether the loan principal has been disbursed to the buyer (loans).
    pub disbursed: bool,
    /// Remaining principal for loan products (0 for classic BNPL).
    pub principal_outstanding: i128,
    /// UNIX timestamp (ledger) when the financing was started. Drives the
    /// per-loan schedule shown in the admin console (instalment due dates)
    /// and lets borrowers/admins see how far into the term they are.
    pub started_at: u64,
}

#[contract]
pub struct Installments;

#[contractimpl]
impl Installments {
    /// Initialize. `admin` can pause products; `payment_asset` is the
    /// USDC/EURC token users pay with; `project_contract` is the savings pool
    /// used to verify the soft-collateral pledge before loan disbursal.
    pub fn __constructor(env: Env, admin: Address, payment_asset: Address, project_contract: Address) {
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage()
            .instance()
            .set(&DataKey::PaymentAsset, &payment_asset);
        env.storage()
            .instance()
            .set(&DataKey::ProjectContract, &project_contract);
    }

    /// A provider lists a product for pay-in-installments financing.
    /// `deposit` is the initial down payment; monthly installments follow.
    pub fn register_product(
        env: Env,
        provider: Address,
        product_id: Symbol,
        price: i128,
        monthly: i128,
        months: u32,
        deposit: i128,
    ) {
        provider.require_auth();
        if price <= 0 || monthly <= 0 || months == 0 {
            panic!("invalid product terms");
        }
        if deposit > price {
            panic!("deposit exceeds price");
        }
        let product = Product {
            provider: provider.clone(),
            price,
            monthly,
            months,
            deposit,
            secured: false,
            total_paid: 0,
            withdrawn: 0,
            active: true,
        };
        env.storage()
            .persistent()
            .set(&DataKey::Product(product_id.clone()), &product);
        env.storage()
            .persistent()
            .extend_ttl(&DataKey::Product(product_id.clone()), 5000, 10000);

        ProductRegistered {
            provider,
            product_id,
            price,
            monthly,
            months,
        }
        .publish(&env);
    }

    pub fn deactivate_product(env: Env, provider: Address, product_id: Symbol) {
        provider.require_auth();
        let mut product = Self::get_product(env.clone(), product_id.clone());
        if product.provider != provider {
            panic!("not the provider");
        }
        product.active = false;
        env.storage()
            .persistent()
            .set(&DataKey::Product(product_id.clone()), &product);
        env.storage()
            .persistent()
            .extend_ttl(&DataKey::Product(product_id.clone()), 5000, 10000);
    }

    /// Marks a product as a secured loan (borrower needs the 25% pool-savings
    /// pledge to start) or unsecured BNPL. Provider-controlled.
    pub fn set_collateral_required(env: Env, provider: Address, product_id: Symbol, secured: bool) {
        provider.require_auth();
        let mut product = Self::get_product(env.clone(), product_id.clone());
        if product.provider != provider {
            panic!("not the provider");
        }
        product.secured = secured;
        env.storage()
            .persistent()
            .set(&DataKey::Product(product_id.clone()), &product);
        env.storage()
            .persistent()
            .extend_ttl(&DataKey::Product(product_id.clone()), 5000, 10000);
    }

    /// Buyer starts a financing agreement, paying the deposit.
    pub fn start_financing(env: Env, buyer: Address, product_id: Symbol) {
        buyer.require_auth();
        if Self::is_defaulted(env.clone(), buyer.clone()) {
            panic!("account defaulted");
        }
        let product = Self::get_product(env.clone(), product_id.clone());
        if !product.active {
            panic!("product not active");
        }
        // A financing may only be started when no *active* one exists — a
        // fully repaid financing (installments_paid >= months) does not block
        // starting a new one.
        if let Some(f) = env
            .storage()
            .persistent()
            .get::<_, Financing>(&DataKey::Financing(buyer.clone(), product_id.clone()))
        {
            if f.installments_paid < product.months {
                panic!("financing already exists");
            }
        }

        // Secured (loan) products: the borrower must already hold the 25%
        // soft-collateral pledge in pool shares before the loan can even be
        // started — signing without backing shares is rejected here, not just
        // at disbursal. Enforced again in `disburse_loan` (defense in depth).
        if product.secured {
            let principal = product.price.checked_sub(product.deposit).expect("overflow");
            if principal > 0 {
                let pledge = Self::savings_pledge(env.clone(), buyer.clone());
                let max_principal = pledge.checked_mul(LOAN_MULTIPLE).expect("overflow");
                if principal > max_principal {
                    panic!("insufficient savings pledge: needs a 25% pool-savings stake to start");
                }
            }
        }

        let payment_asset: Address = env.storage().instance().get(&DataKey::PaymentAsset).unwrap();
        let deposit = product.deposit;
        if deposit > 0 {
            token::Client::new(&env, &payment_asset).transfer(
                &buyer,
                &env.current_contract_address(),
                &deposit,
            );
        }

        let financing = Financing {
            buyer: buyer.clone(),
            product_id: product_id.clone(),
            installments_paid: 0,
            total_paid: deposit,
            late: 0,
            disbursed: false,
            principal_outstanding: 0,
            started_at: env.ledger().timestamp(),
        };
        let financing_key = DataKey::Financing(buyer.clone(), product_id.clone());
        env.storage().persistent().set(&financing_key, &financing);
        env.storage()
            .persistent()
            .extend_ttl(&financing_key, 5000, 10000);

        Self::index_buyer(env.clone(), buyer.clone());
        Self::record_payment(env, product_id, deposit);
    }

    /// Buyer pays one monthly installment. The interest embedded in the
    /// installment (total repaid minus price, spread evenly over the months)
    /// is routed straight into the savings pool in the same transaction —
    /// savers' income arrives automatically the moment a repayment lands.
    /// Only the principal portion settles into the provider's corpus.
    pub fn pay_installment(env: Env, buyer: Address, product_id: Symbol) {
        buyer.require_auth();
        let product = Self::get_product(env.clone(), product_id.clone());
        let mut financing =
            Self::get_financing(env.clone(), buyer.clone(), product_id.clone());
        if financing.installments_paid >= product.months {
            panic!("financing complete");
        }

        let payment_asset: Address = env.storage().instance().get(&DataKey::PaymentAsset).unwrap();
        let monthly = product.monthly;
        token::Client::new(&env, &payment_asset).transfer(
            &buyer,
            &env.current_contract_address(),
            &monthly,
        );

        // Route the interest portion to the savings pool. `route_revenue`
        // requires auth from this contract (the router), so only our own
        // repayments can book saver revenue. The funds move *before* the
        // booking call — claimable only ever grows from money already inside
        // the pool.
        let interest_cut = Self::interest_per_installment(&product);
        if interest_cut > 0 {
            let project_pool: Address = env
                .storage()
                .instance()
                .get(&DataKey::ProjectContract)
                .unwrap();
            token::Client::new(&env, &payment_asset).transfer(
                &env.current_contract_address(),
                &project_pool,
                &interest_cut,
            );
            let _: () = env.invoke_contract(
                &project_pool,
                &Symbol::new(&env, "route_revenue"),
                (env.current_contract_address(), interest_cut).into_val(&env),
            );
        }

        financing.installments_paid += 1;
        financing.total_paid = financing.total_paid.checked_add(monthly).expect("overflow");
        if financing.disbursed {
            financing.principal_outstanding =
                financing.principal_outstanding.saturating_sub(monthly);
        }
        financing.late = 0;
        env.storage().persistent().set(
            &DataKey::Financing(buyer.clone(), product_id.clone()),
            &financing,
        );

        Self::record_payment(env, product_id, monthly.saturating_sub(interest_cut));
    }

    /// Buyer repays the entire remaining balance in one transaction: all
    /// outstanding installments are settled at once. Each remaining month's
    /// saver-interest is routed to the pool in the same way a single
    /// installment payment would, so savers earn identically — just batched.
    /// Only the principal portions settle into the provider's corpus.
    pub fn payoff_loan(env: Env, buyer: Address, product_id: Symbol) {
        buyer.require_auth();
        let product = Self::get_product(env.clone(), product_id.clone());
        let mut financing =
            Self::get_financing(env.clone(), buyer.clone(), product_id.clone());
        let remaining = product.months.saturating_sub(financing.installments_paid);
        if remaining == 0 {
            panic!("financing complete");
        }

        let payment_asset: Address = env.storage().instance().get(&DataKey::PaymentAsset).unwrap();
        let lump = (remaining as i128)
            .checked_mul(product.monthly)
            .expect("overflow");
        token::Client::new(&env, &payment_asset)
            .transfer(&buyer, &env.current_contract_address(), &lump);

        let interest_cut = Self::interest_per_installment(&product);
        if interest_cut > 0 {
            let total_interest = (remaining as i128)
                .checked_mul(interest_cut)
                .expect("overflow");
            let project_pool: Address = env
                .storage()
                .instance()
                .get(&DataKey::ProjectContract)
                .unwrap();
            token::Client::new(&env, &payment_asset).transfer(
                &env.current_contract_address(),
                &project_pool,
                &total_interest,
            );
            let _: () = env.invoke_contract(
                &project_pool,
                &Symbol::new(&env, "route_revenue"),
                (env.current_contract_address(), total_interest).into_val(&env),
            );
        }

        financing.installments_paid = product.months;
        financing.total_paid = financing.total_paid.checked_add(lump).expect("overflow");
        financing.principal_outstanding = 0;
        financing.late = 0;
        let key = DataKey::Financing(buyer.clone(), product_id.clone());
        env.storage().persistent().set(&key, &financing);
        env.storage()
            .persistent()
            .extend_ttl(&key, 5000, 10000);

        let principal_part = lump.checked_sub((remaining as i128)
            .checked_mul(interest_cut)
            .expect("overflow"))
            .expect("overflow");
        Self::record_payment(env, product_id, principal_part);
    }

    /// Admin disburses the loan principal (`price - deposit`) to the buyer.
    /// The contract must already hold the funds (the lenders' liquidity pool
    /// tops the escrow up). Repayments flow back through `withdraw`.
    pub fn disburse_loan(env: Env, buyer: Address, product_id: Symbol) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        let product = Self::get_product(env.clone(), product_id.clone());
        if !product.active {
            panic!("product not active");
        }
        let mut financing =
            Self::get_financing(env.clone(), buyer.clone(), product_id.clone());
        if financing.disbursed {
            panic!("loan already disbursed");
        }
        let principal = product.price.checked_sub(product.deposit).expect("overflow");
        if principal <= 0 {
            panic!("nothing to disburse");
        }
        // Soft-collateral rule: the principal must be backed by the borrower's
        // pool shares (max 4x savings). Shares are locked in the savings pool
        // (no withdrawals), so the pledge cannot shrink after this check.
        let pledge = Self::savings_pledge(env.clone(), buyer.clone());
        let max_principal = pledge.checked_mul(LOAN_MULTIPLE).expect("overflow");
        if principal > max_principal {
            panic!("insufficient savings pledge: needs 25% of the loan in pool shares");
        }

        let payment_asset: Address = env.storage().instance().get(&DataKey::PaymentAsset).unwrap();
        token::Client::new(&env, &payment_asset)
            .transfer(&env.current_contract_address(), &buyer, &principal);

        financing.disbursed = true;
        financing.principal_outstanding = principal;
        env.storage()
            .persistent()
            .set(&DataKey::Financing(buyer.clone(), product_id.clone()), &financing);

        LoanDisbursed {
            buyer,
            product_id,
            principal,
        }
        .publish(&env);
    }

    /// Provider withdraws settled funds (installment total minus platform fee).
    pub fn withdraw(env: Env, provider: Address, product_id: Symbol) {
        provider.require_auth();
        let mut product = Self::get_product(env.clone(), product_id.clone());
        if product.provider != provider {
            panic!("not the provider");
        }
        let settled = product.total_paid.checked_sub(product.withdrawn).expect("overflow");
        if settled <= 0 {
            panic!("nothing to withdraw");
        }
        let fee = settled.checked_mul(FEE_BPS).expect("overflow") / 10000;
        let payout = settled.checked_sub(fee).expect("overflow");
        product.withdrawn = product.withdrawn.checked_add(settled).expect("overflow");

        let mut fees: i128 = env.storage().instance().get(&DataKey::FeePool).unwrap_or(0);
        fees = fees.checked_add(fee).expect("overflow");
        env.storage().instance().set(&DataKey::FeePool, &fees);

        let payment_asset: Address = env.storage().instance().get(&DataKey::PaymentAsset).unwrap();
        token::Client::new(&env, &payment_asset)
            .transfer(&env.current_contract_address(), &provider, &payout);

        env.storage()
            .persistent()
            .set(&DataKey::Product(product_id.clone()), &product);
        Withdrawal {
            provider,
            product_id,
            payout,
            fee,
        }
        .publish(&env);
    }

    pub fn version(_env: Env) -> u32 {
        VERSION
    }

    /// Platform fees accrued from provider withdrawals (1% of settled funds),
    /// claimable by the admin only.
    pub fn fees_owed(env: Env) -> i128 {
        env.storage().instance().get(&DataKey::FeePool).unwrap_or(0)
    }

    /// Admin claims up to `amount` of the accrued platform fees. Fails if
    /// `amount` exceeds what has actually accrued. User funds (escrow,
    /// repayments) are never touched — only the fee pool is payable.
    pub fn claim_fees(env: Env, admin: Address, amount: i128) {
        let stored_admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        if admin != stored_admin {
            panic!("not the admin");
        }
        if amount <= 0 {
            panic!("amount must be positive");
        }
        let mut fees: i128 = env.storage().instance().get(&DataKey::FeePool).unwrap_or(0);
        if amount > fees {
            panic!("amount exceeds accrued fees");
        }
        fees = fees.checked_sub(amount).expect("overflow");
        env.storage().instance().set(&DataKey::FeePool, &fees);

        let payment_asset: Address = env.storage().instance().get(&DataKey::PaymentAsset).unwrap();
        token::Client::new(&env, &payment_asset)
            .transfer(&env.current_contract_address(), &admin, &amount);

        FeeClaimed { admin, amount }.publish(&env);
    }

    /// Admin flags a disbursed, incomplete loan as late (one missed
    /// installment per call). Drives the borrower-facing "overdue" state.
    pub fn mark_late(env: Env, admin: Address, buyer: Address, product_id: Symbol) {
        let stored_admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        if admin != stored_admin {
            panic!("not the admin");
        }
        let product = Self::get_product(env.clone(), product_id.clone());
        let mut financing =
            Self::get_financing(env.clone(), buyer.clone(), product_id.clone());
        if !financing.disbursed {
            panic!("loan not disbursed");
        }
        if financing.installments_paid >= product.months {
            panic!("loan complete");
        }
        financing.late = financing.late.checked_add(1).expect("overflow");
        let financing_key = DataKey::Financing(buyer.clone(), product_id.clone());
        env.storage().persistent().set(&financing_key, &financing);
        env.storage()
            .persistent()
            .extend_ttl(&financing_key, 5000, 10000);

        LoanMarkedLate {
            buyer,
            product_id,
            late: financing.late,
        }
        .publish(&env);
    }

    /// Admin writes a loan off as defaulted. The borrower is permanently
    /// flagged (until `clear_default`) and can no longer start new financings.
    /// No funds move in this version — the written-off principal is the pool's
    /// book loss, shown in the admin console.
    pub fn settle_default(env: Env, admin: Address, buyer: Address, product_id: Symbol) {
        let stored_admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        if admin != stored_admin {
            panic!("not the admin");
        }
        let product = Self::get_product(env.clone(), product_id.clone());
        let mut financing =
            Self::get_financing(env.clone(), buyer.clone(), product_id.clone());
        if !financing.disbursed {
            panic!("loan not disbursed");
        }
        if financing.installments_paid >= product.months {
            panic!("loan complete");
        }
        let outstanding = financing.principal_outstanding;

        Self::set_defaulted(env.clone(), buyer.clone());

        financing.late = 0;
        let financing_key = DataKey::Financing(buyer.clone(), product_id.clone());
        env.storage().persistent().set(&financing_key, &financing);
        env.storage()
            .persistent()
            .extend_ttl(&financing_key, 5000, 10000);

        LoanDefaulted {
            buyer,
            product_id,
            outstanding,
        }
        .publish(&env);
    }

    /// Admin override: removes a borrower's default flag.
    pub fn clear_default(env: Env, admin: Address, buyer: Address) {
        let stored_admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        if admin != stored_admin {
            panic!("not the admin");
        }
        if !Self::is_defaulted(env.clone(), buyer.clone()) {
            panic!("not defaulted");
        }
        env.storage()
            .persistent()
            .remove(&DataKey::Defaulted(buyer.clone()));

        let list: Vec<Address> = env
            .storage()
            .persistent()
            .get(&DataKey::DefaultedAccounts)
            .unwrap_or(Vec::new(&env));
        let mut kept = Vec::new(&env);
        for i in 0..list.len() {
            let entry = list.get(i).unwrap();
            if entry != buyer {
                kept.push_back(entry);
            }
        }
        env.storage().persistent().set(&DataKey::DefaultedAccounts, &kept);
        env.storage()
            .persistent()
            .extend_ttl(&DataKey::DefaultedAccounts, 5000, 10000);

        DefaultCleared { buyer }.publish(&env);
    }

    pub fn is_defaulted(env: Env, buyer: Address) -> bool {
        env.storage()
            .persistent()
            .has(&DataKey::Defaulted(buyer))
    }

    pub fn borrower_count(env: Env) -> u32 {
        env.storage()
            .persistent()
            .get::<_, Vec<Address>>(&DataKey::Borrowers)
            .unwrap_or(Vec::new(&env))
            .len()
    }

    pub fn borrower_at(env: Env, index: u32) -> Address {
        env.storage()
            .persistent()
            .get::<_, Vec<Address>>(&DataKey::Borrowers)
            .unwrap_or(Vec::new(&env))
            .get(index)
            .expect("index out of range")
    }

    pub fn defaulted_count(env: Env) -> u32 {
        env.storage()
            .persistent()
            .get::<_, Vec<Address>>(&DataKey::DefaultedAccounts)
            .unwrap_or(Vec::new(&env))
            .len()
    }

    pub fn defaulted_at(env: Env, index: u32) -> Address {
        env.storage()
            .persistent()
            .get::<_, Vec<Address>>(&DataKey::DefaultedAccounts)
            .unwrap_or(Vec::new(&env))
            .get(index)
            .expect("index out of range")
    }

    /// Real eligibility verdict for the borrower-facing screen: not
    /// defaulted, no existing financing for the product, and pool savings
    /// covering at least 25% of the principal.
    pub fn check_eligibility(env: Env, borrower: Address, product_id: Symbol) -> EligibilityResult {
        let defaulted = Self::is_defaulted(env.clone(), borrower.clone());
        let product_opt: Option<Product> = env
            .storage()
            .persistent()
            .get(&DataKey::Product(product_id.clone()));
        // A financing only blocks re-eligibility while it is still active
        // (installments outstanding). Fully repaid financings leave the
        // borrower free to start another one.
        let already_started = env
            .storage()
            .persistent()
            .get::<_, Financing>(&DataKey::Financing(borrower.clone(), product_id.clone()))
            .map_or(false, |f| {
                product_opt
                    .as_ref()
                    .map_or(true, |p| f.installments_paid < p.months)
            });
        let principal = match &product_opt {
            Some(p) => p.price.checked_sub(p.deposit).expect("overflow"),
            None => 0,
        };

        let savings = if defaulted || principal <= 0 {
            0
        } else {
            Self::savings_pledge(env.clone(), borrower.clone())
        };
        let max_principal = savings.checked_mul(LOAN_MULTIPLE).expect("overflow");
        let required_pledge = principal.checked_add(LOAN_MULTIPLE - 1).expect("overflow")
            .checked_div(LOAN_MULTIPLE)
            .expect("overflow");

        EligibilityResult {
            eligible: !defaulted
                && !already_started
                && principal > 0
                && savings > 0
                && max_principal >= principal,
            defaulted,
            already_started,
            savings,
            max_principal,
            principal,
            required_pledge,
        }
    }

    /// Reads the borrower's pool savings in stroops from the project contract
    /// (shares x share price). Cross-contract read — no auth required on the
    /// called views.
    fn savings_pledge(env: Env, borrower: Address) -> i128 {
        let project: Address = env
            .storage()
            .instance()
            .get(&DataKey::ProjectContract)
            .unwrap();
        let state: ProjectInvestorState = env.invoke_contract(
            &project,
            &Symbol::new(&env, "get_investor"),
            (borrower,).into_val(&env),
        );
        let share_price: i128 = env.invoke_contract(
            &project,
            &Symbol::new(&env, "share_price"),
            ().into_val(&env),
        );
        state
            .shares
            .checked_mul(share_price)
            .expect("overflow")
    }

    fn index_buyer(env: Env, buyer: Address) {
        let mut list: Vec<Address> = env
            .storage()
            .persistent()
            .get(&DataKey::Borrowers)
            .unwrap_or(Vec::new(&env));
        for i in 0..list.len() {
            if list.get(i).unwrap() == buyer {
                return;
            }
        }
        list.push_back(buyer);
        env.storage().persistent().set(&DataKey::Borrowers, &list);
        env.storage()
            .persistent()
            .extend_ttl(&DataKey::Borrowers, 5000, 10000);
    }

    fn set_defaulted(env: Env, buyer: Address) {
        if Self::is_defaulted(env.clone(), buyer.clone()) {
            return;
        }
        env.storage()
            .persistent()
            .set(&DataKey::Defaulted(buyer.clone()), &());
        env.storage()
            .persistent()
            .extend_ttl(&DataKey::Defaulted(buyer.clone()), 5000, 10000);

        let mut list: Vec<Address> = env
            .storage()
            .persistent()
            .get(&DataKey::DefaultedAccounts)
            .unwrap_or(Vec::new(&env));
        list.push_back(buyer);
        env.storage().persistent().set(&DataKey::DefaultedAccounts, &list);
        env.storage()
            .persistent()
            .extend_ttl(&DataKey::DefaultedAccounts, 5000, 10000);
    }

    pub fn get_product(env: Env, product_id: Symbol) -> Product {
        env.storage()
            .persistent()
            .get(&DataKey::Product(product_id))
            .expect("product not found")
    }

    pub fn get_financing(env: Env, buyer: Address, product_id: Symbol) -> Financing {
        env.storage()
            .persistent()
            .get(&DataKey::Financing(buyer, product_id))
            .expect("financing not found")
    }

    pub fn payment_asset(env: Env) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::PaymentAsset)
            .unwrap()
    }

    fn record_payment(env: Env, product_id: Symbol, amount: i128) {
        let mut product = Self::get_product(env.clone(), product_id.clone());
        product.total_paid = product.total_paid.checked_add(amount).expect("overflow");
        env.storage()
            .persistent()
            .set(&DataKey::Product(product_id), &product);
    }

    /// Interest carried by each installment: total repaid minus price, spread
    /// evenly over the term. Zero when the product carries no financing
    /// charge. The per-payment floor leaves at most `months - 1` stroops of
    /// rounding dust in the provider's corpus over the full term.
    fn interest_per_installment(product: &Product) -> i128 {
        let total = (product.months as i128)
            .checked_mul(product.monthly)
            .expect("overflow");
        if total <= product.price {
            return 0;
        }
        (total - product.price) / product.months as i128
    }
}

mod test;
