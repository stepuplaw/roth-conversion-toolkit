import { BRACKETS_2026, type FilingStatus } from './data.js';
import { irmaaTier, type IrmaaResult } from './irmaa.js';
import { conversionWindow, type WindowResult } from './rmd.js';
import { taxableSocialSecurity } from './ss.js';
import { bracketRate, bracketRow, federalTax, seniorDeduction, standardDeduction } from './tax.js';

export interface PlanInputs {
  status: FilingStatus;
  /** owner's birth year, four digits */
  birthYear: number;
  /** spouse is 65 or older by year end (MFJ only) */
  spouse65?: boolean;
  /** 2026 income other than Social Security and other than the conversion (AGI components) */
  otherIncome: number;
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
  /** AGI + tax-exempt interest, the IRMAA and senior-deduction MAGI */
  magi: number;
  seniorDeduction: number;
  deductions: number;
  taxable: number;
  tax: number;
  /** stated bracket rate at this taxable income */
  bracket: number;
  irmaa: IrmaaResult;
}

/** One full pass through the 2026 stack at a given conversion amount. */
export function scenario(inputs: PlanInputs, conversion: number): Scenario {
  const status = inputs.status;
  const year = inputs.year ?? 2026;
  const ss = inputs.ssBenefits ?? 0;
  const exempt = inputs.taxExemptInterest ?? 0;
  const mfsApart = inputs.mfsApart ?? false;
  const you65 = year - inputs.birthYear >= 65;
  const spouse65 = inputs.spouse65 ?? false;

  const otherWithConversion = inputs.otherIncome + conversion;
  const taxableSS = taxableSocialSecurity(ss, otherWithConversion, exempt, status, mfsApart);
  const agi = otherWithConversion + taxableSS;
  const magi = agi + exempt;
  const senior = seniorDeduction(magi, status, you65, spouse65, year);
  const deductions = standardDeduction(status, you65, spouse65) + senior;
  const taxable = Math.max(0, agi - deductions);
  return {
    conversion,
    taxableSS,
    agi,
    magi,
    seniorDeduction: senior,
    deductions,
    taxable,
    tax: federalTax(taxable, status),
    bracket: bracketRate(taxable, status),
    irmaa: irmaaTier(magi, status, status === 'mfs' && !mfsApart),
  };
}

export interface BracketFill {
  /** the bracket rate whose top this conversion reaches */
  rate: number;
  /** taxable-income ceiling of that bracket */
  bracketTop: number;
  /** conversion dollars that land taxable income exactly on that ceiling */
  conversion: number;
}

/**
 * How many conversion dollars fill taxable income to each bracket ceiling,
 * solved against the full stack (Social Security phase-in and the senior
 * deduction clawback both make a converted dollar add more than a dollar
 * of taxable income, which is exactly why flat bracket arithmetic from a
 * brokerage calculator overshoots).
 */
export function bracketFills(inputs: PlanInputs, maxConversion = 5_000_000): BracketFill[] {
  const base = scenario(inputs, 0);
  const rows = BRACKETS_2026[inputs.status];
  const fills: BracketFill[] = [];
  for (const row of rows) {
    if (row.upTo === Infinity || row.upTo <= base.taxable) continue;
    const c = solveConversionForTaxable(inputs, row.upTo, maxConversion);
    if (c === null) continue;
    fills.push({ rate: row.rate, bracketTop: row.upTo, conversion: c });
  }
  return fills;
}

/** Smallest conversion whose taxable income reaches `targetTaxable`, or null if unreachable. */
export function solveConversionForTaxable(
  inputs: PlanInputs,
  targetTaxable: number,
  maxConversion = 5_000_000,
): number | null {
  if (scenario(inputs, 0).taxable >= targetTaxable) return 0;
  if (scenario(inputs, maxConversion).taxable < targetTaxable) return null;
  let lo = 0;
  let hi = maxConversion;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (scenario(inputs, mid).taxable >= targetTaxable) hi = mid;
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
    irmaaTiersCrossed: at.irmaa.tier - base.irmaa.tier,
    irmaaAnnualPerPerson: 12 * (at.irmaa.monthlyPerPerson - base.irmaa.monthlyPerPerson),
  };
}

export { bracketRow };
