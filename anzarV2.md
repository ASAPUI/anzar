# ANZAR V2 — Code Review Report
**Branch:** `main` | **Reviewer:** Claude (Senior Engineer) | **Date:** 2026-08-06

---

## Summary

ANZAR is a local-first personal productivity web app (Calendar + Notes + Graph + Today) built in vanilla JS with no build tooling. The recovery branch is **fully functional**; the main branch **renders a black void** in the content area because `js/app.js` is a monolithic object that never calls `render()` on `DOMContentLoaded`, and three module files (`calendar.js`, `notes.js`, `graph.js`) are **empty**. The HTML shell (topbar, nav, modals) is solid and represents a genuine UI upgrade over the recovery branch. The strategy is correct: transplant the recovery branch's logic into the main branch's shell.

**Overall verdict: REQUEST CHANGES — critical rendering failure, fixable in one session.**

---

## 🔴 Critical Issues (Must Fix Before Use)

### C-1 — `js/app.js` Never Mounts the UI

**File:** `js/app.js` (main branch, monolithic version in doc index 17)

The `App` object is defined but the `DOMContentLoaded` listener only calls `App.init()`. The problem is that `init()` calls `this.render()`, but the HTML shell from the **main branch** uses `<main id="main">` while the recovery `app.js` calls `document.getElementById('main')` — this is fine. The real issue: if `js/app.js` on the actual main branch is **empty or truncated** (as stated in STRATEGY.md), nothing ever runs.

**Evidence:** The screenshot shows the topbar rendering (loaded from HTML) but `<main>` is black — JS never touched it.

**Fix:** Replace `js/app.js` with the complete version from the recovery branch (index 17), then add `type="module"` to the script tag and modularize as per STRATEGY.md.

```html
<!-- index.html — change this: -->
<script src="js/app.js"></script>

<!-- to this: -->
<script type="module" src="js/app.js"></script>
```

---

### C-2 — Three Module Files Are Empty

**Files:** `js/calendre.js`, `js/graph.js`, `js/notes.js` (index 2, 3, 4 — all empty)

The main branch split the monolith into separate files but never populated them. Any `import` referencing these files will throw a SyntaxError and halt execution.

**Fix:** Extract the relevant functions from `js/app.js` (recovery, index 17) into these files. See STRATEGY.md Step 3 for the exact split points.

---

### C-3 — Typo File `js/calendre.js` (Dead Code)

`calendre.js` is a misspelled dead file. It will never be imported anywhere because the correct name is `calendar.js`. Delete it.

```bash
git rm js/calendre.js
```

---

### C-4 — `manifest.js` Has Wrong Extension

**File:** `manifest.js` (index 10)

The PWA manifest must be `manifest.json`. With `.js` extension, `<link rel="manifest" href="manifest.json">` in index.html will 404, breaking PWA installability and the `theme-color` meta.

```bash
git mv manifest.js manifest.json
```

---

### C-5 — `index.html` Loads External Scripts as Globals Without ES Module Guard

**File:** `index.html` (index 15)

```html
<script src="js/app.js"></script>
```

Without `type="module"`, ES6 `import`/`export` syntax in app.js throws a `SyntaxError` immediately in strict-mode parsers. Once you add `type="module"`, the D3 and marked CDN scripts loaded before it become globals accessible from modules — that part is fine — but the order matters.

**Fix:**
```html
<!-- Keep D3 and marked as globals BEFORE the module -->
<script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
<script src="https://d3js.org/d3.v7.min.js"></script>
<!-- Then the app module -->
<script type="module" src="js/app.js"></script>
```

---

## 🟠 Major Issues (Should Fix)

### M-1 — XSS Risk in `renderMarkdown()` — Unescaped URL in Anchor Tag

**File:** `js/app.js`, line ~390 (recovery version)

```javascript
.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')
```

`$2` is the raw URL from user input. A note containing `[click me](javascript:alert(1))` would execute arbitrary JS.

**Fix:**
```javascript
.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, text, url) => {
    const safeUrl = url.startsWith('http://') || url.startsWith('https://')
        ? url
        : '#';
    return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${escapeHtml(text)}</a>`;
})
```

---

### M-2 — `renderMarkdown()` Is a Hand-Rolled Parser with Known Failure Modes

The custom regex Markdown parser (index 17, ~350-400) has multiple edge cases that will break:

- Nested lists render incorrectly (the `<ul>/<li>` regex wraps greedily)
- Code blocks with content matching other regexes get double-processed (e.g., a `**bold**` inside a ` ``` ` block)
- Table detection is fragile — the separator row (`| --- |`) is silently dropped but causes row misalignment

**Fix:** The `marked.min.js` CDN script is already loaded in `index.html`. Use it:

