#![cfg(test)]
extern crate std;

use crate::{Referral, ReferralClient};
use soroban_sdk::{
    symbol_short,
    testutils::Address as _,
    token::{self, StellarAssetClient},
    Address, Env, Symbol, Vec,
};

const USDC: Symbol = symbol_short!("USDC");
const EURC: Symbol = symbol_short!("EURC");
const REWARD: i128 = 1_000; // 0.0001 units

fn setup<'a>(env: &Env) -> (Address, Address, Address, Address, ReferralClient<'a>) {
    env.mock_all_auths();
    let admin = Address::generate(env);
    let referrer = Address::generate(env);
    let referee = Address::generate(env);

    let usdc = env
        .register_stellar_asset_contract_v2(admin.clone())
        .address();
    let eurc = env
        .register_stellar_asset_contract_v2(admin.clone())
        .address();

    let id = env.register(Referral, (&admin, &usdc, &eurc, &REWARD));
    let contract = ReferralClient::new(env, &id);

    // Fund the reward pools held by the contract.
    for (asset, amount) in [(&usdc, &200_000), (&eurc, &200_000)] {
        let sac = StellarAssetClient::new(env, asset);
        sac.mint(&id, amount);
    }
    (admin, referrer, referee, usdc, contract)
}

fn balance(env: &Env, asset: &Address, who: &Address) -> i128 {
    token::Client::new(env, asset).balance(who)
}

#[test]
fn register_pays_nothing_until_claimed() {
    let env = Env::default();
    let (_admin, referrer, referee, usdc, contract) = setup(&env);

    let r0 = balance(&env, &usdc, &referrer);
    let e0 = balance(&env, &usdc, &referee);

    contract.register(&referrer, &referee, &USDC);
    // Invite recorded, but no payout yet.
    assert_eq!(balance(&env, &usdc, &referrer), r0);
    assert_eq!(balance(&env, &usdc, &referee), e0);
    assert_eq!(contract.referrer_of(&referee), referrer);
    assert_eq!(contract.referrer_count(&referrer), 1);
    assert!(!contract.confirmed(&referee));
    assert!(!contract.claimed(&referrer, &referee, &USDC));
}

#[test]
fn claim_requires_usage_confirmation() {
    let env = Env::default();
    let (_admin, referrer, referee, usdc, contract) = setup(&env);

    contract.register(&referrer, &referee, &USDC);
    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        contract.claim_referral(&referrer, &referee, &USDC);
    }));
    assert!(result.is_err());
    assert_eq!(balance(&env, &usdc, &referrer), 0);
    assert_eq!(balance(&env, &usdc, &referee), 0);
}

#[test]
fn both_sides_paid_after_usage_confirmed() {
    let env = Env::default();
    let (_admin, referrer, referee, usdc, contract) = setup(&env);

    contract.register(&referrer, &referee, &USDC);
    contract.confirm_usage(&referee);
    assert!(contract.confirmed(&referee));

    let r0 = balance(&env, &usdc, &referrer);
    let e0 = balance(&env, &usdc, &referee);
    contract.claim_referral(&referrer, &referee, &USDC);
    assert_eq!(balance(&env, &usdc, &referrer), r0 + REWARD);
    assert_eq!(balance(&env, &usdc, &referee), e0 + REWARD);
    assert!(contract.claimed(&referrer, &referee, &USDC));
}

#[test]
fn claim_has_no_auth_requirement() {
    let env = Env::default();
    let (admin, referrer, referee, usdc, contract) = setup(&env);

    contract.register(&referrer, &referee, &USDC);
    contract.confirm_usage(&referee);

    // No `require_auth` in claim_referral: any caller may settle a pair.
    env.mock_all_auths();
    let r0 = balance(&env, &usdc, &referrer);
    let e0 = balance(&env, &usdc, &referee);
    contract.claim_referral(&referrer, &referee, &USDC);
    assert_eq!(balance(&env, &usdc, &referrer), r0 + REWARD);
    assert_eq!(balance(&env, &usdc, &referee), e0 + REWARD);
    assert_ne!(referrer, admin);
}

