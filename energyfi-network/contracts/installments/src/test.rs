#![cfg(test)]
extern crate std;

use crate::{EligibilityResult, Financing, Installments, InstallmentsClient, Product};
use energyfi_project::{Project, ProjectClient};
use soroban_sdk::{
    symbol_short,
    testutils::{Address as _, Ledger},
    token::{self, StellarAssetClient},
    Address, Env, String, Symbol,
};

const X200: Symbol = symbol_short!("X200");
const X300: Symbol = symbol_short!("X300");

fn register_project<'a>(
    env: &Env,
    admin: &Address,
    usdc: &Address,
) -> (Address, ProjectClient<'a>) {
    let id = env.register(
        Project,
        (
            admin,
            usdc,
            10_000_000i128, // 1 USDC per share
            100_000_000i128, // 100M shares total
            &String::from_str(env, "Test Pool"),
            &String::from_str(env, "TP"),
        ),
    );
    (id.clone(), ProjectClient::new(env, &id))
}

fn setup<'a>(env: &Env) -> (Address, Address, Address, Address, InstallmentsClient<'a>, ProjectClient<'a>) {
    env.mock_all_auths();
    let admin = Address::generate(env);
    let provider = Address::generate(env);
    let buyer = Address::generate(env);

    let usdc = env
        .register_stellar_asset_contract_v2(admin.clone())
        .address();
    let usdc_admin = StellarAssetClient::new(env, &usdc);
    usdc_admin.mint(&buyer, &10_000_000_000);

    let (project_id, project) = register_project(env, &admin, &usdc);
    let id = env.register(Installments, (&admin, &usdc, &project_id));
    let contract = InstallmentsClient::new(env, &id);
    (admin, provider, buyer, project_id, contract, project)
}

#[test]
fn secured_loan_rejects_sign_without_pledge() {
    let env = Env::default();
    let (_admin, provider, buyer, _project_id, contract, _project) = setup(&env);

    // 100 USDC secured loan needs >= 25 USDC in pool savings to even sign.
    contract.register_product(&provider, &X200, &100_000_000, &9_200_000, &12, &0);
    contract.set_collateral_required(&provider, &X200, &true);

    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        contract.start_financing(&buyer, &X200);
    }));
    assert!(result.is_err(), "secured loan must not start without the pledge");

    // Unsecured (BNPL) product signed without savings stays allowed.
    contract.register_product(&provider, &X300, &100_000_000, &9_200_000, &12, &0);
    contract.start_financing(&buyer, &X300);
}

#[test]
fn secured_loan_starts_when_pledge_is_held() {
    let env = Env::default();
    let (_admin, provider, buyer, _project_id, contract, project) = setup(&env);

    contract.register_product(&provider, &X200, &100_000_000, &9_200_000, &12, &0);
    contract.set_collateral_required(&provider, &X200, &true);

    // 25% stake (25 USDC) is enough to start the secured loan.
    project.invest(&buyer, &250_000_000);
    contract.start_financing(&buyer, &X200);
    let financing: Financing = contract.get_financing(&buyer, &X200);
    assert_eq!(financing.total_paid, 0);
}

#[test]
fn only_provider_can_flip_collateral_required() {
    let env = Env::default();
    let (admin, provider, _buyer, _project_id, contract, _project) = setup(&env);

    contract.register_product(&provider, &X200, &100_000_000, &9_200_000, &12, &0);
    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        contract.set_collateral_required(&admin, &X200, &true);
    }));
    assert!(result.is_err());
}

#[test]
fn financing_lifecycle() {
    let env = Env::default();
    let (_admin, provider, buyer, _project_id, contract, _project) = setup(&env);
    let usdc = contract.payment_asset();

    // Product: 900 USDC, 30 USDC/mo for 20 months, no deposit.
    contract.register_product(&provider, &X200, &90_000_000, &3_000_000, &20, &0);
    let product: Product = contract.get_product(&X200);
    assert_eq!(product.price, 90_000_000);

    // Buyer starts financing and pays installments.
    contract.start_financing(&buyer, &X200);
    for _ in 0..5 {
        contract.pay_installment(&buyer, &X200);
    }

    let financing: Financing = contract.get_financing(&buyer, &X200);
    assert_eq!(financing.installments_paid, 5);
    assert_eq!(financing.total_paid, 15_000_000);

    // Provider withdraws settled amount (5 x 30 USDC = 150 USDC minus 1% fee).
    let usdc_client = token::Client::new(&env, &usdc);
    let provider_balance_before = usdc_client.balance(&provider);
    contract.withdraw(&provider, &X200);
    let provider_balance_after = usdc_client.balance(&provider);
    assert_eq!(provider_balance_after - provider_balance_before, 15_000_000 - 150_000);

    // Provider cannot withdraw twice.
    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        contract.withdraw(&provider, &X200);
    }));
    assert!(result.is_err());
}

