// ── Post-modal-close callback (used to reopen intro popover on mobile) ──
let _afterModalClose = null;

// ── WRC State Manager ──
const WRC = {
  get() { try { return JSON.parse(sessionStorage.getItem('wrc') || '{}'); } catch(e) { return {}; } },
  set(updates) { try { sessionStorage.setItem('wrc', JSON.stringify({...this.get(), ...updates})); } catch(e) {} },
  val(key, fallback) { const v = this.get()[key]; return (v !== undefined && v !== null) ? v : fallback; }
};

function navigate(url, updates) {
  if (updates) WRC.set(updates);
  window.location.href = url;
}

// ── Activity metadata ──
const activityMeta = {
  light:    { label: 'Light Work',      kcal: '< 200 kcal/hr (< 233 W)',       color: '#00966C' },
  moderate: { label: 'Moderate Work',   kcal: '201–300 kcal/hr (234–349 W)',   color: '#F57F17' },
  heavy:    { label: 'Heavy Work',      kcal: '301–400 kcal/hr (350–465 W)',   color: '#E65100' },
  vh:       { label: 'Very Heavy Work', kcal: '401–500 kcal/hr (466–580 W)',   color: '#880E4F' },
};

const activityEmoji = {
  light: '🟢', moderate: '🟡', heavy: '🔴', vh: '⛔'
};

// ── Sector labels ──
const sectorLabels = {
  restaurant:     '🍽 Restaurant',
  warehouse:      '📦 Warehouse',
  factory:        '🏭 Manufacturing',
  healthcare:     '🏥 Healthcare',
  retail:         '🛍 Retail',
  construction:   '🏗 Indoor Construction',
  laundry:        '🧺 Laundry',
  foodprocessing: '🍳 Food Processing / Meatpacking',
  publicsafety:   '🚒 Public Safety',
  buildingservices:'🛠 Housekeeping',
  agriculture:    '🌾 Greenhouse',
  garment:        '✂️ Textile',
  hospitality:    '🏨 Hospitality',
  childcare:      '🧒 Childcare',
};

// ── Data globals ──
let wbgtRows = { acclim: [], unacclim: [] };
let trhRows = [];
let hiRowsAcclim = [];
let hiRowsUnacclim = [];
let sectorData = {};
let activityList = []; // flat per-activity objects (new format)

async function initData() {
  const base = 'data/';
  try {
    const [wbgt, trh, hi, sectors] = await Promise.all([
      fetch(base + 'wbgt-rows.json').then(r => r.json()),
      fetch(base + 'trh-rows.json').then(r => r.json()),
      fetch(base + 'hi-rows.json').then(r => r.json()),
      fetch(base + 'sectors.json').then(r => r.json()),
    ]);
    wbgtRows = wbgt;
    trhRows = trh;
    hiRowsAcclim = hi.acclim;
    hiRowsUnacclim = hi.unacclim;
    // sectors.json is now a flat array of per-activity objects.
    // Build backward-compatible sectorData lookup for existing rendering code.
    activityList = sectors;
    sectorData = {};
    for (const act of activityList) {
      for (const s of act.sector) {
        if (!sectorData[s]) sectorData[s] = { light: [], moderate: [], heavy: [], vh: [] };
        if (sectorData[s][act.niosh_level]) {
          sectorData[s][act.niosh_level].push(act.description);
        }
      }
    }
  } catch(e) {
    console.warn('Data load failed:', e);
  }
}

// ── Activity modal ──
function ensureActivityModal() {
  if (document.getElementById('activity-modal-overlay')) return;
  const el = document.createElement('div');
  el.innerHTML = `<div id="activity-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="activity-modal-title" onclick="if(event.target===this)closeActivityModal()">
  <div id="activity-modal">
    <div class="modal-sticky-header">
      <h2 id="activity-modal-title">Determining Activity Level in Practice</h2>
      <button class="modal-close-btn" onclick="closeActivityModal()" aria-label="Close">&#x2715;</button>
    </div>
    <div id="activity-modal-body">
    <p class="modal-sub">How to identify the correct work category — including when tasks vary, when PPE adds risk, and when to push back on a misclassification.</p>
    <div class="qa-accordion">
      <div class="qa-item">
        <button class="qa-question" aria-expanded="false" onclick="toggleQA(this)">
          <span>A job involves different tasks throughout a shift. Which activity level applies?</span>
          <span class="qa-chevron" aria-hidden="true"></span>
        </button>
        <div class="qa-answer" hidden>Use the highest activity level sustained for 30 continuous minutes or more. If the work alternates between light and heavy tasks in short bursts, moderate is usually appropriate. When in doubt, use the more protective (higher) category — this is especially important when advocating for a worker or assessing risk.</div>
      </div>
      <div class="qa-item">
        <button class="qa-question" aria-expanded="false" onclick="toggleQA(this)">
          <span>The physical demands of the job seem harder than the category description suggests. How can the actual metabolic rate be determined?</span>
          <span class="qa-chevron" aria-hidden="true"></span>
        </button>
        <div class="qa-answer" hidden>Workers and their representatives have the right to request that metabolic rate be properly assessed. <strong>ISO 8996:2021</strong> provides a systematic measurement and estimation approach. The <strong>2024 Adult Compendium of Physical Activities</strong> (Herrmann et al., 2024) offers an extensive task-level MET/kcal reference. Heart rate monitoring during actual work is the most practical field method and can be done by a worker, union rep, or industrial hygienist. If a job is being assessed at a lower activity level than the work actually involves, that directly affects how protective the recommended work-rest schedule is.</div>
      </div>
      <div class="qa-item">
        <button class="qa-question" aria-expanded="false" onclick="toggleQA(this)">
          <span>Does wearing PPE, a uniform, or other special clothing affect the heat stress risk?</span>
          <span class="qa-chevron" aria-hidden="true"></span>
        </button>
        <div class="qa-answer" hidden>Yes — significantly. PPE does not change metabolic rate, but impermeable clothing severely limits sweat evaporation and increases physiological heat strain. Apply WBGT clothing correction factors (e.g., +10–11&deg;C WBGT equivalent for fully impermeable suits). Workers in coveralls, chemical suits, or heavy protective gear face substantially greater heat illness risk at any given temperature than workers in standard clothing — and standard work-rest schedules based on WBGT alone will underestimate that risk.</div>
      </div>
      <div class="qa-item">
        <button class="qa-question" aria-expanded="false" onclick="toggleQA(this)">
          <span>What should happen when very heavy work is being done in high heat — and a work-rest schedule alone doesn't seem sufficient?</span>
          <span class="qa-chevron" aria-hidden="true"></span>
        </button>
        <div class="qa-answer" hidden>At WBGT above ~26–27&deg;C (79–81&deg;F), very heavy continuous work is hazardous for all workers regardless of acclimatization status. Work-rest cycles are a control measure of last resort — engineering controls (spot cooling, task rotation, mechanization of the heaviest tasks) should be the first line of response. Workers and advocates can raise this under OSHA's General Duty Clause if engineering controls are feasible but not implemented. A certified industrial hygienist (CIH) can document the hazard and recommend controls.</div>
      </div>
      <div class="qa-item">
        <button class="qa-question" aria-expanded="false" onclick="toggleQA(this)">
          <span>How can a worker or union representative identify the correct activity level for a job — especially if they disagree with how management has categorized it?</span>
          <span class="qa-chevron" aria-hidden="true"></span>
        </button>
        <div class="qa-answer" hidden>Start by comparing the job tasks to the activity level descriptions in Step 2. If the actual work involves more exertion than the assigned category suggests, document it — video of the tasks, heart rate data, or a written task description. Workers have the right under OSHA Section 8(a) to request an inspection, and unions can raise misclassification of physical demand in collective bargaining or grievance procedures. A worker center, occupational health clinic, or industrial hygienist can provide independent assessment.</div>
      </div>
    </div>
    </div>
  </div>
</div>`;
  document.body.appendChild(el.firstElementChild);
}

