// Sorted smallest → largest so the algo picks the most relatable match first
const COMPARISONS = [
  { label: 'Cristo Redentor',    m: 38,           emoji: '🗿', img: 'cristo.png'               },
  { label: 'Torre de Pisa',      m: 56,           emoji: '🏛️', img: 'pisa.png'                 },
  { label: 'Estátua da Lib.',    m: 93,           emoji: '🗽', img: 'estatua da liberdade.png'  },
  { label: 'Big Ben',            m: 96,           emoji: '🕰️', img: 'big ben.png'               },
  { label: 'campo de futebol',   m: 105,          emoji: '⚽'                                   },
  { label: 'Pirâmide de Gizé',   m: 138,          emoji: '🔺', img: 'piramide.png'              },
  { label: 'Torre Eiffel',       m: 330,          emoji: '🗼', img: 'eiffel.png'                },
  { label: 'Pão de Açúcar',      m: 396,          emoji: '🏔️'                                   },
  { label: 'Empire State',       m: 443,          emoji: '🏙️', img: 'empire.png'                },
  { label: 'Burj Khalifa',       m: 828,          emoji: '🌆', img: 'burj.png'                  },
  { label: 'Table Mountain',     m: 1_086,        emoji: '🏞️'                                   },
  { label: 'Pico da Neblina',    m: 2_994,        emoji: '🌫️'                                   },
  { label: 'Mont Blanc',         m: 4_808,        emoji: '🏔️'                                   },
  { label: 'Kilimanjaro',        m: 5_895,        emoji: '🌋'                                   },
  { label: 'Aconcágua',          m: 6_961,        emoji: '⛰️'                                   },
  { label: 'Monte Everest',      m: 8_848,        emoji: '🗻'                                   },
  { label: 'Ponte Rio-Niterói',  m: 13_290,       emoji: '🌉'                                   },
  { label: 'maratona',           m: 42_195,       emoji: '🏃'                                   },
  { label: 'SP → Rio de Janeiro',m: 430_000,      emoji: '🚗'                                   },
  { label: 'Rio → Buenos Aires', m: 1_970_000,    emoji: '✈️'                                   },
  { label: 'Rio Amazonas',       m: 6_400_000,    emoji: '🌊'                                   },
  { label: 'Brasil → Portugal',  m: 7_560_000,    emoji: '🛫'                                   },
  { label: 'Muralha da China',   m: 21_196_000,   emoji: '🧱'                                   },
  { label: 'volta ao mundo',     m: 40_075_000,   emoji: '🌍'                                   },
];

let totalCm = 0;
let dailyCm = 0;
let sites = {};

// ── Smart formatting ──────────────────────────────────────
// Picks unit + decimals so the number is always readable (3-4 significant digits).
function smartFmt(cm) {
  if (cm < 100) {
    // 0–99 cm
    const n = cm >= 10 ? cm.toFixed(0) : cm.toFixed(1);
    return { value: n, unit: 'cm' };
  }
  if (cm < 100000) {
    // 1 m – 999.99 m
    const m = cm / 100;
    const n = m < 10 ? m.toFixed(2) : m < 100 ? m.toFixed(1) : m.toFixed(0);
    return { value: n, unit: 'm' };
  }
  // ≥ 1 km
  const km = cm / 100000;
  const n = km < 10 ? km.toFixed(3) : km < 100 ? km.toFixed(2) : km.toFixed(1);
  return { value: n, unit: 'km' };
}
function getComparisonData(cm) {
  const m = cm / 100;
  if (m <= 0) return null;

  // Smallest landmark not yet fully passed (ratio < 1)
  for (const c of COMPARISONS) {
    const r = m / c.m;
    if (r >= 0.05 && r < 1) return { ...c, ratio: r };
  }

  // Tiny scroll: still on the smallest landmark (Cristo) — show low %
  if (m < COMPARISONS[0].m) {
    const c = COMPARISONS[0];
    return { ...c, ratio: m / c.m };
  }

  // Beyond the largest reference: show as multiplier of the biggest
  const last = COMPARISONS[COMPARISONS.length - 1];
  return { ...last, ratio: m / last.m };
}