#[test]
fn cannot_pay_more_than_term() {
    let env = Env::default();
    let (_admin, provider, buyer, _project_id, contract, _project) = setup(&env);

    contract.register_product(&provider, &X200, &60_000_000, &6_000_000, &2, &0);
    contract.start_financing(&buyer, &X200);
    contract.pay_installment(&buyer, &X200);
    contract.pay_installment(&buyer, &X200);
    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        contract.pay_installment(&buyer, &X200);
    }));
    assert!(result.is_err());
}

#[test]
fn deposit_is_collected() {
    let env = Env::default();
    let (_admin, provider, buyer, _project_id, contract, _project) = setup(&env);
    let usdc = contract.payment_asset();

    contract.register_product(&provider, &X200, &90_000_000, &3_000_000, &20, &10_000_000);
    contract.start_financing(&buyer, &X200);

    let financing: Financing = contract.get_financing(&buyer, &X200);
    assert_eq!(financing.total_paid, 10_000_000);

    let usdc_client = token::Client::new(&env, &usdc);
    assert_eq!(usdc_client.balance(&contract.address), 10_000_000);
}

#[test]
fn loan_principal_is_disbursed_to_buyer() {
    let env = Env::default();
    let (_admin, provider, buyer, _project_id, contract, project) = setup(&env);
    let usdc = contract.payment_asset();
    let usdc_client = token::Client::new(&env, &usdc);

    // Loan: 100 USDC principal, 9.2 USDC/mo x 12, no deposit.
    contract.register_product(&provider, &X200, &100_000_000, &9_200_000, &12, &0);
    contract.start_financing(&buyer, &X200);

    // Soft collateral: buyer first saves 100 USDC in the pool (10 shares),
    // pledging 25%+ of the principal.
    project.invest(&buyer, &100_000_000);

    // Pool tops up the escrow with 100 USDC.
    let sac = StellarAssetClient::new(&env, &usdc);
    sac.mint(&contract.address, &100_000_000);

    let buyer_before = usdc_client.balance(&buyer);
    contract.disburse_loan(&buyer, &X200);
    assert_eq!(usdc_client.balance(&buyer), buyer_before + 100_000_000);

    let financing: Financing = contract.get_financing(&buyer, &X200);
    assert!(financing.disbursed);
    assert_eq!(financing.principal_outstanding, 100_000_000);

    // Installments reduce the outstanding principal.
    contract.pay_installment(&buyer, &X200);
    let financing: Financing = contract.get_financing(&buyer, &X200);
    assert_eq!(financing.principal_outstanding, 100_000_000 - 9_200_000);
    assert_eq!(financing.installments_paid, 1);
}

#[test]
fn loan_cannot_be_disbursed_twice() {
    let env = Env::default();
    let (_admin, provider, buyer, _project_id, contract, project) = setup(&env);
    let usdc = contract.payment_asset();

    contract.register_product(&provider, &X200, &100_000_000, &9_200_000, &12, &0);
    contract.start_financing(&buyer, &X200);
    project.invest(&buyer, &100_000_000);
    StellarAssetClient::new(&env, &usdc).mint(&contract.address, &100_000_000);

    contract.disburse_loan(&buyer, &X200);
    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        contract.disburse_loan(&buyer, &X200);
    }));
    assert!(result.is_err());
}

#[test]
fn loan_cannot_be_disbursed_without_financing() {
    let env = Env::default();
    let (_admin, provider, _buyer, _project_id, contract, _project) = setup(&env);

    contract.register_product(&provider, &X200, &100_000_000, &9_200_000, &12, &0);
    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        contract.disburse_loan(&Address::generate(&env), &X200);
    }));
    assert!(result.is_err());
}

