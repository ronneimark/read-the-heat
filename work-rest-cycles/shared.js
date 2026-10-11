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
  light:    { label: 'Light Work',      kcal: '~150–200 kcal/hr (116–233 W)', color: '#2E7D32' },
  moderate: { label: 'Moderate Work',   kcal: '~200–350 kcal/hr (233–407 W)', color: '#F57F17' },
  heavy:    { label: 'Heavy Work',      kcal: '~350–500 kcal/hr (407–581 W)', color: '#E65100' },
  vh:       { label: 'Very Heavy Work', kcal: '>500 kcal/hr (>581 W)',         color: '#880E4F' },
};

const activityEmoji = {
  light: '🟢', moderate: '🟡', heavy: '🔴', vh: '⛔'
};

// ── Sector labels ──
const sectorLabels = {
  restaurant:     '🍽 Restaurant / Kitchen',
  warehouse:      '📦 Warehouse / Distribution',
  factory:        '🏭 Factory / Manufacturing',
  healthcare:     '🏥 Healthcare',
  retail:         '🛍 Retail',
  construction:   '🏗 Indoor Construction',
  laundry:        '🧺 Laundry / Linen Services',
  foodprocessing: '🍳 Food Processing / Meatpacking',
  publicsafety:   '🚒 Public Safety / Emergency Services',
  buildingservices:'🛠 Janitorial / Housekeeping',
  agriculture:    '🌾 Agriculture (Indoor / Greenhouse)',
  garment:        '✂️ Garment / Textile',
  childcare:      '🧒 Childcare',
};

// ── Data globals ──
let wbgtRows = { acclim: [], unacclim: [] };
let trhRows = [];
let hiRowsAcclim = [];
let hiRowsUnacclim = [];
let sectorData = {};

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
    sectorData = sectors;
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
    <button class="modal-close-btn" onclick="closeActivityModal()" aria-label="Close">&#x2715;</button>
    <h2 id="activity-modal-title">Determining Activity Level in Practice</h2>
    <p class="modal-sub">How to identify the correct work category — including when tasks vary, when PPE adds risk, and when to push back on a misclassification.</p>
    <div class="table-wrap">
      <table class="qa-table" style="table-layout:fixed;width:100%">
        <thead>
          <tr>
            <th class="left" style="width:30%">Question</th>
            <th style="width:70%;text-align:left">Guidance</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="label">A job involves different tasks throughout a shift. Which activity level applies?</td>
            <td style="text-align:left;font-size:14px">Use the highest activity level sustained for 30 continuous minutes or more. If the work alternates between light and heavy tasks in short bursts, moderate is usually appropriate. When in doubt, use the more protective (higher) category — this is especially important when advocating for a worker or assessing risk.</td>
          </tr>
          <tr>
            <td class="label">The physical demands of the job seem harder than the category description suggests. How can the actual metabolic rate be determined?</td>
            <td style="text-align:left;font-size:14px">Workers and their representatives have the right to request that metabolic rate be properly assessed. <strong>ISO 8996:2021</strong> provides a systematic measurement and estimation approach. The <strong>2024 Adult Compendium of Physical Activities</strong> (Herrmann et al., 2024) offers an extensive task-level MET/kcal reference. Heart rate monitoring during actual work is the most practical field method and can be done by a worker, union rep, or industrial hygienist. If a job is being assessed at a lower activity level than the work actually involves, that directly affects how protective the recommended work-rest schedule is.</td>
          </tr>
          <tr>
            <td class="label">Does wearing PPE, a uniform, or other special clothing affect the heat stress risk?</td>
            <td style="text-align:left;font-size:14px">Yes — significantly. PPE does not change metabolic rate, but impermeable clothing severely limits sweat evaporation and increases physiological heat strain. Apply WBGT clothing correction factors (e.g., +10–11&deg;C WBGT equivalent for fully impermeable suits). Workers in coveralls, chemical suits, or heavy protective gear face substantially greater heat illness risk at any given temperature than workers in standard clothing — and standard work-rest schedules based on WBGT alone will underestimate that risk.</td>
          </tr>
          <tr>
            <td class="label">What should happen when very heavy work is being done in high heat — and a work-rest schedule alone doesn't seem sufficient?</td>
            <td style="text-align:left;font-size:14px">At WBGT above ~26–27&deg;C (79–81&deg;F), very heavy continuous work is hazardous for all workers regardless of acclimatization status. Work-rest cycles are a control measure of last resort — engineering controls (spot cooling, task rotation, mechanization of the heaviest tasks) should be the first line of response. Workers and advocates can raise this under OSHA's General Duty Clause if engineering controls are feasible but not implemented. A certified industrial hygienist (CIH) can document the hazard and recommend controls.</td>
          </tr>
          <tr>
            <td class="label">How can a worker or union representative identify the correct activity level for a job — especially if they disagree with how management has categorized it?</td>
            <td style="text-align:left;font-size:14px">Start by comparing the job tasks to the activity level descriptions in Step 2. If the actual work involves more exertion than the assigned category suggests, document it — video of the tasks, heart rate data, or a written task description. Workers have the right under OSHA Section 8(a) to request an inspection, and unions can raise misclassification of physical demand in collective bargaining or grievance procedures. A worker center, occupational health clinic, or industrial hygienist can provide independent assessment.</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</div>`;
  document.body.appendChild(el.firstElementChild);
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

document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') closeActivityModal();
});

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
    crumbs.push({ label: 'Industry', selected: false });
  }

  // Activity level
  const actLevel = WRC.val('activity', null);
  const actLabel = WRC.val('activityLabel', null);
  if (actLevel && actLabel) {
    const emoji = activityEmoji[actLevel] || '';
    crumbs.push({ label: (emoji ? emoji + ' ' : '') + actLabel, href: 'activity.html', selected: true });
  } else {
    crumbs.push({ label: 'Activity Level', selected: false });
  }

  // Worker status
  const workerStatus = WRC.val('workerStatus', null);
  if (workerStatus) {
    const statusLabel = workerStatus === 'acclimatized' ? '✅ Acclimatized' :
                        workerStatus === 'unacclimatized' ? '🟠 Unacclimatized' : workerStatus;
    crumbs.push({ label: statusLabel, href: 'acclimatization.html', selected: true });
  } else {
    crumbs.push({ label: 'Acclimatization', selected: false });
  }

  // Measurement instrument
  const instrument = WRC.val('instrument', null);
  const instrumentLabels = { wbgt: '🌡️ WBGT', trh: '💧 Temp + Humidity', hi: '🔥 Heat Index' };
  if (instrument && instrumentLabels[instrument]) {
    crumbs.push({ label: instrumentLabels[instrument], href: 'measurement.html', selected: true });
  } else {
    crumbs.push({ label: 'Instrument', selected: false });
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
    if (c.selected) {
      const a = document.createElement('a');
      a.className = 'wrc-crumb';
      a.href = c.href;
      a.textContent = c.label;
      a.title = 'Change selection';
      container.appendChild(a);
    } else {
      const span = document.createElement('span');
      span.className = 'wrc-crumb-pending';
      span.textContent = c.label;
      container.appendChild(span);
    }
  });
}

// ── updateLayout (generic — pages override as needed) ──
function updateLayout() {
  const fixedTop = document.getElementById('fixed-top');
  if (!fixedTop) return;
  const defPanel = document.getElementById('def-panels-container');
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
