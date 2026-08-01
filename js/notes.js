// ============================================================
// ANZAR — Notes View
// Logic: recovery branch (IndexedDB, modular)
// Output: main branch Brutalist Swiss design
// ============================================================

import { put, get, getAll, remove, uid, escapeHtml } from './storage.js';

// ---- State --------------------------------------------------
let _currentNoteId    = null;
let _noteViewMode     = 'split';
let _expandedFolders  = new Set();
let _container        = null;

const DEFAULT_NOTES = [
  {
    id: 'welcome',
    title: 'Welcome',
    content: '# Welcome to Anzar Notes\n\nA clean, distraction-free note-taking experience.\n\n## Features\n- **Markdown editing** with live preview\n- **File tree** with folders\n- **Wiki links** with `[[note names]]`\n- **Tags** with `#hashtags`\n\n## Markdown Cheatsheet\n\n### Formatting\n**Bold**, *italic*, `code`\n\n### Links\nUse `[[Note Title]]` to link notes.\n\n### Code\n```js\nconsole.log("Hello Anzar");\n```\n\n> A blockquote for important thoughts\n\n---\n\nHappy writing!',
    folder: null,
    tags: [],
    links: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'daily',
    title: 'Daily Note',
    content: '# Daily Note\n\n## Morning\n- [ ] Review goals\n- [ ] Check tasks\n\n## Notes\nLinked: [[Welcome]]\n\n#daily #journal',
    folder: 'Daily Notes',
    tags: ['daily', 'journal'],
    links: ['Welcome'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'ideas',
    title: 'Project Ideas',
    content: '# Project Ideas\n\n1. **Habit Tracker**\n2. **Recipe Manager**\n\nRelated: [[Welcome]]\n\n#ideas #projects',
    folder: 'Projects',
    tags: ['ideas', 'projects'],
    links: ['Welcome'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

const DEFAULT_FOLDERS = [
  { id: 'f-daily',    name: 'Daily Notes' },
  { id: 'f-projects', name: 'Projects'    }
];

// ---- Init ---------------------------------------------------

async function _ensureDefaults() {
  const notes   = await getAll('notes');
  const folders = await getAll('folders');

  if (notes.length === 0) {
    for (const n of DEFAULT_NOTES) await put('notes', n);
    for (const f of DEFAULT_FOLDERS) await put('folders', f);
    _currentNoteId = 'welcome';
    _expandedFolders = new Set(['Daily Notes', 'Projects']);
  } else if (!_currentNoteId) {
    _currentNoteId = notes[0].id;
  }
}

// ---- Public -------------------------------------------------

export async function renderNotes(container) {
  _container = container;
  await _ensureDefaults();

  container.innerHTML = `
    <div class="notes-view">
      <!-- Sidebar -->
      <aside class="notes-sidebar">
        <div class="notes-sidebar-header">
          <span class="notes-sidebar-title">Vault</span>
          <div class="notes-sidebar-actions">
            <button class="notes-sidebar-btn" id="newNoteBtn" title="New Note">+</button>
            <button class="notes-sidebar-btn" id="newFolderBtn" title="New Folder">📁</button>
          </div>
        </div>
        <div class="notes-sidebar-search">
          <input type="text" class="notes-search-input" id="searchInput" placeholder="Search notes..." />
        </div>
        <div class="notes-file-tree" id="fileTree"></div>
      </aside>

      <!-- Main editor -->
      <main class="notes-main">
        <div class="notes-main-header">
          <div class="notes-breadcrumb" id="breadcrumb"><span>Vault</span></div>
          <div class="view-toggle-group">
            <button class="view-toggle-btn ${_noteViewMode === 'source'  ? 'active' : ''}" data-view="source">Edit</button>
            <button class="view-toggle-btn ${_noteViewMode === 'split'   ? 'active' : ''}" data-view="split">Split</button>
            <button class="view-toggle-btn ${_noteViewMode === 'preview' ? 'active' : ''}" data-view="preview">Preview</button>
          </div>
        </div>
        <div class="notes-main-content">
          <div class="editor-view ${_noteViewMode}-view" id="editorView">
            <div class="editor-pane">
              <textarea id="editor" placeholder="Start writing in Markdown..."></textarea>
            </div>
            <div class="preview-pane" id="preview"></div>
          </div>
        </div>
        <div class="notes-status-bar">
          <span id="wordCount">0 words</span>
          <span id="charCount">0 chars</span>
          <span id="cursorPos">Ln 1, Col 1</span>
        </div>
      </main>
    </div>
  `;

  await _renderFileTree();
  _loadActiveNote();

  // Search
  container.querySelector('#searchInput').addEventListener('input', () => _renderFileTree());

  // View toggle
  container.querySelectorAll('.view-toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.view-toggle-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      _noteViewMode = btn.dataset.view;
      container.querySelector('#editorView').className = `editor-view ${_noteViewMode}-view`;
    });
  });

  // New note
  container.querySelector('#newNoteBtn').addEventListener('click', () => {
    _showModal('New Note', async (name, folderName) => {
      const id = uid();
      const note = {
        id,
        title:     name,
        content:   `# ${name}\n\n`,
        folder:    folderName || null,
        tags:      [],
        links:     [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      await put('notes', note);
      _currentNoteId = id;
      if (folderName) _expandedFolders.add(folderName);
      await _renderFileTree();
      _loadActiveNote();
    }, true);
  });

  // New folder
  container.querySelector('#newFolderBtn').addEventListener('click', () => {
    _showModal('New Folder', async (name) => {
      const folders = await getAll('folders');
      if (!folders.find(f => f.name === name)) {
        await put('folders', { id: uid(), name });
        _expandedFolders.add(name);
      }
      await _renderFileTree();
    }, false);
  });
}

// ---- File Tree ----------------------------------------------

async function _renderFileTree() {
  if (!_container) return;
  const tree = _container.querySelector('#fileTree');
  if (!tree) return;

  const search  = (_container.querySelector('#searchInput')?.value || '').toLowerCase();
  const [allNotes, allFolders] = await Promise.all([getAll('notes'), getAll('folders')]);

  const filtered = search
    ? allNotes.filter(n => n.title.toLowerCase().includes(search) || (n.content || '').toLowerCase().includes(search))
    : allNotes;

  tree.innerHTML = '';

  // Root notes (no folder)
  filtered.filter(n => !n.folder).forEach(n => tree.appendChild(_noteItem(n)));

  // Folders
  allFolders.forEach(folder => {
    const folderNotes = filtered.filter(n => n.folder === folder.name);
    if (search && folderNotes.length === 0 && !folder.name.toLowerCase().includes(search)) return;

    const isOpen = _expandedFolders.has(folder.name);

    const header = document.createElement('div');
    header.className = `folder-header${isOpen ? ' open' : ''}`;
    header.innerHTML = `
      <span class="chevron">▶</span>
      <span class="file-icon">📁</span>
      <span class="folder-header-name">${escapeHtml(folder.name)}</span>
      <span class="folder-actions">
        <button class="folder-action-btn" data-action="add" title="Add note">+</button>
        <button class="folder-action-btn" data-action="del" title="Delete folder">×</button>
      </span>
    `;

    header.addEventListener('click', (e) => {
      if (e.target.closest('.folder-action-btn')) return;
      if (_expandedFolders.has(folder.name)) _expandedFolders.delete(folder.name);
      else _expandedFolders.add(folder.name);
      _renderFileTree();
    });

    header.querySelector('[data-action="add"]').addEventListener('click', (e) => {
      e.stopPropagation();
      _showModal(`New Note in "${folder.name}"`, async (name) => {
        const id = uid();
        await put('notes', {
          id, title: name, content: `# ${name}\n\n`, folder: folder.name,
          tags: [], links: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
        });
        _currentNoteId = id;
        _expandedFolders.add(folder.name);
        await _renderFileTree();
        _loadActiveNote();
      }, false);
    });

    header.querySelector('[data-action="del"]').addEventListener('click', async (e) => {
      e.stopPropagation();
      const count = allNotes.filter(n => n.folder === folder.name).length;
      const msg = count > 0
        ? `Delete folder "${folder.name}"? ${count} note(s) will become root notes.`
        : `Delete empty folder "${folder.name}"?`;
      if (!confirm(msg)) return;

      // Move notes to root
      for (const n of allNotes.filter(n => n.folder === folder.name)) {
        await put('notes', { ...n, folder: null });
      }
      await remove('folders', folder.id);
      _expandedFolders.delete(folder.name);
      await _renderFileTree();
    });

    tree.appendChild(header);

    if (isOpen) {
      const children = document.createElement('div');
      children.className = 'folder-children';
      folderNotes.forEach(n => children.appendChild(_noteItem(n)));
      tree.appendChild(children);
    }
  });
}

function _noteItem(note) {
  const div = document.createElement('div');
  div.className = `file-tree-item note${note.id === _currentNoteId ? ' active' : ''}`;
  div.innerHTML = `
    <span class="file-icon">◉</span>
    <span class="name">${escapeHtml(note.title || 'Untitled')}</span>
    <span class="note-delete-btn" title="Delete">×</span>
  `;
  div.addEventListener('click', (e) => {
    if (e.target.closest('.note-delete-btn')) return;
    _currentNoteId = note.id;
    _renderFileTree();
    _loadActiveNote();
  });
  div.querySelector('.note-delete-btn').addEventListener('click', async (e) => {
    e.stopPropagation();
    if (!confirm(`Delete "${note.title}"?`)) return;
    await remove('notes', note.id);
    if (_currentNoteId === note.id) {
      const remaining = await getAll('notes');
      _currentNoteId = remaining[0]?.id || null;
    }
    await _renderFileTree();
    _loadActiveNote();
  });
  return div;
}

// ---- Editor -------------------------------------------------

async function _loadActiveNote() {
  if (!_container) return;
  const editor  = _container.querySelector('#editor');
  const preview = _container.querySelector('#preview');
  const breadcrumb = _container.querySelector('#breadcrumb');
  if (!editor || !preview) return;

  if (!_currentNoteId) {
    editor.value     = '';
    preview.innerHTML = `<div class="notes-empty-state"><h3>No note selected</h3><p>Create a new note to get started</p></div>`;
    if (breadcrumb) breadcrumb.innerHTML = '<span>Vault</span>';
    return;
  }

  const note = await get('notes', _currentNoteId);
  if (!note) { _currentNoteId = null; _loadActiveNote(); return; }

  editor.value = note.content || '';
  if (breadcrumb) {
    breadcrumb.innerHTML = `<span>Vault</span><span>/</span><span class="current">${escapeHtml(note.title)}</span>`;
  }
  _updatePreview(note.content || '');
  _updateStats();

  // Remove old listeners by cloning
  const fresh = editor.cloneNode(true);
  editor.parentNode.replaceChild(fresh, editor);

  fresh.addEventListener('input', async () => {
    const n = await get('notes', _currentNoteId);
    if (!n) return;
    n.content  = fresh.value;
    n.updatedAt = new Date().toISOString();
    n.tags   = [...fresh.value.matchAll(/#(\w+)/g)].map(m => m[1]);
    n.links  = [...fresh.value.matchAll(/\[\[(.*?)\]\]/g)].map(m => m[1].trim());
    await put('notes', n);
    _updatePreview(fresh.value);
    _updateStats();
  });

  fresh.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const s = fresh.selectionStart, en = fresh.selectionEnd;
      fresh.value = fresh.value.substring(0, s) + '  ' + fresh.value.substring(en);
      fresh.selectionStart = fresh.selectionEnd = s + 2;
    }
  });

  fresh.addEventListener('keyup',  () => _updateCursor(fresh));
  fresh.addEventListener('click',  () => _updateCursor(fresh));
}

function _updatePreview(text) {
  const preview = _container?.querySelector('#preview');
  if (!preview) return;
  preview.innerHTML = _renderMarkdown(text);

  // Wiki links
  preview.querySelectorAll('.wiki-link').forEach(link => {
    link.addEventListener('click', async (e) => {
      e.preventDefault();
      const title   = link.dataset.title;
      const all     = await getAll('notes');
      const existing= all.find(n => n.title.toLowerCase() === title.toLowerCase());
      if (existing) {
        _currentNoteId = existing.id;
      } else {
        const id = uid();
        await put('notes', {
          id, title, content: `# ${title}\n\n`, folder: null,
          tags: [], links: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
        });
        _currentNoteId = id;
      }
      await _renderFileTree();
      _loadActiveNote();
    });
  });
}

function _updateStats() {
  if (!_container) return;
  const editor = _container.querySelector('#editor');
  if (!editor) return;
  const text  = editor.value;
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const wc    = _container.querySelector('#wordCount');
  const cc    = _container.querySelector('#charCount');
  if (wc) wc.textContent = `${words} words`;
  if (cc) cc.textContent = `${text.length} chars`;
}

function _updateCursor(editor) {
  if (!_container) return;
  const text  = editor.value.substring(0, editor.selectionStart);
  const lines = text.split('\n');
  const line  = lines.length;
  const col   = lines[lines.length - 1].length + 1;
  const cp    = _container.querySelector('#cursorPos');
  if (cp) cp.textContent = `Ln ${line}, Col ${col}`;
}

// ---- Markdown renderer --------------------------------------

function _renderMarkdown(text) {
  if (!text || !text.trim()) {
    return '<div class="notes-empty-state"><h3>Start typing</h3><p>Markdown preview will appear here</p></div>';
  }

  let html = text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    // Code blocks (must come before inline code)
    .replace(/```[\w]*\n([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
    // Headers
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm,  '<h2>$1</h2>')
    .replace(/^# (.+)$/gm,   '<h1>$1</h1>')
    // Bold / italic / inline code
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,     '<em>$1</em>')
    .replace(/`(.+?)`/g,       '<code>$1</code>')
    // Blockquote
    .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
    // Checkboxes
    .replace(/^- \[ \] (.+)$/gm, '<p><input type="checkbox" disabled> $1</p>')
    .replace(/^- \[x\] (.+)$/gm, '<p><input type="checkbox" checked disabled> $1</p>')
    // Lists
    .replace(/^- (.+)$/gm,       '<li>$1</li>')
    .replace(/^\d+\. (.+)$/gm,   '<li>$1</li>')
    // HR
    .replace(/^---$/gm, '<hr>')
    // Wiki links
    .replace(/\[\[(.*?)\]\]/g, (_, title) => {
      return `<a href="#" class="wiki-link" data-title="${escapeHtml(title.trim())}">${escapeHtml(title.trim())}</a>`;
    })
    // Normal links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    // Tags
    .replace(/#(\w+)/g, '<span class="tag">#$1</span>');

  // Wrap consecutive <li> in <ul>
  html = html.replace(/(<li>[\s\S]*?<\/li>\n?)+/g, m => `<ul>${m}</ul>`);

  // Wrap table rows
  html = html.replace(/^\|(.+)\|$/gm, (_, cells) => {
    const parts = cells.split('|').map(c => c.trim());
    if (parts.every(c => /^[-: ]+$/.test(c))) return '';
    return '<tr>' + parts.map(c => `<td>${c}</td>`).join('') + '</tr>';
  });
  html = html.replace(/(<tr>[\s\S]*?<\/tr>\n?)+/g, m => `<table>${m}</table>`);

  // Wrap remaining lines in <p>
  const lines  = html.split('\n');
  const result = [];
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    const isBlock = /^<(h[1-6]|ul|ol|li|pre|table|thead|tbody|tr|td|th|blockquote|hr|div|p|input)/.test(t);
    result.push(isBlock ? t : `<p>${t}</p>`);
  }

  return result.join('\n');
}

// ---- Modal --------------------------------------------------

function _showModal(title, callback, showFolderSelect) {
  const overlay     = document.getElementById('modalOverlay');
  const titleEl     = document.getElementById('modalTitle');
  const input       = document.getElementById('modalInput');
  const folderGroup = document.getElementById('modalFolderGroup');
  const folderSelect= document.getElementById('modalFolderSelect');
  const cancel      = document.getElementById('modalCancel');
  const confirm     = document.getElementById('modalConfirm');

  titleEl.textContent = title;
  input.value = '';

  if (showFolderSelect && folderGroup && folderSelect) {
    folderGroup.classList.remove('hidden');
    getAll('folders').then(folders => {
      folderSelect.innerHTML = '<option value="">Root (no folder)</option>';
      folders.forEach(f => {
        const opt = document.createElement('option');
        opt.value = f.name; opt.textContent = f.name;
        folderSelect.appendChild(opt);
      });
    });
  } else if (folderGroup) {
    folderGroup.classList.add('hidden');
  }

  overlay.classList.add('show');
  input.focus();

  const doConfirm = () => {
    const val    = input.value.trim();
    const folder = showFolderSelect && folderSelect ? folderSelect.value || null : null;
    if (val) { callback(val, folder); }
    overlay.classList.remove('show');
    cleanup();
  };
  const doCancel = () => { overlay.classList.remove('show'); cleanup(); };
  const onKey    = (e) => { if (e.key === 'Enter') doConfirm(); if (e.key === 'Escape') doCancel(); };

  confirm.addEventListener('click', doConfirm);
  cancel.addEventListener('click', doCancel);
  input.addEventListener('keydown', onKey);

  function cleanup() {
    confirm.removeEventListener('click', doConfirm);
    cancel.removeEventListener('click', doCancel);
    input.removeEventListener('keydown', onKey);
  }
}