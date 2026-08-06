# ANZAR — Optimized Merge Strategy
**The best of both branches, zero compromise**

> **Goal:** Keep the main branch's structural intent (modular files, cleaner nav) while restoring 100% of the recovery branch's working content — without breaking anything.

---

## 1. Situation Summary

| | Main Branch | Recovery Branch |
|---|---|---|
| **Navigation / UI shell** | ✅ Works | ✅ Works |
| **Content rendering** | 🔴 Broken (black void) | ✅ All 4 views work |
| **File structure** | ✅ Intended modular split | ⚠️ Monolithic app.js |
| **Design system** | ✅ Same CSS | ✅ Same CSS |
| **Dead files** | ❓ Unknown | ❌ 4 empty JS files |
| **Storage** | ❓ Unknown | ✅ IndexedDB + localStorage |
| **PWA / SW** | ❓ Unknown | ✅ Functional |

**Root cause of main branch failure:** `js/app.js` is either empty, truncated, or has a broken init — the HTML shell (topbar, `<main id="main">`) loads fine but `App.init()` never fires or `render()` is missing.

**What we are NOT doing:** a full rewrite. We are doing a targeted transplant.

---

## 2. Target File Structure (Final State)

```
anzar/
├── index.html              ← Keep main branch version (has [?] [⚙] [🔔] icons, V2 label)
├── css/
│   └── style.css           ← Keep as-is (identical across both branches)
├── js/
│   ├── app.js              ← ROUTER ONLY (~80 lines) — new file
│   ├── storage.js          ← Keep recovery branch version (complete, tested)
│   ├── modules/
│   │   ├── calendar.js     ← Extracted from recovery app.js
│   │   ├── notes.js        ← Extracted from recovery app.js
│   │   ├── graph.js        ← Extracted from recovery app.js
│   │   └── today.js        ← Extracted from recovery app.js (replaces today.js)
│   └── utils/
│       └── helpers.js      ← escapeHtml, debounce, modal logic
├── sw.js                   ← Recovery branch version (updated asset list)
├── manifest.json           ← Recovery branch version (tested)
├── README.md
└── STRATEGY.md
```

**What gets deleted:** `js/calendre.js` (typo), all empty placeholder files from recovery branch, any dead imports.

---

## 3. Step-by-Step Execution Plan

### Step 1 — Stabilize (15 min)

Start on main branch. Do not touch recovery. Create a working branch:

```bash
git checkout main
git checkout -b fix/restore-and-modularize
```

### Step 2 — Transplant the Working Core (30 min)

Copy only the files that are proven to work from recovery:

```bash
git checkout recovery-branch -- js/storage.js
git checkout recovery-branch -- sw.js
git checkout recovery-branch -- manifest.json
```

These three files are self-contained and risk-free. They fix persistence and PWA immediately.

### Step 3 — Create the Module Files (2–3 hours)

This is the main work. Open `recovery-branch/js/app.js` and extract each section into its own file under `js/modules/`. The split points are already clear in the recovery code:

**`js/modules/calendar.js`** — extract: `renderCalendar()`, `renderCalendarGrid()`, `createDayCell()`

```javascript
// js/modules/calendar.js
export const CalendarModule = {
    selectedPriority: 'none',
    currentMonth: new Date(),

    render(container, data, save) { /* renderCalendar body */ },
    renderGrid(view, data) { /* renderCalendarGrid body */ },
    createDayCell(day, isOtherMonth) { /* body */ }
};
```

**`js/modules/notes.js`** — extract: `renderNotes()`, `renderFileTree()`, `createNoteItem()`, `loadActiveNote()`, `updatePreview()`, `renderMarkdown()`, `updateStats()`, `updateCursorPos()`, `openNote()`, `deleteNote()`, `addToRecent()`, `removeFromRecent()`

```javascript
// js/modules/notes.js
export const NotesModule = {
    currentNoteId: null,
    noteViewMode: 'split',
    expandedFolders: new Set(),

    render(container, data, save, openNote) { /* renderNotes body */ },
    renderFileTree(view, data, save) { /* body */ },
    renderMarkdown(text, data) { /* body */ },
    // ... all note methods
};
```

**`js/modules/graph.js`** — extract: `renderGraph()` and the D3 logic

```javascript
// js/modules/graph.js
export const GraphModule = {
    render(container, data, openNote) { /* renderGraph body */ }
};
```

**`js/modules/today.js`** — extract: `renderToday()` (replaces the old standalone today.js)

```javascript
// js/modules/today.js
export const TodayModule = {
    render(container, data) { /* renderToday body */ }
};
```

**`js/utils/helpers.js`** — extract: `escapeHtml()`, `showModal()`, `setupModal()`, `debounce()`

