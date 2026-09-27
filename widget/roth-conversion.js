/*!
 * Roth conversion window calculator, embeddable widget
 * Kevin D. Klagge, Esq.  https://stepuplaw.com/roth-conversion-calculator
 *
 * Drop this anywhere:
 *   <div data-stepup-roth></div>
 *   <script src="https://stepuplaw.com/embed/roth-conversion.js" async></script>
 *
 * Everything runs in the visitor's browser. The widget makes no network calls
 * after this file loads, no analytics, no tracking, and nothing typed into it
 * is transmitted anywhere. It never asks for a Social Security number or an
 * account number.
 *
 * MIT licensed, which asks nothing of you. We do ask, without requiring it,
 * that you keep the credit line and its followable link to stepuplaw.com. That
 * link is how corrections reach the people running this, and it is what makes
 * maintaining it worth doing.
 * https://github.com/stepuplaw/roth-conversion-toolkit/blob/main/ATTRIBUTION.md
 *
 * Every figure in here was read from the primary document it belongs to, on
 * the VERIFIED date below. The 2026 rate tables, standard deduction and
 * capital-gain rate ceilings come from Rev. Proc. 2025-32 sections 4.01, 4.14
 * and 4.03 read directly; the senior deduction from IRC 151(d)(5) as added by
 * Pub. L. 119-21 and from IRS Schedule 1-A; the 2026 Medicare IRMAA schedule
 * from the CMS fact sheet; the Social Security thresholds from IRC section 86.
 * Tax figures change every year. Load this file from stepuplaw.com rather than
 * copying it, and your embed stays current automatically.
 */
