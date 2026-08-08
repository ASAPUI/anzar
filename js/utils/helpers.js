// js/utils/helpers.js
export function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export function debounce(fn, delay) {
  let timeoutId;
  return function(...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

export function setupModal(App) {
  const overlay = document.getElementById('modalOverlay');
  const titleEl = document.getElementById('modalTitle');
  const input = document.getElementById('modalInput');
  const folderGroup = document.getElementById('modalFolderGroup');
  const folderSelect = document.getElementById('modalFolderSelect');
  const cancel = document.getElementById('modalCancel');
  const confirm = document.getElementById('modalConfirm');

  cancel.addEventListener('click', () => {
    overlay.classList.remove('show');
    App.modalCallback = null;
  });

  confirm.addEventListener('click', () => {
    const val = input.value.trim();
    if (val && App.modalCallback) {
      const folder = folderSelect ? folderSelect.value || null : null;
      App.modalCallback(val, folder);
      overlay.classList.remove('show');
      App.modalCallback = null;
    }
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') confirm.click();
    if (e.key === 'Escape') cancel.click();
  });

  App.showModal = (title, placeholder, callback, showFolderSelect) => {
    titleEl.textContent = title;
    input.value = '';
    input.placeholder = placeholder || '';

    if (folderGroup && folderSelect && showFolderSelect) {
      folderGroup.style.display = 'flex';
      folderSelect.innerHTML = '<option value="">Root</option>';
      (App.data.folders || []).forEach(folder => {
        const opt = document.createElement('option');
        opt.value = folder;
        opt.textContent = folder;
        folderSelect.appendChild(opt);
      });
    } else if (folderGroup) {
      folderGroup.style.display = 'none';
    }

    overlay.classList.add('show');
    input.focus();
    App.modalCallback = callback;
  };
}