```javascript
// js/utils/helpers.js
export function escapeHtml(text) { /* body */ }
export function debounce(fn, delay) { /* body */ }
export function setupModal(callback) { /* body */ }
```

### Step 4 — Rewrite app.js as a Clean Router (1 hour)

This is the key file. It should be short and clear:

```javascript
// js/app.js
import { openDB } from './storage.js';
import { CalendarModule } from './modules/calendar.js';
import { NotesModule } from './modules/notes.js';
import { GraphModule } from './modules/graph.js';
import { TodayModule } from './modules/today.js';
import { escapeHtml, debounce, setupModal } from './utils/helpers.js';

const App = {
    data: {
        tasks: [],
        notes: [],
        folders: [],
        settings: { theme: 'dark' },
        recentNotes: []
    },
    currentView: 'today',

    init() {
        try {
            this.load();
            this.ensureDefaults();
            this.setupTheme();
            this.setupExport();
            this.setupNav();
            setupModal(this);
            this.render();
        } catch (error) {
            console.error('App init failed:', error);
            document.getElementById('main').innerHTML =
                '<div style="padding:2rem;color:red">Failed to load. Check console.</div>';
        }
    },

    load() {
        const saved = localStorage.getItem('anzar_data');
        if (!saved) return;
        try {
            const parsed = JSON.parse(saved);
            this.data = { recentNotes: [], folders: [], ...parsed };
        } catch (e) {
            console.error('Storage parse failed, using defaults');
        }
    },

    save() {
        try {
            localStorage.setItem('anzar_data', JSON.stringify(this.data));
        } catch (e) {
            console.error('Save failed (storage full?):', e);
        }
    },

    render() {
        const main = document.getElementById('main');
        if (!main) { console.error('No #main element found'); return; }
        main.innerHTML = '';

        switch (this.currentView) {
            case 'calendar': CalendarModule.render(main, this.data, () => this.save()); break;
            case 'notes':    NotesModule.render(main, this.data, () => this.save(), (id) => this.openNote(id)); break;
            case 'graph':    GraphModule.render(main, this.data, (id) => this.openNote(id)); break;
            case 'today':    TodayModule.render(main, this.data); break;
            default:         TodayModule.render(main, this.data);
        }
    },

    openNote(id) {
        this.currentView = 'notes';
        NotesModule.currentNoteId = id;
        this.render();
        document.querySelectorAll('.nav-btn').forEach(b =>
            b.classList.toggle('active', b.dataset.view === 'notes')
        );
    },

    setupNav() {
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentView = btn.dataset.view;
                this.render();
            });
        });
    },

    setupTheme() { /* same as recovery */ },
    setupExport() { /* same as recovery */ },
    ensureDefaults() { /* same as recovery, with graph demo data added */ }
};

document.addEventListener('DOMContentLoaded', () => App.init());
```

### Step 5 — Update index.html (15 min)

Keep the main branch's `index.html` (it has the better nav with V2 label and extra icons), but make two changes:

1. Confirm `<main id="main"></main>` exists and is not renamed
2. Change the script tag to use ES modules:

```html
<!-- Replace this: -->
<script src="js/app.js"></script>

<!-- With this: -->
<script type="module" src="js/app.js"></script>
```

Remove the inline CDN scripts for marked.js and D3 from the HTML — import them inside the module files that actually use them, or keep them as globals if you want zero build tooling.

### Step 6 — Update sw.js Asset List (10 min)

Update the cache list to match the new structure and remove dead files:

```javascript
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/css/style.css',
    '/js/app.js',
    '/js/storage.js',
    '/js/modules/calendar.js',
    '/js/modules/notes.js',
    '/js/modules/graph.js',
    '/js/modules/today.js',
    '/js/utils/helpers.js'
];
```

### Step 7 — Add Graph Demo Data (20 min)

The graph view is visually empty in both branches because the demo notes have no interconnecting links. Add 3 linked notes inside `ensureDefaults()`:

```javascript
// Add to the default notes array:
{
    id: 'lang-overview',
    title: 'Language Learning Hub',
    content: '# Language Learning\n\nStudying [[German Basics]] and [[French Basics]].\n\n#languages',
    folder: 'Languages',
    tags: ['languages'],
    links: ['German Basics', 'French Basics'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
},
{
    id: 'lang-german',
    title: 'German Basics',
    content: '# German Basics\n\nSee also [[Language Learning Hub]].\n\n#german #vocab',
    folder: 'Languages',
    tags: ['german', 'vocab'],
    links: ['Language Learning Hub'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
},
{
    id: 'lang-french',
    title: 'French Basics',
    content: '# French Basics\n\nSee also [[Language Learning Hub]].\n\n#french #vocab',
    folder: 'Languages',
    tags: ['french', 'vocab'],
    links: ['Language Learning Hub'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
}
```

