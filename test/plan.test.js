import test from 'node:test';
import assert from 'node:assert/strict';
import {
  scenario,
  analyzeConversion,
  bracketFills,
  solveConversionForTaxable,
} from '../dist/index.js';

// Composite pass, hand-computed end to end.

test('MFJ couple, both 67, 80k other income, 40k Social Security', () => {
  const inputs = {
    status: 'mfj',
    birthYear: 1959,
    spouse65: true,
    otherIncome: 80000,
    ssBenefits: 40000,
  };
  const s = scenario(inputs, 0);
  assert.equal(s.taxableSS, 34000);
  assert.equal(s.agi, 114000);
  assert.equal(s.seniorDeduction, 12000);
  assert.equal(s.deductions, 32200 + 3300 + 12000);
  assert.equal(s.taxable, 66500);
  assert.equal(s.tax, 7484); // 2,480 + 12% of 41,700
  assert.equal(s.bracket, 0.12);
  assert.equal(s.irmaa.tier, 0);
});

test('senior-deduction clawback raises the effective rate above the bracket', () => {
  const inputs = { status: 'single', birthYear: 1960, otherIncome: 100000 };
  const a = analyzeConversion(inputs, 1000);
  // Each converted dollar adds 6 cents of lost deduction: 1,060 of taxable
  // income per 1,000 converted, all at 22%.
  assert.equal(a.base.seniorDeduction, 4500);
  assert.equal(a.at.seniorDeduction, 4440);
  assert.equal(a.seniorClawback, 60);
  assert.ok(Math.abs(a.conversionTax - 233.2) < 0.01);
  assert.ok(Math.abs(a.effectiveRate - 0.2332) < 0.0001);
});

test('the Social Security torpedo: a 10k conversion drags 8.5k of benefits into tax', () => {
  const inputs = { status: 'single', birthYear: 1958, otherIncome: 20000, ssBenefits: 30000 };
  const a = analyzeConversion(inputs, 10000);
  assert.equal(a.base.taxableSS, 5350);
  assert.equal(a.at.taxableSS, 13850);
  assert.equal(a.ssTorpedo, 8500);
});

test('bracket fills are exact when no phase-ins interfere', () => {
  const inputs = { status: 'single', birthYear: 1970, otherIncome: 50000 };
  // taxable = 33,900; top of 12% is 50,400, so 16,500 converts 1:1
  const fills = bracketFills(inputs);
  const to12 = fills.find((f) => f.rate === 0.12);
  assert.equal(to12.conversion, 16500);
  const to22 = fills.find((f) => f.rate === 0.22);
  assert.equal(to22.conversion, 71800);
});

test('bracket fills shrink when each converted dollar adds more than a dollar of taxable income', () => {
  const inputs = { status: 'single', birthYear: 1958, otherIncome: 20000, ssBenefits: 30000 };
  // naive headroom to the 12% top would ignore the torpedo; the solver must not
  const c = solveConversionForTaxable(inputs, 50400);
  const s = scenario(inputs, c);
  assert.ok(Math.abs(s.taxable - 50400) <= 1);
  const naive = 50400 - scenario(inputs, 0).taxable;
  assert.ok(c < naive, `solver (${c}) must be below naive headroom (${naive})`);
});

test('IRMAA crossing is priced per person per year', () => {
  const inputs = { status: 'single', birthYear: 1956, otherIncome: 105000 };
  const a = analyzeConversion(inputs, 10000);
  assert.equal(a.irmaaTiersCrossed, 1);
  // (81.20 + 14.50) x 12
  assert.ok(Math.abs(a.irmaaAnnualPerPerson - 1148.4) < 0.01);
});

test('a conversion of zero analyses cleanly', () => {
  const a = analyzeConversion({ status: 'mfj', birthYear: 1955, otherIncome: 60000 }, 0);
  assert.equal(a.conversionTax, 0);
  assert.equal(a.effectiveRate, 0);
});