#[test]
fn fees_accrue_on_withdraw_and_admin_can_claim() {
    let env = Env::default();
    let (admin, provider, buyer, _project_id, contract, _project) = setup(&env);
    let usdc = contract.payment_asset();
    let usdc_client = token::Client::new(&env, &usdc);

    contract.register_product(&provider, &X200, &100_000_000, &9_200_000, &12, &0);
    contract.start_financing(&buyer, &X200);
    for _ in 0..5 {
        contract.pay_installment(&buyer, &X200);
    }

    // 5 x 9.2 = 46 USDC paid; the interest portion (10.4 USDC total, 866666
    // per installment) is routed to the pool, so the settled corpus is
    // 5 x 8333334 = 41666670 -> 1% fee = 416666 USDC.
    contract.withdraw(&provider, &X200);
    assert_eq!(contract.fees_owed(), 416_666);

    // Admin claims the full accrued fee into their wallet.
    let admin_before = usdc_client.balance(&admin);
    contract.claim_fees(&admin, &416_666);
    assert_eq!(usdc_client.balance(&admin), admin_before + 416_666);
    assert_eq!(contract.fees_owed(), 0);
}

#[test]
fn only_admin_can_claim_fees() {
    let env = Env::default();
    let (_admin, provider, buyer, _project_id, contract, _project) = setup(&env);
    let stranger = Address::generate(&env);

    contract.register_product(&provider, &X200, &100_000_000, &9_200_000, &12, &0);
    contract.start_financing(&buyer, &X200);
    contract.pay_installment(&buyer, &X200);
    contract.withdraw(&provider, &X200);

    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        contract.claim_fees(&stranger, &83_333);
    }));
    assert!(result.is_err());
    assert_eq!(contract.fees_owed(), 83_333);
}

#[test]
fn cannot_claim_more_than_accrued_fees() {
    let env = Env::default();
    let (admin, provider, buyer, _project_id, contract, _project) = setup(&env);

    contract.register_product(&provider, &X200, &100_000_000, &9_200_000, &12, &0);
    contract.start_financing(&buyer, &X200);
    contract.pay_installment(&buyer, &X200);
    contract.withdraw(&provider, &X200);

    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        contract.claim_fees(&admin, &1_000_000);
    }));
    assert!(result.is_err());
    assert_eq!(contract.fees_owed(), 83_333);
}

#[test]
fn loan_requires_savings_pledge() {
    let env = Env::default();
    let (_admin, provider, buyer, _project_id, contract, project) = setup(&env);
    let usdc = contract.payment_asset();

    // 200 USDC loan needs >= 50 USDC (25%) in pool savings.
    contract.register_product(&provider, &X200, &200_000_000, &18_400_000, &12, &0);
    contract.start_financing(&buyer, &X200);
    StellarAssetClient::new(&env, &usdc).mint(&contract.address, &200_000_000);

    // No savings at all -> blocked.
    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        contract.disburse_loan(&buyer, &X200);
    }));
    assert!(result.is_err());

    // 30 USDC of savings -> max loan 120 USDC -> still blocked.
    project.invest(&buyer, &30_000_000);
    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        contract.disburse_loan(&buyer, &X200);
    }));
    assert!(result.is_err());

    // 50 USDC total -> max loan 200 USDC -> boundary passes.
    project.invest(&buyer, &20_000_000);
    contract.disburse_loan(&buyer, &X200);
    assert_eq!(contract.borrower_count(), 1);
}

#[test]
fn mark_late_settle_and_clear_default() {
    let env = Env::default();
    let (admin, provider, buyer, _project_id, contract, project) = setup(&env);
    let usdc = contract.payment_asset();
    let stranger = Address::generate(&env);

    contract.register_product(&provider, &X200, &200_000_000, &18_400_000, &12, &0);
    contract.register_product(&provider, &X300, &100_000_000, &9_200_000, &12, &0);
    let x400: Symbol = symbol_short!("X400");
    contract.register_product(&provider, &x400, &50_000_000, &4_600_000, &12, &0);
    contract.start_financing(&buyer, &X200);
    project.invest(&buyer, &100_000_000);
    StellarAssetClient::new(&env, &usdc).mint(&contract.address, &200_000_000);
    contract.disburse_loan(&buyer, &X200);

    // Not disbursed yet -> mark_late rejected.
    contract.start_financing(&buyer, &X300);
    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        contract.mark_late(&admin, &buyer, &X300);
    }));
    assert!(result.is_err());

    // Only the admin can flag late.
    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        contract.mark_late(&stranger, &buyer, &X200);
    }));
    assert!(result.is_err());

    contract.mark_late(&admin, &buyer, &X200);
    let financing: Financing = contract.get_financing(&buyer, &X200);
    assert_eq!(financing.late, 1);

    // Settle default -> flag set, indexed, and new loans blocked.
    contract.settle_default(&admin, &buyer, &X200);
    assert!(contract.is_defaulted(&buyer));
    assert_eq!(contract.defaulted_count(), 1);
    assert_eq!(contract.defaulted_at(&0), buyer);

    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        contract.start_financing(&buyer, &x400);
    }));
    assert!(result.is_err());

    // Only the admin can clear; clearing restores access.
    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        contract.clear_default(&stranger, &buyer);
    }));
    assert!(result.is_err());
    contract.clear_default(&admin, &buyer);
    assert!(!contract.is_defaulted(&buyer));
    assert_eq!(contract.defaulted_count(), 0);

    contract.start_financing(&buyer, &x400);
}