```javascript
updatePreview(view, data) {
    const text = view.querySelector('#editor').value;
    // Process wiki links before passing to marked
    const processed = text.replace(/\[\[(.*?)\]\]/g, (_, title) =>
        `<a href="#" class="wiki-link" data-title="${escapeHtml(title.trim())}">${escapeHtml(title.trim())}</a>`
    );
    view.querySelector('#preview').innerHTML = marked.parse(processed);
    // re-attach wiki-link listeners...
}
```

This eliminates ~80 lines of fragile regex code.

---

### M-3 — `setInterval` in `today.js` Leaks on View Navigation

**File:** `js/today.js` (index 12)

```javascript
setInterval(() => {
    timeEl.textContent = formatTime(new Date());
}, 1000);
```

Every time the user navigates to the "Today" view, a new interval is created. After 10 navigations, 10 intervals are ticking simultaneously. The interval reference is never stored or cleared.

**Fix:**
```javascript
// Store the interval ID and clear on next render
let clockInterval = null;

export async function renderToday(container) {
    if (clockInterval) clearInterval(clockInterval);
    // ...render...
    clockInterval = setInterval(() => {
        timeEl.textContent = formatTime(new Date());
    }, 1000);
}
```

---

### M-4 — No Error Boundary Around `App.init()`

**File:** `js/app.js` (main branch — if app.js is empty this is moot, but applies to the recovery version too)

If any module import fails or `this.load()` throws, the user sees a permanent black screen with no feedback. The STRATEGY.md already notes this.

**Fix (from STRATEGY.md Step 4):**
```javascript
init() {
    try {
        this.load();
        this.ensureDefaults();
        this.setupTheme();
        this.setupExport();
        this.setupNav();
        this.render();
    } catch (error) {
        console.error('App init failed:', error);
        document.getElementById('main').innerHTML =
            `<div style="padding:2rem;color:red;font-family:monospace">
                <strong>ANZAR failed to load</strong><br>
                ${error.message}<br>
                <small>Check the browser console for details.</small>
             </div>`;
    }
}
```

---

### M-5 — Graph View Has No Demo Data Visible on First Load

**File:** `js/app.js` `ensureDefaults()` (recovery version)

The default notes (`welcome`, `daily`, `ideas`, `reading`) have `links: []` except `ideas` which links to `Welcome`. The graph renders with one edge (Ideas → Welcome). The graph legend shows "german" and "french" node types but there are no notes with those tags.

**Fix:** Add the three interconnected language notes from STRATEGY.md Step 7:
```javascript
// In ensureDefaults(), add to the notes array:
{ id: 'lang-hub', title: 'Language Learning Hub',
  content: '# Language Learning\n\nStudying [[German Basics]] and [[French Basics]].\n\n#languages',
  folder: 'Languages', tags: ['languages'], links: ['German Basics', 'French Basics'], ... },
{ id: 'lang-de', title: 'German Basics',
  content: '# German\n\nSee [[Language Learning Hub]].\n\n#german #vocab',
  folder: 'Languages', tags: ['german', 'vocab'], links: ['Language Learning Hub'], ... },
{ id: 'lang-fr', title: 'French Basics',
  content: '# French\n\nSee [[Language Learning Hub]].\n\n#french #vocab',
  folder: 'Languages', tags: ['french', 'vocab'], links: ['Language Learning Hub'], ... }
```

---

### M-6 — `sw.js` Caches Dead Files

**File:** `sw.js` (index 11)

The service worker tries to pre-cache `/js/calendar.js`, `/js/notes.js`, `/js/graph.js`, `/js/today.js` — files that either don't exist or are empty in the main branch. This causes the SW `install` event to fail silently (or loudly in some browsers), breaking offline support entirely.

**Fix:** Update `STATIC_ASSETS` to match the actual file structure after modularization:
```javascript
const STATIC_ASSETS = [
    '/', '/index.html', '/css/style.css',
    '/js/app.js', '/js/storage.js',
    '/js/modules/calendar.js', '/js/modules/notes.js',
    '/js/modules/graph.js', '/js/modules/today.js',
    '/js/utils/helpers.js'
];
```

---

## 🟡 Minor Issues (Nice to Have)

### N-1 — Duplicate `index.html` Files

There are two versions of `index.html` in the provided context (index 13 and index 15). The main branch version (15) is the correct one (V2 topbar). The recovery version (13) uses an old sidebar layout. Confirm only one exists in the repo.

---

### N-2 — `today.js` XSS: `focus` Value Not Escaped

**File:** `js/today.js` (index 12)

```javascript
value="${saved.focus}"
```

If `saved.focus` contains a `"` character, it breaks the HTML attribute. Use `escapeHtml()`:
```javascript
value="${escapeHtml(saved.focus)}"
```