#[test]
fn claim_is_idempotent() {
    let env = Env::default();
    let (_admin, referrer, referee, usdc, contract) = setup(&env);

    contract.register(&referrer, &referee, &USDC);
    contract.confirm_usage(&referee);
    contract.claim_referral(&referrer, &referee, &USDC);

    let r0 = balance(&env, &usdc, &referrer);
    let e0 = balance(&env, &usdc, &referee);
    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        contract.claim_referral(&referrer, &referee, &USDC);
    }));
    assert!(result.is_err());
    assert_eq!(balance(&env, &usdc, &referrer), r0);
    assert_eq!(balance(&env, &usdc, &referee), e0);
}

#[test]
fn claim_rejects_wrong_currency() {
    let env = Env::default();
    let (_admin, referrer, referee, usdc, contract) = setup(&env);

    contract.register(&referrer, &referee, &USDC);
    contract.confirm_usage(&referee);
    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        contract.claim_referral(&referrer, &referee, &EURC);
    }));
    assert!(result.is_err());
    assert_eq!(balance(&env, &usdc, &referrer), 0);
}

#[test]
fn eurc_payout_uses_eurc_pool() {
    let env = Env::default();
    let (_admin, referrer, referee, usdc, contract) = setup(&env);
    let eurc = contract.eurc_asset();

    contract.register(&referrer, &referee, &EURC);
    contract.confirm_usage(&referee);
    contract.claim_referral(&referrer, &referee, &EURC);
    assert_eq!(balance(&env, &eurc, &referrer), REWARD);
    assert_eq!(balance(&env, &eurc, &referee), REWARD);
    assert_eq!(balance(&env, &usdc, &referrer), 0);
}

#[test]
fn cannot_refer_yourself() {
    let env = Env::default();
    let (_admin, referrer, _referee, _usdc, contract) = setup(&env);
    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        contract.register(&referrer, &referrer, &USDC);
    }));
    assert!(result.is_err());
}

#[test]
fn one_referrer_per_referee() {
    let env = Env::default();
    let (_admin, referrer, referee, _usdc, contract) = setup(&env);
    let other = Address::generate(&env);

    contract.register(&referrer, &referee, &USDC);
    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        contract.register(&other, &referee, &USDC);
    }));
    assert!(result.is_err());
}

#[test]
fn max_five_referrals_per_wallet() {
    let env = Env::default();
    let (_admin, referrer, _referee, _usdc, contract) = setup(&env);
    let mut referees = Vec::new(&env);
    for _i in 0..5 {
        let referee = Address::generate(&env);
        referees.push_back(referee.clone());
        contract.register(&referrer, &referee, &USDC);
    }
    assert_eq!(contract.referrer_count(&referrer), 5);
    let list: Vec<Address> = contract.referees(&referrer);
    assert_eq!(list.len(), 5);

    let sixth = Address::generate(&env);
    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        contract.register(&referrer, &sixth, &USDC);
    }));
    assert!(result.is_err());
    assert_eq!(contract.referrer_count(&referrer), 5);
}

#[test]
fn unsupported_currency_rejected() {
    let env = Env::default();
    let (_admin, referrer, referee, _usdc, contract) = setup(&env);
    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        contract.register(&referrer, &referee, &symbol_short!("NGN"));
    }));
    assert!(result.is_err());
}

#[test]
fn usage_confirmation_requires_registration() {
    let env = Env::default();
    let (_admin, _referrer, referee, _usdc, contract) = setup(&env);
    let outsider = Address::generate(&env);
    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        contract.confirm_usage(&outsider);
    }));
    assert!(result.is_err());
    assert!(!contract.confirmed(&referee));
}

#[test]
fn underfunded_pool_reverts_on_claim() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let referrer = Address::generate(&env);
    let referee = Address::generate(&env);

    let usdc = env
        .register_stellar_asset_contract_v2(admin.clone())
        .address();
    let eurc = env
        .register_stellar_asset_contract_v2(admin.clone())
        .address();
    // Do NOT fund the pools.
    let id = env.register(Referral, (&admin, &usdc, &eurc, &REWARD));
    let contract = ReferralClient::new(&env, &id);

    contract.register(&referrer, &referee, &USDC);
    contract.confirm_usage(&referee);

    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        contract.claim_referral(&referrer, &referee, &USDC);
    }));
    assert!(result.is_err());
    assert_eq!(contract.referrer_count(&referrer), 1);
}