#[test]
fn eligibility_reflects_savings_and_default() {
    let env = Env::default();
    let (admin, provider, buyer, _project_id, contract, project) = setup(&env);
    let usdc = contract.payment_asset();
    let stranger = Address::generate(&env);

    contract.register_product(&provider, &X200, &200_000_000, &18_400_000, &12, &0);

    // No savings -> not eligible, honest reasons.
    let r: EligibilityResult = contract.check_eligibility(&stranger, &X200);
    assert!(!r.eligible);
    assert!(!r.defaulted);
    assert_eq!(r.savings, 0);
    assert_eq!(r.principal, 200_000_000);
    assert_eq!(r.required_pledge, 50_000_000);

    // 100 USDC of savings -> eligible, max loan 400 USDC.
    project.invest(&buyer, &100_000_000);
    let r: EligibilityResult = contract.check_eligibility(&buyer, &X200);
    assert!(r.eligible);
    assert_eq!(r.savings, 100_000_000);
    assert_eq!(r.max_principal, 400_000_000);

    // After a default -> permanently rejected.
    contract.start_financing(&buyer, &X200);
    StellarAssetClient::new(&env, &usdc).mint(&contract.address, &200_000_000);
    contract.disburse_loan(&buyer, &X200);
    contract.settle_default(&admin, &buyer, &X200);
    let r: EligibilityResult = contract.check_eligibility(&buyer, &X200);
    assert!(!r.eligible);
    assert!(r.defaulted);
}

#[test]
fn installments_route_interest_to_pool_automatically() {
    let env = Env::default();
    let (_admin, provider, buyer, _project_id, contract, project) = setup(&env);
    let usdc = contract.payment_asset();
    let usdc_client = token::Client::new(&env, &usdc);
    let saver = Address::generate(&env);
    StellarAssetClient::new(&env, &usdc).mint(&saver, &10_000_000_000);

    // Loan: 200 USDC at 18.4/mo x 12 -> 20.8 USDC total interest,
    // 1733333 per installment.
    contract.register_product(&provider, &X200, &200_000_000, &18_400_000, &12, &0);
    contract.start_financing(&buyer, &X200);

    // A saver holds 10 of the pool's 10 sold shares -> all routed interest.
    project.invest(&saver, &100_000_000);

    for _ in 0..3 {
        contract.pay_installment(&buyer, &X200);
    }

    // 3 x 1733333 = 5199999 USDC moved into the pool and booked as revenue
    // (pool balance = saver's 100 USDC principal + the routed interest).
    assert_eq!(usdc_client.balance(&project.address), 105_199_999);
    assert_eq!(project.claimable(&saver), 5_199_999);

    // The saver can claim the real routed money.
    let bal_before = usdc_client.balance(&saver);
    assert_eq!(project.claim_dividends(&saver), 5_199_999);
    assert_eq!(usdc_client.balance(&saver), bal_before + 5_199_999);

    // Provider corpus: only the principal portion (3 x 16666667 = 50000001).
    let product: Product = contract.get_product(&X200);
    assert_eq!(product.total_paid, 50_000_001);
    assert_eq!(usdc_client.balance(&contract.address), 50_000_001);

    // Borrower-side accounting keeps the full monthly payments.
    let financing: Financing = contract.get_financing(&buyer, &X200);
    assert_eq!(financing.total_paid, 55_200_000);
    assert_eq!(financing.installments_paid, 3);
}

