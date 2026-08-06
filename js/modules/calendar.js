import { escapeHtml } from './utils/helpers.js';

export const CalendarModule = {
  selectedPriority: 'none',
  currentMonth: new Date(),

  render(container, data, save) {
    const view = document.createElement('div');
    view.className = 'calendar-view';
    view.innerHTML = `
      <aside class="sidebar">
        <div class="sidebar-title">Add Task</div>
        <form class="task-form" id="taskForm">
          <div class="form-group">
            <label class="form-label">Title *</label>
            <input type="text" class="form-input" id="taskTitle" placeholder="Task name" required>
          </div>
          <div class="form-group">
            <label class="form-label">Date *</label>
            <input type="date" class="form-input" id="taskDate" required>
          </div>
          <div class="form-group">
            <label class="form-label">Priority</label>
            <div class="priority-group" id="priorityGroup">
              <button type="button" class="priority-pill" data-priority="urgent">
                <span class="pill-dot urgent"></span>Urgent
              </button>
              <button type="button" class="priority-pill" data-priority="high">
                <span class="pill-dot high"></span>High
              </button>
              <button type="button" class="priority-pill" data-priority="medium">
                <span class="pill-dot medium"></span>Medium
              </button>
              <button type="button" class="priority-pill" data-priority="low">
                <span class="pill-dot low"></span>Low
              </button>
              <button type="button" class="priority-pill active" data-priority="none">
                <span class="pill-dot none"></span>None
              </button>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Assigned to</label>
            <input type="text" class="form-input" id="taskAssignee" placeholder="Name">
          </div>
          <div class="form-group">
            <label class="form-label">Note</label>
            <textarea class="form-textarea" id="taskNote" placeholder="Short description..."></textarea>
          </div>
          <button type="submit" class="add-btn">Add to Calendar</button>
        </form>

        <div class="legend">
          <div class="legend-title">Legend</div>
          <div class="legend-item"><span class="legend-dot" style="background:var(--urgent)"></span>Urgent</div>
          <div class="legend-item"><span class="legend-dot" style="background:var(--high)"></span>High</div>
          <div class="legend-item"><span class="legend-dot" style="background:var(--medium)"></span>Medium</div>
          <div class="legend-item"><span class="legend-dot" style="background:var(--low)"></span>Low</div>
          <div class="legend-item"><span class="legend-dot" style="background:var(--none)"></span>None</div>
        </div>
      </aside>

      <div class="calendar-area">
        <div class="cal-header">
          <div class="cal-nav">
            <button class="cal-nav-btn" id="prevMonth">‹</button>
            <button class="cal-nav-btn" id="nextMonth">›</button>
          </div>
          <div class="cal-month-year" id="monthYear"></div>
          <button class="today-btn" id="todayBtn">Today</button>
        </div>
        <div class="weekday-headers">
          <div class="weekday-header">Sun</div>
          <div class="weekday-header">Mon</div>
          <div class="weekday-header">Tue</div>
          <div class="weekday-header">Wed</div>
          <div class="weekday-header">Thu</div>
          <div class="weekday-header">Fri</div>
          <div class="weekday-header">Sat</div>
        </div>
        <div class="cal-grid" id="calGrid"></div>
      </div>
    `;
    container.appendChild(view);

    const priorityGroup = view.querySelector('#priorityGroup');
    priorityGroup.querySelectorAll('.priority-pill').forEach(pill => {
      pill.addEventListener('click', (e) => {
        e.preventDefault();
        priorityGroup.querySelectorAll('.priority-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        this.selectedPriority = pill.dataset.priority;
      });
    });

    const form = view.querySelector('#taskForm');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const title = view.querySelector('#taskTitle');
      const date = view.querySelector('#taskDate');

      if (!title.value.trim()) {
        title.classList.add('error');
        setTimeout(() => title.classList.remove('error'), 1000);
        return;
      }
      if (!date.value) {
        date.classList.add('error');
        setTimeout(() => date.classList.remove('error'), 1000);
        return;
      }

      const task = {
        id: Date.now().toString(),
        title: title.value.trim(),
        date: date.value,
        priority: this.selectedPriority,
        assignee: view.querySelector('#taskAssignee').value.trim(),
        note: view.querySelector('#taskNote').value.trim(),
        createdAt: new Date().toISOString()
      };
      data.tasks.push(task);
      save();

      title.value = '';
      date.value = '';
      view.querySelector('#taskAssignee').value = '';
      view.querySelector('#taskNote').value = '';
      this.selectedPriority = 'none';
      priorityGroup.querySelectorAll('.priority-pill').forEach(p => p.classList.remove('active'));
      priorityGroup.querySelector('[data-priority="none"]').classList.add('active');

      const taskDate = new Date(task.date);
      this.currentMonth = new Date(taskDate.getFullYear(), taskDate.getMonth(), 1);
      this.renderGrid(view, data);
    });

    view.querySelector('#prevMonth').addEventListener('click', () => {
      this.currentMonth.setMonth(this.currentMonth.getMonth() - 1);
      this.renderGrid(view, data);
    });
    view.querySelector('#nextMonth').addEventListener('click', () => {
      this.currentMonth.setMonth(this.currentMonth.getMonth() + 1);
      this.renderGrid(view, data);
    });
    view.querySelector('#todayBtn').addEventListener('click', () => {
      this.currentMonth = new Date();
      this.renderGrid(view, data);
    });

    this.renderGrid(view, data);
  },

  renderGrid(view, data) {
    const monthYear = view.querySelector('#monthYear');
    const grid = view.querySelector('#calGrid');
    const year = this.currentMonth.getFullYear();
    const month = this.currentMonth.getMonth();

    const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    monthYear.textContent = `${monthNames[month]} ${year}`;

    grid.innerHTML = '';

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();
    const today = new Date();
    const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;

    for (let i = firstDay - 1; i >= 0; i--) {
      const day = daysInPrevMonth - i;
      const cell = this.createDayCell(day, true);
      grid.appendChild(cell);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const cell = this.createDayCell(day, false);
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

      if (isCurrentMonth && day === today.getDate()) {
        cell.classList.add('today');
      }

      const dayTasks = data.tasks.filter(t => t.date === dateStr);
      dayTasks.forEach(task => {
        const chip = document.createElement('div');
        chip.className = `task-chip ${task.priority}`;
        chip.textContent = task.title;
        const tooltip = [task.assignee && `Assigned: ${task.assignee}`, task.note].filter(Boolean).join('\n');
        if (tooltip) chip.setAttribute('data-tooltip', tooltip);
        cell.appendChild(chip);
      });

      cell.addEventListener('click', (e) => {
        if (e.target.classList.contains('task-chip')) return;
        const dateInput = view.querySelector('#taskDate');
        if (dateInput) dateInput.value = dateStr;
      });

      grid.appendChild(cell);
    }

    const totalCells = firstDay + daysInMonth;
    const remaining = 42 - totalCells;
    for (let day = 1; day <= remaining; day++) {
      const cell = this.createDayCell(day, true);
      grid.appendChild(cell);
    }
  },

  createDayCell(day, isOtherMonth) {
    const cell = document.createElement('div');
    cell.className = `day-cell ${isOtherMonth ? 'other-month' : ''}`;
    cell.innerHTML = `<div class="day-number">${day}</div>`;
    return cell;
  }
};