/*
 * 2026 figures, every one read from the named primary document on 2026-08-18.
 * Research brief: stepuplaw repo, reference/research/roth-conversion-window.md
 * (passes 3 and 4). Do not edit a number here without re-reading the source.
 */

export type FilingStatus = 'single' | 'mfj' | 'mfs' | 'hoh';

/** One bracket row: tax on income above `over`, up to `upTo`, is `base` plus `rate` on the excess over `over`. */
export interface BracketRow {
  over: number;
  upTo: number; // Infinity on the last row
  base: number;
  rate: number;
}

/*
 * Rev. Proc. 2025-32, section 3.01, read directly from
 * irs.gov/pub/irs-drop/rp-25-32.pdf (extracted with pdftotext, 2026-08-18).
 * Table 1 = section 1(j)(2)(A) MFJ and surviving spouses; Table 2 = 1(j)(2)(B)
 * heads of households; Table 3 = 1(j)(2)(C) unmarried; Table 4 = 1(j)(2)(D)
 * married filing separately. MFS tracks Table 3 exactly until the 35% band,
 * which ends at 384,350 instead of 640,600.
 * Transposition trap flagged in the brief: HoH 24% band ends at 201,750,
 * twenty-five dollars below the single figure of 201,775.
 */
export const BRACKETS_2026: Record<FilingStatus, BracketRow[]> = {
  mfj: [
    { over: 0, upTo: 24800, base: 0, rate: 0.10 },
    { over: 24800, upTo: 100800, base: 2480, rate: 0.12 },
    { over: 100800, upTo: 211400, base: 11600, rate: 0.22 },
    { over: 211400, upTo: 403550, base: 35932, rate: 0.24 },
    { over: 403550, upTo: 512450, base: 82048, rate: 0.32 },
    { over: 512450, upTo: 768700, base: 116896, rate: 0.35 },
    { over: 768700, upTo: Infinity, base: 206583.5, rate: 0.37 },
  ],
  single: [
    { over: 0, upTo: 12400, base: 0, rate: 0.10 },
    { over: 12400, upTo: 50400, base: 1240, rate: 0.12 },
    { over: 50400, upTo: 105700, base: 5800, rate: 0.22 },
    { over: 105700, upTo: 201775, base: 17966, rate: 0.24 },
    { over: 201775, upTo: 256225, base: 41024, rate: 0.32 },
    { over: 256225, upTo: 640600, base: 58448, rate: 0.35 },
    { over: 640600, upTo: Infinity, base: 192979.25, rate: 0.37 },
  ],
  hoh: [
    { over: 0, upTo: 17700, base: 0, rate: 0.10 },
    { over: 17700, upTo: 67450, base: 1770, rate: 0.12 },
    { over: 67450, upTo: 105700, base: 7740, rate: 0.22 },
    { over: 105700, upTo: 201750, base: 16155, rate: 0.24 },
    { over: 201750, upTo: 256200, base: 39207, rate: 0.32 },
    { over: 256200, upTo: 640600, base: 56631, rate: 0.35 },
    { over: 640600, upTo: Infinity, base: 191171, rate: 0.37 },
  ],
  mfs: [
    { over: 0, upTo: 12400, base: 0, rate: 0.10 },
    { over: 12400, upTo: 50400, base: 1240, rate: 0.12 },
    { over: 50400, upTo: 105700, base: 5800, rate: 0.22 },
    { over: 105700, upTo: 201775, base: 17966, rate: 0.24 },
    { over: 201775, upTo: 256225, base: 41024, rate: 0.32 },
    { over: 256225, upTo: 384350, base: 58448, rate: 0.35 },
    { over: 384350, upTo: Infinity, base: 103291.75, rate: 0.37 },
  ],
};

/* Rev. Proc. 2025-32, section 3.14(1): standard deduction for taxable years
 * beginning in 2026. MFS carries the same 16,100 as single. */
export const STANDARD_DEDUCTION_2026: Record<FilingStatus, number> = {
  mfj: 32200,
  single: 16100,
  hoh: 24150,
  mfs: 16100,
};

