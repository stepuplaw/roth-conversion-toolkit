/**
 * Applicable RMD age under SECURE 2.0 section 107. Born 1951 through 1959
 * is 73, including 1959, where the statute is self-contradictory (section
 * 107(c) arguably assigns both 73 and 75). The final regulations (T.D.
 * 10001) RESERVED that question; the age-73 answer lives in the proposed
 * regulations, REG-103529-23, 89 FR 58644, 58645 ("In the case of an
 * employee born in 1959, the applicable age is age 73"), still proposed as
 * of 2026-08-18. Recheck 26 CFR 1.401(a)(9)-2(b)(2)(v) at each refresh.
 * Born 1960 or later is 75. Earlier cohorts (72, 70 and a half) are
 * already past their starting age and the window analysis treats them so.
 */
export function rmdAge(birthYear: number): number {
  if (birthYear >= 1960) return 75;
  if (birthYear >= 1951) return 73;
  if (birthYear >= 1949) return 72; // born July 1949 to end of 1950 (month-level nuance not modelled)
  return 70.5;
}

export interface WindowResult {
  rmdAge: number;
  /** calendar year RMDs begin (the year the owner reaches the applicable age) */
  firstRmdYear: number;
  /** full calendar years remaining before the first RMD year, from `fromYear` */
  yearsLeft: number;
  /** true when the owner is already in RMD territory */
  rmdStarted: boolean;
  /** true only for a 1959 birth year, where the statute contradicts itself
   * and the age-73 answer rests on a still-proposed regulation */
  ambiguity1959: boolean;
}

/** The conversion window: the years between now and the first RMD year. */
export function conversionWindow(birthYear: number, fromYear = 2026): WindowResult {
  const age = rmdAge(birthYear);
  const firstRmdYear = birthYear + Math.ceil(age);
  return {
    rmdAge: age,
    firstRmdYear,
    yearsLeft: Math.max(0, firstRmdYear - fromYear),
    rmdStarted: fromYear >= firstRmdYear,
    ambiguity1959: birthYear === 1959,
  };
}
