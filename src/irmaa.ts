import {
  type FilingStatus,
  IRMAA_2026,
  IRMAA_2026_MFS,
  IRMAA_LOOKBACK_YEARS,
  PART_B_STANDARD_2026,
} from './data.js';

export interface IrmaaResult {
  /** 0-based tier index (0 = no surcharge) */
  tier: number;
  /** monthly Part B surcharge per person */
  partB: number;
  /** monthly Part D surcharge per person */
  partD: number;
  /** total monthly Part B premium per person (standard + surcharge) */
  partBTotal: number;
  /** combined monthly surcharge per person (B + D) */
  monthlyPerPerson: number;
  /** MAGI dollars of headroom before the NEXT cliff (Infinity at the top tier) */
  headroom: number;
  /** how many tiers this MAGI sits above the no-surcharge tier */
  lookbackYears: number;
}

/**
 * IRMAA tier for a 2026 MAGI (AGI + tax-exempt interest). The premium it
 * sets lands two years later, in 2028. Every threshold is a cliff: one
 * dollar over lands the entire tier, for each spouse on Medicare.
 * `mfsTogether` selects the separate, harsher MFS schedule that applies to
 * a separate filer who lived with the spouse at any time in the year.
 */
export function irmaaTier(
  magi: number,
  status: FilingStatus,
  mfsTogether = false,
): IrmaaResult {
  if (status === 'mfs' && mfsTogether) {
    const i = IRMAA_2026_MFS.findIndex((t) => magi <= t.upTo);
    const t = IRMAA_2026_MFS[i];
    return {
      tier: i,
      partB: t.partB,
      partD: t.partD,
      partBTotal: PART_B_STANDARD_2026 + t.partB,
      monthlyPerPerson: t.partB + t.partD,
      headroom: i < IRMAA_2026_MFS.length - 1 ? IRMAA_2026_MFS[i].upTo - magi : Infinity,
      lookbackYears: IRMAA_LOOKBACK_YEARS,
    };
  }
  const joint = status === 'mfj';
  const i = IRMAA_2026.findIndex((t) => magi <= (joint ? t.jointUpTo : t.singleUpTo));
  const t = IRMAA_2026[i];
  const bound = joint ? IRMAA_2026[i].jointUpTo : IRMAA_2026[i].singleUpTo;
  return {
    tier: i,
    partB: t.partB,
    partD: t.partD,
    partBTotal: PART_B_STANDARD_2026 + t.partB,
    monthlyPerPerson: t.partB + t.partD,
    headroom: i < IRMAA_2026.length - 1 ? bound - magi : Infinity,
    lookbackYears: IRMAA_LOOKBACK_YEARS,
  };
}
