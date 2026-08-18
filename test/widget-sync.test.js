import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  BRACKETS_2026,
  STANDARD_DEDUCTION_2026,
  IRMAA_2026,
  IRMAA_2026_MFS,
  PART_B_STANDARD_2026,
  SS_BASE,
  SS_ADJUSTED_BASE,
} from '../dist/index.js';

// The embeddable widget in widget/roth-conversion.js carries its own copy of
// the tables (it must be a single dependency-free file). This test keeps the
// two from drifting: every load-bearing figure in the library must appear
// literally in the widget source.

const src = readFileSync(new URL('../widget/roth-conversion.js', import.meta.url), 'utf8');

function expectLiteral(n, label) {
  const s = String(n);
  assert.ok(src.includes(s), `widget is missing ${label} = ${s}`);
}

test('widget carries every bracket boundary and base', () => {
  for (const status of Object.keys(BRACKETS_2026)) {
    for (const row of BRACKETS_2026[status]) {
      if (row.upTo !== Infinity) expectLiteral(row.upTo, `${status} bracket top`);
      if (row.base > 0) expectLiteral(row.base, `${status} bracket base`);
    }
  }
});

test('widget carries the standard deductions', () => {
  for (const status of Object.keys(STANDARD_DEDUCTION_2026)) {
    expectLiteral(STANDARD_DEDUCTION_2026[status], `${status} standard deduction`);
  }
  expectLiteral(1650, 'aged addition, married');
  expectLiteral(2050, 'aged addition, unmarried');
  expectLiteral(6000, 'senior deduction');
});

test('widget carries the Social Security thresholds', () => {
  expectLiteral(SS_BASE.mfj, 'SS base, joint');
  expectLiteral(SS_BASE.single, 'SS base, single');
  expectLiteral(SS_ADJUSTED_BASE.mfj, 'SS adjusted base, joint');
  expectLiteral(SS_ADJUSTED_BASE.single, 'SS adjusted base, single');
});

test('widget carries the IRMAA schedule', () => {
  expectLiteral(PART_B_STANDARD_2026.toFixed(2), 'Part B standard');
  for (const t of IRMAA_2026) {
    if (t.singleUpTo !== Infinity) expectLiteral(t.singleUpTo, 'IRMAA single bound');
    if (t.jointUpTo !== Infinity) expectLiteral(t.jointUpTo, 'IRMAA joint bound');
    if (t.partB > 0) expectLiteral(t.partB.toFixed(2), 'IRMAA Part B surcharge');
    if (t.partD > 0) expectLiteral(t.partD.toFixed(2), 'IRMAA Part D surcharge');
  }
  for (const t of IRMAA_2026_MFS) {
    if (t.upTo !== Infinity) expectLiteral(t.upTo, 'IRMAA MFS bound');
  }
});