/* Rev. Proc. 2025-32, section 3.14(3): additional standard deduction under
 * section 63(f) for the aged or the blind is 1,650, increased to 2,050 if the
 * individual is also unmarried and not a surviving spouse. Per qualifying
 * condition; this toolkit models the aged condition only. */
export const AGED_ADDITION_MARRIED = 1650;
export const AGED_ADDITION_UNMARRIED = 2050;

/* OBBBA senior deduction, per the IRS newsroom page "Working families tax
 * cuts: tax deductions for working Americans and seniors", read 2026-08-18.
 * 6,000 per individual aged 65 or older (age attained on or before the last
 * day of the taxable year), available whether or not the taxpayer itemises,
 * TEMPORARY for taxable years 2025 through 2028 only, phased out at 6% of
 * MAGI above 75,000 (150,000 joint). The same page states a married taxpayer
 * must FILE JOINTLY to claim it, so married filing separately gets nothing. */
export const SENIOR_DEDUCTION_PER_PERSON = 6000;
export const SENIOR_DEDUCTION_RATE = 0.06;
export const SENIOR_DEDUCTION_THRESHOLD: Record<FilingStatus, number> = {
  mfj: 150000,
  single: 75000,
  hoh: 75000,
  mfs: 0, // never used: seniorDeduction() returns 0 for MFS because joint filing is a condition
};
export const SENIOR_DEDUCTION_LAST_YEAR = 2028;

/* IRC section 86 thresholds for taxing Social Security benefits. Statutory,
 * never inflation-indexed. Base amount section 86(c)(1); adjusted base amount
 * section 86(c)(2). MFS living with the spouse at any time in the year has a
 * base of zero. */
export const SS_BASE: Record<FilingStatus, number> = {
  mfj: 32000,
  single: 25000,
  hoh: 25000,
  mfs: 0, // living together; living apart all year uses the single figures
};
export const SS_ADJUSTED_BASE: Record<FilingStatus, number> = {
  mfj: 44000,
  single: 34000,
  hoh: 34000,
  mfs: 0,
};

/* 2026 Medicare IRMAA, CMS fact sheet "2026 Medicare Parts A & B Premiums and
 * Deductibles" read directly 2026-08-18 (cms.gov/newsroom/fact-sheets/...).
 * Standard Part B premium 202.90/month. MAGI here is AGI plus tax-exempt
 * interest, from the return TWO years before the premium year (42 U.S.C.
 * 1395r(i); SSA POMS HI 01101.020). Each threshold is a CLIFF: one dollar over
 * lands the whole tier, per person. */
export const PART_B_STANDARD_2026 = 202.9;

export interface IrmaaTier {
  /** MAGI upper bound for this tier (inclusive), single filer */
  singleUpTo: number;
  /** MAGI upper bound for this tier (inclusive), joint filers */
  jointUpTo: number;
  /** monthly Part B surcharge per person */
  partB: number;
  /** monthly Part D surcharge per person */
  partD: number;
}

export const IRMAA_2026: IrmaaTier[] = [
  { singleUpTo: 109000, jointUpTo: 218000, partB: 0, partD: 0 },
  { singleUpTo: 137000, jointUpTo: 274000, partB: 81.2, partD: 14.5 },
  { singleUpTo: 171000, jointUpTo: 342000, partB: 202.9, partD: 37.5 },
  { singleUpTo: 205000, jointUpTo: 410000, partB: 324.6, partD: 60.4 },
  { singleUpTo: 499999, jointUpTo: 749999, partB: 446.3, partD: 83.3 },
  { singleUpTo: Infinity, jointUpTo: Infinity, partB: 487.0, partD: 91.0 },
];

/* MFS (lived with spouse at any time in the year) is a separate, harsher
 * schedule with only three bands and no gentle first step: one dollar over
 * 109,000 lands straight on the fifth-tier surcharge. */
export const IRMAA_2026_MFS: { upTo: number; partB: number; partD: number }[] = [
  { upTo: 109000, partB: 0, partD: 0 },
  { upTo: 390999, partB: 446.3, partD: 83.3 },
  { upTo: Infinity, partB: 487.0, partD: 91.0 },
];

/** Years between the conversion-year MAGI and the premium year it sets. */
export const IRMAA_LOOKBACK_YEARS = 2;
