import test from 'node:test';
import assert from 'node:assert/strict';
import {
  federalTax,
  bracketRate,
  seniorDeduction,
  standardDeduction,
  agedAdditions,
} from '../dist/index.js';

// Hand-computed against Rev. Proc. 2025-32 section 3.01 tables (read 2026-08-18).

test('federal tax, single, 12% band', () => {
  // 1,240 + 12% of (35,850 - 12,400) = 1,240 + 2,814
  assert.equal(federalTax(35850, 'single'), 4054);
});

test('federal tax at exact bracket boundaries matches the next base', () => {
  assert.equal(federalTax(24800, 'mfj'), 2480);
  assert.equal(federalTax(100800, 'mfj'), 11600);
  assert.equal(federalTax(12400, 'single'), 1240);
  assert.equal(federalTax(105700, 'hoh'), 16155);
  assert.equal(federalTax(384350, 'mfs'), 103291.75);
});

test('the HoH 24% band ends 25 dollars below the single figure', () => {
  // the transposition trap: 201,750 vs 201,775
  assert.equal(bracketRate(201750, 'hoh'), 0.24);
  assert.equal(bracketRate(201751, 'hoh'), 0.32);
  assert.equal(bracketRate(201775, 'single'), 0.24);
  assert.equal(bracketRate(201776, 'single'), 0.32);
});

test('MFS diverges from single only at the 35% band top', () => {
  assert.equal(bracketRate(384350, 'mfs'), 0.35);
  assert.equal(bracketRate(384351, 'mfs'), 0.37);
  assert.equal(bracketRate(384351, 'single'), 0.35);
});

test('standard deduction stack with aged additions', () => {
  assert.equal(standardDeduction('mfj', false, false), 32200);
  // unmarried 65+ takes 2,050, not 1,650
  assert.equal(standardDeduction('single', true, false), 18150);
  // both spouses 65+: 1,650 each
  assert.equal(standardDeduction('mfj', true, true), 35500);
  assert.equal(agedAdditions('hoh', true, false), 2050);
  assert.equal(agedAdditions('mfs', true, false), 1650);
});

test('senior deduction phases out at 6% above the threshold', () => {
  assert.equal(seniorDeduction(100000, 'single', true, false), 4500);
  assert.equal(seniorDeduction(175000, 'single', true, false), 0);
  assert.equal(seniorDeduction(200000, 'mfj', true, true), 9000);
  assert.equal(seniorDeduction(60000, 'single', true, false), 6000);
});

test('senior deduction is zero when not 65, when filing separately, and after 2028', () => {
  assert.equal(seniorDeduction(60000, 'single', false, false), 0);
  assert.equal(seniorDeduction(60000, 'mfs', true, false), 0);
  assert.equal(seniorDeduction(60000, 'single', true, false, 2029), 0);
  assert.equal(seniorDeduction(60000, 'single', true, false, 2024), 0);
});
