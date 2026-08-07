#![cfg(test)]
extern crate std;

use crate::{CreditBalance, EnergyCredit, EnergyCreditClient};
use soroban_sdk::{
    testutils::Address as _,
    token::{self, StellarAssetClient},
    Address, Env, String,
};

fn setup<'a>(env: &Env) -> (Address, Address, Address, EnergyCreditClient<'a>) {
    env.mock_all_auths();
    let admin = Address::generate(env);
    let buyer = Address::generate(env);

    let usdc = env.register_stellar_asset_contract_v2(admin.clone()).address();
    let usdc_admin = StellarAssetClient::new(env, &usdc);
    usdc_admin.mint(&buyer, &10_000_000_000); // 10,000 USDC

    let credit_id = env.register(
        EnergyCredit,
        (
            &admin,
            &usdc,
            15_000_000i128, // 0.15 USDC per kWh (1 USDC = 10^7 stroops)
            &String::from_str(env, "EnergyFi Credit"),
            &String::from_str(env, "EFC"),
        ),
    );
    let credit = EnergyCreditClient::new(env, &credit_id);
    (admin, buyer, usdc, credit)
}

#[test]
fn buy_and_consume_credits() {
    let env = Env::default();
    let (_admin, buyer, usdc, credit) = setup(&env);

    let kwh = 100_i128;
    credit.buy_credits(&buyer, &kwh);

    let balance: CreditBalance = credit.get_balance(&buyer);
    assert_eq!(balance.kwh, 100);
    assert_eq!(balance.total_purchased, 100);

    let usdc_client = token::Client::new(&env, &usdc);
    assert_eq!(usdc_client.balance(&credit.address), 15 * 100 * 1_000_000);

    // Consume half.
    credit.consume_credits(&buyer, &40);
    let balance: CreditBalance = credit.get_balance(&buyer);
    assert_eq!(balance.kwh, 60);
    assert_eq!(balance.total_consumed, 40);
}

#[test]
fn cannot_overconsume() {
    let env = Env::default();
    let (_admin, buyer, _usdc, credit) = setup(&env);

    credit.buy_credits(&buyer, &10);
    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        credit.consume_credits(&buyer, &11);
    }));
    assert!(result.is_err());
}

#[test]
fn admin_can_change_price() {
    let env = Env::default();
    let (_admin, _buyer, _usdc, credit) = setup(&env);

    assert_eq!(credit.price(), 15_000_000);
    credit.set_price(&20_000_000);
    assert_eq!(credit.price(), 20_000_000);
}
