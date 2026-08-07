#![no_std]
use soroban_sdk::{contract, contractevent, contractimpl, contracttype, token, Address, Env, String};

const VERSION: u32 = 2;
/// Fixed-point scaling for the revenue-per-share accumulator.
const SCALE: i128 = 1_000_000_000;

#[contractevent(topics = ["project", "invest"])]
struct Invested {
    investor: Address,
    shares: i128,
    amount: i128,
}

#[contractevent(topics = ["project", "revenue"])]
struct RevenueDeposited {
    amount: i128,
    revenue_per_share: i128,
}

#[contractevent(topics = ["project", "dividend"])]
struct DividendPaid {
    investor: Address,
    payout: i128,
}

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Admin,
    PaymentAsset,
    /// Price of one share in stroops of the payment asset.
    SharePrice,
    /// Total number of shares issued for this project.
    TotalShares,
    /// Total number of shares actually sold.
    TotalSold,
    /// Cumulative dividend accrual per share, scaled by SCALE.
    RevPerShare,
    /// Revenue deposited while no shares were sold yet (applied on first invest).
    PendingRevenue,
    /// Cumulative invested amount (stroops).
    TotalInvested,
    Name,
    Symbol,
    /// investor -> InvestorState
    Investor(Address),
}

#[derive(Clone)]
#[contracttype]
pub struct InvestorState {
    pub shares: i128,
    /// Baseline for dividend math: shares * rev_per_share at buy time (scaled).
    pub snapshot: i128,
    /// Dividends already claimed (stroops).
    pub claimed: i128,
    /// Total invested (stroops).
    pub invested: i128,
}

#[contract]
pub struct Project;