### Step 8 — Add Debounce to Search (10 min)

In `js/modules/notes.js`, wrap the search listener:

```javascript
const debounce = (fn, delay) => {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); };
};

view.querySelector('#searchInput').addEventListener(
    'input',
    debounce(() => this.renderFileTree(view, data, save), 300)
);
```

### Step 9 — Test and Merge (30 min)

```bash
# Open index.html in browser (no server needed)
# Check all 4 views render
# Check data persists on reload
# Check dark/light toggle
# Check export JSON works
# Check graph shows nodes

git add .
git commit -m "feat: modularize app, restore all content, fix graph demo data"
git checkout main
git merge fix/restore-and-modularize
```

---

## 4. What Changes vs What Stays the Same

| Element | Change? | Action |
|---|---|---|
| `index.html` shell | Minimal | Add `type="module"` to script tag |
| `css/style.css` | None | Keep as-is |
| `js/storage.js` | None | Keep recovery version |
| `js/app.js` | Major | Rewrite as clean router |
| `js/modules/*.js` | New files | Extract from recovery `app.js` |
| `js/utils/helpers.js` | New file | Extract utilities |
| `js/today.js` (old standalone) | Deleted | Replaced by `modules/today.js` |
| `js/calendre.js` | Deleted | Typo file, never used |
| Empty placeholder files | Deleted | Replaced by real modules |
| `sw.js` | Updated | New asset list |
| `manifest.json` | None | Keep recovery version |
| Graph demo data | Added | 3 interconnected notes |
| Error handling | Added | try/catch in `App.init()` |
| Search debounce | Added | 300ms debounce on input |

---

## 5. Key Decisions and Why

**Why keep the main branch `index.html` instead of recovery's?**
Main branch shows a more evolved UI (V2 label, [?] [⚙] [🔔] icons). The shell works — only the JS was broken. No reason to downgrade the HTML.

**Why use ES modules (`type="module"`)?**
The file split into `js/modules/*.js` requires imports. ES modules work natively in all modern browsers without a build tool, which preserves the "no build step" principle from STRATEGY.md.

**Why not use a bundler (Webpack/Vite)?**
STRATEGY.md says "Zero build tooling — save file, refresh browser." Respecting that constraint. ES modules achieve the modular split with zero tooling overhead.

**Why not just copy the entire recovery `app.js` into main?**
That would fix the black screen but leave main branch worse than before — a 1500-line monolith with 4 dead empty files next to it. The whole point of main branch was to improve the structure. We're doing that, correctly this time.

**Why not merge main branch improvements into recovery?**
The main branch's only confirmed improvements are cosmetic (better topbar icons, V2 label). Everything structural in main is broken or unknown. It's safer to keep recovery as the content source and only take the verified HTML shell from main.

---

## 6. Risk Map

| Risk | Likelihood | Mitigation |
|---|---|---|
| ES module `import` fails due to CORS on `file://` | Medium | Use a local server (`python -m http.server`) or deploy to GitHub Pages |
| Module state (e.g. `currentNoteId`) shared incorrectly | Low | Store shared state in `App.data`, pass as argument to modules |
| Old localStorage data incompatible with new structure | Very Low | `ensureDefaults()` already handles missing fields gracefully |
| D3 / marked CDN unavailable offline | Low | Already handled by service worker cache |
| Merge conflict on `style.css` | Very Low | Both branches use identical CSS |

---

## 7. Kimi Prompt

Use this prompt to have Kimi execute the full implementation described in this document.

---

