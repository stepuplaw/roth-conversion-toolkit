import {
  AGED_ADDITION_MARRIED,
  AGED_ADDITION_UNMARRIED,
  BRACKETS_2026,
  type BracketRow,
  type FilingStatus,
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
 * The OBBBA senior deduction for the given year. Zero outside 2025-2028,
 * zero for married filing separately (joint filing is a condition of the
 * deduction per the IRS eligibility page), otherwise 6,000 per person 65+
 * less 6% of MAGI above the threshold, floored at zero.
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
  const gross = people * SENIOR_DEDUCTION_PER_PERSON;
  const excess = Math.max(0, magi - SENIOR_DEDUCTION_THRESHOLD[status]);
  return Math.max(0, gross - SENIOR_DEDUCTION_RATE * excess);
}

/** Total standard deduction stack (basic + aged additions). */
export function standardDeduction(
  status: FilingStatus,
  you65: boolean,
  spouse65: boolean,
): number {
  return STANDARD_DEDUCTION_2026[status] + agedAdditions(status, you65, spouse65);
}
