#![no_std]
use soroban_sdk::{contract, contractevent, contractimpl, contracttype, token, Address, Env, String};

const VERSION: u32 = 1;

#[contractevent(topics = ["credit", "buy"])]
struct CreditBought {
    buyer: Address,
    kwh: i128,
    cost: i128,
}

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    /// Address that may mint kWh credits (EnergyFi).
    Admin,
    /// Price of one kWh in stroops of the payment asset (e.g. USDC/EURC).
    KwhPrice,
    /// Payment asset accepted for credit purchases (e.g. USDC/EURC token address).
    PaymentAsset,
    /// Name of the credit product.
    Name,
    /// Symbol of the credit product.
    Symbol,
    /// Per-account credit balance bookkeeping.
    Credit(Address),
}

#[derive(Clone)]
#[contracttype]
pub struct CreditBalance {
    pub kwh: i128,
    /// Total credits purchased over the lifetime of the account.
    pub total_purchased: i128,
    /// Total credits consumed over the lifetime of the account.
    pub total_consumed: i128,
}

#[contract]
pub struct EnergyCredit;

#[contractimpl]
impl EnergyCredit {
    /// Initialize the contract. `admin` is the only account allowed to set
    /// the price. `payment_asset` is the asset users pay with
    /// (USDC or EURC token address).
    pub fn __constructor(
        env: Env,
        admin: Address,
        payment_asset: Address,
        kwh_price: i128,
        name: String,
        symbol: String,
    ) {
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::PaymentAsset, &payment_asset);
        env.storage().instance().set(&DataKey::KwhPrice, &kwh_price);
        env.storage().instance().set(&DataKey::Name, &name);
        env.storage().instance().set(&DataKey::Symbol, &symbol);
    }

    /// Set the price of one kWh in the payment asset (admin only).
    pub fn set_price(env: Env, kwh_price: i128) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        if kwh_price <= 0 {
            panic!("price must be positive");
        }
        env.storage().instance().set(&DataKey::KwhPrice, &kwh_price);
    }

    /// Buy prepaid energy credits. `buyer` pays `kwh * price` in the payment
    /// asset, which is held by this contract, and receives `kwh` of credit.
    pub fn buy_credits(env: Env, buyer: Address, kwh: i128) {
        buyer.require_auth();
        if kwh <= 0 {
            panic!("kwh must be positive");
        }
        let price: i128 = env.storage().instance().get(&DataKey::KwhPrice).unwrap();
        let payment_asset: Address = env.storage().instance().get(&DataKey::PaymentAsset).unwrap();
        let cost = price.checked_mul(kwh).expect("overflow");

        token::Client::new(&env, &payment_asset).transfer(
            &buyer,
            &env.current_contract_address(),
            &cost,
        );

        let mut balance = Self::get_balance(env.clone(), buyer.clone());
        balance.kwh = balance.kwh.checked_add(kwh).expect("overflow");
        balance.total_purchased = balance.total_purchased.checked_add(kwh).expect("overflow");
        env.storage()
            .instance()
            .set(&DataKey::Credit(buyer.clone()), &balance);

        // Emit an event so the frontend can listen for credit purchases.
        CreditBought {
            buyer,
            kwh,
            cost,
        }
        .publish(&env);
    }

    /// Consume `kwh` of energy credit (called by EnergyFi when a user pays an
    /// energy bill or uses the grid). Admin only.
    pub fn consume_credits(env: Env, account: Address, kwh: i128) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        if kwh <= 0 {
            panic!("kwh must be positive");
        }
        let mut balance = Self::get_balance(env.clone(), account.clone());
        if balance.kwh < kwh {
            panic!("insufficient credit");
        }
        balance.kwh = balance.kwh.checked_sub(kwh).expect("overflow");
        balance.total_consumed = balance.total_consumed.checked_add(kwh).expect("overflow");
        env.storage()
            .instance()
            .set(&DataKey::Credit(account.clone()), &balance);
    }

    pub fn version(_env: Env) -> u32 {
        VERSION
    }

    pub fn get_balance(env: Env, account: Address) -> CreditBalance {
        env.storage()
            .instance()
            .get(&DataKey::Credit(account))
            .unwrap_or(CreditBalance {
                kwh: 0,
                total_purchased: 0,
                total_consumed: 0,
            })
    }

    pub fn price(env: Env) -> i128 {
        env.storage().instance().get(&DataKey::KwhPrice).unwrap()
    }

    pub fn payment_asset(env: Env) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::PaymentAsset)
            .unwrap()
    }
}

mod test;
