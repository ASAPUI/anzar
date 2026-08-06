import { escapeHtml, debounce } from './utils/helpers.js';

export const NotesModule = {
  currentNoteId: null,
  noteViewMode: 'split',
  expandedFolders: new Set(),

  render(container, data, save, openNoteFn) {
    const view = document.createElement('div');
    view.className = 'notes-view';
    view.innerHTML = `
      <aside class="notes-sidebar">
        <div class="notes-sidebar-header">
          <span class="notes-sidebar-title">Vault</span>
          <div class="notes-sidebar-actions">
            <button class="notes-sidebar-btn" id="newNoteBtn" title="New Note">+</button>
            <button class="notes-sidebar-btn" id="newFolderBtn" title="New Folder">📁</button>
          </div>
        </div>
        <div class="notes-sidebar-search">
          <input type="text" class="notes-search-input" id="searchInput" placeholder="Search notes...">
        </div>
        <div class="notes-file-tree" id="fileTree"></div>
      </aside>
      
      <main class="notes-main">
        <div class="notes-main-header">
          <div class="notes-breadcrumb" id="breadcrumb">
            <span>Vault</span>
          </div>
          <div class="view-toggle-group">
            <button class="view-toggle-btn ${this.noteViewMode === 'source' ? 'active' : ''}" data-view="source">Edit</button>
            <button class="view-toggle-btn ${this.noteViewMode === 'split' ? 'active' : ''}" data-view="split">Split</button>
            <button class="view-toggle-btn ${this.noteViewMode === 'preview' ? 'active' : ''}" data-view="preview">Preview</button>
          </div>
        </div>
        <div class="notes-main-content" id="mainContent">
          <div class="editor-view ${this.noteViewMode}-view" id="editorView">
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
    `;
    container.appendChild(view);

    this.renderFileTree(view, data, save);

    const searchInput = view.querySelector('#searchInput');
    searchInput.addEventListener('input', debounce(() => {
      this.renderFileTree(view, data, save);
    }, 300));

    view.querySelectorAll('.view-toggle-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        view.querySelectorAll('.view-toggle-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.noteViewMode = btn.dataset.view;
        view.querySelector('#editorView').className = 'editor-view ' + this.noteViewMode + '-view';
      });
    });

    view.querySelector('#newNoteBtn').addEventListener('click', () => {
      window.App.showModal('New Note', 'Note name...', (name, folder) => {
        const id = 'note_' + Date.now();
        data.notes.push({
          id,
          title: name,
          content: '# ' + name + '\n\n',
          folder: folder || null,
          tags: [],
          links: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        this.currentNoteId = id;
        this.addToRecent(data, id);
        if (folder) this.expandedFolders.add(folder);
        save();
        openNoteFn(id);
      }, true);
    });

    view.querySelector('#newFolderBtn').addEventListener('click', () => {
      window.App.showModal('New Folder', 'Folder name...', (name) => {
        if (!data.folders.includes(name)) {
          data.folders.push(name);
          this.expandedFolders.add(name);
          save();
          this.renderFileTree(view, data, save);
        }
      }, false);
    });

    this.loadActiveNote(view, data, save);
  },

  renderFileTree(view, data, save) {
    const tree = view.querySelector('#fileTree');
    tree.innerHTML = '';
    
    const search = view.querySelector('#searchInput').value.toLowerCase();
    const filtered = search 
      ? data.notes.filter(n => 
          (n.title || '').toLowerCase().includes(search) || 
          (n.content || '').toLowerCase().includes(search))
      : data.notes;
    
    const rootNotes = filtered.filter(n => !n.folder);
    rootNotes.forEach(n => this.createNoteItem(n, tree, data, save));
    
    (data.folders || []).forEach(folder => {
      const folderNotes = filtered.filter(n => n.folder === folder);
      if (search && folderNotes.length === 0 && !folder.toLowerCase().includes(search)) return;
      
      const header = document.createElement('div');
      header.className = 'folder-header' + (this.expandedFolders.has(folder) ? ' open' : '');
      header.innerHTML = `
        <span class="chevron">▶</span>
        <span class="file-icon">📁</span>
        <span class="folder-header-name">${escapeHtml(folder)}</span>
        <span class="folder-actions">
          <button class="folder-action-btn" data-action="add" title="Add note to folder">+</button>
          <button class="folder-action-btn" data-action="delete" title="Delete folder">×</button>
        </span>
      `;
      
      const toggleExpand = (e) => {
        if (e.target.closest('.folder-action-btn')) return;
        if (this.expandedFolders.has(folder)) this.expandedFolders.delete(folder);
        else this.expandedFolders.add(folder);
        save();
        this.renderFileTree(view, data, save);
      };
      header.addEventListener('click', toggleExpand);
      
      header.querySelector('[data-action="add"]').addEventListener('click', (e) => {
        e.stopPropagation();
        window.App.showModal(`New Note in "${folder}"`, 'Note name...', (name) => {
          const id = 'note_' + Date.now();
          data.notes.push({
            id,
            title: name,
            content: '# ' + name + '\n\n',
            folder: folder,
            tags: [],
            links: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
          this.currentNoteId = id;
          this.addToRecent(data, id);
          this.expandedFolders.add(folder);
          save();
          window.App.render();
        }, false);
      });
      
      header.querySelector('[data-action="delete"]').addEventListener('click', (e) => {
        e.stopPropagation();
        const noteCount = data.notes.filter(n => n.folder === folder).length;
        const msg = noteCount > 0 
          ? `Delete folder "${folder}"? ${noteCount} note(s) will become root notes.` 
          : `Delete empty folder "${folder}"?`;
        if (!confirm(msg)) return;
        
        data.notes.forEach(n => {
          if (n.folder === folder) n.folder = null;
        });
        data.folders = data.folders.filter(f => f !== folder);
        this.expandedFolders.delete(folder);
        save();
        window.App.render();
      });
      
      tree.appendChild(header);
      
      if (this.expandedFolders.has(folder)) {
        const children = document.createElement('div');
        children.className = 'folder-children';
        folderNotes.forEach(n => this.createNoteItem(n, children, data, save));
        tree.appendChild(children);
      }
    });
  },

  createNoteItem(note, parent, data, save) {
    const div = document.createElement('div');
    div.className = 'file-tree-item note' + (note.id === this.currentNoteId ? ' active' : '');
    div.innerHTML = `
      <span class="file-icon">◉</span>
      <span class="name">${escapeHtml(note.title || 'Untitled')}</span>
      <span class="note-delete-btn" title="Delete note">×</span>
    `;
    div.addEventListener('click', (e) => {
      if (e.target.closest('.note-delete-btn')) return;
      this.openNote(note.id, data, save);
    });
    div.querySelector('.note-delete-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      this.deleteNote(note.id, data, save);
    });
    parent.appendChild(div);
  },

  loadActiveNote(view, data, save) {
    const note = data.notes.find(n => n.id === this.currentNoteId);
    if (!note) {
      view.querySelector('#editor').value = '';
      view.querySelector('#preview').innerHTML = `
        <div class="notes-empty-state">
          <h3>No note selected</h3>
          <p>Create a new note to get started</p>
        </div>`;
      view.querySelector('#breadcrumb').innerHTML = '<span>Vault</span>';
      return;
    }
    
    view.querySelector('#editor').value = note.content || '';
    view.querySelector('#breadcrumb').innerHTML = `
      <span>Vault</span>
      <span>/</span>
      <span class="current">${escapeHtml(note.title || 'Untitled')}</span>
    `;
    this.updatePreview(view, data);
    this.updateStats(view);

    const editor = view.querySelector('#editor');
    
    editor.addEventListener('input', () => {
      note.content = editor.value;
      note.updatedAt = new Date().toISOString();
      note.tags = [...editor.value.matchAll(/#(\w+)/g)].map(m => m[1]);
      note.links = [...editor.value.matchAll(/\[\[(.*?)\]\]/g)].map(m => m[1].trim());
      save();
      this.updatePreview(view, data);
      this.updateStats(view);
    });

    editor.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const start = editor.selectionStart;
        const end = editor.selectionEnd;
        editor.value = editor.value.substring(0, start) + '  ' + editor.value.substring(end);
        editor.selectionStart = editor.selectionEnd = start + 2;
      }
    });

    editor.addEventListener('keyup', () => this.updateCursorPos(view));
    editor.addEventListener('click', () => this.updateCursorPos(view));
  },

  updatePreview(view, data) {
    const text = view.querySelector('#editor').value;
    view.querySelector('#preview').innerHTML = this.renderMarkdown(text, data);
    
    setTimeout(() => {
      view.querySelectorAll('.wiki-link').forEach(link => {
        link.addEventListener('click', (e) => {
          e.preventDefault();
          const title = link.dataset.title;
          const existing = data.notes.find(n => n.title.toLowerCase() === title.toLowerCase());
          if (existing) {
            this.openNote(existing.id, data, () => {});
          } else {
            const note = {
              id: Date.now().toString(),
              title: title,
              content: '',
              folder: null,
              tags: [],
              links: [],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            };
            data.notes.push(note);
            window.App.save();
            this.openNote(note.id, data, () => {});
          }
        });
      });
    }, 0);
  },

  renderMarkdown(text, data) {
    if (!text || !text.trim()) {
      return '<div class="notes-empty-state"><h3>Start typing</h3><p>Markdown preview will appear here</p></div>';
    }
    
    let html = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code>$1</code>')
      .replace(/```([a-z]*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
      .replace(/^> (.*$)/gim, '<blockquote>$1</blockquote>')
      .replace(/^- \[ \] (.*$)/gim, '<p><input type="checkbox"> $1</p>')
      .replace(/^- \[x\] (.*$)/gim, '<p><input type="checkbox" checked> $1</p>')
      .replace(/^- (.*$)/gim, '<li>$1</li>')
      .replace(/^(\d+)\. (.*$)/gim, '<li>$1. $2</li>')
      .replace(/\[\[(.*?)\]\]/g, (match, title) => {
        const linked = data.notes.find(n => n.title.toLowerCase() === title.toLowerCase().trim());
        return `<a href="#" class="wiki-link" data-title="${escapeHtml(title.trim())}">${escapeHtml(title.trim())}</a>`;
      })
      .replace(/#(\w+)/g, '<span class="tag">#$1</span>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')
      .replace(/^---$/gim, '<hr>');
    
    html = html.replace(/^\|(.+)\|$/gim, (m, p) => {
      const cells = p.split('|').map(c => c.trim()).filter(Boolean);
      if (cells.length === 0) return '';
      if (cells.every(c => /^[-:]+$/.test(c))) return '';
      return '<tr>' + cells.map(c => `<td>${c}</td>`).join('') + '</tr>';
    });
    
    html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');
    html = html.replace(/<ul>(\d+\..*?)<\/ul>/gs, (m, p) => {
      return '<ol>' + p.replace(/<li>/g, '<li>').replace(/<\/li>/g, '</li>') + '</ol>';
    });
    html = html.replace(/(<tr>.*<\/tr>\n?)+/g, (m) => {
      const rows = m.trim().split('\n').filter(r => r.trim());
      if (rows.length === 0) return '';
      const headerRow = rows[0];
      const bodyRows = rows.slice(1).join('\n');
      return `<table><thead>${headerRow}</thead><tbody>${bodyRows}</tbody></table>`;
    });
    
    const lines = html.split('\n');
    let result = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const isBlock = /^<(h[1-6]|ul|ol|li|blockquote|pre|table|thead|tbody|tr|td|hr|div)/.test(line);
      const isClosing = /^<\//.test(line);
      
      if (isBlock || isClosing) {
        result.push(line);
      } else {
        result.push('<p>' + line + '</p>');
      }
    }
    
    return result.join('\n');
  },

  updateStats(view) {
    const text = view.querySelector('#editor').value;
    const words = text.trim().split(/\s+/).filter(w => w.length > 0).length;
    const chars = text.length;
    view.querySelector('#wordCount').textContent = words + ' words';
    view.querySelector('#charCount').textContent = chars + ' chars';
  },

  updateCursorPos(view) {
    const editor = view.querySelector('#editor');
    const text = editor.value.substring(0, editor.selectionStart);
    const lines = text.split('\n');
    const line = lines.length;
    const col = lines[lines.length - 1].length + 1;
    view.querySelector('#cursorPos').textContent = `Ln ${line}, Col ${col}`;
  },

  openNote(id, data, save) {
    const note = data.notes.find(n => n.id === id);
    if (!note) return;
    this.currentNoteId = id;
    this.addToRecent(data, id);
    window.App.currentView = 'notes';
    window.App.render();
  },

  addToRecent(data, noteId) {
    data.recentNotes = data.recentNotes.filter(id => id !== noteId);
    data.recentNotes.unshift(noteId);
    if (data.recentNotes.length > 8) data.recentNotes.pop();
    window.App.save();
  },

  removeFromRecent(data, noteId) {
    data.recentNotes = data.recentNotes.filter(id => id !== noteId);
    if (this.currentNoteId === noteId) {
      this.currentNoteId = data.recentNotes[0] || null;
    }
    window.App.save();
  },

  deleteNote(noteId, data, save) {
    if (!confirm('Delete this note?')) return;
    const note = data.notes.find(n => n.id === noteId);
    const deletedTitle = note ? note.title.toLowerCase() : '';
    
    data.notes = data.notes.filter(n => n.id !== noteId);
    data.notes.forEach(n => {
      n.links = (n.links || []).filter(l => l.toLowerCase() !== deletedTitle);
    });
    data.recentNotes = data.recentNotes.filter(id => id !== noteId);
    
    if (this.currentNoteId === noteId) {
      this.currentNoteId = data.recentNotes[0] || data.notes[0]?.id || null;
    }
    save();
    window.App.render();
  }
};