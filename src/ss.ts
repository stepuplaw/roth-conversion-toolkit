import { type FilingStatus, SS_ADJUSTED_BASE, SS_BASE } from './data.js';

/**
 * Taxable portion of Social Security benefits under IRC section 86,
 * the Publication 915 worksheet reduced to its formula.
 *
 * `otherIncome` is AGI excluding Social Security (wages, pensions, IRA
 * withdrawals, conversions, interest, dividends, capital gains).
 * `taxExemptInterest` counts toward provisional income even though it is
 * not taxed. `mfsApart` marks a separate filer who lived apart from the
 * spouse for the entire year, who uses the single thresholds; a separate
 * filer who lived with the spouse at any time has a base of zero.
 */
export function taxableSocialSecurity(
  ssBenefits: number,
  otherIncome: number,
  taxExemptInterest: number,
  status: FilingStatus,
  mfsApart = false,
): number {
  if (ssBenefits <= 0) return 0;
  const s: FilingStatus = status === 'mfs' && mfsApart ? 'single' : status;
  const base = SS_BASE[s];
  const adjBase = SS_ADJUSTED_BASE[s];
  const provisional = otherIncome + taxExemptInterest + 0.5 * ssBenefits;
  if (provisional <= base) return 0;
  if (provisional <= adjBase) {
    return Math.min(0.5 * (provisional - base), 0.5 * ssBenefits);
  }
  const tier1 = Math.min(0.5 * (adjBase - base), 0.5 * ssBenefits);
  return Math.min(0.85 * (provisional - adjBase) + tier1, 0.85 * ssBenefits);
}
