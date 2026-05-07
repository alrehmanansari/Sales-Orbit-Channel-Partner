// Notification system – polling every 30 seconds
let _pollInterval = null;
let _notifPanelOpen = false;

async function fetchUnreadCount() {
  try {
    const data = await API.getUnreadCount();
    const count = data.unread_count || 0;
    const badge = document.getElementById('notif-badge');
    if (badge) {
      badge.textContent = count > 99 ? '99+' : count;
      badge.classList.toggle('hidden', count === 0);
    }
    return count;
  } catch (e) {
    // Silent — auth errors handled globally
  }
}

async function loadNotifications() {
  const panel = document.getElementById('notif-panel');
  const scroll = document.getElementById('notif-scroll');
  if (!panel || !scroll) return;

  try {
    const data = await API.getNotifications({ limit: 20 });
    const items = data.data || [];

    if (!items.length) {
      scroll.innerHTML = `<div class="notif-empty">No notifications yet</div>`;
      return;
    }

    scroll.innerHTML = items.map(n => `
      <div class="notif-item${n.is_read ? '' : ' unread'}" data-id="${n.id}" data-ref="${n.reference_id || ''}" data-type="${n.reference_type || ''}">
        <div class="notif-dot"></div>
        <div class="notif-item-body">
          <div class="notif-item-title">${escHtml(n.title)}</div>
          <div class="notif-item-msg">${escHtml(n.message)}</div>
          <div class="notif-item-time">${Auth.timeAgo(n.created_at)}</div>
        </div>
      </div>
    `).join('');

    // Click handlers
    scroll.querySelectorAll('.notif-item').forEach(el => {
      el.addEventListener('click', async () => {
        const id   = el.dataset.id;
        const ref  = el.dataset.ref;
        const type = el.dataset.type;

        if (!el.classList.contains('notif-item') || el.querySelector('.notif-dot')?.style.opacity === '0') {
          // already read visually
        }

        el.classList.remove('unread');
        await API.markRead(id).catch(() => {});
        await fetchUnreadCount();

        // Navigate to reference
        if (ref && type === 'account') {
          const user = Auth.getUser();
          const basePath = Auth.isInternal(user) ? '/internal/accounts.html' : '/partner/accounts.html';
          window.location.href = `${basePath}?id=${ref}`;
        } else if (ref && type === 'ticket') {
          window.location.href = `/internal/tickets.html?id=${ref}`;
        }
      });
    });
  } catch (e) {
    scroll.innerHTML = `<div class="notif-empty">Could not load notifications</div>`;
  }
}

function toggleNotifPanel() {
  const panel = document.getElementById('notif-panel');
  if (!panel) return;
  _notifPanelOpen = !_notifPanelOpen;
  panel.classList.toggle('hidden', !_notifPanelOpen);
  if (_notifPanelOpen) loadNotifications();
}

async function markAllRead() {
  await API.markAllRead().catch(() => {});
  await fetchUnreadCount();
  await loadNotifications();
}

function startPolling(intervalMs = 30000) {
  fetchUnreadCount();
  _pollInterval = setInterval(fetchUnreadCount, intervalMs);
}

function stopPolling() {
  if (_pollInterval) clearInterval(_pollInterval);
}

function initNotifications() {
  const btn = document.getElementById('notif-btn');
  if (btn) btn.addEventListener('click', (e) => { e.stopPropagation(); toggleNotifPanel(); });

  const markAllBtn = document.getElementById('mark-all-read');
  if (markAllBtn) markAllBtn.addEventListener('click', markAllRead);

  // Close panel on outside click
  document.addEventListener('click', (e) => {
    const panel = document.getElementById('notif-panel');
    if (_notifPanelOpen && panel && !panel.contains(e.target) && e.target.id !== 'notif-btn') {
      _notifPanelOpen = false;
      panel.classList.add('hidden');
    }
  });

  startPolling();
}

function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

window.Notifications = { initNotifications, fetchUnreadCount, loadNotifications, markAllRead };