```
You are an expert vanilla JavaScript developer. Your task is to implement the ANZAR merge strategy described below. You will produce complete, ready-to-save file contents — no placeholders, no "// add your code here", no truncations.

## Context

ANZAR is a local-first personal productivity web app (no backend, no build tools). It has 4 views: Calendar, Notes, Graph (D3 force-directed), Today. Data is stored in localStorage. It is a PWA with a service worker.

There are two branches:
- **recovery-branch**: fully working monolithic app.js (~1500 lines), all 4 views render correctly
- **main-branch**: broken (black void in content area), but has a better HTML shell (topbar with V2 label, [?][⚙][🔔] icons)

## What you must produce

Create the following files with complete, production-ready content:

### 1. `index.html`
Use the main branch shell structure (topbar with: logo "ANZAR", nav buttons TODAY/CALENDAR/NOTES/GRAPH, right side [?][⚙][🔔] plus export ↓ and theme toggle ☀). Keep `<main id="main"></main>`. Add `type="module"` to the app.js script tag. Keep CDN links for marked.js and D3 as global scripts (not modules) so modules can access `marked` and `d3` as globals.

### 2. `css/style.css`
Keep exactly as provided in the recovery branch (do not modify).

### 3. `js/storage.js`
Keep exactly as provided in the recovery branch (do not modify).

### 4. `js/utils/helpers.js`
Extract and export these utilities:
- `escapeHtml(text)` — XSS-safe HTML encoding
- `debounce(fn, delay)` — standard debounce
- `setupModal(App)` — sets up the modal overlay (cancel/confirm/keyboard events)
- `showModal(title, placeholder, callback, showFolderSelect, folders)` — shows the modal with optional folder select

### 5. `js/modules/calendar.js`
Export `CalendarModule` object with:
- `render(container, data, save)` — full calendar view with sidebar form + month grid
- `renderGrid(view, data, currentMonth)` — renders the 7x6 grid for a given month
- `createDayCell(day, isOtherMonth)` — creates a single day cell div

Preserve all features: priority pills, task chips with tooltips, form validation with error flash, click-day-to-fill-date, legend, prev/next month navigation, today button.

### 6. `js/modules/notes.js`
Export `NotesModule` object with state (`currentNoteId`, `noteViewMode`, `expandedFolders`) and methods:
- `render(container, data, save, openNoteFn)` — full notes view
- `renderFileTree(view, data, save)` — sidebar file tree with folders, search, delete buttons
- `createNoteItem(note, data, save)` — single file tree item
- `loadActiveNote(view, data, save)` — loads note into editor, sets up all listeners
- `updatePreview(view, data)` — re-renders markdown preview
- `renderMarkdown(text, data)` — custom markdown parser including wiki links and tags
- `updateStats(view)` — word/char count
- `updateCursorPos(view)` — Ln/Col display
- `openNote(id, data, save)` — switches active note
- `deleteNote(id, data, save)` — deletes note and updates recent list

Apply 300ms debounce to the search input.

### 7. `js/modules/graph.js`
Export `GraphModule` with:
- `render(container, data, openNoteFn)` — full D3 force-directed graph

If no notes exist or no links exist, show a styled empty state message. Use `d3` as a global (loaded via CDN in index.html).

### 8. `js/modules/today.js`
Export `TodayModule` with:
- `render(container, data)` — today's date header, 3 stat cards (Tasks/Done/Urgent), task list for today sorted by priority, empty state if no tasks

### 9. `js/app.js`
Clean router (~100 lines). Must:
- Import all modules and helpers
- Define `App` object with `data`, `currentView`
- `init()` wrapped in try/catch — on error, show visible error message in `#main`
- `load()` from localStorage with try/catch
- `save()` to localStorage with try/catch
- `ensureDefaults()` — create demo data if notes/tasks are empty, including 3 interconnected notes for the graph: "Language Learning Hub" (links to German Basics + French Basics), "German Basics" (#german #vocab), "French Basics" (#french #vocab), plus the existing Welcome/Daily/Projects/Reading notes
- `render()` — routes to the correct module
- `openNote(id)` — switches to notes view and sets currentNoteId
- `setupNav()` — nav button click handlers
- `setupTheme()` — dark/light toggle
- `setupExport()` — JSON export button
- Initialize with `document.addEventListener('DOMContentLoaded', () => App.init())`

### 10. `sw.js`
Update the static assets list to include the new module paths. Remove all references to dead files (calendre.js, the old empty calendar.js/notes.js/graph.js).

### 11. `manifest.json`
Keep exactly as provided in the recovery branch.

## Hard constraints

- Zero build tools. No npm, no webpack, no Vite. Files must work by opening index.html in a browser (or serving with `python -m http.server`).
- No frameworks. Vanilla JS, HTML, CSS only.
- ES modules (`type="module"`) for imports between js files. `d3` and `marked` remain globals loaded via CDN script tags.
- localStorage is the primary data store. IndexedDB (storage.js) is available but optional.
- All 4 views must render real content — no empty screens.
- escapeHtml must be applied to all user-generated content rendered to innerHTML.
- The graph must show nodes when the default demo data is present.
- Dark mode must work on load (read from data.settings.theme).
- Data must persist on page reload.

## Design system

CSS variables already defined in style.css:
- `--bg`, `--ink`, `--accent` (#FF0000 in light, same in dark)
- `--bg-sidebar`, `--border`, `--border-light`
- `--urgent` #E45858, `--high` #EF9F27, `--medium` #E8C547, `--low` #1D9E75, `--none` #378ADD
- Font: Helvetica Neue (display), Courier New (mono)
- No border-radius (brutalist)
- Dark mode via `[data-theme="dark"]` on `<html>`

## Output format

For each file, output:

=== FILENAME ===
[complete file content]
=== END ===

Output all 11 files in the order listed above. Do not truncate any file. Do not add TODO comments or placeholders. The code must be complete and functional.
```