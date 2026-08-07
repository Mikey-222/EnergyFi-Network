#![no_std]
use soroban_sdk::{
    contract, contractevent, contractimpl, contracttype, symbol_short, token, Address, Env,
    Symbol, Vec,
};

const VERSION: u32 = 2;
/// Hard cap: one wallet may refer at most 5 neighbours (anti-Sybil, keeps the
/// reward pools from being drained by freshly-created addresses).
pub const MAX_REFERRALS: u32 = 5;

#[contractevent(topics = ["referral", "joined"])]
struct ReferralJoined {
    referrer: Address,
    referee: Address,
}

#[contractevent(topics = ["referral", "usage_confirmed"])]
struct UsageConfirmed {
    referee: Address,
}

#[contractevent(topics = ["referral", "paid_referrer"])]
struct ReferrerPaid {
    referrer: Address,
    referee: Address,
    currency: Symbol,
    reward: i128,
}

#[contractevent(topics = ["referral", "paid_referee"])]
struct RefereePaid {
    referee: Address,
    referrer: Address,
    currency: Symbol,
    reward: i128,
}

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Admin,
    UsdcAsset,
    EurcAsset,
    Reward,
    /// referee -> referrer (a wallet can only be referred once).
    Referrer(Address),
    /// referrer -> list of referees they invited.
    Referees(Address),
    /// referee -> currency of their pending invite (first invite wins).
    Currency(Address),
    /// referee -> usage confirmed by the referee's own wallet (anti-farming
    /// gate: rewards only unlock after the referee actually uses the app).
    Confirmed(Address),
    /// (referrer, referee, currency) -> payout already made.
    Claimed(Address, Address, Symbol),
}

#[contract]
pub struct Referral;

#[contractimpl]
impl Referral {
    /// Initialize. `usdc_asset`/`eurc_asset` are the Stellar Asset Contracts the
    /// rewards are paid from; `reward` is the per-referral amount in stroops
    /// (0.0001 USDC/EURC = 1_000 stroops). The admin funds both pools by
    /// transferring tokens into this contract.
    pub fn __constructor(
        env: Env,
        admin: Address,
        usdc_asset: Address,
        eurc_asset: Address,
        reward: i128,
    ) {
        if reward <= 0 {
            panic!("invalid reward");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::UsdcAsset, &usdc_asset);
        env.storage().instance().set(&DataKey::EurcAsset, &eurc_asset);
        env.storage().instance().set(&DataKey::Reward, &reward);
    }

    /// Links a neighbour's wallet address to the caller's. No payout yet: the
    /// invite stays pending until the referee confirms app usage and the
    /// reward is claimed (both sides then get `reward` in the chosen
    /// currency).
    ///
    /// Guards: no self-referrals, one referee per wallet (first referrer
    /// wins), max `MAX_REFERRALS` referees per referrer.
    pub fn register(env: Env, referrer: Address, referee: Address, currency: Symbol) {
        referrer.require_auth();
        if referrer == referee {
            panic!("cannot refer yourself");
        }
        if currency != symbol_short!("USDC") && currency != symbol_short!("EURC") {
            panic!("unsupported currency");
        }
        if env
            .storage()
            .persistent()
            .has(&DataKey::Referrer(referee.clone()))
        {
            panic!("referee already referred");
        }

        let mut list: Vec<Address> = env
            .storage()
            .persistent()
            .get(&DataKey::Referees(referrer.clone()))
            .unwrap_or_else(|| Vec::new(&env));
        if list.len() >= MAX_REFERRALS {
            panic!("max referrals reached");
        }

        list.push_back(referee.clone());
        let list_key = DataKey::Referees(referrer.clone());
        env.storage().persistent().set(&list_key, &list);
        env.storage()
            .persistent()
            .extend_ttl(&list_key, 5000, 10000);
        let referral_key = DataKey::Referrer(referee.clone());
        env.storage()
            .persistent()
            .set(&referral_key, &referrer.clone());
        env.storage()
            .persistent()
            .extend_ttl(&referral_key, 5000, 10000);
        let currency_key = DataKey::Currency(referee.clone());
        env.storage().persistent().set(&currency_key, &currency);

        ReferralJoined {
            referrer,
            referee,
        }
        .publish(&env);
    }