#[contractimpl]
impl Project {
    /// Initialize a tokenized project. One contract instance per project.
    /// `admin` deposits project revenue for distribution.
    pub fn __constructor(
        env: Env,
        admin: Address,
        payment_asset: Address,
        share_price: i128,
        total_shares: i128,
        name: String,
        symbol: String,
    ) {
        if share_price <= 0 || total_shares <= 0 {
            panic!("invalid terms");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage()
            .instance()
            .set(&DataKey::PaymentAsset, &payment_asset);
        env.storage().instance().set(&DataKey::SharePrice, &share_price);
        env.storage().instance().set(&DataKey::TotalShares, &total_shares);
        env.storage().instance().set(&DataKey::TotalSold, &0i128);
        env.storage().instance().set(&DataKey::RevPerShare, &0i128);
        env.storage().instance().set(&DataKey::PendingRevenue, &0i128);
        env.storage().instance().set(&DataKey::TotalInvested, &0i128);
        env.storage().instance().set(&DataKey::Name, &name);
        env.storage().instance().set(&DataKey::Symbol, &symbol);
    }

    /// Invest `amount` (stroops of payment asset) and receive shares at the
    /// fixed share price (rounded down). Reverts if shares would exceed the
    /// total issued.
    pub fn invest(env: Env, investor: Address, amount: i128) -> i128 {
        investor.require_auth();
        if amount <= 0 {
            panic!("amount must be positive");
        }
        let share_price: i128 = env.storage().instance().get(&DataKey::SharePrice).unwrap();
        let total_shares: i128 = env.storage().instance().get(&DataKey::TotalShares).unwrap();
        let shares = amount.checked_div(share_price).expect("overflow");
        if shares <= 0 {
            panic!("amount below one share");
        }
        let mut total_sold: i128 = env.storage().instance().get(&DataKey::TotalSold).unwrap();
        if total_sold.checked_add(shares).expect("overflow") > total_shares {
            panic!("project fully subscribed");
        }

        let payment_asset: Address = env.storage().instance().get(&DataKey::PaymentAsset).unwrap();
        token::Client::new(&env, &payment_asset).transfer(
            &investor,
            &env.current_contract_address(),
            &amount,
        );

        // Apply any revenue that was deposited before the first shares sold.
        // NOTE: the buyer's snapshot is taken from the *current* rev_per_share
        // *before* pending revenue is folded in, otherwise the first buyer's
        // baseline absorbs it and it becomes unclaimable by anyone.
        let mut state = Self::get_investor(env.clone(), investor.clone());
        let mut rev_per_share: i128 = env.storage().instance().get(&DataKey::RevPerShare).unwrap();
        let pending: i128 = env
            .storage()
            .instance()
            .get(&DataKey::PendingRevenue)
            .unwrap();
        let new_total_sold = total_sold.checked_add(shares).expect("overflow");
        // New shares enter at the current accrual rate, so no past revenue is owed.
        let snapshot_add = shares
            .checked_mul(rev_per_share)
            .expect("overflow")
            .checked_div(SCALE)
            .expect("overflow");
        if pending > 0 {
            rev_per_share = rev_per_share
                .checked_add(pending.checked_mul(SCALE).expect("overflow").checked_div(new_total_sold).expect("overflow"))
                .expect("overflow");
            env.storage().instance().set(&DataKey::RevPerShare, &rev_per_share);
            env.storage().instance().set(&DataKey::PendingRevenue, &0i128);
        }

        state.shares = state.shares.checked_add(shares).expect("overflow");
        state.snapshot = state.snapshot.checked_add(snapshot_add).expect("overflow");
        state.invested = state.invested.checked_add(amount).expect("overflow");
        env.storage()
            .instance()
            .set(&DataKey::Investor(investor.clone()), &state);

        total_sold = total_sold.checked_add(shares).expect("overflow");
        env.storage().instance().set(&DataKey::TotalSold, &total_sold);
        let total_invested_prev: i128 = env
            .storage()
            .instance()
            .get(&DataKey::TotalInvested)
            .unwrap();
        let total_invested = total_invested_prev.checked_add(amount).expect("overflow");
        env.storage()
            .instance()
            .set(&DataKey::TotalInvested, &total_invested);

        Invested {
            investor,
            shares,
            amount,
        }
        .publish(&env);
        shares
    }

    /// Admin deposits project revenue (e.g. energy sales) into the dividend pool.
    pub fn deposit_revenue(env: Env, amount: i128) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        if amount <= 0 {
            panic!("amount must be positive");
        }
        let payment_asset: Address = env.storage().instance().get(&DataKey::PaymentAsset).unwrap();
        token::Client::new(&env, &payment_asset).transfer(
            &admin,
            &env.current_contract_address(),
            &amount,
        );

        let total_sold: i128 = env.storage().instance().get(&DataKey::TotalSold).unwrap();
        if total_sold == 0 {
            // No shareholders yet; credit once the first shares are sold.
            let mut pending: i128 = env
                .storage()
                .instance()
                .get(&DataKey::PendingRevenue)
                .unwrap();
            pending = pending.checked_add(amount).expect("overflow");
            env.storage()
                .instance()
                .set(&DataKey::PendingRevenue, &pending);
        } else {
            let mut rev_per_share: i128 =
                env.storage().instance().get(&DataKey::RevPerShare).unwrap();
            rev_per_share = rev_per_share
                .checked_add(
                    amount
                        .checked_mul(SCALE)
                        .expect("overflow")
                        .checked_div(total_sold)
                        .expect("overflow"),
                )
                .expect("overflow");
            env.storage()
                .instance()
                .set(&DataKey::RevPerShare, &rev_per_share);
        }

        RevenueDeposited {
            amount,
            revenue_per_share: rev_per_share_or(&env, total_sold),
        }
        .publish(&env);
    }

