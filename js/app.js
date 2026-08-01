// ============================================================
// ANZAR — App Entry Point
// Logic: recovery branch (modular routing, IndexedDB)
// UI shell: main branch (topbar, theme toggle, export)
// ============================================================

import { openDB, getAll, DB_VERSION } from './storage.js';
import { renderToday }                from './today.js';
import { renderCalendar }             from './calendar.js';
import { renderNotes }                from './notes.js';
import { renderGraph, stopGraph }     from './graph.js';

const mainView = document.getElementById('main-view');
const navBtns  = document.querySelectorAll('.nav-btn');
let currentView = 'today';

// ---- Counts -------------------------------------------------

async function updateCounts() {
  try {
    const [tasks, notes] = await Promise.all([
      getAll('tasks').catch(() => []),
      getAll('notes').catch(() => [])
    ]);
    const calBadge   = document.getElementById('count-calendar');
    const notesBadge = document.getElementById('count-notes');
    const dbVerEl    = document.getElementById('db-version');
    if (calBadge)   calBadge.textContent   = tasks.length;
    if (notesBadge) notesBadge.textContent  = notes.length;
    if (dbVerEl)    dbVerEl.textContent     = `v${DB_VERSION}`;
  } catch (e) {
    console.warn('Count update failed', e);
  }
}

// ---- Router -------------------------------------------------

async function route(view) {
  currentView = view;

  // Stop D3 simulation when leaving graph
  stopGraph();

  // Animate transition
  mainView.innerHTML = '';
  mainView.classList.remove('fade-in');
  void mainView.offsetWidth; // reflow
  mainView.classList.add('fade-in');

  // Activate nav button
  navBtns.forEach(b => b.classList.toggle('active', b.dataset.view === view));

  switch (view) {
    case 'today':    await renderToday(mainView);    break;
    case 'calendar': await renderCalendar(mainView); break;
    case 'notes':    await renderNotes(mainView);
                     // Handle graph → note navigation
                     if (window.__anzar_open_note) {
                       // notes module reads this flag on its own after render
                       delete window.__anzar_open_note;
                     }
                     break;
    case 'graph':    await renderGraph(mainView);    break;
    default:         await renderToday(mainView);
  }

  await updateCounts();
}

// ---- Theme --------------------------------------------------

function initTheme() {
  const toggle = document.getElementById('themeToggle');
  if (!toggle) return;

  // Persist theme
  const saved = localStorage.getItem('anzar_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
  toggle.textContent = saved === 'dark' ? '☀' : '☾';

  toggle.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const next    = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    toggle.textContent = next === 'dark' ? '☀' : '☾';
    localStorage.setItem('anzar_theme', next);
  });
}

// ---- Export -------------------------------------------------

function initExport() {
  const btn = document.getElementById('exportBtn');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    const [tasks, notes, folders] = await Promise.all([
      getAll('tasks').catch(() => []),
      getAll('notes').catch(() => []),
      getAll('folders').catch(() => [])
    ]);
    const payload = { version: DB_VERSION, exportedAt: new Date().toISOString(), tasks, notes, folders };
    const blob    = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url     = URL.createObjectURL(blob);
    const a       = document.createElement('a');
    a.href        = url;
    a.download    = `anzar-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });
}

// ---- Nav ----------------------------------------------------

function initNav() {
  navBtns.forEach(btn => {
    btn.addEventListener('click', () => route(btn.dataset.view));
  });
}

// ---- Service Worker -----------------------------------------

function initSW() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(err => {
      console.warn('SW registration failed', err);
    });
  }
}

// ---- Boot ---------------------------------------------------

async function init() {
  await openDB();
  initTheme();
  initExport();
  initNav();
  await route('today');
  initSW();
}

init();