function getComparison(cm) {
  const d = getComparisonData(cm);
  if (!d) return '';
  return d.ratio < 0.95
    ? `${d.emoji} ${(d.ratio * 100).toFixed(0)}% da altura do(a) ${d.label}`
    : `${d.emoji} ${d.ratio.toFixed(1)}× a altura do(a) ${d.label}`;
}
function escapeHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── Render ─────────────────────────────────────────────────
function renderHero() {
  const { value, unit } = smartFmt(totalCm);
  document.getElementById('distance-value').textContent = value;
  document.getElementById('distance-unit').textContent  = unit;
  document.getElementById('comparison').textContent     = getComparison(totalCm);
  renderLandmarkViz();
}
function renderLandmarkViz() {
  const viz = document.getElementById('landmark-viz');
  const data = getComparisonData(totalCm);
  if (!data) {
    viz.style.display = 'none';
    return;
  }

  const ratio = totalCm / 100 / data.m;
  const pct = Math.min(ratio, 1) * 100;
  const label = ratio >= 1 ? `${ratio.toFixed(1)}×` : `${Math.round(pct)}%`;

  const img     = document.getElementById('landmark-img');
  const emojiEl = document.getElementById('landmark-emoji');

  if (data.img) {
    img.src              = `images/${data.img}`;
    img.alt              = data.label;
    img.style.display    = 'block';
    emojiEl.style.display = 'none';
  } else {
    img.style.display     = 'none';
    emojiEl.textContent   = data.emoji;
    emojiEl.style.display = 'flex';
  }

  document.getElementById('landmark-name').textContent    = data.label;
  document.getElementById('landmark-fill').style.height   = `${pct}%`;
  document.getElementById('landmark-marker').style.bottom = `${pct}%`;
  document.getElementById('landmark-label').textContent   = label;
  viz.style.display = 'flex';
}
function renderDailyBadge(cm) {
  const f = smartFmt(cm);
  document.getElementById('daily-value').textContent = `${f.value} ${f.unit}`;
}
function renderSites() {
  const list    = document.getElementById('sites-list');
  const entries = Object.entries(sites).sort((a,b) => b[1]-a[1]);
  document.getElementById('sites-count').textContent = entries.length;
  if (entries.length === 0) {
    list.innerHTML = '<p class="empty-state">Nenhum dado ainda.<br>Começa a scrollar! 👆</p>';
    document.getElementById('sites-total-label').textContent = '';
    return;
  }
  const maxCm = entries[0][1];
  document.getElementById('sites-total-label').textContent = `top ${Math.min(entries.length,10)}`;
  list.innerHTML = entries.slice(0,10).map(([host,cm]) => {
    const f   = smartFmt(cm);
    const pct = maxCm > 0 ? (cm/maxCm*100).toFixed(1) : 0;
    return `<div class="site-item">
      <span class="site-name">${escapeHtml(host)}</span>
      <span class="site-dist">${f.value} ${f.unit}</span>
      <div class="site-bar-wrap"><div class="site-bar">
        <div class="site-bar-fill" style="width:${pct}%"></div>
      </div></div>
    </div>`;
  }).join('');
}
function loadAndRender() {
  chrome.storage.local.get(['totalCm','sites','dailyCm'], (data) => {
    totalCm = data.totalCm || 0;
    dailyCm = data.dailyCm || 0;
    sites   = data.sites   || {};
    renderHero();
    renderDailyBadge(dailyCm);
    renderSites();
  });
}

// ── Toast ──────────────────────────────────────────────────
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2600);
}

// ── Live updates: re-render whenever storage changes ──────
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes.totalCm) totalCm = changes.totalCm.newValue || 0;
  if (changes.dailyCm) dailyCm = changes.dailyCm.newValue || 0;
  if (changes.sites)   sites   = changes.sites.newValue   || {};
  renderHero();
  renderDailyBadge(dailyCm);
  renderSites();
});

// ── Reset button ───────────────────────────────────────────
document.getElementById('reset-btn').addEventListener('click', () => {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <h3>Zerar tudo?</h3>
      <p>Isso vai apagar todo o histórico de distância percorrida. Essa ação não pode ser desfeita.</p>
      <div class="modal-actions">
        <button class="btn-cancel">Cancelar</button>
        <button class="btn-confirm">Zerar</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('show'));

  overlay.querySelector('.btn-cancel').addEventListener('click', () => {
    overlay.classList.remove('show');
    setTimeout(() => overlay.remove(), 200);
  });
  overlay.querySelector('.btn-confirm').addEventListener('click', () => {
    chrome.storage.local.set({ totalCm:0, sites:{}, dailyCm:0 }, () => {
      totalCm=0; dailyCm=0; sites={};
      renderHero(); renderDailyBadge(0); renderSites();
      overlay.classList.remove('show');
      setTimeout(() => overlay.remove(), 200);
      showToast('Dados zerados!');
    });
  });
});

loadAndRender();
