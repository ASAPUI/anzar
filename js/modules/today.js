// js/modules/today.js
import { escapeHtml } from '../utils/helpers.js';

let clockInterval = null;

export const TodayModule = {
  render(container, data) {
    // Clear any existing interval
    if (clockInterval) {
      clearInterval(clockInterval);
      clockInterval = null;
    }

    const view = document.createElement('div');
    view.className = 'today-view';
    const today = new Date().toISOString().split('T')[0];
    const todayTasks = data.tasks.filter(t => t.date === today)
      .sort((a, b) => {
        const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3, none: 4 };
        return (priorityOrder[a.priority] || 4) - (priorityOrder[b.priority] || 4);
      });
    const total = todayTasks.length;
    const completed = todayTasks.filter(t => t.isCompleted).length;
    const high = todayTasks.filter(t => t.priority === 'high' || t.priority === 'urgent').length;

    view.innerHTML = `
      <h2>Today — ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</h2>
      <div class="today-stats">
        <div class="stat-card"><div class="stat-number">${total}</div><div class="stat-label">Tasks</div></div>
        <div class="stat-card"><div class="stat-number">${completed}</div><div class="stat-label">Done</div></div>
        <div class="stat-card"><div class="stat-number" style="color:var(--urgent)">${high}</div><div class="stat-label">Urgent</div></div>
      </div>
      <div class="today-tasks">
        <h3>Your Schedule</h3>
        <div id="todayTaskList"></div>
      </div>
    `;
    container.appendChild(view);

    const list = view.querySelector('#todayTaskList');
    if (todayTasks.length === 0) {
      list.innerHTML = '<div class="empty-state">No tasks today. Add one in the calendar.</div>';
    } else {
      todayTasks.forEach(task => {
        const card = document.createElement('div');
        card.style.cssText = 'padding:16px;margin-bottom:8px;background:var(--bg-sidebar);border:0.5px solid var(--border-light);cursor:pointer;transition:all 0.15s;';
        const priorityColor = task.priority === 'urgent' ? 'urgent' : task.priority === 'high' ? 'high' : task.priority === 'medium' ? 'medium' : task.priority === 'low' ? 'low' : 'none';
        card.innerHTML = `
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
            <span style="width:8px;height:8px;border-radius:50%;background:var(--${priorityColor});"></span>
            <span style="font-weight:700;font-size:14px;">${escapeHtml(task.title)}</span>
          </div>
          ${task.assignee ? `<div style="font-size:11px;color:var(--ink-muted);text-transform:uppercase;letter-spacing:0.05em;">Assigned: ${escapeHtml(task.assignee)}</div>` : ''}
          ${task.note ? `<div style="font-size:12px;color:var(--ink-secondary);margin-top:4px;">${escapeHtml(task.note)}</div>` : ''}
        `;
        card.addEventListener('mouseenter', () => card.style.borderColor = 'var(--ink)');
        card.addEventListener('mouseleave', () => card.style.borderColor = 'var(--border-light)');
        list.appendChild(card);
      });
    }
  }
};