// ============================================================
// ANZAR — Calendar View
// Logic: recovery branch (IndexedDB, modular)
// Output: main branch Brutalist Swiss design
// ============================================================

import { put, getAll, remove, uid, escapeHtml } from './storage.js';

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
];

let _currentMonth = new Date();
let _selectedPriority = 'none';

export async function renderCalendar(container) {
  container.innerHTML = `
    <div class="calendar-view">
      <!-- Sidebar: task form -->
      <aside class="calendar-sidebar">
        <div class="sidebar-title">Add Task</div>
        <div class="task-form" id="taskForm">
          <div class="form-group">
            <label class="form-label">Title *</label>
            <input type="text" class="form-input" id="taskTitle" placeholder="Task name" />
          </div>
          <div class="form-group">
            <label class="form-label">Date *</label>
            <input type="date" class="form-input" id="taskDate" />
          </div>
          <div class="form-group">
            <label class="form-label">Priority</label>
            <div class="priority-group" id="priorityGroup">
              <button type="button" class="priority-pill" data-priority="urgent"><span class="pill-dot urgent"></span>Urgent</button>
              <button type="button" class="priority-pill" data-priority="high"><span class="pill-dot high"></span>High</button>
              <button type="button" class="priority-pill" data-priority="medium"><span class="pill-dot medium"></span>Medium</button>
              <button type="button" class="priority-pill" data-priority="low"><span class="pill-dot low"></span>Low</button>
              <button type="button" class="priority-pill active" data-priority="none"><span class="pill-dot none"></span>None</button>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Assigned to</label>
            <input type="text" class="form-input" id="taskAssignee" placeholder="Name" />
          </div>
          <div class="form-group">
            <label class="form-label">Note</label>
            <textarea class="form-textarea" id="taskNote" placeholder="Short description..."></textarea>
          </div>
          <button class="add-btn" id="addTaskBtn">Add to Calendar</button>
        </div>

        <div class="legend">
          <div class="legend-title">Legend</div>
          <div class="legend-item"><span class="legend-dot" style="background:var(--urgent)"></span>Urgent — Critical</div>
          <div class="legend-item"><span class="legend-dot" style="background:var(--high)"></span>High — Important</div>
          <div class="legend-item"><span class="legend-dot" style="background:var(--medium)"></span>Medium — Normal</div>
          <div class="legend-item"><span class="legend-dot" style="background:var(--low)"></span>Low — Trivial</div>
          <div class="legend-item"><span class="legend-dot" style="background:var(--none)"></span>None — Unset</div>
        </div>
      </aside>

      <!-- Calendar area -->
      <div class="calendar-area">
        <div class="cal-header">
          <div class="cal-nav">
            <button class="cal-nav-btn" id="prevMonth">‹</button>
            <button class="cal-nav-btn" id="nextMonth">›</button>
          </div>
          <div class="cal-month-year" id="calMonthYear"></div>
          <button class="today-btn" id="todayBtn">Today</button>
        </div>
        <div class="weekday-headers">
          ${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => `<div class="weekday-header">${d}</div>`).join('')}
        </div>
        <div class="cal-grid" id="calGrid"></div>
      </div>
    </div>
  `;

  const form         = container.querySelector('#taskForm');
  const titleInput   = container.querySelector('#taskTitle');
  const dateInput    = container.querySelector('#taskDate');
  const assigneeInput= container.querySelector('#taskAssignee');
  const noteInput    = container.querySelector('#taskNote');
  const priorityGroup= container.querySelector('#priorityGroup');
  const addBtn       = container.querySelector('#addTaskBtn');

  // Priority pills
  priorityGroup.querySelectorAll('.priority-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      priorityGroup.querySelectorAll('.priority-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      _selectedPriority = pill.dataset.priority;
    });
  });

  // Add task
  addBtn.addEventListener('click', async () => {
    if (!titleInput.value.trim()) {
      titleInput.classList.add('error');
      setTimeout(() => titleInput.classList.remove('error'), 800);
      return;
    }
    if (!dateInput.value) {
      dateInput.classList.add('error');
      setTimeout(() => dateInput.classList.remove('error'), 800);
      return;
    }

    const task = {
      id:          uid(),
      title:       titleInput.value.trim(),
      date:        dateInput.value,
      priority:    _selectedPriority,
      assignee:    assigneeInput.value.trim(),
      note:        noteInput.value.trim(),
      isCompleted: false,
      createdAt:   new Date().toISOString()
    };

    await put('tasks', task);

    // Reset form
    titleInput.value    = '';
    dateInput.value     = '';
    assigneeInput.value = '';
    noteInput.value     = '';
    _selectedPriority   = 'none';
    priorityGroup.querySelectorAll('.priority-pill').forEach(p => p.classList.remove('active'));
    priorityGroup.querySelector('[data-priority="none"]').classList.add('active');

    // Jump to task's month
    const [y, m] = task.date.split('-').map(Number);
    _currentMonth = new Date(y, m - 1, 1);
    await _renderGrid(container);
  });

  // Navigation
  container.querySelector('#prevMonth').addEventListener('click', async () => {
    _currentMonth.setMonth(_currentMonth.getMonth() - 1);
    await _renderGrid(container);
  });
  container.querySelector('#nextMonth').addEventListener('click', async () => {
    _currentMonth.setMonth(_currentMonth.getMonth() + 1);
    await _renderGrid(container);
  });
  container.querySelector('#todayBtn').addEventListener('click', async () => {
    _currentMonth = new Date();
    await _renderGrid(container);
  });

  await _renderGrid(container);
}

