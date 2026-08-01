# Anzar

**Calendar + Linked Notes. Brutalist Swiss. Local-only.**

A productivity tool that combines a monthly calendar with Obsidian-style linked notes. No backend. No subscriptions. Your data never leaves your browser.

---

## What It Does

| Module | What You Get |
|--------|-------------|
| **Calendar** | Monthly grid with task chips, priority colors, add form sidebar |
| **Notes** | Markdown editor with live preview, `[[wiki links]]`, auto-tagging |
| **Graph** | Force-directed visualization of note connections (D3) |
| **Today** | Daily task summary with urgency stats |

---

## Design

**Brutalist Swiss aesthetic.**

- Helvetica Neue, absolute black/white, one red accent
- 0.5px borders, zero border-radius, uppercase labels
- Dark mode inverts everything — white ink on black ground
- No gradients, no shadows, no decoration beyond function

---

## Stack

- **HTML5** — structure
- **Vanilla JS** — all logic, no framework
- **localStorage** — data persistence
- **Marked.js** — Markdown rendering
- **D3.js** — graph visualization
- **GitHub Pages** — free hosting

---

## Quick Start

Open `index.html` in any browser. No build step. No server.

Or deploy:

```bash
git init
git add .
git commit -m "Anzar"
git remote add origin https://github.com/ASAPUI/anzar.git
git push -u origin main
```

Enable GitHub Pages in repo settings. Live at `https://ASAPUI.github.io/anzar/`

---

## How to Use

### Calendar
1. Fill the sidebar form: title, date, priority
2. Click **Add to Calendar**
3. Tasks appear as colored chips on the correct day
4. Click any day cell to auto-fill the date field
5. Hover a chip to see assignee and note

### Notes
1. Go to **Notes** tab
2. Click **+ New Note**
3. Write in Markdown
4. Use `[[Note Title]]` to link notes — click links to navigate
5. Use `#tag` for auto-extracted tags

### Graph
1. Create 2+ notes with `[[links]]` between them
2. Go to **Graph** tab
3. Drag nodes, zoom, click to open notes

---

## Data

Everything stores in your browser's `localStorage`.

**Export:** Click the ↓ button in the top bar to download a `.json` backup.

**No cloud.** No account. No tracking.

---

## Keyboard

| Key | Action |
|-----|--------|
| `Tab` | Navigate form fields |
| `Enter` | Submit task form |

---

## File Structure

```
anzar/
├── index.html          # Single page shell
├── css/
│   └── style.css       # Brutalist Swiss design system
├── js/
│   └── app.js          # All logic: calendar, notes, graph, storage
└── README.md           # This file
```

---

## Roadmap

- [x] Monthly calendar with task form
- [x] Priority system (5 levels)
- [x] Markdown notes with wiki links
- [x] Note graph (D3 force-directed)
- [x] Today view with stats
- [x] Dark/light mode
- [x] Export to JSON
- [ ] Week view toggle
- [x] Search across notes



---

## License

MIT. Build whatever you want.
