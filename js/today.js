// ============================================================
// ANZAR — Today View
// Logic: recovery branch (IndexedDB, modular)
// Output: main branch Brutalist Swiss design
// ============================================================

import { put, get, getAll, escapeHtml } from './storage.js';

const FOCUS_ID = 'today-focus';

function getGreeting() {
  const h = new Date().getHours();
  if (h < 6)  return 'Up late, architect.';
  if (h < 12) return 'Good morning, builder.';
  if (h < 18) return 'Good afternoon, operator.';
  return 'Good evening, strategist.';
}

function formatTime(d) {
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function formatDate(d) {
  return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

function priorityDot(p) {
  return `<span class="priority-dot ${p || 'none'}"></span>`;
}

export async function renderToday(container) {
  const now   = new Date();
  const today = now.toISOString().split('T')[0];

  // Load data from IndexedDB
  const [focusRecord, allTasks] = await Promise.all([
    get('today', FOCUS_ID).catch(() => null),
    getAll('tasks').catch(() => [])
  ]);

  const focus = focusRecord ? focusRecord.focus : '';
  const todayTasks = allTasks
    .filter(t => t.date === today)
    .sort((a, b) => {
      const order = { urgent: 0, high: 1, medium: 2, low: 3, none: 4 };
      return (order[a.priority] ?? 4) - (order[b.priority] ?? 4);
    });

  const total     = todayTasks.length;
  const completed = todayTasks.filter(t => t.isCompleted).length;
  const urgent    = todayTasks.filter(t => t.priority === 'urgent' || t.priority === 'high').length;

  container.innerHTML = `
    <div class="today-view">
      <div class="today-header">
        <h1>Today</h1>
        <p>Your command center</p>
      </div>

      <div class="today-grid">
        <!-- Clock card -->
        <div class="card">
          <div class="today-time" id="today-clock">${formatTime(now)}</div>
          <div class="today-date">${formatDate(now)}</div>
          <div class="today-greeting">${getGreeting()}</div>
        </div>

        <!-- Focus card -->
        <div class="card">
          <div class="card-label">Today's Focus</div>
          <input
            type="text"
            class="focus-input"
            id="today-focus-input"
            placeholder="What is your primary intention today?"
            value="${escapeHtml(focus)}"
          />
          <p class="focus-hint">Press Enter to save</p>
        </div>
      </div>

      <!-- Stats -->
      <div class="today-stats">
        <div class="stat-card">
          <div class="stat-number">${total}</div>
          <div class="stat-label">Tasks</div>
        </div>
        <div class="stat-card">
          <div class="stat-number">${completed}</div>
          <div class="stat-label">Done</div>
        </div>
        <div class="stat-card">
          <div class="stat-number" style="color:var(--urgent)">${urgent}</div>
          <div class="stat-label">Urgent / High</div>
        </div>
      </div>

      <!-- Task list -->
      <div class="today-tasks-section">
        <div class="today-tasks-title">Your Schedule</div>
        <div id="today-task-list">
          ${todayTasks.length === 0
            ? '<div class="empty-state">No tasks today. Add one in the calendar.</div>'
            : todayTasks.map(t => `
              <div class="task-row">
                ${priorityDot(t.priority)}
                <span class="task-row-title">${escapeHtml(t.title)}</span>
                ${t.assignee ? `<span class="task-row-assignee">${escapeHtml(t.assignee)}</span>` : ''}
              </div>
            `).join('')
          }
        </div>
      </div>
    </div>
  `;

  // Live clock
  const clockEl = container.querySelector('#today-clock');
  const clockTimer = setInterval(() => {
    if (clockEl && document.contains(clockEl)) {
      clockEl.textContent = formatTime(new Date());
    } else {
      clearInterval(clockTimer);
    }
  }, 1000);

  // Focus input
  const focusInput = container.querySelector('#today-focus-input');
  const saveFocus  = async () => {
    await put('today', { id: FOCUS_ID, focus: focusInput.value.trim(), updated: Date.now() });
  };
  focusInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { saveFocus(); focusInput.blur(); } });
  focusInput.addEventListener('blur', saveFocus);
}