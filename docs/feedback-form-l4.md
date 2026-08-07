# L4.3 Feedback Form (draft)

Create a Google Form with these questions, then paste the shareable link into
`dev-server/src/lib/energyfi/config.ts` (`FEEDBACK_FORM_URL`)
and add a "Feedback" link in the app (profile screen). Responses get summarized
in `docs/feedback-l4.md`.

## Form settings

- Title: "EnergyFi Testnet — Feedback"
- Collect emails: no (keep it short and private)
- Send responses to: the EnergyFi team inbox

## Questions

1. **How did you first get testnet USDC?** (Multiple choice)
   - Circle faucet (faucet.circle.com)
   - Friend / team member
   - Other: ____

2. **Which feature did you try?** (Checkboxes)
   - Buy energy credits
   - Finance a solar product (installments)
   - Invest in SolarFarm Europe
   - Top up / wallet

3. **Rate the product** (Linear scale 1–5, 1 = terrible, 5 = excellent)

4. **What did you like most?** (Paragraph)

5. **What was confusing or broken?** (Paragraph) — include wallet address if
   a transaction failed

6. **What feature should we build next?** (Paragraph)

7. **Would you use this on mainnet?** (Multiple choice)
   - Yes, for home energy
   - Yes, as an investor
   - Maybe
   - No: ____

## Onboarding checklist (what to record as proof)

- [ ] Share form link + app URL + faucet instructions with 10+ people
- [ ] Collect wallet addresses; verify activity via
      https://horizon-testnet.stellar.org/accounts/<address>/payments
- [ ] Copy responses into `docs/feedback-l4.md` with dates
