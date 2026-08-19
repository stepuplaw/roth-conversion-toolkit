# roth-conversion-toolkit

The 2026 Roth conversion math the brokerage calculators skip. A converted
dollar is taxed at its bracket rate, and then four more meters run: it can
drag another 85 cents of Social Security into taxable income, push qualified
dividends and long-term gains from the 0% rate into the 15% rate, claw back
the temporary senior deduction, and set a higher Medicare premium two years
out, where each threshold is a cliff. Stacked, those can take a household
sitting in the 12% bracket past a 49% marginal rate. This library computes the
whole stack at once, from tables read directly out of the primary documents
and dated. TypeScript, zero dependencies, no network calls anywhere in it.

[![npm](https://img.shields.io/npm/v/roth-conversion-toolkit.svg)](https://www.npmjs.com/package/roth-conversion-toolkit)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue.svg)](https://www.typescriptlang.org/)
[![Network calls](https://img.shields.io/badge/network%20calls-zero-brightgreen.svg)](#privacy-by-design)

Three ways to use it, in order of how little work they are:

1. **Just use the tool.** Free, no signup, at
   [stepuplaw.com/roth-conversion-calculator](https://stepuplaw.com/roth-conversion-calculator).
2. **Put it on your own site.** Two lines of HTML, no build step, no account.
   See [stepuplaw.com/roth-conversion-widget](https://stepuplaw.com/roth-conversion-widget).
3. **Install the library** and build your own thing on it. Below.

## Why this exists

Every Roth conversion calculator we could find multiplies the conversion by a
bracket rate. For a retiree that number is often badly wrong, in the
expensive direction, for four reasons this library models and they do not:

1. **The Social Security tax torpedo.** Whether benefits are taxed depends on
   a formula (IRC §86) whose thresholds were never indexed for inflation.
   Inside the phase-in range, each converted dollar can pull another 85 cents
   of benefits into taxable income, so a 22% bracket becomes an honest
   marginal rate near 40%.
2. **The capital-gain bump zone.** Qualified dividends and long-term gains
   are taxed on their own 0/15/20 schedule and stack on top of ordinary
   income, so a conversion slides in underneath and can push them up a rate
   band. Combined with the torpedo this produces a documented 49.95% marginal
   rate for a household nominally in the 12% bracket, which a flat calculator
   prices at 12%.
3. **The senior deduction clawback, 2025 through 2028 only.** The new $6,000
   per-person deduction for age 65+ phases out at 6% of income above
   $75,000/$150,000, and it expires after 2028. Note the phaseout applies to
   the per-person amount and each qualifying spouse claims the reduced figure,
   so a couple both 65+ lose 12 cents per dollar and are fully phased out at
   $250,000, not $350,000.
4. **Medicare IRMAA cliffs, on a two-year delay.** A 2026 conversion sets the
   2028 premium, every threshold is a cliff where one dollar over triggers
   the whole surcharge for each spouse on Medicare, and married-filing-
   separately has its own three-band schedule with no gentle first step.

It also carries the gates that disqualify money entirely: the RMD-first rule,
the non-spouse inherited IRA bar, the SIMPLE IRA two-year rule, and the fact
that no conversion since 2018 can be undone.

## Install

```
npm install roth-conversion-toolkit
```

## Use

```ts
import { analyzeConversion, bracketFills } from 'roth-conversion-toolkit';

const inputs = {
  status: 'mfj',          // 'single' | 'mfj' | 'mfs' | 'hoh'
  birthYear: 1959,
  spouse65: true,
  otherIncome: 80_000,    // ORDINARY income: pensions, wages, interest, IRA withdrawals
  qualifiedIncome: 0,     // qualified dividends + net long-term capital gains
  ssBenefits: 40_000,
  taxExemptInterest: 0,
};

// how much conversion room each bracket holds, solved against the full
// stack (torpedo and clawback included, which is why it is not the plain
// distance to the bracket line)
bracketFills(inputs);
// [{ rate: 0.12, bracketTop: 100800, conversion: ... }, ...]

// everything about one candidate amount
const a = analyzeConversion(inputs, 50_000);
a.conversionTax;        // federal tax caused by the conversion
a.effectiveRate;        // often well above the bracket rate
a.ssTorpedo;            // extra SS dollars made taxable
a.seniorClawback;       // senior-deduction dollars lost
a.preferentialDisplacement; // extra tax on gains pushed up a rate band
a.irmaaTiersCrossed;    // Medicare cliffs crossed
a.irmaaAnnualPerPerson; // added premium per person per year, two years out
a.window;               // years left before RMDs begin (73 or 75)
```

Lower-level pieces are exported too: `federalTax`, `taxableSocialSecurity`,
`irmaaTier`, `rmdAge`, `conversionWindow`, `scenario`, and the raw 2026
tables (`BRACKETS_2026`, `IRMAA_2026`, and friends).

## Where every number comes from

Each figure was read from the primary document on **August 19, 2026**, not
from a summary of it:

| Figures | Source |
|---|---|
| 2026 rate tables, all four statuses | Rev. Proc. 2025-32 §4.01, read from the IRS PDF |
| Standard deduction + aged additions | Rev. Proc. 2025-32 §4.14 |
| 0% and 15% ceilings for dividends and long-term gains | Rev. Proc. 2025-32 §4.03 |
| Senior deduction: per-person phaseout, MAGI definition, 2025-2028 term, joint-filing condition | IRC §151(d)(5), added by Pub. L. 119-21 §70103; IRS Schedule 1-A Part V |
| Social Security thresholds ($25k/$32k, $34k/$44k, MFS zero) | IRC §86(c) |
| 2026 IRMAA schedule incl. the separate MFS table | CMS fact sheet, 2026 Medicare Parts A & B |
| IRMAA two-year lookback | 42 U.S.C. §1395r(i)(4)(B)(i); SSA POMS HI 01101.020 |
| RMD ages 73/75, the born-1959 contradiction | SECURE 2.0 §107(c); T.D. 10001 (reserved); REG-103529-23 (proposes 73) |
| Conversion bars (RMD-first, SIMPLE two-year, no undo) | 26 CFR §1.408A-4; IRS Pub 590-A |

One honest footnote the tool states rather than hides: for anyone born in
1959 the statute assigns both age 73 and age 75, the final regulations
reserved the question, and only the proposed regulations answer 73. The
toolkit uses 73, the safe planning age, and says so.

## Privacy by design

The library and the widget make no network calls, keep no state, and never
ask for a Social Security number or an account number. Inputs are incomes and
a birth year; everything runs where the code runs.

## What this is not

An estimate of federal income tax under stated assumptions, not legal or tax
advice, and not a substitute for either. It assumes the standard deduction, so
itemized deductions are out of scope, including the medical expense deduction
that a conversion shrinks by raising AGI and the revived section 68 limitation
that bites large itemizers from 2026. Also unmodelled: the 3.8% net investment
income tax, ACA premium credits (whose 400% FPL cliff returned in 2026 and is
the largest cliff facing anyone converting before 65), the qualified business
income deduction, the SALT phasedown above $500,000, and state income tax (the
authors practice in Florida, which has none). When those matter, the answer is
a professional, not a bigger calculator.

## Tests

`npm test` runs hand-computed cases for every table boundary, the torpedo, the
clawback, the capital-gain bump zones, the cliffs, and the composite scenarios.
It also pins the engine to the marginal rates published in the planning
literature (22.2%, 40.7% and 49.95%) and asserts the senior deduction against a
line-by-line transcription of IRS Schedule 1-A Part V. If a figure here
disagrees with the primary source, that is a bug; please open an issue.

### Changelog

**0.2.0** corrects two senior-deduction errors found in a full audit on
2026-08-19 and adds preferential income. The 6% phaseout applies to the
per-person amount rather than the combined amount, which had overstated a
couple's deduction by up to $6,000; and the MAGI for that phaseout excludes
tax-exempt interest, unlike the IRMAA MAGI. Qualified dividends and long-term
gains now have their own input and are taxed on their own schedule.

## Credit

Built by [Klagge Law, PLLC](https://stepuplaw.com), a Miami estate planning
and probate litigation firm, for its own clients first. Attribution is a
request rather than a condition; see [ATTRIBUTION.md](./ATTRIBUTION.md).
