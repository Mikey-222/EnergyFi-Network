#![cfg(test)]
extern crate std;

use crate::{InvestorState, Project, ProjectClient};
use soroban_sdk::{
    contract, contractimpl,
    testutils::Address as _,
    token::{self, StellarAssetClient},
    Address, Env, String,
};

/// Stand-in for the installments contract: books revenue into the project
/// pool on behalf of a `router` address, exercising the same cross-contract
/// auth path a real repayment would.
#[contract]
struct MockRouter;

#[contractimpl]
impl MockRouter {
    pub fn push_revenue(env: Env, project: Address, router: Address, amount: i128) {
        ProjectClient::new(&env, &project).route_revenue(&router, &amount);
    }
}

fn setup<'a>(env: &Env) -> (Address, Address, Address, ProjectClient<'a>) {
    env.mock_all_auths();
    let admin = Address::generate(env);
    let investor_a = Address::generate(env);
    let investor_b = Address::generate(env);

    let usdc = env
        .register_stellar_asset_contract_v2(admin.clone())
        .address();
    let usdc_admin = StellarAssetClient::new(env, &usdc);
    usdc_admin.mint(&investor_a, &10_000_000_000);
    usdc_admin.mint(&investor_b, &10_000_000_000);
    usdc_admin.mint(&admin, &50_000_000_000);

    let id = env.register(
        Project,
        (
            &admin,
            &usdc,
            10_000_000i128, // 1 USDC per share
            1_000i128,      // 1000 shares total
            &String::from_str(env, "SolarFarm Europe"),
            &String::from_str(env, "SFE"),
        ),
    );
    let project = ProjectClient::new(env, &id);
    (admin, investor_a, investor_b, project)
}

#[test]
fn invest_and_claim_dividends() {
    let env = Env::default();
    let (_admin, investor_a, investor_b, project) = setup(&env);

    // A invests 100 USDC -> 10 shares; B invests 50 USDC -> 5 shares.
    let shares_a = project.invest(&investor_a, &100_000_000);
    assert_eq!(shares_a, 10);
    let shares_b = project.invest(&investor_b, &50_000_000);
    assert_eq!(shares_b, 5);

    // Revenue: 60 USDC. A is entitled to 2/3 (40 USDC), B to 1/3 (20 USDC).
    project.deposit_revenue(&60_000_000);
    assert_eq!(project.claimable(&investor_a), 40_000_000);
    assert_eq!(project.claimable(&investor_b), 20_000_000);

    let usdc = project.payment_asset();
    let usdc_client = token::Client::new(&env, &usdc);

    let bal_before = usdc_client.balance(&investor_a);
    let payout = project.claim_dividends(&investor_a);
    assert_eq!(payout, 40_000_000);
    assert_eq!(usdc_client.balance(&investor_a) - bal_before, 40_000_000);

    // Claiming again yields nothing.
    assert_eq!(project.claim_dividends(&investor_a), 0);

    // Second revenue round: 30 USDC. A gets 20, B gets 10 (cumulative math).
    project.deposit_revenue(&30_000_000);
    assert_eq!(project.claimable(&investor_a), 20_000_000);
    assert_eq!(project.claimable(&investor_b), 30_000_000);
    project.claim_dividends(&investor_b);
    assert_eq!(project.claimable(&investor_b), 0);
}

#[test]
fn cannot_oversubscribe() {
    let env = Env::default();
    let (_admin, investor_a, _investor_b, project) = setup(&env);

    project.invest(&investor_a, &999_000_000); // 99 shares
    assert_eq!(project.total_sold(), 99);
    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        project.invest(&investor_a, &9_020_000_000); // would push total past 1000
    }));
    assert!(result.is_err());

    let state: InvestorState = project.get_investor(&investor_a);
    assert_eq!(state.shares, 99);
}

#[test]
fn amount_below_share_price_reverts() {
    let env = Env::default();
    let (_admin, investor_a, _investor_b, project) = setup(&env);

    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        project.invest(&investor_a, &5_000_000); // half a share
    }));
    assert!(result.is_err());
}