    /// The referee's own wallet confirms that they are actively using the app.
    /// This is the anti-farming gate: an invite earns nothing until the
    /// referee signs this. Only a wallet that has been invited can confirm.
    pub fn confirm_usage(env: Env, referee: Address) {
        referee.require_auth();
        if !env.storage().persistent().has(&DataKey::Referrer(referee.clone())) {
            panic!("referee not referred");
        }
        let key = DataKey::Confirmed(referee.clone());
        env.storage().persistent().set(&key, &true);
        env.storage().persistent().extend_ttl(&key, 5000, 10000);
        UsageConfirmed { referee }.publish(&env);
    }

    /// Pays `reward` to BOTH the referrer and the referee — but only once the
    /// referee has confirmed app usage. Anyone may call (the app does it for
    /// either side); the payout is idempotent per (referrer, referee,
    /// currency). The whole call reverts if the chosen currency pool is
    /// underfunded.
    pub fn claim_referral(
        env: Env,
        referrer: Address,
        referee: Address,
        currency: Symbol,
    ) {
        if currency != symbol_short!("USDC") && currency != symbol_short!("EURC") {
            panic!("unsupported currency");
        }
        let stored_referrer: Address = env
            .storage()
            .persistent()
            .get(&DataKey::Referrer(referee.clone()))
            .expect("referee not referred");
        if stored_referrer != referrer {
            panic!("referrer mismatch");
        }
        let stored_currency: Symbol = env
            .storage()
            .persistent()
            .get(&DataKey::Currency(referee.clone()))
            .expect("no pending invite");
        if stored_currency != currency {
            panic!("currency mismatch with invite");
        }
        if !env
            .storage()
            .persistent()
            .get(&DataKey::Confirmed(referee.clone()))
            .unwrap_or(false)
        {
            panic!("referee has not confirmed app usage");
        }
        let claimed_key = DataKey::Claimed(referrer.clone(), referee.clone(), currency.clone());
        if env.storage().persistent().has(&claimed_key) {
            panic!("reward already claimed");
        }

        let reward: i128 = env.storage().instance().get(&DataKey::Reward).unwrap();
        let asset: Address = if currency == symbol_short!("USDC") {
            env.storage()
                .instance()
                .get(&DataKey::UsdcAsset)
                .unwrap()
        } else {
            env.storage()
                .instance()
                .get(&DataKey::EurcAsset)
                .unwrap()
        };

        let pool = env.current_contract_address();
        let token_client = token::Client::new(&env, &asset);
        token_client.transfer(&pool, &referrer, &reward);
        token_client.transfer(&pool, &referee, &reward);

        env.storage()
            .persistent()
            .set(&claimed_key, &true);
        env.storage()
            .persistent()
            .extend_ttl(&claimed_key, 5000, 10000);

        ReferrerPaid {
            referrer: referrer.clone(),
            referee: referee.clone(),
            currency: currency.clone(),
            reward,
        }
        .publish(&env);
        RefereePaid {
            referee,
            referrer,
            currency,
            reward,
        }
        .publish(&env);
    }

    pub fn version(_env: Env) -> u32 {
        VERSION
    }

    pub fn reward(env: Env) -> i128 {
        env.storage().instance().get(&DataKey::Reward).unwrap()
    }

    pub fn max_referrals(_env: Env) -> u32 {
        MAX_REFERRALS
    }

    pub fn usdc_asset(env: Env) -> Address {
        env.storage().instance().get(&DataKey::UsdcAsset).unwrap()
    }

    pub fn eurc_asset(env: Env) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::EurcAsset)
            .unwrap()
    }

    pub fn referrer_of(env: Env, referee: Address) -> Address {
        env.storage()
            .persistent()
            .get(&DataKey::Referrer(referee))
            .expect("referee not referred")
    }

    pub fn currency_of(env: Env, referee: Address) -> Symbol {
        env.storage()
            .persistent()
            .get(&DataKey::Currency(referee))
            .expect("referee not referred")
    }

    pub fn confirmed(env: Env, referee: Address) -> bool {
        env.storage()
            .persistent()
            .get(&DataKey::Confirmed(referee))
            .unwrap_or(false)
    }

    pub fn claimed(env: Env, referrer: Address, referee: Address, currency: Symbol) -> bool {
        env.storage()
            .persistent()
            .has(&DataKey::Claimed(referrer, referee, currency))
    }

    pub fn referees(env: Env, referrer: Address) -> Vec<Address> {
        env.storage()
            .persistent()
            .get(&DataKey::Referees(referrer))
            .unwrap_or_else(|| Vec::new(&env))
    }

    pub fn referrer_count(env: Env, referrer: Address) -> u32 {
        env.storage()
            .persistent()
            .get(&DataKey::Referees(referrer))
            .map(|list: Vec<Address>| list.len())
            .unwrap_or(0)
    }
}

mod test;
