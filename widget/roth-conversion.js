/*!
 * Roth conversion window calculator, embeddable widget
 * Klagge Law, PLLC  https://stepuplaw.com/roth-conversion-calculator
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
  var STD = { mfj: 32200, single: 16100, hoh: 24150, mfs: 16100 };

  /* Rev. Proc. 2025-32 section 4.03 (IRC 1(h), 1(j)(5)): the ceilings for the
     0% and 15% rates on qualified dividends and long-term gains. These are
     levels of TOTAL taxable income, because that income stacks on top of
     ordinary income rather than getting its own allowance. */
  var PREF0 = { mfj: 98900, single: 49450, hoh: 66200, mfs: 49450 };
  var PREF15 = { mfj: 613700, single: 545500, hoh: 579600, mfs: 306850 };

  /* IRC section 86 thresholds, statutory and never indexed. MFS living with
     the spouse at any time in the year has a base of zero. */
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

  function federalTax(taxable, status) {
    if (taxable <= 0) return 0;
    var rows = BRACKETS[status];
    for (var i = 0; i < rows.length; i++) {
      if (taxable <= rows[i][0]) {
        var over = i === 0 ? 0 : rows[i - 1][0];
        return rows[i][1] + rows[i][2] * (taxable - over);
      }
    }
    return 0;
  }
  function bracketAt(taxable, status) {
    var rows = BRACKETS[status];
    if (taxable <= 0) return { rate: rows[0][2], top: rows[0][0] };
    for (var i = 0; i < rows.length; i++) {
      if (taxable <= rows[i][0]) return { rate: rows[i][2], top: rows[i][0] };
    }
  }
  function taxableSS(ben, other, exempt, status, mfsApart) {
    if (ben <= 0) return 0;
    var s = status === 'mfs' && mfsApart ? 'single' : status;
    var pi = other + exempt + 0.5 * ben;
    if (pi <= SS_BASE[s]) return 0;
    if (pi <= SS_ADJ[s]) return Math.min(0.5 * (pi - SS_BASE[s]), 0.5 * ben);
    var t1 = Math.min(0.5 * (SS_ADJ[s] - SS_BASE[s]), 0.5 * ben);
    return Math.min(0.85 * (pi - SS_ADJ[s]) + t1, 0.85 * ben);
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
  function prefTax(ordinaryTaxable, pref, status) {
    var amt = Math.max(0, pref);
    var at0 = Math.min(amt, Math.max(0, PREF0[status] - ordinaryTaxable));
    var room = Math.max(0, PREF15[status] - Math.max(ordinaryTaxable, PREF0[status]));
    var at15 = Math.min(amt - at0, room);
    var at20 = amt - at0 - at15;
    return { at0: at0, at15: at15, at20: at20, tax: 0.15 * at15 + 0.20 * at20 };
  }
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

  var CSS =
    '.surc{--surc-brand:#1F4D3A;--surc-fg:#1E293B;--surc-mut:#475569;--surc-line:rgba(71,85,105,.25);' +
    'font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:var(--surc-fg);font-size:16px;line-height:1.55;max-width:760px}' +
    '.surc *{box-sizing:border-box}' +
    '.surc-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px 20px}' +
    '@media(max-width:560px){.surc-grid{grid-template-columns:1fr}}' +
    '.surc label{display:block}' +
    '.surc .surc-lab{font-weight:600;display:block;margin-bottom:4px}' +
    '.surc .surc-hint{font-size:13px;color:var(--surc-mut);margin-top:3px;display:block}' +
    '.surc input,.surc select{width:100%;padding:8px 10px;font-size:16px;border:1px solid var(--surc-line);border-radius:8px;background:#fff;color:var(--surc-fg)}' +
    '.surc-cards{display:grid;gap:12px;margin-top:16px}' +
    '.surc-card{border:1px solid var(--surc-line);border-radius:10px;padding:14px 16px}' +
    '.surc-card.surc-head{border:2px solid var(--surc-brand)}' +
    '.surc-card.surc-warn{border:2px solid #B08D2E;background:rgba(176,141,46,.07)}' +
    '.surc-card h4{margin:0 0 6px;font-size:16.5px}' +
    '.surc-card p{margin:6px 0 0}' +
    '.surc-card ul{margin:6px 0 0;padding-left:20px}' +
    '.surc-card li{margin-top:4px}' +
    '.surc-tbl{width:100%;border-collapse:collapse;margin-top:8px;font-size:15px}' +
    '.surc-tbl th,.surc-tbl td{text-align:left;padding:5px 8px;border-bottom:1px solid var(--surc-line)}' +
    '.surc-tbl th{font-weight:600}' +
    '.surc-small{font-size:13.5px;color:var(--surc-mut)}' +
    '.surc-foot{margin-top:14px;font-size:13px;color:var(--surc-mut);border-top:1px solid var(--surc-line);padding-top:10px}' +
    '.surc-foot a{color:var(--surc-brand)}' +
    '.surc details{margin-top:10px}' +
    '.surc summary{cursor:pointer;font-weight:600}';

  /* ---------- UI ---------- */

  function build(root) {
    var showCredit = String(root.getAttribute('data-surc-credit')).toLowerCase() !== 'off';
    root.className = (root.className ? root.className + ' ' : '') + 'surc';
    root.innerHTML =
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
      '<span class="surc-hint">Leave it blank to see how much room your brackets hold.</span></label>' +
      '</div>' +
      '<div class="surc-cards" data-out="cards"></div>' +
      '<div class="surc-foot">' +
      'This is general information and an estimate, not legal or tax advice, and it creates no attorney-client relationship. ' +
      'It assumes the standard deduction and 2026 federal figures. It does not model itemized deductions (including the medical expense deduction, which a conversion shrinks by raising your income), ' +
      'the 3.8 percent net investment income tax, the qualified business income deduction, or health insurance subsidies before age 65. State income tax is not included (Florida has none). ' +
      'Figures verified against Rev. Proc. 2025-32, the IRS senior-deduction pages, the CMS 2026 fact sheet, and IRC section 86 on <strong>' + VERIFIED + '</strong>. ' +
      (showCredit
        ? 'Roth conversion calculator by Klagge Law, PLLC. Full guide at <a href="' + TOOL + '" target="_blank" rel="noopener">stepuplaw.com</a>.'
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
      return '<div class="surc-card surc-' + kind + '"><h4>' + title + '</h4>' + body + '</div>';
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
            '<p>The new $6,000 senior deduction phases out at 6 cents per dollar of income above ' + usd(thr) + ', and it exists only for tax years 2025 through 2028. Inside that band, each converted dollar carries the bracket rate plus the clawback. After 2028 the clawback disappears with the deduction. For income in this band, the arithmetic can favor converting <em>less</em> now and more after 2028, the opposite of the usual advice.</p>');
        }
      }

      /* break-even card */
      if (conv > 0) {
        var effNow = (at.tax - base.tax) / conv;
        var later = [0.12, 0.22, 0.24, 0.32];
        var beb = '<p>A conversion pays off when today’s rate is lower than the rate the money would face coming out later, whether that is your own RMD-swollen bracket, a surviving spouse filing single, or children emptying the account within 10 years during their peak earnings.</p>';
        beb += '<table class="surc-tbl"><tr><th>If it would come out later at</th><th>Every $100,000 converted saves about</th></tr>';
        for (var k = 0; k < later.length; k++) {
          var diff = (later[k] - effNow) * 100000;
          beb += '<tr><td>' + pct(later[k]) + '</td><td>' + (diff >= 0 ? usd(diff) : 'a loss of about ' + usd(-diff)) + '</td></tr>';
        }
        beb += '</table>';
        beb += '<p class="surc-small">Your effective rate on this conversion is ' + pct(effNow) + '. Nobody knows future rates, growth, or the year of death, which is why this is a range and a judgment, not a single number.</p>';
        h += card('card', 'When converting wins', beb);
      }

      /* never-convert list */
      h += '<details><summary>Money that cannot convert, and the traps around it</summary>' +
        '<div class="surc-card" style="margin-top:8px">' +
        '<ul>' +
        '<li><strong>This year’s RMD.</strong> In any RMD year the required distribution comes out first and can never be converted. Converting it creates an excess Roth contribution with a 6% excise tax each year until corrected.</li>' +
        '<li><strong>An inherited IRA, unless you are the surviving spouse.</strong> A non-spouse beneficiary can never convert an inherited traditional IRA, and the workaround people trade online, withdrawing and recontributing, fails too. Only a spouse who treats the account as their own can convert.</li>' +
        '<li><strong>A SIMPLE IRA in its first two years.</strong> Converting during the two years after the first contribution triggers a 25% penalty in place of the usual 10%.</li>' +
        '<li><strong>Anything you might want back.</strong> Conversions became irreversible in 2018. There is no recharacterization and no undo.</li>' +
        '<li><strong>401(k) money, without care.</strong> Employer-plan money can reach a Roth, but move it by direct rollover. A check paid to you triggers mandatory 20% withholding you must replace from other money within 60 days. And if you are still working past RMD age at that employer, plan money can wait while IRA money cannot.</li>' +
        '<li><strong>Each conversion runs its own 5-year clock</strong> if you are under 59½, separate from the Roth earnings clock. Converting money you will need within five years deserves a hard look first.</li>' +
        '</ul></div></details>';

      out.innerHTML = h;
    }

    render();
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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
