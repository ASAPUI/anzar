import { CalendarModule } from './modules/calendar.js';
import { NotesModule } from './modules/notes.js';
import { GraphModule } from './modules/graph.js';
import { TodayModule } from './modules/today.js';
import { setupModal } from './utils/helpers.js';

window.NotesModule = NotesModule;

const App = {
  data: {
    tasks: [],
    notes: [],
    folders: [],
    settings: { theme: 'dark' },
    recentNotes: []
  },
  currentView: 'calendar',
  modalCallback: null,

  init() {
    try {
      this.load();
      this.ensureDefaults();
      this.setupTheme();
      this.setupExport();
      this.setupNav();
      setupModal(this);
      this.render();

      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js').catch(err => {
          console.warn('Service Worker registration failed:', err);
        });
      }
    } catch (error) {
      console.error('App initialization failed:', error);
      const main = document.getElementById('main');
      if (main) {
        main.innerHTML = '<div style="padding:2rem;color:var(--accent);font-size:14px"><strong>Error loading Anzar</strong><br>' + error.message + '</div>';
      }
    }
  },

  load() {
    const saved = localStorage.getItem('anzar_data');
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved);
      this.data = { tasks: [], notes: [], folders: [], recentNotes: [], settings: { theme: 'dark' }, ...parsed };
    } catch (e) {
      console.error('Failed to parse saved data:', e);
    }
  },

  save() {
    try {
      localStorage.setItem('anzar_data', JSON.stringify(this.data));
    } catch (e) {
      console.error('Failed to save data:', e);
    }
  },

  ensureDefaults() {
    if (this.data.notes.length === 0) {
      this.data.folders = ['Daily Notes', 'Projects', 'Resources', 'Languages'];
      this.data.notes = [
        {
          id: 'welcome',
          title: 'Welcome',
          content: '# Welcome to Anzar\n\nA clean, distraction-free note-taking experience.\n\n## Features\n- **Markdown editing** with live preview\n- **File tree** with folders\n- **Dark theme** optimized for focus\n- **Wiki links** with [[note names]]\n- **Tags** with #hashtags\n\n## Markdown Cheatsheet\n\n### Headers\n# H1\n## H2\n### H3\n\n### Formatting\n**Bold**, *italic*, `code`\n\n### Lists\n- Item 1\n- Item 2\n\n1. Numbered 1\n2. Numbered 2\n\n### Code Block\n```javascript\nconsole.log("Hello world");\n```\n\n### Quote\n> A blockquote for important thoughts\n\n### Table\n| Name | Value |\n|------|-------|\n| A    | 1     |\n| B    | 2     |\n\n---\n\nHappy writing!',
          folder: null,
          tags: [],
          links: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 'lang-overview',
          title: 'Language Learning Hub',
          content: '# Language Learning\n\nStudying [[German Basics]] and [[French Basics]].\n\nTrack your progress across multiple languages.\n\n#languages #learning',
          folder: 'Languages',
          tags: ['languages', 'learning'],
          links: ['German Basics', 'French Basics'],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 'lang-german',
          title: 'German Basics',
          content: '# German Basics\n\nFoundational vocabulary and grammar.\n\nSee also [[Language Learning Hub]] and [[French Basics]].\n\n## Vocab\n- das Buch = the book\n- der Stuhl = the chair\n- die Tasse = the cup\n\n#german #vocab',
          folder: 'Languages',
          tags: ['german', 'vocab'],
          links: ['Language Learning Hub', 'French Basics'],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 'lang-french',
          title: 'French Basics',
          content: '# French Basics\n\nFrench fundamentals and pronunciation.\n\nSee also [[Language Learning Hub]] and [[German Basics]].\n\n## Vocab\n- le livre = the book\n- la chaise = the chair\n- la tasse = the cup\n\n#french #vocab',
          folder: 'Languages',
          tags: ['french', 'vocab'],
          links: ['Language Learning Hub', 'German Basics'],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 'daily',
          title: 'Daily Standup',
          content: '# Daily Note Template\n\n## Morning\n- [ ] Review goals\n- [ ] Check emails\n\n## Focus\n- Implement feature X\n- Review PRs\n\n## Evening\n- Reflect on progress\n- Plan tomorrow\n\n#daily #journal',
          folder: 'Daily Notes',
          tags: ['daily', 'journal'],
          links: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 'ideas',
          title: 'Project Ideas',
          content: '# Project Ideas\n\n## App Concepts\n1. **Habit Tracker** - Minimalist design\n2. **Recipe Manager** - With meal planning\n3. **Code Snippet Library** - Tag-based organization\n\n## Links\n- Related: [[Welcome]]\n\n#ideas #projects',
          folder: 'Projects',
          tags: ['ideas', 'projects'],
          links: ['Welcome'],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 'reading',
          title: 'Reading List',
          content: '# Reading List\n\n## Books\n- *Atomic Habits* by James Clear\n- *Deep Work* by Cal Newport\n- *The Pragmatic Programmer*\n\n## Articles\n- [How to Learn](https://example.com)\n\n#reading #books',
          folder: 'Resources',
          tags: ['reading', 'books'],
          links: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];
      this.data.recentNotes = ['welcome'];
      this.save();
    }
  },

  render() {
    const main = document.getElementById('main');
    if (!main) {
      console.error('No #main element found');
      return;
    }
    main.innerHTML = '';

    switch (this.currentView) {
      case 'calendar':
        CalendarModule.render(main, this.data, () => this.save());
        break;
      case 'notes':
        NotesModule.render(main, this.data, () => this.save(), (id) => this.openNote(id));
        break;
      case 'graph':
        GraphModule.render(main, this.data, (id) => this.openNote(id));
        break;
      case 'today':
        TodayModule.render(main, this.data);
        break;
      default:
        TodayModule.render(main, this.data);
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

  setupTheme() {
    const toggle = document.getElementById('themeToggle');
    if (!toggle) return;
    const html = document.documentElement;
    html.setAttribute('data-theme', this.data.settings.theme);
    toggle.textContent = this.data.settings.theme === 'dark' ? '☀' : '☾';
    toggle.addEventListener('click', () => {
      const current = html.getAttribute('data-theme');
      const next = current === 'dark' ? 'light' : 'dark';
      html.setAttribute('data-theme', next);
      this.data.settings.theme = next;
      toggle.textContent = next === 'dark' ? '☀' : '☾';
      this.save();
    });
  },

  setupExport() {
    const btn = document.getElementById('exportBtn');
    if (!btn) return;
    btn.addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(this.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `anzar-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }
};

window.App = App;

document.addEventListener('DOMContentLoaded', () => {
  App.init();
});