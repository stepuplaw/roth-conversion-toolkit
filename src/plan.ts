import { BRACKETS_2026, type FilingStatus } from './data.js';
import { irmaaTier, type IrmaaResult } from './irmaa.js';
import { conversionWindow, type WindowResult } from './rmd.js';
import { taxableSocialSecurity } from './ss.js';
import {
  bracketRate,
  bracketRow,
  federalTax,
  preferentialTax,
  seniorDeduction,
  standardDeduction,
} from './tax.js';

export interface PlanInputs {
  status: FilingStatus;
  /** owner's birth year, four digits */
  birthYear: number;
  /** spouse is 65 or older by year end (MFJ only) */
  spouse65?: boolean;
  /**
   * 2026 ORDINARY income other than Social Security and other than the
   * conversion: pensions, wages, interest, IRA and annuity withdrawals.
   * Qualified dividends and long-term capital gains do NOT belong here, they
   * go in `qualifiedIncome` because they are taxed on a separate rate schedule.
   */
  otherIncome: number;
  /**
   * Qualified dividends plus net long-term capital gains. Taxed under IRC 1(h)
   * at 0/15/20 percent, stacked on top of ordinary income.
   */
  qualifiedIncome?: number;
  /** total 2026 Social Security benefits, before any withholding */
  ssBenefits?: number;
  /** tax-exempt interest (counts toward provisional income and IRMAA MAGI) */
  taxExemptInterest?: number;
  /** MFS only: lived apart from the spouse for the entire year */
  mfsApart?: boolean;
  /** tax year being modelled */
  year?: number;
}

export interface Scenario {
  conversion: number;
  taxableSS: number;
  agi: number;
  /** AGI + tax-exempt interest: the IRMAA MAGI (42 U.S.C. 1395r(i)(4)(A)) */
  magi: number;
  /** AGI plus only the 911/931/933 exclusions: the senior-deduction MAGI */
  seniorMagi: number;
  seniorDeduction: number;
  deductions: number;
  /** total taxable income, ordinary plus preferential */
  taxable: number;
  /** the portion taxed on the ordinary rate schedule */
  taxableOrdinary: number;
  /** the portion taxed at 0/15/20 under IRC 1(h) */
  taxablePreferential: number;
  ordinaryTax: number;
  preferentialTax: number;
  /** total federal income tax */
  tax: number;
  /** marginal ORDINARY bracket rate, the one a conversion lands in */
  bracket: number;
  irmaa: IrmaaResult;
}

/** One full pass through the 2026 stack at a given conversion amount. */
export function scenario(inputs: PlanInputs, conversion: number): Scenario {
  const status = inputs.status;
  const year = inputs.year ?? 2026;
  const ss = inputs.ssBenefits ?? 0;
  const exempt = inputs.taxExemptInterest ?? 0;
  const qualified = Math.max(0, inputs.qualifiedIncome ?? 0);
  const mfsApart = inputs.mfsApart ?? false;
  const you65 = year - inputs.birthYear >= 65;
  const spouse65 = inputs.spouse65 ?? false;

  // A conversion is ordinary income. Qualified dividends and long-term gains
  // sit in AGI too, so they feed section 86 provisional income and both MAGIs.
  const ordinaryBeforeSS = inputs.otherIncome + conversion;
  const taxableSS = taxableSocialSecurity(
    ss,
    ordinaryBeforeSS + qualified,
    exempt,
    status,
    mfsApart,
  );
  const agi = ordinaryBeforeSS + qualified + taxableSS;

  // Two different MAGIs, deliberately. IRMAA adds tax-exempt interest; the
  // senior deduction does not (IRC 151(d)(5)(C)(iii)(II)).
  const irmaaMagi = agi + exempt;
  const seniorMagi = agi;

  const senior = seniorDeduction(seniorMagi, status, you65, spouse65, year);
  const deductions = standardDeduction(status, you65, spouse65) + senior;
  const taxable = Math.max(0, agi - deductions);

  // Preferential income stacks on top, so deductions come off ordinary first.
  const taxablePreferential = Math.min(qualified, taxable);
  const taxableOrdinary = taxable - taxablePreferential;
  const ordinaryTax = federalTax(taxableOrdinary, status);
  const pref = preferentialTax(taxableOrdinary, taxablePreferential, status);

  return {
    conversion,
    taxableSS,
    agi,
    magi: irmaaMagi,
    seniorMagi,
    seniorDeduction: senior,
    deductions,
    taxable,
    taxableOrdinary,
    taxablePreferential,
    ordinaryTax,
    preferentialTax: pref.tax,
    tax: ordinaryTax + pref.tax,
    bracket: bracketRate(taxableOrdinary, status),
    irmaa: irmaaTier(irmaaMagi, status, status === 'mfs' && !mfsApart),
  };
}