#[test]
fn revenue_deposited_before_first_invest_is_claimable() {
    let env = Env::default();
    let (_admin, investor_a, investor_b, project) = setup(&env);

    // Admin deposits 60 USDC while nobody has invested yet.
    project.deposit_revenue(&60_000_000);

    // A invests 100 USDC -> 10 shares (the only shareholder, 100% of shares sold).
    let shares_a = project.invest(&investor_a, &100_000_000);
    assert_eq!(shares_a, 10);

    // The pre-investment revenue must accrue to the first shareholder, not be
    // trapped: A can claim all 60 USDC.
    assert_eq!(project.claimable(&investor_a), 60_000_000);
    let usdc = project.payment_asset();
    let usdc_client = token::Client::new(&env, &usdc);
    let bal_before = usdc_client.balance(&investor_a);
    assert_eq!(project.claim_dividends(&investor_a), 60_000_000);
    assert_eq!(usdc_client.balance(&investor_a) - bal_before, 60_000_000);

    // A later buys 1 more share (still 100% of sold shares), a new 10 USDC
    // revenue round deposits; A is entitled to all of it minus 1 stroop of
    // truncation dust from the rev_per_share division.
    project.invest(&investor_a, &10_000_000);
    project.deposit_revenue(&10_000_000);
    assert_eq!(project.claimable(&investor_a), 9_999_999);
    project.claim_dividends(&investor_a);

    // B joins with 1 share; the 10 USDC revenue round owes B 10/11 - but it was
    // already fully claimed by A (rounding), so B's claim is 0.
    project.invest(&investor_b, &10_000_000);
    assert_eq!(project.claimable(&investor_b), 0);
}

#[test]
fn route_revenue_from_router_contract_books_revenue() {
    let env = Env::default();
    let (_admin, investor_a, investor_b, project) = setup(&env);
    let router = env.register(MockRouter, ());
    let router_client = MockRouterClient::new(&env, &router);

    project.invest(&investor_a, &100_000_000); // 10 shares
    project.invest(&investor_b, &50_000_000); // 5 shares

    // The installments contract (router) routes 30 USDC of interest.
    router_client.push_revenue(&project.address, &router, &30_000_000);
    assert_eq!(project.claimable(&investor_a), 20_000_000);
    assert_eq!(project.claimable(&investor_b), 10_000_000);

    // A second routed round accumulates on top.
    router_client.push_revenue(&project.address, &router, &15_000_000);
    assert_eq!(project.claimable(&investor_a), 30_000_000);
    assert_eq!(project.claimable(&investor_b), 15_000_000);
}

#[test]
fn route_revenue_rejects_unknown_router() {
    // Fresh env without blanket auth: require_auth must be genuinely enforced.
    let env = Env::default();
    let admin = Address::generate(&env);
    let usdc = env
        .register_stellar_asset_contract_v2(admin.clone())
        .address();
    let id = env.register(
        Project,
        (
            &admin,
            &usdc,
            10_000_000i128,
            1_000i128,
            &String::from_str(&env, "Test Pool"),
            &String::from_str(&env, "TP"),
        ),
    );
    let project = ProjectClient::new(&env, &id);
    let stranger = Address::generate(&env);

    // A wallet (or any other contract) cannot book revenue while pretending
    // to be the router: require_auth on the router address fails for a caller
    // that is not the router contract itself.
    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        project.route_revenue(&stranger, &30_000_000);
    }));
    assert!(result.is_err());
    assert_eq!(project.total_sold(), 0);
}

#[test]
fn route_revenue_before_first_invest_is_pending() {
    let env = Env::default();
    let (_admin, investor_a, _investor_b, project) = setup(&env);
    let router = env.register(MockRouter, ());
    let router_client = MockRouterClient::new(&env, &router);

    // Routed interest lands while nobody holds shares yet.
    router_client.push_revenue(&project.address, &router, &60_000_000);

    let shares_a = project.invest(&investor_a, &100_000_000);
    assert_eq!(shares_a, 10);
    assert_eq!(project.claimable(&investor_a), 60_000_000);
}

#[test]
fn route_revenue_rejects_zero_or_negative() {
    let env = Env::default();
    let (_admin, investor_a, _investor_b, project) = setup(&env);
    let router = env.register(MockRouter, ());
    let router_client = MockRouterClient::new(&env, &router);

    project.invest(&investor_a, &100_000_000);
    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        router_client.push_revenue(&project.address, &router, &0);
    }));
    assert!(result.is_err());
    assert_eq!(project.claimable(&investor_a), 0);
}