function toggleQA(btn) {
  const item = btn.closest('.qa-item');
  const answer = item.querySelector('.qa-answer');
  const expanded = btn.getAttribute('aria-expanded') === 'true';
  btn.setAttribute('aria-expanded', expanded ? 'false' : 'true');
  answer.hidden = expanded;
}

function openActivityModal() {
  ensureActivityModal();
  document.getElementById('activity-modal-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
  const closeBtn = document.querySelector('#activity-modal .modal-close-btn');
  if (closeBtn) closeBtn.focus();
}

function closeActivityModal() {
  const overlay = document.getElementById('activity-modal-overlay');
  if (overlay) overlay.classList.remove('open');
  document.body.style.overflow = '';
}

// ── Methodology modal ──
function ensureMethodologyModal() {
  if (document.getElementById('methodology-modal-overlay')) return;
  const el = document.createElement('div');
  el.innerHTML = `<div id="methodology-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="methodology-modal-title" onclick="if(event.target===this)closeMethodologyModal()">
  <div id="methodology-modal">
    <div class="modal-sticky-header">
      <h2 id="methodology-modal-title">Sources, Methodology, and Verification Notes</h2>
      <button class="modal-close-btn" onclick="closeMethodologyModal()" aria-label="Close">&#x2715;</button>
    </div>

    <div id="methodology-modal-body">
    <div class="section-label">Primary Sources</div>
    <ul class="source-list">
      <li>American Conference of Governmental Industrial Hygienists. (2025). <em>Threshold limit values for chemical substances and physical agents and biological exposure indices.</em> ACGIH.</li>
      <li>Herrmann, S. D., Willis, E. A., Ainsworth, B. E., Barreira, T. V., Hastert, M., Kracht, C. L., Schuna, J. M., Jr., Cai, Z., Quan, M., Tudor-Locke, C., Whitt-Glover, M. C., &amp; Jacobs, D. R. (2024). 2024 Adult Compendium of Physical Activities: A third update of the energy costs of human activities. <em>Journal of Sport and Health Science, 13</em>(1), 6–12. https://doi.org/10.1016/j.jshs.2023.10.010</li>
      <li>International Organization for Standardization. (2021). <em>ISO 8996:2021: Ergonomics of the thermal environment — Determination of metabolic rate.</em> ISO.</li>
      <li>National Institute for Occupational Safety and Health. (1986). <em>Criteria for a recommended standard: Occupational exposure to hot environments</em> (DHHS [NIOSH] Publication No. 86-113). U.S. Department of Health and Human Services.</li>
      <li>National Institute for Occupational Safety and Health. (2016). <em>NIOSH criteria for a recommended standard: Occupational exposure to heat and hot environments</em> (DHHS [NIOSH] Publication No. 2016-106). U.S. Department of Health and Human Services.</li>
      <li>Occupational Safety and Health Administration. (2017). <em>OSHA-NIOSH heat safety tool</em> (OSHA Publication No. 3993). U.S. Department of Labor.</li>
      <li>Rothfusz, L. P. (1990). <em>The heat index "equation" (or, more than you ever wanted to know about heat index)</em> (Technical Attachment SR/SSD 90-23). National Weather Service, Southern Region Headquarters.</li>
      <li>U.S. Environmental Protection Agency. (1993). <em>Preventing heat illness during outdoor work activities</em> [Referenced in NIOSH, 2016, Table 6-2]. U.S. Environmental Protection Agency.</li>
    </ul>

    <hr class="divider">

    <div class="section-label">Activity Level Definitions</div>
    <p class="desc" style="font-size:14px">Use these descriptions to determine which column applies to tasks performed in your workplace. Many jobs involve more than one activity level during a shift — use the highest level sustained for 30 minutes or more as the basis for work-rest decisions. Metabolic rate ranges are based on NIOSH workload categories; for more precise estimation by task, consult <strong>ISO 8996:2021</strong> (<em>Ergonomics of the thermal environment — Determination of metabolic rate</em>) or the <strong>2024 Adult Compendium of Physical Activities</strong> (Herrmann et al., 2024).</p>

    <hr class="divider">

    <div class="section-label">Methodology Notes</div>
    <div class="note-box warn-note">
      <strong>⚠ What is confirmed vs. what still requires direct curve reading.</strong>
      <br><br>
      <strong>Confirmed from NIOSH (2016) equations and Table 5-1 (no further verification needed):</strong>
      <br>• The Recommended Alert Limit (RAL, for unacclimatized workers) and Recommended Exposure Limit (REL, for acclimatized workers) equations for 60 min/h (continuous work): RAL = 59.9 − 14.1 log₁₀(M[W]); REL = 56.7 − 11.5 log₁₀(M[W])
      <br>• Continuous-work REL thresholds: Light ≈ 30°C (Table 5-1); Moderate ≈ 28°C (Table 5-1); Heavy = 26°C (equation + Table 5-1); Very Heavy ≈ 25°C (Table 5-1)
      <br>• Continuous-work RAL thresholds: Light ≈ 26.5°C (equation); Moderate ≈ 25°C (NIOSH text, p. 4); Heavy ≈ 22.3°C (equation); Very Heavy ≈ 20.9°C (equation)
      <br>• RAL/REL framework, four-line structure (15/30/45/60 min/h), clothing assumption, standard man, and acclimatization protocols — all confirmed NIOSH (2016)
      <br><br>
      <strong>Still requires direct reading from NIOSH (2016) Figures 8-1 and 8-2:</strong>
      <br>• All 45/15, 30/30, and 15/45 WBGT thresholds — the figures present these as graphical curves only; no equations are given for the non-continuous work-rest lines. Cells marked * in the WBGT tab are approximate and should be verified against the figures before use in enforcement or published tools.
      <br><br>
      <strong>Derived approximations (no primary source — methodology only):</strong>
      <br>• T+RH tab unacclimatized thresholds — derived by shifting acclimatized HI breakpoints; no equivalent NIOSH published table in HI units
      <br>• Heat Index tab unacclimatized table — similarly derived; NIOSH Recommended Alert Limits (RAL) is expressed in WBGT, not HI
      <br>• Thermometer-only path HI values — calculated from measured dry-bulb temperature at an assumed 100% relative humidity (see below)
    </div>

    <div class="note-box">
      <strong>Thermometer-Only (Dry Bulb) Path — Methodology</strong><br><br>
      When a worker or supervisor has access only to a standard thermometer (no hygrometer or psychrometer), the tool accepts a dry-bulb air temperature and calculates a Heat Index using <strong>100% relative humidity as a conservative ceiling assumption</strong>. This is the highest possible heat stress for a given air temperature, because relative humidity cannot exceed 100%; the actual Heat Index will be equal to or lower than the displayed value if measured humidity is below 100%.<br><br>
      This approach ensures the work-rest recommendation will never <em>underestimate</em> risk — it is protective by design. However, it may significantly <em>overestimate</em> heat stress in dry environments (e.g., dry desert climates, low-humidity warehouses), and in those settings a measured humidity reading should be obtained for a more accurate assessment.<br><br>
      The resulting Heat Index value is then passed through the same Rothfusz (1990) regression and NIOSH-derived thresholds used for the T+RH path. The tool displays a notice to the user that 100% RH was assumed and recommends re-entering with a measured humidity if available.
    </div>

    <div class="note-box">
      <strong>Acclimatization Status — Tool Workflow</strong><br><br>
      Before entering a temperature measurement, users select the worker's acclimatization status. This determines which NIOSH exposure limit applies:<br><br>
      <strong>Acclimatized (REL):</strong> Workers who have completed a full acclimatization protocol and have not been absent from heat work for seven or more consecutive days. The NIOSH Recommended Exposure Limit (REL) applies. Acclimatization increases sweating efficiency, stabilizes cardiovascular response, and lowers core body temperature and heart rate at equivalent workloads (NIOSH, 2016).<br><br>
      <strong>Unacclimatized — New Worker (RAL):</strong> Workers starting heat exposure for the first time, or newly assigned to a hot work area. The NIOSH Recommended Alert Limit (RAL) applies. NIOSH protocol recommends no more than 20% of usual heat exposure on Day 1, increasing by approximately 20% per day over 7–14 days (NIOSH, 2016, p. 105).<br><br>
      <strong>Unacclimatized — Returning Worker (RAL):</strong> Workers previously acclimatized but absent from heat work for seven or more consecutive days. The RAL also applies. NIOSH return protocol: 4-day ramp — 50% → 60% → 80% → 100% of usual exposure (NIOSH, 2016, p. 105). Workers with cardiovascular disease, obesity, certain medications, or a history of prior heat illness should also be considered unacclimatized for conservative planning purposes.<br><br>
      NIOSH (2016, p. 40): <em>"lack of acclimatization has been shown to be a major factor associated with worker heat-related illness and death."</em>
    </div>

    <div class="note-box">
      <strong>Methodology for Heat Index–Based Work-Rest Limits</strong><br><br>
      NIOSH expresses both the Recommended Exposure Limit (REL, for acclimatized workers) and the Recommended Alert Limit (RAL, for unacclimatized workers) in Wet Bulb Globe Temperature (WBGT) units — not Heat Index. The Temperature + Humidity and Heat Index tabs in this tool use Heat Index as a practical field substitute because it requires no specialized instrumentation and is accessible to workers and supervisors without industrial hygiene training. The following describes how the limits were derived for each.<br><br>
      <strong>Acclimatized worker limits (REL-derived):</strong><br>
      Heat Index thresholds were established using OSHA's published Heat Index risk framework as the structural basis (Lower Risk / Moderate / High / Very High / Extreme), which maps onto the NIOSH REL risk continuum. Work-rest cycles at each Heat Index level were assigned by cross-referencing the approximate WBGT equivalent for a given Heat Index value against the NIOSH (2016) REL curves (Figures 8-1 and 8-2). The approximate WBGT-to-Heat Index relationship used is: at moderate humidity (~50% RH), WBGT ≈ 0.70 × Wet Bulb Temperature + 0.30 × Dry Bulb Temperature; and Heat Index ≈ Dry Bulb Temperature + a humidity adjustment. This yields a rough correspondence of approximately 1–2°C WBGT per 5°F Heat Index under moderate indoor conditions, though this relationship varies significantly with relative humidity and air movement.<br><br>
      <strong>Unacclimatized worker limits (RAL-derived):</strong><br>
      No NIOSH-published table expresses the Recommended Alert Limit (RAL) in Heat Index units. The unacclimatized thresholds in this tool are approximated by shifting the acclimatized (REL-based) Heat Index breakpoints downward by approximately 8–10°F (4–5°C equivalent). This offset is derived from the difference between the NIOSH REL and RAL continuous-work equations at representative metabolic rates — for example, at moderate work (300 kcal/h), the REL continuous-work threshold is ≈27.5°C WBGT and the RAL is ≈24.0°C WBGT, a difference of approximately 3.5°C. Accounting for the approximate WBGT-to-HI conversion, this translates to roughly 8–10°F lower Heat Index thresholds for unacclimatized workers. These are approximations only and have not been validated against a published NIOSH source.<br><br>
      <strong>Limitations of Heat Index for occupational use:</strong><br>
      Heat Index was developed for shade conditions with light air movement (~5 mph). It does not account for: (1) radiant heat from hot equipment, ovens, or surfaces — a major factor in kitchens, laundries, and foundries; (2) very low or very high air velocity; (3) PPE or impermeable clothing; or (4) individual metabolic rate. In any environment with significant radiant heat sources or unusual clothing, WBGT measurement is strongly preferred and the Heat Index tab values should not be relied upon for compliance or enforcement purposes. The WBGT tab values, derived directly from NIOSH (2016) equations and Table 5-1, are the most defensible basis for formal heat stress assessment.
    </div>

    <div class="note-box warn-note">
      <strong>⚠ The 2016 NIOSH update removed the 1986 ceiling limits.</strong> The 1986 criteria included absolute ceiling WBGT values above which no work was recommended. NIOSH (2016) explicitly removed these: "Data and scientific evidence were not identified to continue to support the NIOSH ceiling limit recommendations. Acclimatized workers live and work in temperatures above the ceiling limit without adverse health effects." The <strong>DANGER!</strong> designation in this tool therefore does not reflect a NIOSH-defined ceiling; it indicates conditions where the work-rest curves cannot provide protection using work-practice controls alone and where engineering controls, physiological monitoring, or cessation of work should be evaluated by a qualified safety professional.
    </div>

    <div class="note-box">
      <strong>NIOSH (2016) RAL and REL equations</strong> — The 2016 Criteria Document (p. 93) provides equations for the 60 min/h (continuous work) curves, where M = metabolic rate in Watts (1 kcal/h = 1.163 W):<br><br>
      <code style="font-size:13px;font-family:monospace">RAL [°C WBGT] = 59.9 − 14.1 × log₁₀(M[W])  &nbsp;&nbsp;← confirmed NIOSH equation</code><br>
      <code style="font-size:13px;font-family:monospace">REL [°C WBGT] = 56.7 − 11.5 × log₁₀(M[W])  &nbsp;&nbsp;← confirmed NIOSH equation</code><br><br>
      <strong>Non-continuous work-rest lines (TWA derivation)</strong> — Substituting the time-weighted average metabolic rate (M × T/60) yields:<br>
      <code style="font-size:12px;font-family:monospace">REL_T = 56.7 − 11.5 × log₁₀(M × T/60) = REL_60 + 11.5 × log₁₀(60/T)</code><br>
      <code style="font-size:12px;font-family:monospace">RAL_T = 59.9 − 14.1 × log₁₀(M × T/60) = RAL_60 + 14.1 × log₁₀(60/T)</code><br><br>
      Resulting offsets above the continuous-work baseline:<br>
      <code style="font-size:12px;font-family:monospace">45 min/h: REL +1.4°C, RAL +1.8°C</code><br>
      <code style="font-size:12px;font-family:monospace">30 min/h: REL +3.5°C, RAL +4.2°C</code><br>
      <code style="font-size:12px;font-family:monospace">15 min/h: REL +6.9°C, RAL +8.5°C</code><br><br>
      The TWA approach assumes resting metabolic rate = 0, slightly overstating allowable WBGT at rest-heavy schedules. The equations produce thresholds consistent with the confirmed anchor points (REL at 300 kcal/h, 60 min/h = 27.5°C; RAL at 300 kcal/h, 60 min/h = 24.0°C) and with the visual scale of Figures 8-1 and 8-2. Verify against those figures for enforcement use.
    </div>

    <div class="note-box">
      <strong>Indoor-specific considerations:</strong>
      <br>• Tables assume indoor setting with <em>no direct solar load</em>. All WBGT values assume natural WBGT (NWBGTi) or indoor measurement.
      <br>• Radiant heat sources (ovens, machinery, steam lines, dryers) can dramatically elevate effective heat stress beyond what air temperature or heat index captures. WBGT measured on-site is the only reliable method in these environments.
      <br>• Air movement matters: fans can reduce heat stress significantly; still air in a hot room is more hazardous than the dry-bulb temperature alone suggests.
      <br>• PPE and clothing dramatically affect allowable exposure. Impermeable suits can require reducing thresholds by 10–11°C WBGT equivalent (ACGIH, 2025, Table 2).
    </div>

    <hr class="divider">

    <div class="section-label">Comparison of Major Standard-Setting Bodies</div>
    <div class="table-wrap">
      <table class="qa-table" style="table-layout:fixed;width:100%">
        <thead>
          <tr>
            <th class="left" style="width:18%">Standard / Agency</th>
            <th style="width:18%;text-align:left">Basis</th>
            <th style="width:18%;text-align:left">Work-Rest Structure</th>
            <th style="width:14%;text-align:left">Copyright Status</th>
            <th style="width:32%;text-align:left">Notes</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="label">NIOSH REL/RAL<br>(1986, confirmed 2016)</td>
            <td style="text-align:left;font-size:12px">WBGT + metabolic rate (kcal/h); standard man 70 kg, 1.8 m²</td>
            <td style="font-size:12px">Continuous curves (4 work-rest lines: 15/30/45/60 min/h); no published discrete table</td>
            <td style="font-size:12px;color:var(--safe-text);background:var(--safe-bg)">Public domain (federal agency)</td>
            <td style="text-align:left;font-size:12px">Current standard is NIOSH (2016), Pub. No. 2016-106, which confirmed 1986 curve values unchanged and removed 1986 ceiling limits. Recommended basis for this tool.</td>
          </tr>
          <tr>
            <td class="label">ACGIH TLV</td>
            <td style="text-align:left;font-size:12px">WBGT + metabolic rate (kcal/hr)</td>
            <td style="font-size:12px">% of hour; includes clothing correction</td>
            <td style="font-size:12px;color:var(--high-text);background:var(--high-bg)">Copyrighted (ACGIH)</td>
            <td style="text-align:left;font-size:12px">Similar structure to NIOSH but different breakpoints; most used in industrial hygiene practice; not reproducible without license</td>
          </tr>
          <tr>
            <td class="label">OSHA Heat Index<br>(NIOSH joint)</td>
            <td style="text-align:left;font-size:12px">Heat Index (°F); no metabolic rate</td>
            <td style="font-size:12px">Risk categories → protective measures</td>
            <td style="font-size:12px;color:var(--safe-text);background:var(--safe-bg)">Public domain (federal agencies)</td>
            <td style="text-align:left;font-size:12px">Simpler, more accessible; does not differentiate by workload intensity; useful for field conditions without WBGT meter</td>
          </tr>
          <tr>
            <td class="label">Cal/OSHA Title 8</td>
            <td style="text-align:left;font-size:12px">Heat Index or temperature triggers</td>
            <td style="font-size:12px">Preventive cool-down rest ≥5 min; not scheduled cycling</td>
            <td style="font-size:12px;color:var(--safe-text);background:var(--safe-bg)">Public domain (state agency)</td>
            <td style="text-align:left;font-size:12px">Different regulatory model: mandatory "as needed" cooling rest, not fixed work-rest cycles; applies to outdoor and indoor workers</td>
          </tr>
          <tr>
            <td class="label">EPA (1993) / NIOSH (2016) Table 6-2</td>
            <td style="text-align:left;font-size:12px">Adjusted dry-bulb temp (°F) with RH and solar correction factors</td>
            <td style="font-size:12px">Minute-level splits (45/15, 40/20, 35/25, 30/30, 25/35, 20/40, 15/45) at 1°F increments</td>
            <td style="font-size:12px;color:var(--safe-text);background:var(--safe-bg)">Public domain</td>
            <td style="text-align:left;font-size:12px">Adapted from EPA (1993); reproduced in NIOSH (2016) as a practical field reference. Assumes physically fit, well-rested, fully hydrated, under age 40, 30% RH, natural ventilation. Different methodology from RAL/REL curves — uses ambient temp + adjustments, not WBGT.</td>
          </tr>
        </tbody>
      </table>
    </div>

    <hr class="divider">

    <div class="section-label">Individual Health Risk Factors</div>
    <div class="note-box">
      The tool includes a reference panel (accessed via the ❤ button on any page) summarizing individual-level factors that increase susceptibility to heat-related illness, drawn from NIOSH (2016). These factors do not modify the displayed work-rest thresholds — the thresholds are based on the NIOSH "standard man" (70 kg, 1.8 m² BSA, physically fit, acclimatized where noted) — but supervisors and safety professionals should apply additional caution and potentially more conservative schedules when workers have one or more of the following characteristics:<br><br>
      <strong>High-risk conditions identified by NIOSH (2016):</strong> cardiovascular disease or hypertension; diabetes; kidney disease; obesity (BMI ≥ 30); pregnancy; age 65 or older (reduced sweating capacity); prior heat stroke (permanent impairment of heat tolerance in some individuals); use of medications that impair thermoregulation (diuretics, anticholinergics, beta-blockers, antihistamines, certain antidepressants and antipsychotics); recent illness with fever or diarrhea; low physical fitness; and lack of acclimatization (addressed in the tool's acclimatization workflow above).<br><br>
      This panel is informational only. Specific accommodation decisions should involve occupational medicine consultation.
    </div>

    <div class="section-label">Intended Use and Limitations</div>
    <div class="note-box">
      This tool is intended as a preliminary reference for occupational health education and policy development. It does not constitute a compliance standard or legal requirement. Users should:
      <br>• Verify intermediate work-rest line thresholds (45/15, 30/30, 15/45 WBGT values) against NIOSH (2016) Figures 8-1 and 8-2 before use in enforcement or published tools — continuous-work thresholds are confirmed from equations and Table 5-1 and do not require further verification
      <br>• Apply professional judgment accounting for site-specific conditions (radiant heat, clothing, workload variability, individual risk factors)
      <br>• Treat Heat Index–based recommendations (T+RH and thermometer-only paths) as approximations — NIOSH expresses its limits in WBGT, not Heat Index; the WBGT tab values are the most defensible basis for formal heat stress assessment
      <br>• Consult a certified industrial hygienist (CIH) for complex or high-hazard situations
      <br>• Check for updates to NIOSH criteria, OSHA standards, and state-specific requirements
      <br><br>
      Developed with support from GLC-OHS / UIC School of Public Health. For informational and educational use.
    </div>
    </div>
  </div>
</div>`;
  document.body.appendChild(el.firstElementChild);
}

function openMethodologyModal() {
  ensureMethodologyModal();
  document.getElementById('methodology-modal-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
  const closeBtn = document.querySelector('#methodology-modal .modal-close-btn');
  if (closeBtn) closeBtn.focus();
}

// ── Individual Health Risk Factors modal ──
function ensureHealthModal() {
  if (document.getElementById('health-modal-overlay')) return;
  const el = document.createElement('div');
  el.innerHTML = `<div id="health-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="health-modal-title" onclick="if(event.target===this)closeHealthModal()">
  <div id="health-modal">
    <div class="modal-sticky-header">
      <h2 id="health-modal-title">Individual Health Risk Factors</h2>
      <button class="modal-close-btn" onclick="closeHealthModal()" aria-label="Close">&#x2715;</button>
    </div>
    <div id="health-modal-body">

    <div class="health-callout">
      <strong>What this means for you:</strong> Some workers overheat faster than others — even in the same conditions, doing the same job. If any of the factors below apply to you or someone on your crew, treat that person as if the temperature and workload are one level higher than the tool shows. When in doubt, take more breaks and keep a close eye on how everyone is feeling.
    </div>

    <h3>Heart Disease or High Blood Pressure</h3>
    <p>Your heart pumps blood to your skin to release heat — it's how your body cools itself down. If someone has heart disease, heart failure, or high blood pressure that isn't well controlled, their body can't move heat out as effectively. Many blood pressure medications also affect how the body handles heat (see medications below).</p>

    <h3>Larger Body Size</h3>
    <p>Bigger bodies produce more body heat during physical work — and have a harder time releasing it through sweat. A heavier worker doing the same task as a lighter coworker may actually be working at the equivalent of the next level up (for example, "Heavy" instead of "Moderate"). If a worker is noticeably heavier than average, it's a good idea to select the next-higher activity level in this tool to be safe.</p>

    <h3>Body Weight &amp; Metabolic Heat Production</h3>
    <p>NIOSH activity categories (Light, Moderate, Heavy, Very Heavy) are defined in absolute kilocalories per hour — not relative to body size. The underlying conversion is straightforward:</p>
    <p style="margin:8px 0 8px 16px;font-family:monospace;font-size:14px">kcal/hr = METs × body weight (kg)</p>
    <p>The activity level assignments in this tool assume a reference worker of approximately <strong>70 kg (154 lb)</strong>. A heavier worker performing the same physical task generates proportionally more absolute metabolic heat and may effectively be operating in the next-higher NIOSH category — even though the task itself hasn't changed. For example, a 90 kg worker doing a task rated at 3.5 METs produces 315 kcal/hr (Heavy), while a 70 kg worker doing the same task produces 245 kcal/hr (Moderate).</p>
    <p>This is distinct from the insulation and sweating effects associated with obesity (above). It applies across the full weight spectrum: any worker meaningfully heavier than 70 kg is generating more absolute heat than the reference assumption behind these categories. <strong>When the worker's body weight is substantially above 70 kg, selecting the next-higher activity level is the more protective choice.</strong></p>
    <p style="font-size:12px;color:var(--subtext);margin-top:4px">MET values and reference weight: Ainsworth et al. (2024). <em>2024 Adult Compendium of Physical Activities</em>. Activity level assignments: NIOSH (2016), Table 5-1.</p>

    <h3>Diabetes</h3>
    <p>Diabetes can damage the nerves that control sweating, which makes it harder for the body to cool down. It can also affect the heart and blood vessels. On top of that, blood sugar can swing up or down during hot, physically demanding work, which adds to the risk.</p>

    <h3>Kidney Problems</h3>
    <p>The kidneys help keep the body's fluids and salts balanced. When someone has chronic kidney disease, they get dehydrated faster and have a harder time recovering from it. Heat makes dehydration happen quickly, which is more serious for workers with kidney problems.</p>

    <h3>Had Heat Stroke Before</h3>
    <p>Heat stroke can permanently affect the part of the brain that controls body temperature. A worker who has had heat stroke in the past is at much higher risk of it happening again — even in conditions that wouldn't affect most people. They should be treated as if they're brand new to working in the heat, and their return to hot work should be gradual and supervised.</p>

    <h3>Age 55 or Older</h3>
    <p>As people get older, the heart doesn't pump as strongly during heat stress, sweating slows down, and the sense of thirst decreases — so workers may not realize they're dehydrating. Older workers make up a disproportionate share of heat-related deaths across all industries. Take extra care.</p>

    <h3>Pregnancy</h3>
    <p>Pregnant workers produce more body heat and heat up faster during exertion. They also need more fluids. NIOSH recommends extra caution for pregnant workers in hot environments, especially in the first three months.</p>

    <h3>Certain Medications</h3>
    <p>Some common prescription drugs make it much harder for the body to handle heat. Workers on any of the following should be treated as higher risk — supervisors don't need to know what someone takes, just that these types of medications exist and matter:</p>
    <div class="health-factor-grid">
      <div class="health-factor-card">
        <div class="health-factor-card-title"><span class="hf-icon">💊</span> Water pills (diuretics)</div>
        <p>These remove fluid from the body — which is useful for blood pressure and heart conditions, but speeds up dehydration in the heat. Common brand names include Lasix and hydrochlorothiazide.</p>
      </div>
      <div class="health-factor-card">
        <div class="health-factor-card-title"><span class="hf-icon">💊</span> Allergy and bladder medications (anticholinergics)</div>
        <p>These can block the ability to sweat — which is the main way the body cools itself. Found in some antihistamines, bladder medications, and certain antidepressants.</p>
      </div>
      <div class="health-factor-card">
        <div class="health-factor-card-title"><span class="hf-icon">💊</span> Beta-blockers (heart/blood pressure pills)</div>
        <p>These keep the heart from beating faster — which is normally a sign the body is overheating. Workers on beta-blockers may not show the usual early warning signs of heat strain.</p>
      </div>
      <div class="health-factor-card">
        <div class="health-factor-card-title"><span class="hf-icon">💊</span> Antipsychotics and some antidepressants</div>
        <p>These can reduce sweating and interfere with how the brain regulates temperature. They have been linked to heat stroke in both work and medical settings.</p>
      </div>
      <div class="health-factor-card">
        <div class="health-factor-card-title"><span class="hf-icon">💊</span> Stimulants (including some ADHD medications)</div>
        <p>Stimulants raise the body's baseline heart rate and generate extra heat. This leaves less room for the body to respond when conditions get hot.</p>
      </div>
      <div class="health-factor-card">
        <div class="health-factor-card-title"><span class="hf-icon">💊</span> Thyroid medications</div>
        <p>Too much thyroid medication speeds up metabolism and raises body temperature — adding to the heat load before work even begins.</p>
      </div>
    </div>
    <p style="font-size:12px;color:var(--subtext);margin-top:4px"><strong>Note for supervisors:</strong> Workers don't have to tell you what medications they take. What matters is knowing that common prescriptions can significantly reduce heat tolerance — so plan accordingly and watch everyone carefully.</p>

    <h3>Recent Alcohol Use</h3>
    <p>Alcohol causes the body to lose more fluid, which speeds up dehydration. It also disrupts the body's ability to regulate temperature and can impair a person's judgment about whether they're feeling okay. Working in heat after drinking — even the night before — increases risk.</p>

    <h3>Poor Sleep or Exhaustion</h3>
    <p>When someone is sleep-deprived or already worn out, the body doesn't handle heat as well, and the person is less likely to notice or report that something feels off. Fatigued workers may push through warning signs they would otherwise catch. Factor in fatigue when assigning heavy outdoor work.</p>

    <hr class="divider" style="margin:20px 0">
    <p style="font-size:12px;color:var(--subtext)"><strong>Source:</strong> National Institute for Occupational Safety and Health. (2016). <em>NIOSH criteria for a recommended standard: Occupational exposure to heat and hot environments</em> (DHHS [NIOSH] Publication No. 2016-106), Chapter 7. U.S. Department of Health and Human Services.</p>

    </div>
  </div>
</div>`;
  document.body.appendChild(el.firstElementChild);
}

function openHealthModal() {
  ensureHealthModal();
  document.getElementById('health-modal-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
  const closeBtn = document.querySelector('#health-modal .modal-close-btn');
  if (closeBtn) closeBtn.focus();
}

function closeHealthModal() {
  const overlay = document.getElementById('health-modal-overlay');
  if (overlay) overlay.classList.remove('open');
  document.body.style.overflow = '';
  if (_afterModalClose) { const cb = _afterModalClose; _afterModalClose = null; cb(); }
}

function closeMethodologyModal() {
  const overlay = document.getElementById('methodology-modal-overlay');
  if (overlay) overlay.classList.remove('open');
  document.body.style.overflow = '';
  if (_afterModalClose) { const cb = _afterModalClose; _afterModalClose = null; cb(); }
}

// ── Feedback modal ──
function ensureFeedbackModal() {
  if (document.getElementById('feedback-modal-overlay')) return;
  var el = document.createElement('div');
  el.innerHTML = `<div id="feedback-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="feedback-modal-title" onclick="if(event.target===this)closeFeedbackModal()">
  <div id="feedback-modal">
    <div class="modal-sticky-header">
      <h2 id="feedback-modal-title">Comments &amp; Suggestions</h2>
      <button class="modal-close-btn" onclick="closeFeedbackModal()" aria-label="Close">&#x2715;</button>
    </div>
    <div id="feedback-modal-body">
      <p>Have a comment, question, or suggestion? Fill out the form below and it will open in your email client.</p>
      <div class="fb-field" id="fb-name-field">
        <label for="fb-name">Name <span style="font-weight:400;color:#888">(optional)</span></label>
        <input type="text" id="fb-name" placeholder="Your name" autocomplete="name">
      </div>
      <div class="fb-field" id="fb-msg-field">
        <label for="fb-msg">Message <span style="color:#D50032">*</span></label>
        <textarea id="fb-msg" placeholder="Type your comment or suggestion here…"></textarea>
        <span class="fb-error-msg">Please enter a message before sending.</span>
      </div>
      <button class="fb-send-btn" onclick="submitFeedback()">
        <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        Open in Email Client
      </button>
      <p class="fb-note">This will open your default email app with a pre-filled message addressed to the WRC tool team. Your message is not sent automatically.</p>
    </div>
  </div>
</div>`;
  document.body.appendChild(el.firstElementChild);
}
function openFeedbackModal() {
  ensureFeedbackModal();
  document.getElementById('feedback-modal-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
  setTimeout(function() { var el = document.getElementById('fb-msg'); if (el) el.focus(); }, 50);
}
function closeFeedbackModal() {
  var overlay = document.getElementById('feedback-modal-overlay');
  if (overlay) overlay.classList.remove('open');
  document.body.style.overflow = '';
  if (_afterModalClose) { const cb = _afterModalClose; _afterModalClose = null; cb(); }
}
function submitFeedback() {
  var msg = (document.getElementById('fb-msg') || {}).value || '';
  var name = (document.getElementById('fb-name') || {}).value || '';
  var msgField = document.getElementById('fb-msg-field');
  if (!msg.trim()) {
    if (msgField) msgField.classList.add('error');
    return;
  }
  if (msgField) msgField.classList.remove('error');
  var subject = encodeURIComponent('WRC Tool Feedback');
  var body = name.trim()
    ? encodeURIComponent('From: ' + name.trim() + '\n\n' + msg.trim())
    : encodeURIComponent(msg.trim());
  window.location.href = 'mailto:rneima2@uic.edu?subject=' + subject + '&body=' + body;
  closeFeedbackModal();
}

document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    closeActivityModal();
    closeMethodologyModal();
    closeHealthModal();
    closeFeedbackModal();
  }
});

// ── Mobile table → card reflow ──
// Adds data-mobile-label attributes to each tbody data cell so CSS can
// render them as stacked cards on narrow screens.  Safe to call multiple
// times; existing attributes are overwritten (handles unit-toggle updates).
function initMobileTables() {
  document.querySelectorAll('.table-wrap table:not(.qa-table)').forEach(function(table) {
    const headers = [];
    table.querySelectorAll('thead th').forEach(function(th) {
      headers.push(th.textContent.trim());
    });
    if (headers.length < 2) return;

    table.querySelectorAll('tbody tr').forEach(function(row) {
      const sublabel = row.querySelector('td.sublabel');
      if (sublabel) {
        row.classList.add('mobile-sublabel-row');
        return;
      }
      const cells = row.querySelectorAll('td');
      cells.forEach(function(cell, i) {
        if (i > 0 && headers[i]) {
          cell.setAttribute('data-mobile-label', headers[i]);
        }
      });
    });
  });
}

// ── Breadcrumb pills (blue strip, always centered, all 3 always shown) ──
function buildBreadcrumbs() {
  const container = document.getElementById('wrc-breadcrumbs');
  if (!container) return;

  const crumbs = [];

  // Sector
  const sector = WRC.val('sector', null);
  if (sector && sectorLabels[sector]) {
    crumbs.push({ label: sectorLabels[sector], href: 'index.html', selected: true });
  } else {
    crumbs.push({ label: 'Industry', href: 'index.html', selected: false });
  }

  // Activity level
  const actLevel = WRC.val('activity', null);
  const actLabel = WRC.val('activityLabel', null);
  if (actLevel && actLabel) {
    const emoji = activityEmoji[actLevel] || '';
    crumbs.push({ label: (emoji ? emoji + ' ' : '') + actLabel, href: 'activity.html', selected: true });
  } else {
    crumbs.push({ label: 'Activity Level', href: 'activity.html', selected: false });
  }

  // Worker status
  const workerStatus = WRC.val('workerStatus', null);
  if (workerStatus) {
    const statusLabel = workerStatus === 'acclimatized'           ? '✅ Acclimatized' :
                        workerStatus === 'unacclimatized-new'      ? '⚠️ New Worker' :
                        workerStatus === 'unacclimatized-returning' ? '🔄 Returning Worker' :
                        workerStatus === 'unacclimatized'           ? '🟠 Unacclimatized' : workerStatus;
    crumbs.push({ label: statusLabel, href: 'acclimatization.html', selected: true });
  } else {
    crumbs.push({ label: 'Acclimatization', href: 'acclimatization.html', selected: false });
  }

  // Clothing / PPE
  const clothingType = WRC.val('clothingType', null);
  if (clothingType) {
    const clothingLabel = clothingType === 'impermeable' ? '🦺 Impermeable PPE' : '👕 Standard Clothing';
    crumbs.push({ label: clothingLabel, href: 'clothing.html', selected: true });
  } else {
    crumbs.push({ label: 'Clothing/PPE', href: 'clothing.html', selected: false });
  }

  // Measurement instrument
  const instrument = WRC.val('instrument', null);
  const instrumentLabels = { wbgt: '🌡️ WBGT', trh: '💧 Temp + Humidity', hi: '🔥 Heat Index', dbt: '🌡 Thermometer' };
  if (instrument && instrumentLabels[instrument]) {
    crumbs.push({ label: instrumentLabels[instrument], href: 'measurement.html', selected: true });
    // Value pill — show entered measurement alongside instrument
    const measUnit  = WRC.val('measUnit', 'F');
    const unitSuffix = measUnit === 'C' ? '°C' : '°F';
    const measValue = WRC.val('measValue', null);
    const measTemp  = WRC.val('measTemp', null);
    const measRH    = WRC.val('measRH', null);
    let valueLabel = null;
    if (instrument === 'trh' && measTemp != null && measRH != null) {
      valueLabel = measTemp + unitSuffix + ' / ' + measRH + '%';
      const derivedHI     = WRC.val('derivedHI', null);
      const derivedHIUnit = WRC.val('derivedHIUnit', 'F');
      if (derivedHI != null) {
        const hiSuffix = derivedHIUnit === 'C' ? '°C' : '°F';
        valueLabel += ' → HI: ' + derivedHI + hiSuffix;
      }
    } else if (instrument === 'dbt' && measValue != null) {
      // Thermometer Only: show entered temp / 100% RH assumed → calculated HI
      valueLabel = measValue + unitSuffix + ' / 100%';
      const derivedHI     = WRC.val('derivedHI', null);
      const derivedHIUnit = WRC.val('derivedHIUnit', 'F');
      if (derivedHI != null) {
        const hiSuffix = derivedHIUnit === 'C' ? '°C' : '°F';
        valueLabel += ' → HI: ' + derivedHI + hiSuffix;
      }
    } else if ((instrument === 'wbgt' || instrument === 'hi') && measValue != null) {
      valueLabel = measValue + unitSuffix;
    }
    if (valueLabel) {
      crumbs.push({ label: valueLabel, href: 'measurement.html', selected: true, isValue: true });
    }
  } else {
    crumbs.push({ label: 'Instrument', href: 'measurement.html', selected: false });
  }

  container.innerHTML = '';
  crumbs.forEach(function(c, i) {
    if (i > 0) {
      const sep = document.createElement('span');
      sep.className = 'wrc-crumb-sep';
      sep.setAttribute('aria-hidden', 'true');
      sep.textContent = '›';
      container.appendChild(sep);
    }
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    const isCurrent = c.href === currentPage;
    const a = document.createElement('a');
    a.className = c.isValue ? 'wrc-crumb wrc-crumb-value' : (c.selected ? 'wrc-crumb' : 'wrc-crumb-pending');
    if (isCurrent) { a.classList.add('wrc-crumb-current'); a.setAttribute('aria-current', 'page'); }
    a.href = c.href;
    a.textContent = c.label;
    a.title = c.isValue ? 'Change measurement' : (c.selected ? 'Change selection' : 'Make a selection');
    container.appendChild(a);
  });

  // Reset button — clears all selections and returns to index
  const anySelected = crumbs.some(function(c) { return c.selected; });
  if (anySelected) {
    const resetBtn = document.createElement('button');
    resetBtn.className = 'wrc-crumb-reset';
    resetBtn.title = 'Clear all selections';
    resetBtn.setAttribute('aria-label', 'Reset all selections');
    resetBtn.innerHTML = '<svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true"><path d="M1.5 5.5a4 4 0 1 0 .9-2.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><polyline points="1.5,2 1.5,5.5 5,5.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    resetBtn.addEventListener('click', function() {
      try { sessionStorage.removeItem('wrc'); } catch(e) {}
      window.location.href = 'index.html';
    });
    container.appendChild(resetBtn);
  }

  // "Work-Rest Cycle →" button — shown when instrument is selected (value not required)
  if (instrument && instrumentLabels[instrument]) {
    const destMap = { wbgt: 'wbgt.html', trh: 'temp-humidity.html', hi: 'heat-index.html', dbt: 'temp-humidity.html' };
    const dest = destMap[instrument] || 'wbgt.html';
    const goBtn = document.createElement('a');
    goBtn.className = 'wrc-crumb-go';
    goBtn.href = dest;
    goBtn.title = 'View your Work-Rest Cycle';
    goBtn.setAttribute('aria-label', 'View Work-Rest Cycle');
    goBtn.innerHTML = 'Work-Rest Cycle &#8594;';
    container.appendChild(goBtn);
  }

  // ── Mobile step dots (5 circles, red→green, shown instead of breadcrumbs on narrow screens) ──
  const s = WRC.get();
  const stepDone = [
    !!s.sector,
    !!s.activity,
    !!s.workerStatus,
    !!s.clothingType,
    !!(s.instrument && (s.measValue != null || s.measTemp != null))
  ];

  const isMobile = window.innerWidth <= 768;

  // Hide breadcrumbs + strip label on mobile; show dots instead
  container.style.display = isMobile ? 'none' : '';
  const stripLabel = document.querySelector('.wrc-strip-label');
  if (stripLabel) stripLabel.style.display = isMobile ? 'none' : '';

  let dotsEl = document.getElementById('mobile-step-indicator');
  if (!dotsEl) {
    dotsEl = document.createElement('div');
    dotsEl.id = 'mobile-step-indicator';
    container.parentNode.insertBefore(dotsEl, container);
  }
  const stepUrls = ['index.html', 'activity.html', 'acclimatization.html', 'clothing.html', 'measurement.html'];
  dotsEl.style.display = isMobile ? 'flex' : 'none';
  dotsEl.innerHTML = stepDone.map((done, i) =>
    `<a class="wrc-sdot${done ? ' wrc-sdot-done' : ''}" href="${stepUrls[i]}" aria-label="Step ${i+1}">${i+1}</a>`
  ).join('');

  // Mobile Results button — shown when all 5 steps are complete
  if (stepDone[4]) {
    const resultUrls = { wbgt: 'wbgt.html', trh: 'temp-humidity.html', hi: 'heat-index.html', dbt: 'temp-humidity.html' };
    const resultUrl = resultUrls[s.instrument] || 'wbgt.html';
    const mResults = document.createElement('a');
    mResults.className = 'wrc-sdot-results';
    mResults.href = resultUrl;
    mResults.setAttribute('aria-label', 'Return to results');
    mResults.innerHTML = '🟰';
    dotsEl.appendChild(mResults);
  }

  // Mobile reset button — circular arrow, right edge of the dots row
  if (anySelected) {
    const mReset = document.createElement('button');
    mReset.className = 'wrc-sdot-reset';
    mReset.title = 'Reset all selections';
    mReset.setAttribute('aria-label', 'Reset all selections');
    mReset.innerHTML = '<svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true"><path d="M2 6.5a4.5 4.5 0 1 0 1-2.8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><polyline points="2,2.5 2,6.5 6,6.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    mReset.addEventListener('click', function() {
      try { sessionStorage.removeItem('wrc'); } catch(e) {}
      window.location.href = 'index.html';
    });
    dotsEl.appendChild(mReset);
  }

  // ── Context strip: progressive recap of selections (mobile only) ──
  // Step 2+ → activity; Step 3+ → + acclimatization; Step 4+ → + clothing
  const pathname = window.location.pathname;
  const onStep2up = /\/(activity|acclimatization|clothing|measurement|wbgt|temp-humidity|heat-index)\.html/.test(pathname);
  const onStep3up = /\/(acclimatization|clothing|measurement|wbgt|temp-humidity|heat-index)\.html/.test(pathname);
  const onStep4up = /\/(clothing|measurement|wbgt|temp-humidity|heat-index)\.html/.test(pathname);
  const onStep5up = /\/(measurement|wbgt|temp-humidity|heat-index)\.html/.test(pathname);

  const mainStrip = document.querySelector('.wrc-banner-strip');
  let ctxStrip = document.getElementById('wrc-context-strip');

  if (mainStrip && window.innerWidth <= 768) {
    const ctxItems = [];
    if (s.activityLabel) ctxItems.push(s.activityLabel);
    if (s.workerStatus) ctxItems.push(
      s.workerStatus === 'acclimatized'            ? 'Acclimatized' :
      s.workerStatus === 'unacclimatized-new'       ? 'New Worker' :
      s.workerStatus === 'unacclimatized-returning' ? 'Returning Worker' :
      'Unacclimatized');
    if (s.clothingType) ctxItems.push(s.clothingType === 'standard' ? 'Standard Clothing' : 'Impermeable PPE');

    if (ctxItems.length) {
      if (!ctxStrip) {
        ctxStrip = document.createElement('div');
        ctxStrip.id = 'wrc-context-strip';
        mainStrip.after(ctxStrip);
      }
      ctxStrip.innerHTML = ctxItems.map(function(item) {
        return '<span class="wrc-ctx-item">' + item + '</span>';
      }).join('<span class="wrc-ctx-sep"> · </span>');
      ctxStrip.style.display = '';
    } else if (ctxStrip) {
      ctxStrip.style.display = 'none';
    }
  } else if (ctxStrip) {
    ctxStrip.style.display = 'none';
  }

  // ── Third strip: yellow pill with instrument + value when step 5 complete (mobile only) ──
  let strip2 = document.getElementById('wrc-result-strip');

  if (stepDone[4] && mainStrip && window.innerWidth <= 768) {
    // Anchor below context strip if visible, else below main strip
    const anchor = (ctxStrip && ctxStrip.style.display !== 'none') ? ctxStrip : mainStrip;
    if (!strip2) {
      strip2 = document.createElement('div');
      strip2.id = 'wrc-result-strip';
      anchor.after(strip2);
    } else if (strip2.previousElementSibling !== anchor) {
      anchor.after(strip2);
    }
    const inst = s.instrument;
    const measUnit = s.measUnit || 'F';
    const unitSuffix = measUnit === 'C' ? '°C' : '°F';
    const instLabels = { wbgt: 'WBGT', trh: 'Temp + RH', hi: 'Heat Index', dbt: 'Thermometer' };
    const instLabel = instLabels[inst] || inst;
    const derivedHI = s.derivedHI != null ? s.derivedHI : null;
    const derivedHIUnit = s.derivedHIUnit || 'F';
    const hiSuffix = derivedHIUnit === 'C' ? '°C' : '°F';
    let valStr = '';
    if (inst === 'trh' && s.measTemp != null && s.measRH != null) {
      valStr = `${s.measTemp}${unitSuffix} / ${s.measRH}%`;
      if (derivedHI != null) valStr += ` → HI: ${derivedHI}${hiSuffix}`;
    } else if (inst === 'dbt' && s.measValue != null) {
      valStr = `${s.measValue}${unitSuffix} / 100%`;
      if (derivedHI != null) valStr += ` → HI: ${derivedHI}${hiSuffix}`;
    } else if ((inst === 'wbgt' || inst === 'hi') && s.measValue != null) {
      valStr = `${s.measValue}${unitSuffix}`;
    }
    strip2.innerHTML = `<span class="wrc-result-pill">${instLabel}: ${valStr}</span>`;
    strip2.style.display = '';
  } else if (strip2) {
    strip2.style.display = 'none';
  }

  // Re-measure layout now that the strip DOM is settled
  updateLayout();
}

// ── updateLayout (generic — pages override as needed) ──
function updateLayout() {
  const fixedTop = document.getElementById('fixed-top');
  if (!fixedTop) return;
  const defPanel = document.getElementById('def-panels-container');

  // #wrc-result-strip is inside #fixed-top so its height is already included
  const fixedH = fixedTop.offsetHeight;

  if (defPanel) {
    defPanel.style.top = fixedH + 'px';
  }
  const main = document.querySelector('main');
  if (main) {
    const defH = (defPanel && defPanel.style.display !== 'none') ? defPanel.offsetHeight : 0;
    main.style.paddingTop = (fixedH + defH + 16) + 'px';
  }
}

// ── Mobile table init (runs after DOM ready on all pages) ──
document.addEventListener('DOMContentLoaded', function() {
  initMobileTables();

  // ── Banner click-to-home ──
  // Clicks on the banner (#fixed-top) that don't land on a button or link
  // navigate back to index.html.
  const redBanner = document.querySelector('#fixed-top header');
  if (redBanner) {
    redBanner.addEventListener('click', function(e) {
      if (!e.target.closest('button, a')) {
        window.location.href = 'index.html';
      }
    });
  }
});