async function _renderGrid(container) {
  const grid      = container.querySelector('#calGrid');
  const monthYear = container.querySelector('#calMonthYear');
  if (!grid || !monthYear) return;

  const year  = _currentMonth.getFullYear();
  const month = _currentMonth.getMonth();
  monthYear.textContent = `${MONTH_NAMES[month]} ${year}`;

  const tasks      = await getAll('tasks');
  const today      = new Date();
  const todayStr   = today.toISOString().split('T')[0];
  const firstDay   = new Date(year, month, 1).getDay();
  const daysInMonth= new Date(year, month + 1, 0).getDate();
  const prevDays   = new Date(year, month, 0).getDate();

  grid.innerHTML = '';

  // Prev-month filler cells
  for (let i = firstDay - 1; i >= 0; i--) {
    grid.appendChild(_dayCell(prevDays - i, true, null, null));
  }

  // Current month
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const dayTasks= tasks.filter(t => t.date === dateStr);
    const isToday = dateStr === todayStr;
    const cell    = _dayCell(day, false, dateStr, dayTasks, isToday);

    cell.addEventListener('click', (e) => {
      if (e.target.closest('.task-chip')) return;
      const dateInput = container.querySelector('#taskDate');
      if (dateInput) dateInput.value = dateStr;
    });

    grid.appendChild(cell);
  }

  // Next-month filler
  const total     = firstDay + daysInMonth;
  const remaining = 42 - total;
  for (let day = 1; day <= remaining; day++) {
    grid.appendChild(_dayCell(day, true, null, null));
  }
}

function _dayCell(day, isOther, dateStr, tasks, isToday) {
  const cell = document.createElement('div');
  cell.className = `day-cell${isOther ? ' other-month' : ''}${isToday ? ' today' : ''}`;

  const num = document.createElement('div');
  num.className = 'day-number';
  num.textContent = day;
  cell.appendChild(num);

  if (tasks && tasks.length) {
    tasks.forEach(t => {
      const chip = document.createElement('div');
      chip.className = `task-chip ${t.priority || 'none'}`;
      chip.textContent = t.title;
      const tooltip = [
        t.assignee && `Assigned: ${t.assignee}`,
        t.note
      ].filter(Boolean).join('\n');
      if (tooltip) chip.setAttribute('data-tooltip', tooltip);
      cell.appendChild(chip);
    });
  }

  return cell;
}