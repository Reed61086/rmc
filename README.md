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

Static HTML/CSS/JavaScript, with no runtime dependencies or backend. Open through
an HTTP server (`python -m http.server 8000`) or the existing GitHub Pages host.

- Both refinance and purchase start with a 2% lender margin. A user adjustment is
  saved on that device and is independent of the Treasury refresh.
- `rates.js` reads the official Treasury nominal par-yield XML feed's `BC_10YEAR`
  field, using the newest valid observation. January can fall back to the previous
  year when no current-year observation is available.
- Checks run on startup, foreground, reconnection and every 15 minutes while
  visible. Requests are single-flight and throttled to 15 minutes, including the
  Refresh button. Each feed request has a 10-second timeout and one retry.
- Rates show observation date and verification status. Observations over 7 calendar
  days old are labeled historical; saved observations are historical until checked.
  Failed refreshes retain a labeled historical estimate. Without a valid rate,
  estimates and report generation are blocked. No hard-coded rate fallback exists.
- Legacy saved manual CMT is ignored. Borrower inputs remain local and are never
  sent to Treasury. A rate cache contains only rate/date/source/retrieval metadata.
- Reports snapshot inputs, outputs and rate provenance at opening. Printing,
  copying and the device share dialog use that snapshot. Sharing does not confirm
  delivery. This is a responsive web view, not a native mobile application.

## Verification

Requires Node 20+ for tests. Playwright is a development-only dependency.

```sh
npm ci
npm test
npm run test:browser
```

Browser tests use installed Chrome by default. Set `BROWSER_CHANNEL=msedge` to
use Edge. Set `LIVE_CMT=1` to additionally test the real Treasury feed from the
GitHub Pages origin. Otherwise provider responses are deterministic fixtures.
Tests intercept the Pages assets with the local candidate files; they do not
publish changes. Screenshots and a print PDF are written to ignored `test-results/`.

## Existing calculation limitations

The rate and presentation work preserves existing financial formulas. The PLF
function is an approximation, not an official HUD lookup. The configured
$1,209,750 lending cap is unchanged and is not synchronized by the CMT feed. The
first-year calculation uses the existing simplified disbursement model. Purchase
required investment excludes third-party fees even though those fees are shown
in total costs. These figures require separate mortgage-domain validation before
being treated as a reliable quote. Report text identifies these limitations.
No ten-year projections were added because the calculator has no separate note
rate/accrual model supporting them.

## Rollback and continuation

The baseline is commit `8520e115fc98e55577189bab42b8209eef731914`. Revert the feature
commits through a reviewed Git revert if necessary; no database migration or
backfill is involved. The pre-feature page uses manual CMT and must not be
represented as automatically current after rollback. Rate failure already blocks
uncached estimates; no borrower contact or loan lifecycle operation is introduced.
After approval/merge, verify the deployed HTML, `rates.js`, and `calculator.css`,
then check both modes and the published Treasury date on the actual live site.