---

### N-3 — `localStorage` Fallback Missing When Storage Is Full

**File:** `js/app.js` `save()` (recovery, index 17)

```javascript
save() {
    localStorage.setItem('anzar_data', JSON.stringify(this.data));
}
```

No try/catch. If localStorage is full (common on iOS with 5MB limit), this throws silently and data is lost. Fix:
```javascript
save() {
    try {
        localStorage.setItem('anzar_data', JSON.stringify(this.data));
    } catch (e) {
        console.error('Save failed — storage may be full:', e);
    }
}
```

---

### N-4 — `data-theme` Not Restored on Load

**File:** `js/app.js` `setupTheme()` (recovery, index 17)

Theme preference is saved to `this.data.settings.theme` but `document.documentElement.setAttribute('data-theme', ...)` is only set when the user clicks the toggle — not on page load. The HTML has `data-theme="dark"` hardcoded, so dark mode always loads regardless of the saved preference.

**Fix in `init()` or `setupTheme()`:**
```javascript
// Restore saved theme on load
document.documentElement.setAttribute('data-theme', this.data.settings?.theme ?? 'dark');
```

---

### N-5 — `escapeHtml` Defined Inside the App Object, Not Exported

**File:** `js/app.js` (recovery, index 17)

`escapeHtml` is a method of `App` but it's needed in every module. When modules are split, each will need its own copy. Extract it to `js/utils/helpers.js` and import it everywhere.

---

### N-6 — Priority Pill State Reset on Re-Render

**File:** `js/app.js` `renderCalendar()` (recovery, index 17)

After submitting a task, `this.selectedPriority = 'none'` is set but `CalendarModule.selectedPriority` (after modularization) would be instance state on the module object — which persists correctly. However, if the user navigates away and back, the priority resets to `'none'` because the entire view re-renders. This is expected behavior for a non-framework app; just document it.

---

## ✅ What's Done Well

- **`escapeHtml()` used consistently** — All user-generated content rendered to innerHTML goes through the `div.textContent` trick. This is the correct, browser-native XSS defense.
- **`storage.js` versioned migrations** — The `MIGRATIONS` object (index 6) with per-version upgrade functions is a clean, forward-compatible pattern. Adding v4 will be trivial.
- **Priority color system** — The CSS variable approach for `--urgent`, `--high`, `--medium`, `--low`, `--none` with matching `-bg` variants is DRY and themeable. The priority pills look sharp.
- **D3 drag + zoom on graph** — The force simulation with drag handlers and `d3.zoom()` is implemented correctly and cleanly.
- **Service Worker cache-first strategy** — The fetch handler (`caches.match → fetch → cache.put`) is correct and will work offline for static assets.
- **No framework discipline** — The entire 1500-line app is vanilla JS with zero dependencies except D3 and marked. This is intentional and correct for the stated goals.
- **Folder tree with expand/collapse state** — Persisting `expandedFolders` as a `Set` serialized to an array in localStorage is a smart lightweight solution.

---

## Questions for Author

1. **Is `js/app.js` on the main branch actually empty?** The merge strategy doc says "empty or truncated" but doesn't confirm. Running `wc -l js/app.js` on the main branch would clarify.
2. **Why are `[?]`, `[⚙]`, `[🔔]` icons in the topbar non-functional?** They appear in the V2 shell but have no event listeners. Are these placeholders for planned features (help, settings modal, notifications)?
3. **Is IndexedDB (`storage.js`) actually used?** The recovery `app.js` uses only `localStorage` (`anzar_data` key). `storage.js` exports `put/get/getAll/remove/clear` but none of these are imported in `app.js`. The `openDB` call in `app.js` (index 5) suggests an earlier integration that was removed. Clarify if IndexedDB is the intended future store.
4. **`file://` vs HTTP server?** With `type="module"` added, the app will fail on `file://` due to CORS. Users need `python -m http.server 8080` or GitHub Pages. Is this documented in the README?

---

## Verdict

**🔴 REQUEST CHANGES**

The main branch has a fatal rendering failure (black void). All four critical issues (C-1 through C-5) must be resolved before the app is usable. The recovery branch is the correct content source — the merge strategy in STRATEGY.md is accurate and executable. Estimated fix time following that plan: **3–4 hours for a single developer.**

Priority order:
1. Fix `manifest.js` → `manifest.json` (5 min)
2. Delete `js/calendre.js` (1 min)
3. Restore/complete `js/app.js` from recovery (30 min)
4. Add `type="module"` to index.html script tag (1 min)
5. Extract modules per STRATEGY.md (2–3 hours)
6. Fix `setInterval` leak in today.js (10 min)
7. Fix URL XSS in renderMarkdown (10 min)
8. Update sw.js asset list (10 min)