(function () {
  'use strict';

  var HOME = 'https://stepuplaw.com';
  var TOOL = HOME + '/roth-conversion-calculator';
  var VERIFIED = 'August 19, 2026';
  var YEAR = 2026;

  /* ---------- verified 2026 figures ---------- */

  /* Rev. Proc. 2025-32, section 4.01 (section 4 carries the 2026 items; section 3
     is the 2025 modification). Each row is [top of band, base tax, rate]. */
  var BRACKETS = {
    mfj: [[24800, 0, 0.10], [100800, 2480, 0.12], [211400, 11600, 0.22], [403550, 35932, 0.24], [512450, 82048, 0.32], [768700, 116896, 0.35], [Infinity, 206583.5, 0.37]],
    single: [[12400, 0, 0.10], [50400, 1240, 0.12], [105700, 5800, 0.22], [201775, 17966, 0.24], [256225, 41024, 0.32], [640600, 58448, 0.35], [Infinity, 192979.25, 0.37]],
    hoh: [[17700, 0, 0.10], [67450, 1770, 0.12], [105700, 7740, 0.22], [201750, 16155, 0.24], [256200, 39207, 0.32], [640600, 56631, 0.35], [Infinity, 191171, 0.37]],
    mfs: [[12400, 0, 0.10], [50400, 1240, 0.12], [105700, 5800, 0.22], [201775, 17966, 0.24], [256225, 41024, 0.32], [384350, 58448, 0.35], [Infinity, 103291.75, 0.37]]
  };
  /* Standard deduction, Rev. Proc. 2025-32 s.4.14 (2026 figures).
     WARNING: s.3 of that revenue procedure is the 2025 modification, not 2026.
     Citing s.3.14 is wrong and shipped live once before it was caught. */
  var STD = { mfj: 32200, single: 16100, hoh: 24150, mfs: 16100 };

  /* Rev. Proc. 2025-32 section 4.03 (IRC 1(h), 1(j)(5)): the ceilings for the
     0% and 15% rates on qualified dividends and long-term gains. These are
     levels of TOTAL taxable income, because that income stacks on top of
     ordinary income rather than getting its own allowance. */
  /* Capital gain and qualified dividend rate ceilings, IRC s.1(h), amounts from
     Rev. Proc. 2025-32 s.4.03. PREF0 is the top of the 0% band, PREF15 the top
     of the 15% band. They stack ON TOP of ordinary taxable income, which is why
     a conversion sliding in underneath can push gains from 0% into 15%. */
  var PREF0 = { mfj: 98900, single: 49450, hoh: 66200, mfs: 49450 };
  var PREF15 = { mfj: 613700, single: 545500, hoh: 579600, mfs: 306850 };

  /* IRC section 86 thresholds, statutory and never indexed. MFS living with
     the spouse at any time in the year has a base of zero. */
  /* IRC s.86(c) base amount and adjusted base amount. Set by Congress in 1983
     (Pub. L. 98-21) and never indexed for inflation, which is why an ordinary
     retiree now lands inside a range originally aimed at high earners.
     s.86(c)(1)(C)(i) sets the base amount at ZERO for a married person filing
     separately who lived with their spouse at any time during the year, which
     is what the mfs entries and the mfsApart flag implement.
     Verified against the statute across 200,000 random cases on 2026-08-24. */
  var SS_BASE = { mfj: 32000, single: 25000, hoh: 25000, mfs: 0 };
  var SS_ADJ = { mfj: 44000, single: 34000, hoh: 34000, mfs: 0 };

  /* CMS 2026 fact sheet. MAGI bounds are inclusive tops, per person surcharges. */
  var PARTB_STD = 202.90;
  var IRMAA = [
    { s: 109000, j: 218000, b: 0, d: 0 },
    { s: 137000, j: 274000, b: 81.20, d: 14.50 },
    { s: 171000, j: 342000, b: 202.90, d: 37.50 },
    { s: 205000, j: 410000, b: 324.60, d: 60.40 },
    { s: 499999, j: 749999, b: 446.30, d: 83.30 },
    { s: Infinity, j: Infinity, b: 487.00, d: 91.00 }
  ];
  var IRMAA_MFS = [
    { s: 109000, b: 0, d: 0 },
    { s: 390999, b: 446.30, d: 83.30 },
    { s: Infinity, b: 487.00, d: 91.00 }
  ];

  /* ---------- math, mirrored from the tested npm package ---------- */

  function federalTax(taxable, status) { return ordWork(taxable, status).tax; }
  /* The bracket row actually used, kept so the page can print the formula. */
  /* IRC s.1(j) rate tables as inflation-adjusted for 2026 by Rev. Proc.
     2025-32 s.4.01. Each row is [top of bracket, cumulative tax at the bottom
     of this bracket, marginal rate], so tax = base + rate x (taxable - the
     previous row's top). The table satisfies base[n] = base[n-1] +
     rate[n-1] x width[n-1], which is asserted in the library test suite. */
  function ordWork(taxable, status) {
    var rows = BRACKETS[status];
    if (taxable <= 0) return { tax: 0, over: 0, base: 0, rate: rows[0][2], applied: 0 };
    for (var i = 0; i < rows.length; i++) {
      if (taxable <= rows[i][0]) {
        var over = i === 0 ? 0 : rows[i - 1][0];
        return { tax: rows[i][1] + rows[i][2] * (taxable - over),
                 over: over, base: rows[i][1], rate: rows[i][2],
                 applied: taxable - over };
      }
    }
    return { tax: 0, over: 0, base: 0, rate: rows[0][2], applied: 0 };
  }
  function bracketAt(taxable, status) {
    var rows = BRACKETS[status];
    if (taxable <= 0) return { rate: rows[0][2], top: rows[0][0] };
    for (var i = 0; i < rows.length; i++) {
      if (taxable <= rows[i][0]) return { rate: rows[i][2], top: rows[i][0] };
    }
  }
  function taxableSS(ben, other, exempt, status, mfsApart) {
    return ssWork(ben, other, exempt, status, mfsApart).taxable;
  }
  /* Same computation, but keeping every intermediate so the page can show its
     working. taxableSS() delegates here so there is one implementation. */
  /* IRC s.86(a). Two tiers.
       s.86(a)(1)  taxable = lesser of 50% of (provisional income - base amount)
                   and 50% of benefits.
       s.86(a)(2)  once provisional income passes the adjusted base amount,
                   taxable = lesser of
                     (A) 85% of the excess over the adjusted base amount, PLUS
                         the lesser of the s.86(a)(1) amount or one-half of the
                         difference between the adjusted base and base amounts
                         (4,500 single, 6,000 joint), and
                     (B) 85% of benefits.
     s.86(b)(2) defines provisional income as AGI computed without the benefits,
     PLUS tax-exempt interest under s.86(b)(2)(B), PLUS one half of the benefits.
     The tax-exempt interest add-back is why muni bonds raise this figure even
     though the interest itself is never taxed. */
  function ssWork(ben, other, exempt, status, mfsApart) {
    var s = status === 'mfs' && mfsApart ? 'single' : status;
    var base = SS_BASE[s], adj = SS_ADJ[s];
    var pi = other + exempt + 0.5 * ben;
    var w = { s: s, base: base, adj: adj, pi: pi, half: 0.5 * ben, tier: 0,
              tier1: 0, tier2: 0, cap: 0.85 * ben, taxable: 0 };
    if (ben <= 0) { w.pi = 0; return w; }
    if (pi <= base) { w.tier = 0; return w; }
    if (pi <= adj) {
      w.tier = 1;
      w.tier1 = Math.min(0.5 * (pi - base), 0.5 * ben);
      w.taxable = w.tier1;
      return w;
    }
    w.tier = 2;
    w.tier1 = Math.min(0.5 * (adj - base), 0.5 * ben);
    w.tier2 = 0.85 * (pi - adj);
    w.taxable = Math.min(w.tier2 + w.tier1, w.cap);
    w.capped = (w.tier2 + w.tier1) > w.cap;
    return w;
  }
  /* IRC 151(d)(5)(C) and IRS Schedule 1-A Part V. The 6% reduction applies to
     the PER-PERSON 6,000 and each qualified individual then claims the reduced
     amount (form line 35 computed once, entered on both 36a and 36b), so a
     couple both 65+ is fully phased out at 250,000, not 350,000. The MAGI here
     excludes tax-exempt interest, unlike the IRMAA MAGI. */
  function seniorDed(magi, status, you65, sp65) {
    if (status === 'mfs') return 0; /* joint filing is a condition of the deduction */
    var n = (you65 ? 1 : 0) + (status === 'mfj' && sp65 ? 1 : 0);
    if (!n) return 0;
    var thr = status === 'mfj' ? 150000 : 75000;
    return n * Math.max(0, 6000 - 0.06 * Math.max(0, magi - thr));
  }
  /* Tax on qualified dividends and long-term gains, IRC 1(h). They stack on
     top of ordinary income, so a conversion slides in underneath and can push
     them from 0% into 15%. */
  /* IRC s.1(h)(1). Qualified dividends and net long-term gains are taxed on
     their own schedule and are treated as the TOP slice of taxable income, so
     ordinary income fills the 0% band first and displaces gains upward. The
     0%/15%/20% breakpoints come from Rev. Proc. 2025-32 s.4.03. */
  function prefTax(ordinaryTaxable, pref, status) {
    var amt = Math.max(0, pref);
    var at0 = Math.min(amt, Math.max(0, PREF0[status] - ordinaryTaxable));
    var room = Math.max(0, PREF15[status] - Math.max(ordinaryTaxable, PREF0[status]));
    var at15 = Math.min(amt - at0, room);
    var at20 = amt - at0 - at15;
    return { at0: at0, at15: at15, at20: at20, tax: 0.15 * at15 + 0.20 * at20 };
  }
  /* Additional standard deduction for age 65 or older, IRC s.63(f), amounts
     from Rev. Proc. 2025-32 s.4.14. Separate from and additional to the
     temporary senior deduction below. */
  function agedAdd(status, you65, sp65) {
    if (status === 'mfj') return (you65 ? 1650 : 0) + (sp65 ? 1650 : 0);
    if (status === 'mfs') return you65 ? 1650 : 0;
    return you65 ? 2050 : 0;
  }
  function irmaaTier(magi, status, mfsTogether) {
    var i, t;
    if (status === 'mfs' && mfsTogether) {
      for (i = 0; i < IRMAA_MFS.length; i++) {
        if (magi <= IRMAA_MFS[i].s) {
          t = IRMAA_MFS[i];
          return { tier: i, b: t.b, d: t.d, head: i < IRMAA_MFS.length - 1 ? t.s - magi : Infinity };
        }
      }
    }
    var joint = status === 'mfj';
    for (i = 0; i < IRMAA.length; i++) {
      var bound = joint ? IRMAA[i].j : IRMAA[i].s;
      if (magi <= bound) {
        t = IRMAA[i];
        return { tier: i, b: t.b, d: t.d, head: i < IRMAA.length - 1 ? bound - magi : Infinity };
      }
    }
  }
  function rmdAge(by) {
    if (by >= 1960) return 75;
    if (by >= 1951) return 73;
    if (by >= 1949) return 72;
    return 71; /* display only; these cohorts started long ago */
  }
  function scen(inp, conv) {
    var qual = Math.max(0, inp.qual || 0);
    var other = inp.other + conv;              /* ordinary, conversion included */
    var tss = taxableSS(inp.ss, other + qual, inp.exempt, inp.status, inp.mfsApart);
    var agi = other + qual + tss;
    /* Two different MAGIs on purpose: IRMAA counts tax-exempt interest, the
       senior deduction does not. */
    var irmaaMagi = agi + inp.exempt;
    var seniorMagi = agi;
    var sen = seniorDed(seniorMagi, inp.status, inp.you65, inp.sp65);
    var ded = STD[inp.status] + agedAdd(inp.status, inp.you65, inp.sp65) + sen;
    var taxable = Math.max(0, agi - ded);
    var tpref = Math.min(qual, taxable);       /* deductions come off ordinary first */
    var tord = taxable - tpref;
    var p = prefTax(tord, tpref, inp.status);
    var ordTax = federalTax(tord, inp.status);
    return {
      conv: conv, tss: tss, agi: agi, magi: irmaaMagi, seniorMagi: seniorMagi,
      senior: sen, ded: ded, taxable: taxable, tord: tord, tpref: tpref,
      prefTax: p.tax, tax: ordTax + p.tax,
      other: other, qual: qual, ordTax: ordTax,
      ssw: ssWork(inp.ss, other + qual, inp.exempt, inp.status, inp.mfsApart),
      ordw: ordWork(tord, inp.status), prefw: p,
      std: STD[inp.status], aged: agedAdd(inp.status, inp.you65, inp.sp65),
      bracket: bracketAt(tord, inp.status),
      irmaa: irmaaTier(irmaaMagi, inp.status, inp.status === 'mfs' && !inp.mfsApart)
    };
  }
  /* Solves on ORDINARY taxable income: the brackets apply to that portion, and
     preferential income rides on top on its own schedule. */
  function solveToTaxable(inp, target) {
    if (scen(inp, 0).tord >= target) return 0;
    var lo = 0, hi = 5000000;
    if (scen(inp, hi).tord < target) return null;
    for (var i = 0; i < 50; i++) {
      var mid = (lo + hi) / 2;
      if (scen(inp, mid).tord >= target) hi = mid; else lo = mid;
    }
    return Math.round(hi);
  }

  /* ---------- formatting ---------- */

  function usd(n) { return '$' + Math.round(n).toLocaleString('en-US'); }
  function usd2(n) { return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function pct(n) { return (Math.round(n * 1000) / 10).toLocaleString('en-US') + '%'; }
  function num(raw) { return Number(String(raw || '').replace(/[^0-9.]/g, '')) || 0; }

  /* ---------- styles ---------- */

  /* --surc-line is the hairline used inside the card. --surc-edge is the heavier
     one used for the outer frame and the section rules, so an embedder can
     strengthen the outline without darkening every internal divider. */
  var CSS =
    '.surc{--surc-brand:#1F4D3A;--surc-fg:#1E293B;--surc-mut:#475569;--surc-line:rgba(71,85,105,.25);' +
    '--surc-edge:#334155;' +
    'font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:var(--surc-fg);' +
    'font-size:16px;line-height:1.6;max-width:760px;border:2px solid var(--surc-edge);border-radius:14px;' +
    'background:#fff;overflow:hidden;box-shadow:0 1px 2px rgba(20,32,26,.10),0 10px 28px rgba(20,32,26,.13)}' +
    '.surc *{box-sizing:border-box}' +
    /* Header strip, the same recessed bar the credit freeze widget uses for its
       tabs, so the two tools read as one family. */
    '.surc-hd{background:#EDEAE0;border-bottom:2px solid var(--surc-edge);padding:13px 20px}' +
    '.surc-hd b{display:block;font-size:16px;font-weight:700;color:var(--surc-brand);letter-spacing:.005em}' +
    '.surc-hd span{display:block;font-size:12.5px;color:var(--surc-mut);margin-top:2px}' +
    /* Inputs sit on a tint so the answer area below reads as a separate half. */
    '.surc-in{background:#FAF9F5;border-bottom:2px solid var(--surc-edge);padding:16px 20px}' +
    '.surc-body{padding:16px 20px}' +
    '.surc-grid{display:grid;grid-template-columns:1fr 1fr;gap:13px 20px}' +
    '@media(max-width:560px){.surc-grid{grid-template-columns:1fr}' +
    '.surc-hd,.surc-in,.surc-body,.surc-foot{padding-left:14px;padding-right:14px}}' +
    '.surc label{display:block}' +
    '.surc .surc-lab{font-weight:600;display:block;margin-bottom:4px;font-size:14.5px}' +
    '.surc .surc-hint{font-size:12.5px;color:var(--surc-mut);margin-top:4px;display:block;line-height:1.5}' +
    '.surc input,.surc select{width:100%;padding:9px 11px;font-size:16px;border:1px solid var(--surc-line);' +
    'border-radius:8px;background:#fff;color:var(--surc-fg)}' +
    '.surc input:focus,.surc select:focus{outline:0;border-color:var(--surc-brand);' +
    'box-shadow:0 0 0 3px rgba(31,77,58,.15)}' +
    '.surc-cards{display:grid;gap:13px}' +
    /* Every answer card gets a titled bar, so the sections are distinct at a
       glance instead of running together as one wall of boxes. */
    '.surc-card{border:1px solid var(--surc-edge);border-radius:10px;overflow:hidden;background:#fff}' +
    '.surc-card h4{margin:0;font-size:15px;font-weight:700;letter-spacing:.005em;padding:9px 15px;' +
    'background:#F2F0E8;border-bottom:1px solid var(--surc-edge);color:var(--surc-fg)}' +
    '.surc-card .surc-bd{padding:13px 15px}.surc-work{width:100%;border-collapse:collapse;font-size:.84rem;margin:.25rem 0}.surc-work th{text-align:left;font-weight:600;padding:.4rem .5rem;border-bottom:2px solid var(--surc-edge,#334155)}.surc-work td{padding:.42rem .5rem;border-bottom:1px solid rgba(51,65,85,.16);vertical-align:top}.surc-work .surc-ln{width:2.2em;text-align:right;color:#64748b;font-variant-numeric:tabular-nums;padding-right:.35rem}.surc-work td.surc-f{color:#475569;font-variant-numeric:tabular-nums}.surc-work td.surc-n{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums;font-weight:600}.surc-work tr.surc-sec td{background:rgba(51,65,85,.07);font-weight:700;font-size:.82rem;letter-spacing:.02em;padding:.5rem .5rem;border-bottom:1px solid rgba(51,65,85,.25)}.surc-ref{display:inline-block;background:rgba(51,65,85,.1);border-radius:4px;padding:0 .3em;font-weight:600;color:#334155;font-size:.95em}@media(max-width:560px){.surc-work,.surc-work tbody,.surc-work tr,.surc-work td{display:block;width:100%}.surc-work thead{display:none}.surc-work tr{border-bottom:1px solid rgba(51,65,85,.18);padding:.4rem 0}.surc-work tr.surc-sec td{display:block}.surc-work td{border:0;padding:.12rem .3rem}.surc-work td.surc-n{text-align:left;font-size:1.05em}.surc-work .surc-ln{display:inline-block;width:auto;text-align:left}}' +
    '.surc-card.surc-head{border-color:var(--surc-brand)}' +
    '.surc-card.surc-head h4{background:var(--surc-brand);color:#fff;border-bottom-color:var(--surc-brand)}' +
    '.surc-card.surc-warn{border-color:#B08D2E}' +
    '.surc-card.surc-warn h4{background:#B08D2E;color:#fff;border-bottom-color:#B08D2E}' +
    '.surc-card.surc-warn .surc-bd{background:rgba(176,141,46,.07)}' +
    '.surc-card p{margin:8px 0 0}.surc-card p:first-child{margin-top:0}' +
    '.surc-card ul{margin:8px 0 0;padding-left:20px}' +
    '.surc-card li{margin-top:5px}' +
    '.surc-tbl{width:100%;border-collapse:collapse;margin-top:10px;font-size:15px}' +
    '.surc-tbl th,.surc-tbl td{text-align:left;padding:7px 9px;border-bottom:1px solid var(--surc-line)}' +
    '.surc-tbl tr:last-child td{border-bottom:0}' +
    '.surc-tbl th{font-weight:700;background:#FAF9F5;border-bottom-color:var(--surc-edge)}' +
    '.surc-small{font-size:13px;color:var(--surc-mut);line-height:1.55}' +
    '.surc-foot{font-size:12px;color:var(--surc-mut);border-top:2px solid var(--surc-edge);' +
    'background:#F7F5EF;padding:14px 20px;line-height:1.65}' +
    '.surc-foot a{color:var(--surc-brand);font-weight:600}' +
    '.surc-foot strong{color:var(--surc-fg)}' +
    '.surc details{margin-top:0}' +
    '.surc summary{cursor:pointer;font-weight:700;font-size:15px;padding:11px 15px;background:#F2F0E8;' +
    'border:1px solid var(--surc-edge);border-radius:10px;list-style-position:inside}' +
    '.surc details[open] summary{border-radius:10px 10px 0 0;border-bottom-color:var(--surc-line)}' +
    '.surc details .surc-card{border-radius:0 0 10px 10px;border-top:0;margin-top:0}';

  /* ---------- UI ---------- */

  function build(root) {
    var showCredit = String(root.getAttribute('data-surc-credit')).toLowerCase() !== 'off';
    root.className = (root.className ? root.className + ' ' : '') + 'surc';
    root.innerHTML =
      '<div class="surc-hd"><b>Roth conversion calculator</b>' +
      '<span>2026 federal figures, verified ' + VERIFIED + '. Nothing you type leaves your browser.</span></div>' +
      '<div class="surc-in">' +
      '<div class="surc-grid">' +
      '<label><span class="surc-lab">Filing status</span><select data-f="status">' +
      '<option value="mfj">Married filing jointly</option>' +
      '<option value="single">Single</option>' +
      '<option value="hoh">Head of household</option>' +
      '<option value="mfs">Married filing separately</option>' +
      '</select></label>' +
      '<label data-row="mfsapart" style="display:none"><span class="surc-lab">Lived with your spouse at any time this year?</span><select data-f="mfsapart">' +
      '<option value="together">Yes</option><option value="apart">No, apart all year</option>' +
      '</select></label>' +
      '<label><span class="surc-lab">Your birth year</span><input data-f="by" inputmode="numeric" placeholder="e.g. 1958">' +
      '<span class="surc-hint" data-out="agehint"></span></label>' +
      '<label data-row="sp65"><span class="surc-lab">Is your spouse 65 or older this year?</span><select data-f="sp65">' +
      '<option value="no">No</option><option value="yes">Yes</option>' +
      '</select></label>' +
      '<label><span class="surc-lab">2026 ordinary income before the conversion, not counting Social Security</span><input data-f="other" inputmode="numeric" placeholder="e.g. 80,000">' +
      '<span class="surc-hint">Pensions, wages, interest, annuity and IRA withdrawals. Put qualified dividends and long-term capital gains in the next box instead, they are taxed on a different schedule.</span></label>' +
      '<label><span class="surc-lab">Qualified dividends and long-term capital gains</span><input data-f="qual" inputmode="numeric" placeholder="usually 0">' +
      '<span class="surc-hint">Taxed at 0, 15 or 20 percent, and they sit on top of your other income. A conversion slides in underneath and can push them into a higher rate.</span></label>' +
      '<label><span class="surc-lab">Social Security benefits for 2026, if any</span><input data-f="ss" inputmode="numeric" placeholder="e.g. 36,000"></label>' +
      '<label><span class="surc-lab">Tax-exempt interest, if any</span><input data-f="exempt" inputmode="numeric" placeholder="usually 0">' +
      '<span class="surc-hint">Municipal bond interest. It is tax free but still counts toward Medicare and Social Security thresholds.</span></label>' +
      '<label><span class="surc-lab">Amount you are considering converting</span><input data-f="conv" inputmode="numeric" placeholder="e.g. 50,000">' +
      '<span class="surc-hint">Moving money out of a traditional IRA and into a Roth IRA. The money keeps growing, it is taxed as ordinary income this year, and it is never taxed again. Leave it blank to see how much room your brackets hold.</span></label>' +
      '</div></div>' +
      '<div class="surc-body"><div class="surc-cards" data-out="cards"></div></div>' +
      '<div class="surc-foot">' +
      'This is general information and an estimate, not legal or tax advice, and it creates no attorney-client relationship. ' +
      'It assumes the standard deduction and 2026 federal figures. It does not model itemized deductions (including the medical expense deduction, which a conversion shrinks by raising your income), ' +
      'the 3.8 percent net investment income tax, the qualified business income deduction, or health insurance subsidies before age 65. State income tax is not included (Florida has none). ' +
      'Figures verified against Rev. Proc. 2025-32, IRC section 151(d)(5) with IRS Schedule 1-A, the CMS 2026 fact sheet, and IRC section 86 on <strong>' + VERIFIED + '</strong>. ' +
      (showCredit
        ? 'Roth conversion calculator by Kevin D. Klagge, Esq. Full guide at <a href="' + TOOL + '" target="_blank" rel="noopener">stepuplaw.com</a>.'
        : '') +
      '</div>';

    if (!document.getElementById('surc-css')) {
      var st = document.createElement('style');
      st.id = 'surc-css';
      st.textContent = CSS;
      document.head.appendChild(st);
    }

    var els = {};
    root.querySelectorAll('[data-f]').forEach(function (el) { els[el.getAttribute('data-f')] = el; });
    var out = root.querySelector('[data-out="cards"]');
    var ageHint = root.querySelector('[data-out="agehint"]');

    ['other', 'qual', 'ss', 'exempt', 'conv'].forEach(function (k) {
      els[k].addEventListener('input', function () {
        var raw = els[k].value.replace(/[^0-9]/g, '');
        els[k].value = raw ? Number(raw).toLocaleString('en-US') : '';
        render();
      });
    });
    els.by.addEventListener('input', render);
    ['status', 'sp65', 'mfsapart'].forEach(function (k) { els[k].addEventListener('change', render); });

    function card(kind, title, body) {
      return '<div class="surc-card surc-' + kind + '"><h4>' + title + '</h4>' +
        '<div class="surc-bd">' + body + '</div></div>';
    }

    function render() {
      var status = els.status.value;
      root.querySelector('[data-row="sp65"]').style.display = status === 'mfj' ? '' : 'none';
      root.querySelector('[data-row="mfsapart"]').style.display = status === 'mfs' ? '' : 'none';

      var byRaw = els.by.value.replace(/[^0-9]/g, '');
      var by = byRaw.length === 4 ? Number(byRaw) : 0;
      var age = by ? YEAR - by : 0;
      ageHint.textContent = by ? 'Turning ' + age + ' in ' + YEAR : '';

      var inp = {
        status: status,
        other: num(els.other.value),
        qual: num(els.qual.value),
        ss: num(els.ss.value),
        exempt: num(els.exempt.value),
        you65: !!by && age >= 65,
        sp65: els.sp65.value === 'yes',
        mfsApart: els.mfsapart.value === 'apart'
      };
      var conv = num(els.conv.value);

      if (!by || (!inp.other && !inp.ss && !inp.qual)) {
        out.innerHTML = card('card', 'Enter your birth year and income to begin',
          '<p class="surc-small">Nothing you type here leaves your browser.</p>');
        return;
      }

      var h = '';
      var base = scen(inp, 0);
      var at = conv > 0 ? scen(inp, conv) : base;

      /* window card */
      var ra = rmdAge(by);
      var firstRmd = by + Math.ceil(ra);
      if (YEAR >= firstRmd) {
        var ageLabel = by >= 1951 ? 'age ' + ra + ' for your birth year' : 'your cohort reached its starting age years ago';
        h += card('warn', 'You are in RMD territory, so sequence matters',
          '<p>Required minimum distributions have begun for you (' + ageLabel + '). You can still convert, but you must take the full year’s RMD first, and the RMD itself can never be converted. Converting money before the RMD is taken counts as an excess Roth contribution carrying a 6% excise tax each year until it is fixed.</p>');
      } else {
        var winBody = '<p>Required minimum distributions start for you at age ' + ra + ', in <strong>' + firstRmd + '</strong>. That leaves <strong>' + (firstRmd - YEAR) + ' tax year' + (firstRmd - YEAR === 1 ? '' : 's') + '</strong> including this one to convert at brackets you choose, before RMDs start filling them for you.</p>';
        if (by === 1959) {
          winBody += '<p class="surc-small">Born in 1959, the statute contradicts itself on whether your age is 73 or 75. Treasury has proposed fixing it at 73, the final rules left the question open, and 73 is the safe planning age used here.</p>';
        }
        h += card('head', 'Your conversion window', winBody);
      }

      /* bracket picture */
      var bb = '<p>Before any conversion, your taxable income is about <strong>' + usd(base.taxable) + '</strong>' +
        (base.tpref > 0 ? ', of which ' + usd(base.tpref) + ' is dividends and long-term gains taxed on their own schedule, leaving ' + usd(base.tord) + ' in the <strong>' + pct(base.bracket.rate) + '</strong> ordinary bracket.</p>'
                        : ', in the <strong>' + pct(base.bracket.rate) + '</strong> bracket.</p>');
      var rows = BRACKETS[status];
      var fills = [];
      for (var i = 0; i < rows.length - 1 && fills.length < 3; i++) {
        if (rows[i][0] <= base.tord) continue;
        var c = solveToTaxable(inp, rows[i][0]);
        if (c !== null && c > 0) fills.push({ rate: rows[i][2], c: c });
      }
      if (fills.length) {
        bb += '<table class="surc-tbl"><tr><th>To fill the</th><th>You can convert about</th><th>Federal tax on it</th></tr>';
        for (var j = 0; j < fills.length; j++) {
          var fs = scen(inp, fills[j].c);
          bb += '<tr><td>' + pct(fills[j].rate) + ' bracket</td><td>' + usd(fills[j].c) + '</td><td>' + usd(fs.tax - base.tax) + '</td></tr>';
        }
        bb += '</table>';
        bb += '<p class="surc-small">These amounts already account for Social Security phase-in and the senior deduction clawback, which is why they can be smaller than the plain distance to the bracket line.</p>';
      }
      h += card('card', 'How much room your brackets hold', bb);

      /* conversion cost card */
      if (conv > 0) {
        var extraTax = at.tax - base.tax;
        var eff = extraTax / conv;
        var bump = scen(inp, conv + 100);
        var marg = (bump.tax - at.tax) / 100;
        var cb = '<p>Converting <strong>' + usd(conv) + '</strong> adds about <strong>' + usd(extraTax) + '</strong> of federal income tax this year, an effective <strong>' + pct(eff) + '</strong> on the converted amount. The next dollar converts at ' + pct(marg) + '.</p>';
        var torpedo = at.tss - base.tss;
        if (torpedo > 50) {
          cb += '<p><strong>Social Security effect.</strong> This conversion drags ' + usd(torpedo) + ' more of your Social Security into taxable income. That is included in the numbers above, and it is the piece flat bracket arithmetic misses.</p>';
        }
        var claw = base.senior - at.senior;
        if (claw > 50) {
          cb += '<p><strong>Senior deduction effect.</strong> This conversion claws back ' + usd(claw) + ' of the new senior deduction, also included above.</p>';
        }
        var disp = at.prefTax - base.prefTax;
        if (disp > 5) {
          cb += '<p><strong>Capital gains effect.</strong> The conversion is ordinary income, so it slides in underneath your dividends and long-term gains and pushes ' + usd(disp) + ' of them into a higher rate. That is included above and it is the effect most calculators leave out entirely.</p>';
        }
        cb += '<p class="surc-small">Paying the tax from money outside the IRA keeps the full converted amount growing tax free, and it quietly shrinks a taxable estate with no gift tax. Withholding the tax from the conversion itself can add an early-withdrawal penalty before age 59½.</p>';
        h += card('head', 'What this conversion costs', cb);
      }

      /* IRMAA card */
      var medicareRelevant = age >= 63;
      if (medicareRelevant) {
        var ib = '';
        var crossed = at.irmaa.tier - base.irmaa.tier;
        var premYear = YEAR + 2;
        if (conv > 0 && crossed > 0) {
          var addMonthly = (at.irmaa.b + at.irmaa.d) - (base.irmaa.b + base.irmaa.d);
          ib += '<p>This conversion pushes your ' + YEAR + ' income across ' + (crossed === 1 ? 'a Medicare surcharge cliff' : crossed + ' Medicare surcharge cliffs') + '. In <strong>' + premYear + '</strong> that costs about <strong>' + usd2(addMonthly) + ' per month per person</strong> in added Part B and Part D premiums, roughly ' + usd(addMonthly * 12) + ' for the year' + (status === 'mfj' ? ', and double that if both spouses are on Medicare' : '') + '.</p>';
        } else {
          ib += '<p>At this income you stay in ' + (at.irmaa.tier === 0 ? 'the standard premium tier' : 'surcharge tier ' + at.irmaa.tier) + '. ';
          ib += isFinite(at.irmaa.head)
            ? 'You are <strong>' + usd(at.irmaa.head) + '</strong> below the next cliff.</p>'
            : 'You are in the top tier already.</p>';
        }
        ib += '<p class="surc-small">Medicare premiums are set from your income two years back, so a ' + YEAR + ' conversion sets your ' + premYear + ' premium. Each threshold is a cliff. One dollar over it triggers the whole surcharge' + (status === 'mfj' ? ' for both spouses' : '') + '. ' +
          'The ' + premYear + ' brackets are not published yet, so this uses the ' + YEAR + ' schedule. Those thresholds rise with inflation each year, which means a figure just over a line here may well sit under the real ' + premYear + ' line, and the surcharge itself will be higher than the ' + YEAR + ' dollars shown.</p>';
        if (status === 'mfs' && !inp.mfsApart) {
          ib += '<p><strong>Filing separately is the harsh lane.</strong> There is no gentle first step. One dollar over ' + usd(109000) + ' lands directly on a surcharge of about ' + usd2(446.30 + 83.30) + ' per month.</p>';
        }
        h += card(conv > 0 && crossed > 0 ? 'warn' : 'card', 'The Medicare premium your ' + premYear + ' self pays', ib);
      }

      /* senior deduction window insight */
      if (inp.you65 && status !== 'mfs') {
        var thr = status === 'mfj' ? 150000 : 75000;
        var inBand = at.magi > thr && at.senior > 0;
        var wasInBand = base.magi > thr && base.senior > 0;
        if (inBand || wasInBand || (base.senior > 0 && conv > 0 && at.senior === 0)) {
          h += card('card', 'The 2025 to 2028 wrinkle almost every article misses',
            '<p>The new $6,000 senior deduction starts phasing out above ' + usd(thr) + ' of income, and it exists only for tax years 2025 through 2028. ' +
            (status === 'mfj' && inp.sp65 && inp.you65
              ? 'Because it is $6,000 each and the reduction hits each share separately, the two of you give back 12 cents per dollar rather than 6. '
              : 'The reduction runs at 6 cents per dollar. ') +
            'So inside that band a converted dollar costs its bracket rate plus the clawback, and after 2028 the clawback goes away along with the deduction.</p>' +
            '<p class="surc-small">For income sitting inside the band, that can favor converting a little less now and more from 2029. Treat it as a tiebreaker rather than a plan. Below the band the reverse is true, because the deduction is bracket room that simply expires, and the whole effect is worth at most a few hundred dollars a year.</p>');
        }
      }

      /* ---------- what else could you do with the same dollars ----------
         The tax bill this year is identical for a conversion and a plain
         withdrawal, because both are ordinary income out of a traditional IRA.
         What differs is where the money lands and how it is taxed afterwards,
         and that is the comparison people actually need. */
      if (conv > 0) {
        var extra = at.tax - base.tax;
        var young = age > 0 && age < 60;   /* 59 1/2, and we only know the birth year */
        var alt = '<p>The tax you pay this year is the same whether you convert this ' + usd(conv) +
          ' or simply take it out and spend it. Both are ordinary income out of a traditional IRA. ' +
          'What changes is where the money ends up.</p>';
        alt += '<table class="surc-tbl">' +
          '<tr><th>What you do</th><th>Tax this year</th><th>What you hold afterwards</th></tr>' +
          '<tr><td><strong>Convert</strong> to a Roth</td><td>' + usd(extra) + '</td>' +
          '<td>' + usd(conv) + ' in a Roth. All future growth is tax free, there are no required distributions in your lifetime, and your heirs draw it out tax free.</td></tr>' +
          '<tr><td><strong>Withdraw</strong> and keep it</td><td>' + usd(extra) + '</td>' +
          '<td>' + usd(conv - extra) + ' in hand after paying the tax from the withdrawal itself. Future growth on it is taxable each year as interest, dividends or gains.</td></tr>' +
          '<tr><td><strong>Leave it</strong> in the traditional IRA</td><td>' + usd(0) + '</td>' +
          '<td>' + usd(conv) + ' still growing, still untaxed for now, and taxed as ordinary income whenever it comes out, by you or by whoever inherits it.</td></tr>' +
          '</table>';
        alt += '<p class="surc-small">Leaving it alone is not the safe option, it is a decision to be taxed later at a rate nobody knows yet. That is the comparison the table above this one prices.</p>';
        if (young) {
          alt += '<p class="surc-small"><strong>Under 59½ the two are not equivalent.</strong> A withdrawal generally carries a 10 percent early-distribution penalty on top of the income tax. A conversion does not, although each conversion starts its own five-year clock before that money can be withdrawn from the Roth penalty free.</p>';
        }
        h += card('card', 'Converting, withdrawing, or leaving it alone', alt);
      }

      /* break-even card */
      if (conv > 0) {
        var effNow = (at.tax - base.tax) / conv;
        var later = [0.12, 0.22, 0.24, 0.32];
        var beb = '<p>A conversion pays off when today’s rate is lower than the rate this money would face on the way out later. Later usually means one of three things. Your own bracket once required distributions start filling it, a surviving spouse paying single rates after the first death, or children emptying the account inside ten years while they are earning the most they ever will.</p>';
        beb += '<table class="surc-tbl"><tr><th>If it would come out later at</th><th>Every $100,000 converted saves about</th></tr>';
        for (var k = 0; k < later.length; k++) {
          var diff = (later[k] - effNow) * 100000;
          beb += '<tr><td>' + pct(later[k]) + '</td><td>' + (diff >= 0 ? usd(diff) : 'a loss of about ' + usd(-diff)) + '</td></tr>';
        }
        beb += '</table>';
        beb += '<p class="surc-small">Your effective rate on this conversion is ' + pct(effNow) + '. Nobody knows future rates, growth, or the year of death, which is why this is a range and a judgment, not a single number.</p>';
        h += card('card', 'When converting wins', beb);
      }

      /* ---------- the annual saving, once RMDs begin ----------
         The break-even table above is a lifetime total. This is the same
         comparison per year, which is the number that actually settles the
         decision for most people. Computed at ZERO growth on purpose: the
         first-year divisor comes from the IRS Uniform Lifetime Table
         (Treas. Reg. 1.401(a)(9)-9, effective 2022), so every figure here is
         a floor built from a published table rather than a projection. Any
         growth makes the balance larger and the forced distribution larger,
         so the real saving can only exceed what is shown. */
      if (conv > 0 && YEAR < firstRmd) {
        var ULT_FIRST = { 73: 26.5, 75: 24.6 };  /* Uniform Lifetime Table, first RMD year */
        var div0 = ULT_FIRST[ra];
        if (div0) {
          var annualRmd = conv / div0;
          var ab = '<p>Money in a Roth has no required distributions in your lifetime. Money left in the traditional IRA does, every year from ' +
            firstRmd + ' on, whether you need it or not.</p>' +
            '<p>At zero growth, the ' + usd(conv) + ' you are converting would otherwise force a distribution of about <strong>' +
            usd(annualRmd) + ' every year</strong> (' + usd(conv) + ' divided by ' + div0 +
            ', the age ' + ra + ' divisor from the IRS Uniform Lifetime Table). Each of those forced dollars would be ordinary income, ' +
            'run through the same Social Security phase-in this page just priced, and count toward the same Medicare thresholds.</p>';
          ab += '<table class="surc-tbl"><tr><th>If those RMDs would be taxed at</th><th>Converting saves about, each year</th></tr>';
          for (var q = 0; q < later.length; q++) {
            ab += '<tr><td>' + pct(later[q]) + '</td><td>' + usd(annualRmd * later[q]) + '</td></tr>';
          }
          ab += '</table>';
          ab += '<p class="surc-small">A floor, not an estimate. Growth raises the balance and the forced distribution with it, and the divisor falls every year, so the required percentage rises with age. Divisor from Treas. Reg. 1.401(a)(9)-9, the table in effect since 2022.</p>';
          h += card('card', 'What this conversion saves every year, once RMDs begin', ab);
        }
      }

      /* ---------- show the working ----------
         Laid out like a worksheet: numbered lines, grouped into sections, and
         later lines refer back by number. Line numbers are assigned as rows are
         pushed, so they stay sequential whichever rows apply to this taxpayer. */
      (function () {
        var w = at.ssw, o = at.ordw, pw = at.prefw;
        var n = 0, rows = [];
        var STATUS_LABEL = { mfj: 'married filing jointly', single: 'single',
                             hoh: 'head of household', mfs: 'married filing separately' };
        var who = STATUS_LABEL[inp.status] || inp.status;
        /* Every constant on this worksheet names where it comes from, so a
           reader is never asked to accept a number on trust. */
        var src2026 = '2026 figure for ' + who + ', Rev. Proc. 2025-32';
        function line(label, formula, result) {
          n += 1;
          rows.push('<tr><td class="surc-ln">' + n + '</td><td>' + label +
                    '</td><td class="surc-f">' + formula + '</td><td class="surc-n">' +
                    result + '</td></tr>');
          return n;
        }
        function head(title) {
          rows.push('<tr class="surc-sec"><td colspan="4">' + title + '</td></tr>');
        }
        var L = function (x) { return '<span class="surc-ref">(' + x + ')</span>'; };

        /* ---- income ---- */
        head('Income');
        var lOther = line('Ordinary income' + (conv > 0 ? ', including the conversion' : ''),
                          conv > 0 ? usd(inp.other) + ' + conversion ' + usd(conv) : 'as entered',
                          usd(at.other));
        var lQual = line('Qualified dividends and long-term gains', 'as entered', usd(at.qual));
        var lSS = 0, lExempt = 0, lHalf = 0;
        if (inp.ss > 0) lSS = line('Social Security benefits received', 'as entered', usd(inp.ss));
        if (inp.exempt > 0) lExempt = line('Tax-exempt interest', 'as entered', usd(inp.exempt));
        if (inp.ss > 0) lHalf = line('Half of the Social Security benefit', 'half of ' + L(lSS), usd(w.half));

        /* ---- social security ---- */
        var lTSS = 0, lUntaxed = 0;
        if (inp.ss > 0) {
          head('How much Social Security is taxed, IRC section 86');
          var piParts = L(lOther) + ' + ' + L(lQual) + (lExempt ? ' + ' + L(lExempt) : '') + ' + ' + L(lHalf);
          var lPI = line('Provisional income', piParts, usd(w.pi));
          var lBase = line('Base amount', 'IRC section 86(c) for ' + who + '. Set by Congress in 1983 and never adjusted for inflation', usd(w.base));
          if (w.tier === 0) {
            lTSS = line('Social Security taxed', L(lPI) + ' is at or below ' + L(lBase), usd(0));
          } else if (w.tier === 1) {
            lTSS = line('Social Security taxed',
                        '50% of (' + L(lPI) + ' - ' + L(lBase) + '), capped at ' + L(lHalf),
                        usd(w.taxable));
          } else {
            var lAdj = line('Adjusted base amount', 'IRC section 86(c) for ' + who + '. Also never adjusted for inflation', usd(w.adj));
            lTSS = line('Social Security taxed',
                        '85% of (' + L(lPI) + ' - ' + L(lAdj) + ') = ' + usd(w.tier2) +
                        ', plus the first-tier ' + usd(w.tier1) +
                        (w.capped ? ', capped at 85% of ' + L(lSS) : ''),
                        usd(w.taxable));
          }
          lUntaxed = line('Social Security never taxed', L(lSS) + ' - ' + L(lTSS), usd(inp.ss - w.taxable));
        }

        /* ---- taxable income ---- */
        head('Taxable income');
        var lAGI = line('Adjusted gross income',
                        L(lOther) + ' + ' + L(lQual) + (lTSS ? ' + ' + L(lTSS) : ''), usd(at.agi));
        var lStd = line('Standard deduction', src2026 + ' section 4.14', usd(at.std));
        var refs = [lStd];
        if (at.aged) refs.push(line('Additional deduction for being 65 or older', 'IRC section 63(f), ' + src2026 + ' section 4.14', usd(at.aged)));
        if (at.senior) refs.push(line('Temporary senior deduction', 'IRC section 151(d)(5) and IRS Schedule 1-A Part V. 6,000 a person, reduced by 6 cents for every dollar of income above ' + usd(inp.status === 'mfj' ? 150000 : 75000) + ', and it ends after 2028', usd(at.senior)));
        var lDed = refs.length > 1
          ? line('Total deductions', refs.map(L).join(' + '), usd(at.ded))
          : lStd;
        var lTaxable = line('Taxable income', L(lAGI) + ' - ' + L(lDed), usd(at.taxable));

        /* ---- the split ---- */
        var lOrd = lTaxable, lPref = 0;
        if (at.tpref > 0) {
          head('Splitting it, because gains are taxed on their own schedule');
          lPref = line('Dividends and gains inside taxable income',
                       'the lesser of ' + L(lQual) + ' and ' + L(lTaxable), usd(at.tpref));
          lOrd = line('Ordinary income inside taxable income',
                      L(lTaxable) + ' - ' + L(lPref) + ', because deductions come off ordinary first',
                      usd(at.tord));
        }

        /* ---- the tax ---- */
        head('The tax');
        var lOrdTax = line('Tax on ordinary income',
                           o.applied > 0
                             ? 'the ' + pct(o.rate) + ' bracket for ' + who + ' runs from ' + usd(o.over) +
                               ' up, so ' + usd2(o.base) + ' of tax on the income below it plus ' + pct(o.rate) +
                               ' of (' + L(lOrd) + ' - ' + usd(o.over) + ')'
                             : 'nothing left after deductions',
                           usd(at.ordTax));
        var lPrefTax = 0;
        if (at.tpref > 0) {
          var pf = [];
          if (pw.at0 > 0) pf.push(usd(pw.at0) + ' at 0%');
          if (pw.at15 > 0) pf.push(usd(pw.at15) + ' at 15%');
          if (pw.at20 > 0) pf.push(usd(pw.at20) + ' at 20%');
          lPrefTax = line('Tax on dividends and gains',
                          L(lPref) + ' sits on top of ' + L(lOrd) + '. The 0% band for ' + who +
                          ' ends at ' + usd(PREF0[inp.status]) + ' and the 15% band at ' + usd(PREF15[inp.status]) +
                          ' (IRC section 1(h), ' + src2026 + ' section 4.03), so ' + pf.join(', '),
                          usd(at.prefTax));
        }
        var lTotal = line('<strong>Total federal tax</strong>',
                          lPrefTax ? L(lOrdTax) + ' + ' + L(lPrefTax) : L(lOrdTax),
                          '<strong>' + usd(at.tax) + '</strong>');

        /* ---- what the conversion did ---- */
        if (conv > 0) {
          head('What the ' + usd(conv) + ' conversion changed');
          var lBaseTaxable = line('Taxable income with no conversion', 'the same worksheet, converting nothing', usd(base.taxable));
          var lCreated = line('Taxable income the conversion created',
                              L(lTaxable) + ' - ' + L(lBaseTaxable) + ', which is ' +
                              ((at.taxable - base.taxable) / conv).toFixed(2) + ' for every dollar converted',
                              usd(at.taxable - base.taxable));
          var lBaseTax = line('Federal tax with no conversion', 'the same worksheet, converting nothing', usd(base.tax));
          var lExtra = line('Extra federal tax', L(lTotal) + ' - ' + L(lBaseTax), usd(at.tax - base.tax));
          line('<strong>Effective rate on the conversion</strong>',
               L(lExtra) + ' divided by the ' + usd(conv) + ' converted',
               '<strong>' + pct((at.tax - base.tax) / conv) + '</strong>');
        }

        h += '<details><summary>Show the arithmetic behind every number above</summary>' +
             '<div class="surc-card"><div class="surc-bd">' +
             '<table class="surc-work"><thead><tr><th class="surc-ln">#</th><th>Line</th>' +
             '<th>The arithmetic</th><th>Result</th></tr></thead><tbody>' +
             rows.join('') + '</tbody></table>' +
             '<p class="surc-note">A number in brackets refers to the line with that number. ' +
             'Every figure comes from the published 2026 tables cited at the foot of this page. ' +
             'Rounding to whole dollars can make a line look a dollar off.</p>' +
             '</div></div></details>';
      })();

      /* never-convert list */
      h += '<details><summary>Money that cannot convert, and the traps around it</summary>' +
        '<div class="surc-card"><div class="surc-bd">' +
        '<ul>' +
        '<li><strong>This year’s RMD.</strong> In any RMD year the required distribution comes out first and can never be converted. Converting it creates an excess Roth contribution with a 6% excise tax each year until corrected.</li>' +
        '<li><strong>An inherited IRA, unless you are the surviving spouse.</strong> A non-spouse beneficiary can never convert an inherited traditional IRA, and the workaround people trade online, withdrawing and recontributing, fails too. Only a spouse who treats the account as their own can convert.</li>' +
        '<li><strong>A SIMPLE IRA in its first two years.</strong> Converting during the two years after the first contribution triggers a 25% penalty in place of the usual 10%.</li>' +
        '<li><strong>Anything you might want back.</strong> Conversions became irreversible in 2018. There is no recharacterization and no undo.</li>' +
        '<li><strong>401(k) money, without care.</strong> Employer-plan money can reach a Roth, but move it by direct rollover. A check paid to you triggers mandatory 20% withholding you must replace from other money within 60 days. And if you are still working past RMD age at that employer, plan money can wait while IRA money cannot.</li>' +
        '<li><strong>Each conversion runs its own 5-year clock</strong> if you are under 59½, separate from the Roth earnings clock. Converting money you will need within five years deserves a hard look first.</li>' +
        '</ul></div></div></details>';

      out.innerHTML = h;
    }

    render();
  }

  function mount(root) {
    if (!root) return function () {};

    if (!root.getAttribute('data-surc-done')) {
      root.setAttribute('data-surc-done', '1');
      build(root);
    }

    return function unmount() {
      root.removeAttribute('data-surc-done');
      root.innerHTML = '';
      root.classList.remove('surc');
    };
  }

  if (typeof window !== 'undefined') {
    window.StepUpRoth = window.StepUpRoth || {};
    window.StepUpRoth.mount = mount;
  }

  function init() {
    var nodes = document.querySelectorAll('[data-stepup-roth]');
    for (var i = 0; i < nodes.length; i++) {
      if (!nodes[i].getAttribute('data-surc-done')) {
        nodes[i].setAttribute('data-surc-done', '1');
        build(nodes[i]);
      }
    }
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  }
})();
