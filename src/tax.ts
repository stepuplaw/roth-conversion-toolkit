import {
  AGED_ADDITION_MARRIED,
  AGED_ADDITION_UNMARRIED,
  BRACKETS_2026,
  type BracketRow,
  type FilingStatus,
  PREFERENTIAL_FIFTEEN_TOP_2026,
  PREFERENTIAL_ZERO_TOP_2026,
  SENIOR_DEDUCTION_LAST_YEAR,
  SENIOR_DEDUCTION_PER_PERSON,
  SENIOR_DEDUCTION_RATE,
  SENIOR_DEDUCTION_THRESHOLD,
  STANDARD_DEDUCTION_2026,
} from './data.js';

/** Federal income tax on ordinary taxable income, 2026 tables. */
export function federalTax(taxable: number, status: FilingStatus): number {
  if (taxable <= 0) return 0;
  const rows = BRACKETS_2026[status];
  const row = rows.find((r) => taxable <= r.upTo) as BracketRow;
  return row.base + row.rate * (taxable - row.over);
}

/** Marginal bracket rate at a given taxable income. */
export function bracketRate(taxable: number, status: FilingStatus): number {
  if (taxable <= 0) return BRACKETS_2026[status][0].rate;
  const rows = BRACKETS_2026[status];
  return (rows.find((r) => taxable <= r.upTo) as BracketRow).rate;
}

/** The bracket row a given taxable income sits in. */
export function bracketRow(taxable: number, status: FilingStatus): BracketRow {
  const rows = BRACKETS_2026[status];
  if (taxable <= 0) return rows[0];
  return rows.find((r) => taxable <= r.upTo) as BracketRow;
}

/**
 * The aged (65+) additions to the standard deduction, section 63(f).
 * Blindness also qualifies and is not modelled here; a blind taxpayer's
 * deduction is understated by one addition.
 */
export function agedAdditions(
  status: FilingStatus,
  you65: boolean,
  spouse65: boolean,
): number {
  if (status === 'mfj') {
    return (you65 ? AGED_ADDITION_MARRIED : 0) + (spouse65 ? AGED_ADDITION_MARRIED : 0);
  }
  if (status === 'mfs') return you65 ? AGED_ADDITION_MARRIED : 0;
  return you65 ? AGED_ADDITION_UNMARRIED : 0;
}

/**
 * The OBBBA senior deduction for the given year. Zero outside 2025-2028, zero
 * for married filing separately (joint filing is a condition of the deduction,
 * IRC 151(d)(5)(C)(v)).
 *
 * ★ The 6% reduction applies to the PER-PERSON 6,000 and each qualified
 * individual then claims the reduced amount, so this is
 * `people * max(0, 6000 - 6% of excess)`, mirroring Schedule 1-A Part V lines
 * 35 through 37 exactly. See the note in data.ts.
 *
 * `magi` here must be AGI plus only the section 911/931/933 exclusions. Do NOT
 * pass the IRMAA MAGI: tax-exempt interest does not belong in this one.
 */
export function seniorDeduction(
  magi: number,
  status: FilingStatus,
  you65: boolean,
  spouse65: boolean,
  year = 2026,
): number {
  if (year > SENIOR_DEDUCTION_LAST_YEAR || year < 2025) return 0;
  if (status === 'mfs') return 0;
  const people = (you65 ? 1 : 0) + (status === 'mfj' && spouse65 ? 1 : 0);
  if (people === 0) return 0;
  const excess = Math.max(0, magi - SENIOR_DEDUCTION_THRESHOLD[status]);
  const perPerson = Math.max(0, SENIOR_DEDUCTION_PER_PERSON - SENIOR_DEDUCTION_RATE * excess);
  return people * perPerson;
}

/** Total standard deduction stack (basic + aged additions). */
export function standardDeduction(
  status: FilingStatus,
  you65: boolean,
  spouse65: boolean,
): number {
  return STANDARD_DEDUCTION_2026[status] + agedAdditions(status, you65, spouse65);
}

export interface PreferentialSplit {
  atZero: number;
  atFifteen: number;
  atTwenty: number;
  tax: number;
}

/**
 * Tax on qualified dividends and net long-term capital gains under IRC 1(h).
 * They stack ON TOP of ordinary taxable income, so the 0% and 15% ceilings are
 * levels of total taxable income rather than separate allowances. A Roth
 * conversion is ordinary income, so it slides in underneath and can push this
 * income from 0% into 15%, which is a real marginal cost that bracket-only
 * arithmetic never shows.
 */
export function preferentialTax(
  ordinaryTaxable: number,
  preferential: number,
  status: FilingStatus,
): PreferentialSplit {
  const zeroTop = PREFERENTIAL_ZERO_TOP_2026[status];
  const fifteenTop = PREFERENTIAL_FIFTEEN_TOP_2026[status];
  const amount = Math.max(0, preferential);
  const atZero = Math.min(amount, Math.max(0, zeroTop - ordinaryTaxable));
  const fifteenRoom = Math.max(0, fifteenTop - Math.max(ordinaryTaxable, zeroTop));
  const atFifteen = Math.min(amount - atZero, fifteenRoom);
  const atTwenty = amount - atZero - atFifteen;
  return {
    atZero,
    atFifteen,
    atTwenty,
    tax: 0.15 * atFifteen + 0.2 * atTwenty,
  };
}