export interface BracketFill {
  /** the bracket rate whose top this conversion reaches */
  rate: number;
  /** ordinary-taxable-income ceiling of that bracket */
  bracketTop: number;
  /** conversion dollars that land ordinary taxable income on that ceiling */
  conversion: number;
}

/**
 * How many conversion dollars fill ORDINARY taxable income to each bracket
 * ceiling, solved against the full stack. Three effects make a converted dollar
 * add more than a dollar of ordinary taxable income (Social Security phase-in
 * and the senior deduction clawback), which is exactly why flat bracket
 * arithmetic from a brokerage calculator overshoots. Note the target is the
 * ordinary portion: qualified dividends and long-term gains ride on top on
 * their own rate schedule and do not consume ordinary bracket room, though a
 * conversion can still push them from 0% into 15%.
 */
export function bracketFills(inputs: PlanInputs, maxConversion = 5_000_000): BracketFill[] {
  const base = scenario(inputs, 0);
  const rows = BRACKETS_2026[inputs.status];
  const fills: BracketFill[] = [];
  for (const row of rows) {
    if (row.upTo === Infinity || row.upTo <= base.taxableOrdinary) continue;
    const c = solveConversionForTaxable(inputs, row.upTo, maxConversion);
    if (c === null) continue;
    fills.push({ rate: row.rate, bracketTop: row.upTo, conversion: c });
  }
  return fills;
}

/**
 * Smallest conversion whose ORDINARY taxable income reaches `target`, or null
 * if unreachable. Monotonic in the conversion amount, so a binary search is
 * safe even though the marginal-rate curve itself is not monotonic.
 */
export function solveConversionForTaxable(
  inputs: PlanInputs,
  target: number,
  maxConversion = 5_000_000,
): number | null {
  if (scenario(inputs, 0).taxableOrdinary >= target) return 0;
  if (scenario(inputs, maxConversion).taxableOrdinary < target) return null;
  let lo = 0;
  let hi = maxConversion;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (scenario(inputs, mid).taxableOrdinary >= target) hi = mid;
    else lo = mid;
  }
  return Math.round(hi);
}

export interface ConversionAnalysis {
  window: WindowResult;
  base: Scenario;
  at: Scenario;
  /** federal tax caused by the conversion */
  conversionTax: number;
  /** conversionTax / conversion */
  effectiveRate: number;
  /** tax on the next 100 converted dollars, at the top of this conversion */
  marginalRate: number;
  /** extra Social Security dollars made taxable by the conversion */
  ssTorpedo: number;
  /** senior-deduction dollars clawed back by the conversion */
  seniorClawback: number;
  /** extra tax on qualified dividends and long-term gains pushed up a rate band */
  preferentialDisplacement: number;
  /** IRMAA tiers crossed (at.irmaa.tier - base.irmaa.tier) */
  irmaaTiersCrossed: number;
  /** added Medicare premiums per person per YEAR caused by the crossing */
  irmaaAnnualPerPerson: number;
}

/** Everything the toolkit knows about one candidate conversion amount. */
export function analyzeConversion(inputs: PlanInputs, conversion: number): ConversionAnalysis {
  const year = inputs.year ?? 2026;
  const base = scenario(inputs, 0);
  const at = scenario(inputs, conversion);
  const bump = scenario(inputs, conversion + 100);
  const conversionTax = at.tax - base.tax;
  return {
    window: conversionWindow(inputs.birthYear, year),
    base,
    at,
    conversionTax,
    effectiveRate: conversion > 0 ? conversionTax / conversion : 0,
    marginalRate: (bump.tax - at.tax) / 100,
    ssTorpedo: at.taxableSS - base.taxableSS,
    seniorClawback: base.seniorDeduction - at.seniorDeduction,
    preferentialDisplacement: at.preferentialTax - base.preferentialTax,
    irmaaTiersCrossed: at.irmaa.tier - base.irmaa.tier,
    irmaaAnnualPerPerson: 12 * (at.irmaa.monthlyPerPerson - base.irmaa.monthlyPerPerson),
  };
}

export { bracketRow };
