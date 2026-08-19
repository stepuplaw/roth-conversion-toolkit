import test from 'node:test';
import assert from 'node:assert/strict';
import {
  preferentialTax,
  scenario,
  analyzeConversion,
  seniorDeduction,
  PREFERENTIAL_ZERO_TOP_2026,
} from '../dist/index.js';

// Qualified dividends and long-term gains, IRC 1(h). Thresholds from
// Rev. Proc. 2025-32 section 4.03, read from the IRS PDF 2026-08-19.

test('preferential income stacks on top of ordinary income', () => {
  // single: 0% ceiling is total taxable income of 49,450
  const a = preferentialTax(30000, 10000, 'single');
  assert.equal(a.atZero, 10000); // 30,000 + 10,000 stays under 49,450
  assert.equal(a.tax, 0);

  const b = preferentialTax(45000, 10000, 'single');
  assert.equal(b.atZero, 4450); // only 4,450 of room left below 49,450
  assert.equal(b.atFifteen, 5550);
  assert.ok(Math.abs(b.tax - 0.15 * 5550) < 1e-9);

  const c = preferentialTax(60000, 10000, 'single');
  assert.equal(c.atZero, 0); // ordinary income already past the 0% ceiling
  assert.equal(c.atFifteen, 10000);
});

test('the 20% band starts above the maximum 15% rate amount', () => {
  const s = preferentialTax(500000, 100000, 'single'); // 15% top is 545,500
  assert.equal(s.atZero, 0);
  assert.equal(s.atFifteen, 45500);
  assert.equal(s.atTwenty, 54500);
  assert.ok(Math.abs(s.tax - (0.15 * 45500 + 0.2 * 54500)) < 1e-9);
});

test('zero-rate ceilings match the primary source for every status', () => {
  assert.equal(PREFERENTIAL_ZERO_TOP_2026.mfj, 98900);
  assert.equal(PREFERENTIAL_ZERO_TOP_2026.single, 49450);
  assert.equal(PREFERENTIAL_ZERO_TOP_2026.hoh, 66200);
  assert.equal(PREFERENTIAL_ZERO_TOP_2026.mfs, 49450);
});

test('a retiree living on dividends is not taxed as if they were ordinary', () => {
  // 68yo single, 25,000 pension + 25,000 qualified dividends, no Social Security
  const s = scenario(
    { status: 'single', birthYear: 1958, otherIncome: 25000, qualifiedIncome: 25000 },
    0,
  );
  assert.equal(s.agi, 50000);
  assert.equal(s.seniorDeduction, 6000); // MAGI 50,000 is under the 75,000 threshold
  assert.equal(s.deductions, 16100 + 2050 + 6000);
  assert.equal(s.taxable, 25850);
  assert.equal(s.taxablePreferential, 25000);
  assert.equal(s.taxableOrdinary, 850);
  assert.equal(s.preferentialTax, 0); // 25,850 total stays under the 49,450 ceiling
  assert.equal(s.tax, 85); // 10% of 850, and nothing else
});

test('a conversion that pushes gains out of the 0% band shows the displacement', () => {
  const inputs = { status: 'single', birthYear: 1958, otherIncome: 25000, qualifiedIncome: 25000 };
  const a = analyzeConversion(inputs, 60000);
  assert.ok(a.preferentialDisplacement > 0, 'conversion should push gains into the 15% band');
  assert.ok(Math.abs(a.preferentialDisplacement - 3750) < 1e-6); // all 25,000 moves to 15%
  // and the true cost exceeds what an ordinary-only model would report
  assert.ok(a.effectiveRate > 0.19);
});

test('omitting qualifiedIncome leaves prior behaviour unchanged', () => {
  const a = scenario({ status: 'mfj', birthYear: 1959, spouse65: true, otherIncome: 80000, ssBenefits: 40000 }, 0);
  assert.equal(a.taxablePreferential, 0);
  assert.equal(a.taxableOrdinary, a.taxable);
  assert.equal(a.preferentialTax, 0);
  assert.equal(a.taxable, 66500);
  assert.equal(a.tax, 7484);
});

// Two different MAGIs. IRMAA adds tax-exempt interest (42 U.S.C. 1395r(i)(4)(A));
// the senior deduction does not (IRC 151(d)(5)(C)(iii)(II), and Schedule 1-A
// Part I has no line for it).
test('tax-exempt interest raises the IRMAA MAGI but not the senior-deduction MAGI', () => {
  const s = scenario(
    { status: 'single', birthYear: 1958, otherIncome: 90000, taxExemptInterest: 30000 },
    0,
  );
  assert.equal(s.seniorMagi, 90000);
  assert.equal(s.magi, 120000);
  // phaseout runs on 90,000, not 120,000
  assert.equal(s.seniorDeduction, seniorDeduction(90000, 'single', true, false));
  assert.equal(s.seniorDeduction, 5100);
  // but the Medicare tier is set by the higher figure
  assert.equal(s.irmaa.tier, 1);
});

// The published marginal-rate ladder. Each figure appears in the practitioner
// literature (Reichenstein & Meyer in the Journal of Financial Planning for the
// torpedo rates, Kitces for the capital-gain bump zone). If a change to the
// engine moves any of these, the engine is wrong, not the literature.
test('reproduces the published marginal-rate ladder', () => {
  const marginal = (inputs, c = 0, h = 1) =>
    (scenario(inputs, c + h).tax - scenario(inputs, c - h).tax) / (2 * h);
  const round = (x) => Math.round(x * 10000) / 100;

  // 12% bracket inside the 85% Social Security phase-in: 12 x 1.85
  assert.equal(round(marginal({ status: 'single', birthYear: 1963, otherIncome: 28000, ssBenefits: 30000 })), 22.2);
  // 22% bracket inside the phase-in: 22 x 1.85
  assert.equal(round(marginal({ status: 'single', birthYear: 1963, otherIncome: 37703, ssBenefits: 50000 })), 40.7);
  // phase-in plus a capital-gain bump zone: (12 + 15) x 1.85
  assert.equal(
    round(marginal({ status: 'single', birthYear: 1965, otherIncome: 5000, ssBenefits: 60000, qualifiedIncome: 35000 })),
    49.95,
  );
  // all of the above plus the senior-deduction clawback: (12 + 15) x 1.85 x 1.06
  assert.equal(
    round(marginal({ status: 'single', birthYear: 1959, otherIncome: 5000, ssBenefits: 60000, qualifiedIncome: 35000 })),
    52.95,
  );
});

test('the marginal rate curve is non-monotonic (the torpedo hump is real)', () => {
  const inputs = { status: 'single', birthYear: 1958, otherIncome: 15000, ssBenefits: 30000 };
  const marginal = (c, h = 1) => (scenario(inputs, c + h).tax - scenario(inputs, c - h).tax) / (2 * h);
  const peak = marginal(15000); // inside the phase-in
  const after = marginal(30000); // past the 85% cap
  assert.ok(peak > after, 'rate must fall back once benefits are fully taxed');
  assert.ok(Math.abs(peak - 0.222) < 1e-9);
  assert.ok(Math.abs(after - 0.12) < 1e-9);
});

test('municipal interest still counts toward Social Security provisional income', () => {
  const withMuni = scenario(
    { status: 'single', birthYear: 1958, otherIncome: 18000, ssBenefits: 20000, taxExemptInterest: 5000 },
    0,
  );
  assert.equal(withMuni.taxableSS, 4000);
});
