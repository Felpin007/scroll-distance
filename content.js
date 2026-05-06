// 1 CSS pixel = 1/96 inch = 2.54/96 cm = 0.026458... cm  (CSS Values & Units L3)
const PX_TO_CM = 2.54 / 96;

const FLUSH_MS = 350;
const hostname = location.hostname.replace(/^www\./, '') || 'local';

// Track last known scroll position for each scrollable element (incl. window).
const lastScrollMap = new WeakMap();
let lastWindowX = window.scrollX;
let lastWindowY = window.scrollY;

let pendingCm = 0;
let flushTimer = null;

function isWindowScroll(target) {
  return target === document
      || target === window
      || target === document.documentElement
      || target === document.body
      || target === document.scrollingElement;
}

function onScroll(e) {
  const target = e.target;
  let dx = 0, dy = 0;

  if (isWindowScroll(target)) {
    const x = window.scrollX, y = window.scrollY;
    dx = Math.abs(x - lastWindowX);
    dy = Math.abs(y - lastWindowY);
    lastWindowX = x;
    lastWindowY = y;
  } else if (target && typeof target.scrollTop === 'number') {
    const last = lastScrollMap.get(target);
    if (!last) {
      // First time seeing this element — record baseline, don't count.
      lastScrollMap.set(target, { x: target.scrollLeft, y: target.scrollTop });
      return;
    }
    dx = Math.abs(target.scrollLeft - last.x);
    dy = Math.abs(target.scrollTop  - last.y);
    last.x = target.scrollLeft;
    last.y = target.scrollTop;
  } else {
    return;
  }

  if (dx === 0 && dy === 0) return;
  // Pythagorean for diagonal scrolls (mouse drag); rare but more accurate
  pendingCm += Math.hypot(dx, dy) * PX_TO_CM;

  if (!flushTimer) flushTimer = setTimeout(flush, FLUSH_MS);
}

function flush() {
  flushTimer = null;
  if (pendingCm < 0.001) return;
  if (typeof chrome === 'undefined' || !chrome.storage?.local) return;

  const cm = pendingCm;
  pendingCm = 0;
  const today = new Date().toISOString().slice(0, 10);

  try {
    chrome.storage.local.get(['totalCm', 'sites', 'dailyCm', 'lastDate'], (data) => {
      if (chrome.runtime.lastError) return;
      const lastDate = data.lastDate || today;
      let dailyCm = lastDate === today ? (data.dailyCm || 0) : 0;
      dailyCm += cm;

      const totalCm = (data.totalCm || 0) + cm;
      const sites = data.sites || {};
      sites[hostname] = (sites[hostname] || 0) + cm;

      chrome.storage.local.set({ totalCm, sites, dailyCm, lastDate: today });
    });
  } catch (_) {}
}

// Capture phase catches scroll events from any scrollable element
// (scroll events do NOT bubble in DOM, so capture is required to see them all).
document.addEventListener('scroll', onScroll, { capture: true, passive: true });
window.addEventListener('beforeunload', () => { clearTimeout(flushTimer); flush(); });