    /// Routes revenue into the dividend pool on behalf of a trusted router
    /// (the installments contract). The router must have already transferred
    /// `amount` into this contract's balance — `router.require_auth()` binds
    /// the call to the router contract itself, so only that contract can book
    /// revenue here (a stranger passing the router's address fails the check).
    pub fn route_revenue(env: Env, router: Address, amount: i128) {
        router.require_auth();
        if amount <= 0 {
            panic!("amount must be positive");
        }
        let total_sold: i128 = env.storage().instance().get(&DataKey::TotalSold).unwrap();
        if total_sold == 0 {
            // No shareholders yet; credit once the first shares are sold.
            let mut pending: i128 = env
                .storage()
                .instance()
                .get(&DataKey::PendingRevenue)
                .unwrap();
            pending = pending.checked_add(amount).expect("overflow");
            env.storage()
                .instance()
                .set(&DataKey::PendingRevenue, &pending);
        } else {
            let mut rev_per_share: i128 =
                env.storage().instance().get(&DataKey::RevPerShare).unwrap();
            rev_per_share = rev_per_share
                .checked_add(
                    amount
                        .checked_mul(SCALE)
                        .expect("overflow")
                        .checked_div(total_sold)
                        .expect("overflow"),
                )
                .expect("overflow");
            env.storage()
                .instance()
                .set(&DataKey::RevPerShare, &rev_per_share);
        }

        RevenueDeposited {
            amount,
            revenue_per_share: rev_per_share_or(&env, total_sold),
        }
        .publish(&env);
    }

    /// Claim the investor's share of all deposited revenue, pro-rata by shares.
    pub fn claim_dividends(env: Env, investor: Address) -> i128 {
        investor.require_auth();
        let mut state = Self::get_investor(env.clone(), investor.clone());
        if state.shares == 0 {
            panic!("no shares");
        }
        let entitlement = Self::entitlement(env.clone(), investor.clone());
        let payout = entitlement.checked_sub(state.claimed).expect("overflow");
        if payout <= 0 {
            return 0;
        }
        state.claimed = state.claimed.checked_add(payout).expect("overflow");
        env.storage()
            .instance()
            .set(&DataKey::Investor(investor.clone()), &state);

        let payment_asset: Address = env.storage().instance().get(&DataKey::PaymentAsset).unwrap();
        token::Client::new(&env, &payment_asset)
            .transfer(&env.current_contract_address(), &investor, &payout);

        DividendPaid { investor, payout }.publish(&env);
        payout
    }

    pub fn version(_env: Env) -> u32 {
        VERSION
    }

    fn entitlement(env: Env, investor: Address) -> i128 {
        let state = Self::get_investor(env.clone(), investor.clone());
        if state.shares == 0 {
            return 0;
        }
        let rev_per_share: i128 = env.storage().instance().get(&DataKey::RevPerShare).unwrap();
        state
            .shares
            .checked_mul(rev_per_share)
            .expect("overflow")
            .checked_div(SCALE)
            .expect("overflow")
            .checked_sub(state.snapshot)
            .expect("overflow")
    }

    pub fn get_investor(env: Env, investor: Address) -> InvestorState {
        env.storage()
            .instance()
            .get(&DataKey::Investor(investor))
            .unwrap_or(InvestorState {
                shares: 0,
                snapshot: 0,
                claimed: 0,
                invested: 0,
            })
    }

    pub fn claimable(env: Env, investor: Address) -> i128 {
        let state = Self::get_investor(env.clone(), investor.clone());
        Self::entitlement(env, investor)
            .checked_sub(state.claimed)
            .expect("overflow")
    }

    pub fn total_sold(env: Env) -> i128 {
        env.storage().instance().get(&DataKey::TotalSold).unwrap()
    }

    pub fn total_raised(env: Env) -> i128 {
        env.storage().instance().get(&DataKey::TotalInvested).unwrap()
    }

    pub fn share_price(env: Env) -> i128 {
        env.storage().instance().get(&DataKey::SharePrice).unwrap()
    }

    pub fn payment_asset(env: Env) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::PaymentAsset)
            .unwrap()
    }
}

fn rev_per_share_or(env: &Env, total_sold: i128) -> i128 {
    if total_sold == 0 {
        0
    } else {
        env.storage().instance().get(&DataKey::RevPerShare).unwrap()
    }
}

mod test;