#[test]
fn zero_interest_product_routes_nothing() {
    let env = Env::default();
    let (_admin, provider, buyer, _project_id, contract, project) = setup(&env);
    let usdc = contract.payment_asset();
    let usdc_client = token::Client::new(&env, &usdc);
    let saver = Address::generate(&env);
    StellarAssetClient::new(&env, &usdc).mint(&saver, &10_000_000_000);

    // 90 USDC at 4.5/mo x 20 -> exactly 90 USDC: no interest at all.
    contract.register_product(&provider, &X200, &90_000_000, &4_500_000, &20, &0);
    contract.start_financing(&buyer, &X200);
    project.invest(&saver, &100_000_000);

    contract.pay_installment(&buyer, &X200);
    contract.pay_installment(&buyer, &X200);

    // Pool balance is just the saver's locked principal: no interest existed
    // to route.
    assert_eq!(usdc_client.balance(&project.address), 100_000_000);
    assert_eq!(project.claimable(&saver), 0);
    let product: Product = contract.get_product(&X200);
    assert_eq!(product.total_paid, 9_000_000);
}

#[test]
fn financing_records_started_at() {
    let env = Env::default();
    let (_admin, provider, buyer, _project_id, contract, _project) = setup(&env);

    env.ledger().set_timestamp(1_700_000_000);
    contract.register_product(&provider, &X200, &200_000_000, &18_400_000, &12, &0);
    contract.start_financing(&buyer, &X200);
    let financing: Financing = contract.get_financing(&buyer, &X200);
    assert_eq!(financing.started_at, 1_700_000_000);
}

#[test]
fn payoff_loan_settles_remaining_balance_at_once() {
    let env = Env::default();
    let (_admin, provider, buyer, _project_id, contract, project) = setup(&env);
    let usdc = contract.payment_asset();
    let usdc_client = token::Client::new(&env, &usdc);
    let saver = Address::generate(&env);
    StellarAssetClient::new(&env, &usdc).mint(&saver, &10_000_000_000);

    // Loan: 200 USDC at 18.4/mo x 12 -> 1,733,333 interest per installment.
    contract.register_product(&provider, &X200, &200_000_000, &18_400_000, &12, &0);
    contract.start_financing(&buyer, &X200);
    project.invest(&saver, &100_000_000);

    // Pay one installment, then clear the remaining 11 months in one shot (184.4 USDC).
    contract.pay_installment(&buyer, &X200);
    let before = usdc_client.balance(&buyer);
    contract.payoff_loan(&buyer, &X200);
    assert_eq!(usdc_client.balance(&buyer), before - 202_400_000);

    let financing: Financing = contract.get_financing(&buyer, &X200);
    assert_eq!(financing.installments_paid, 12);
    assert_eq!(financing.total_paid, 220_800_000);
    assert_eq!(financing.principal_outstanding, 0);
    assert_eq!(financing.late, 0);

    // All interest for the term reached the pool (12 x the 1,733,333 floor
    // = 20,799,996) and is claimable by the saver.
    assert_eq!(usdc_client.balance(&project.address), 120_799_996);
    assert_eq!(project.claimable(&saver), 20_799_996);

    // Principal-only corpus: 12 x 16,666,667 = 200,000,004 (1 stroop of
    // per-payment floor dust).
    let product: Product = contract.get_product(&X200);
    assert_eq!(product.total_paid, 200_000_004);

    // Completed loan cannot be paid or paid off again.
    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        contract.payoff_loan(&buyer, &X200);
    }));
    assert!(result.is_err());
}

#[test]
fn routed_interest_keeps_provider_withdraw_solvent() {
    let env = Env::default();
    let (_admin, provider, buyer, _project_id, contract, project) = setup(&env);
    let usdc = contract.payment_asset();
    let usdc_client = token::Client::new(&env, &usdc);
    let saver = Address::generate(&env);
    StellarAssetClient::new(&env, &usdc).mint(&saver, &10_000_000_000);

    contract.register_product(&provider, &X200, &200_000_000, &18_400_000, &12, &0);
    contract.start_financing(&buyer, &X200);
    project.invest(&saver, &100_000_000);

    for _ in 0..3 {
        contract.pay_installment(&buyer, &X200);
    }

    // Withdraw pays the provider the principal corpus (minus 1% fee), even
    // though the interest already left the contract for the pool.
    let before = usdc_client.balance(&provider);
    contract.withdraw(&provider, &X200);
    // 50000001 - 500000 fee = 49500001.
    assert_eq!(usdc_client.balance(&provider) - before, 49_500_001);
    assert_eq!(contract.fees_owed(), 500_000);
    // Only the withheld fee remains in the contract (claimable by admin).
    assert_eq!(usdc_client.balance(&contract.address), 500_000);
}
