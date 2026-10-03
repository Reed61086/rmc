---
title: rmc
emoji: 🐳
colorFrom: yellow
colorTo: blue
sdk: static
pinned: false
tags:
  - deepsite
---

Check out the configuration reference at https://huggingface.co/docs/hub/spaces-config-reference

## Calculator

Static responsive HTML/CSS/JavaScript. Both modes default to a 2% margin.
Borrower inputs stay on the device; no borrower data is sent to the rate provider.

### Calculation correction
- Initial rate: published weekly 1-year CMT + margin.
- Expected rate: published weekly 10-year CMT + margin, used for HUD PLF lookup.
- Official HUD General Table ages 62–99 replaces the fitted approximation. Rates
  round to the nearest 0.125%; unsupported ages/rates block calculation.
- Refinance repair reserve: 150% of estimated repairs. Additional repair fee is
  explicit, defaults to zero and must not duplicate third-party fees.
- Mandatory obligations: payoff + closing costs + repair reserve.
- Initial disbursement limit: min(principal limit, max(60% of principal limit,
  mandatory obligations + 10% of principal limit)).
- Additional first-year cash: max(0, min(net available, disbursement limit minus
  mandatory obligations)). A shortage remains visible instead of negative cash.
- Assumes zero initial cash draw, LESA, servicing reserve and additional
  property-charge obligations. Repair eligibility requires lender review.
  Purchase hides repair inputs and does not carry refinance repair reserves.
- Historical/manual mode is explicitly labeled and never saved as current CMT.
  Reports freeze amounts, both rate assumptions, provenance and HUD lookup rate.

### Published rates
The same-origin data/cmt-weekly.json contains both H.15 weekly maturities for
one week ending Friday, supplied by the Federal Reserve via FRED WGS1YR/WGS10YR.
scripts/update-cmt.py validates the complete pair and preserves the previous asset
on failed, contradictory, future, stale or regressed responses. Revisions for an
existing observation require review. No fitted or daily-as-weekly fallback exists.

.github/workflows/weekly-cmt.yml runs weekdays at 23:15 UTC and on manual dispatch,
commits only the rate asset and explicitly requests a Pages rebuild. This host
workflow must be verified after merge; its remote execution is not yet proven.
A failed job remains visible in Actions. The UI labels cached, failed or stale
rates historical; without a complete pair automatic estimates are blocked.
Observations older than 10 calendar days or provider checks older than four days
are stale. Startup, foreground, reconnect and visible 15-minute checks share one
request; requests time out after 10 seconds. The asset contains source and check
timestamps; a browser refresh alone does not refresh the upstream provider.

### Sources and reproducibility
HUD workbook:
https://www.hud.gov/sites/dfiles/SFH/documents/FY%202018%20PLF%20Tables-Rvsd%20Introduction.xls
Table version HUD-2017-10-02; SHA256:
37eff5199bbaa2127325ad83b36b9568d31db0f131f9d2e1c2e94e088724a890.
Regenerate data/hud-plf.js with scripts/extract-plf.py and authoring-only xlrd 2.0.2;
xlrd is not an app or rate-job dependency.
HUD nearest-eighth lookup: https://entp.hud.gov/sfohlp/f17hcmcalcprhlpp.cfm
Federal rules: 24 CFR 206.3, 206.19 and 206.25.

Historical borrower regression (attached RMI report): age 79, home $300,000,
payoff $80,000, repairs $6,000, third-party fees $2,459, margin 2%, 1-year CMT
4.15%, 10-year CMT 4.78%. Expected rate 6.78% looks up at 6.75%, PLF .444:
principal $133,200, costs $13,459, reserve $9,000, obligations $102,459,
disbursement limit $115,779, net $30,741, additional first-year cash $13,320.
These historical inputs are not represented as current published rates.

## Verification
Node 20+ and installed Chrome (or BROWSER_CHANNEL=msedge):
npm ci
npm test
python tests/update-cmt.test.py
npm run test:browser

Set LIVE_CMT=1 for browser verification against the locally validated published
rate asset. Browser tests route the Pages origin to local candidate files and do
not deploy. Screenshots/PDFs are ignored under test-results/.

## Remaining limitations and rollback
Configured lending cap $1,209,750 is preserved from the previous implementation;
it is not the 2026 limit and is not refreshed by CMT. Annual cap policy is the next
separate correction. Purchase required investment still excludes third-party fees;
budget separately. No projections, underwriting eligibility decisions, borrower
contact, lifecycle changes or database migrations are introduced.

After merge verify Pages assets and the scheduled workflow including its requested
Pages build. Rollback: revert this correction commit and disable the new weekly
workflow if it has been activated. Baseline is merge commit
1690439229fba00deee2e5b42097b36cb902f8aa. The old approximation/first-year formula
would return after rollback and must not be represented as corrected.
