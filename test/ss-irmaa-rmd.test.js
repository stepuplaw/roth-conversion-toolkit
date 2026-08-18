import test from 'node:test';
import assert from 'node:assert/strict';
import {
  taxableSocialSecurity,
  irmaaTier,
  rmdAge,
  conversionWindow,
} from '../dist/index.js';

// Section 86 worksheet cases, hand-computed.

test('provisional income at or below the base amount taxes nothing', () => {
  assert.equal(taxableSocialSecurity(20000, 10000, 0, 'single'), 0);
});

test('middle tier taxes half the excess over the base', () => {
  // PI = 18,000 + 10,000 = 28,000; 0.5 x 3,000 = 1,500
  assert.equal(taxableSocialSecurity(20000, 18000, 0, 'single'), 1500);
});

test('upper tier, single', () => {
  // PI = 20,000 + 15,000 = 35,000; 0.85 x 1,000 + min(4,500, 15,000) = 5,350
  assert.equal(taxableSocialSecurity(30000, 20000, 0, 'single'), 5350);
});

test('upper tier capped at 85% of benefits, MFJ', () => {
  // PI = 100,000; formula gives 53,600, cap is 34,000
  assert.equal(taxableSocialSecurity(40000, 80000, 0, 'mfj'), 34000);
});

test('MFS living together starts taxing from the first dollar', () => {
  assert.equal(taxableSocialSecurity(20000, 10000, 0, 'mfs'), 17000);
});

test('MFS living apart all year uses the single thresholds', () => {
  assert.equal(taxableSocialSecurity(20000, 10000, 0, 'mfs', true), 0);
});

test('tax-exempt interest counts toward provisional income', () => {
  // PI = 18,000 + 5,000 + 10,000 = 33,000; 0.5 x 8,000 = 4,000
  assert.equal(taxableSocialSecurity(20000, 18000, 5000, 'single'), 4000);
});

// IRMAA 2026, CMS fact sheet figures.

test('IRMAA is a cliff: one dollar crosses the tier', () => {
  const at = irmaaTier(109000, 'single');
  assert.equal(at.tier, 0);
  assert.equal(at.partB, 0);
  assert.equal(at.partBTotal, 202.9);
  const over = irmaaTier(109001, 'single');
  assert.equal(over.tier, 1);
  assert.equal(over.partB, 81.2);
  assert.equal(over.partD, 14.5);
  assert.equal(over.headroom, 137000 - 109001);
});

test('joint thresholds are double the single ones', () => {
  assert.equal(irmaaTier(218000, 'mfj').tier, 0);
  assert.equal(irmaaTier(218001, 'mfj').tier, 1);
  assert.equal(irmaaTier(750000, 'mfj').partB, 487.0);
});

test('MFS living together has no gentle first step', () => {
  const over = irmaaTier(109001, 'mfs', true);
  assert.equal(over.partB, 446.3);
  assert.equal(over.partD, 83.3);
  assert.equal(irmaaTier(391000, 'mfs', true).partB, 487.0);
});

test('MFS living apart uses the regular single schedule', () => {
  assert.equal(irmaaTier(109001, 'mfs', false).partB, 81.2);
});

// RMD age, SECURE 2.0 section 107 as resolved by regulation.

test('born 1959 answers 73, per the proposed regulation', () => {
  assert.equal(rmdAge(1959), 73);
  const w = conversionWindow(1959, 2026);
  assert.equal(w.firstRmdYear, 2032);
  assert.equal(w.yearsLeft, 6);
  assert.equal(w.rmdStarted, false);
  assert.equal(w.ambiguity1959, true);
});

test('born 1960 or later is 75', () => {
  assert.equal(rmdAge(1960), 75);
  assert.equal(conversionWindow(1960, 2026).firstRmdYear, 2035);
});

test('born 1951 to 1958 is 73', () => {
  assert.equal(rmdAge(1951), 73);
  assert.equal(conversionWindow(1951, 2026).rmdStarted, true);
});
