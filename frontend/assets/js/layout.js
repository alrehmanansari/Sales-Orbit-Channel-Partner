// Shared layout components — topnav replaces sidebar + topbar

function _logoMark() {
  return `<svg width="28" height="28" viewBox="0 0 80 80" fill="none" style="flex-shrink:0">
    <defs>
      <linearGradient id="nav-grad" x1="40" y1="4" x2="40" y2="76" gradientUnits="userSpaceOnUse">
        <stop offset="0%"   stop-color="#4796E3"/>
        <stop offset="45%"  stop-color="#9177C7"/>
        <stop offset="100%" stop-color="#CA6673"/>
      </linearGradient>
    </defs>
    <path d="M40 4C40 4 41.6 22 47 35C53 49 68 40 76 40C68 40 53 31 47 45C41.6 58 40 76 40 76C40 76 38.4 58 33 45C27 31 12 40 4 40C12 40 27 49 33 35C38.4 22 40 4 40 4Z" fill="url(#nav-grad)"/>
  </svg>`;
}

function _rightControls(user) {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  return `
    <div class="topnav-right">
      <span class="topnav-date">${dateStr}</span>
      <button class="theme-btn" onclick="Auth.toggleTheme()">
        <svg class="sun-icon" style="width:15px;height:15px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>
        <svg class="moon-icon" style="width:15px;height:15px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z"/></svg>
      </button>
      <div style="position:relative">
        <button class="notif-btn" id="notif-btn">
          <svg style="width:17px;height:17px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
          <span class="notif-badge hidden" id="notif-badge">0</span>
        </button>
      </div>
      <div style="position:relative">
        <button onclick="Layout.toggleUserMenu()" style="display:flex;align-items:center;gap:8px;background:transparent;border:1px solid transparent;border-radius:10px;padding:5px 10px;cursor:pointer;transition:all .15s;font-family:var(--font)"
          onmouseenter="this.style.background='var(--bg3)';this.style.borderColor='var(--border2)'"
          onmouseleave="this.style.background='transparent';this.style.borderColor='transparent'">
          <span class="av av-sm ${Auth.avatarColor(user?.company_name || user?.name)}" id="user-avatar">${Auth.avatarInitials(user?.company_name || user?.name)}</span>
          <div style="text-align:left">
            <div class="user-name" id="user-name">${user?.role === 'channel_partner' ? (user?.company_name || user?.name || '') : (user?.name || '')}</div>
            <div class="user-role" id="user-role">${Auth.roleLabel(user?.role)}</div>
          </div>
          <svg style="width:14px;height:14px;color:var(--text3);flex-shrink:0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>
        </button>
        <div id="user-dropdown" style="display:none;position:absolute;right:0;top:calc(100% + 6px);background:var(--surface);border:1px solid var(--border2);border-radius:12px;box-shadow:0 8px 24px -4px rgba(0,0,0,.15);min-width:170px;z-index:400;overflow:hidden">
          <div style="padding:10px 14px;border-bottom:1px solid var(--border)">
            <div style="font-size:12px;font-weight:600;color:var(--text)">${user?.name || ''}</div>
            <div style="font-size:11px;color:var(--text3);margin-top:2px">${user?.email || ''}</div>
          </div>
          <button onclick="Auth.logout()" style="width:100%;text-align:left;padding:10px 14px;border:none;background:transparent;font-family:var(--font);font-size:13px;color:var(--g-pink);cursor:pointer;display:flex;align-items:center;gap:8px;transition:background .15s"
            onmouseenter="this.style.background='var(--bg2)'" onmouseleave="this.style.background='transparent'">
            <svg style="width:14px;height:14px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            Sign out
          </button>
        </div>
      </div>
    </div>`;
}

function partnerTopnav(activePage, user) {
  const links = [
    { page: 'dashboard', href: '/partner/dashboard.html', label: 'Partner Dashboard' },
    { page: 'accounts',  href: '/partner/accounts.html',  label: 'My Accounts' },
  ];
  return `
    <div class="topnav-wrap">
      <nav class="topnav">
        <a class="topnav-logo" href="/partner/dashboard.html">
          ${_logoMark()}
          <span class="topnav-logo-name">Sales Orbit</span>
        </a>
        <div class="topnav-links">
          ${links.map(l => `
            <a class="topnav-link${activePage === l.page ? ' active' : ''}" href="${l.href}">${l.label}</a>
          `).join('')}
        </div>
        ${_rightControls(user)}
      </nav>
    </div>`;
}

function internalTopnav(activePage, user) {
  const links = [
    { page: 'dashboard', href: '/internal/dashboard.html', label: 'Team Dashboard' },
    { page: 'accounts',  href: '/internal/accounts.html',  label: 'Accounts' },
    { page: 'tickets',   href: '/internal/tickets.html',   label: 'Tickets' },
  ];
  return `
    <div class="topnav-wrap">
      <nav class="topnav">
        <a class="topnav-logo" href="/internal/dashboard.html">
          ${_logoMark()}
          <span class="topnav-logo-name">Sales Orbit</span>
        </a>
        <div class="topnav-links">
          ${links.map(l => `
            <a class="topnav-link${activePage === l.page ? ' active' : ''}" href="${l.href}">${l.label}</a>
          `).join('')}
        </div>
        ${_rightControls(user)}
      </nav>
    </div>`;
}

function notifPanel() {
  return `
    <div class="notif-panel hidden" id="notif-panel">
      <div class="notif-panel-head">
        <span class="notif-panel-title">Notifications</span>
        <button class="btn btn-ghost btn-sm" id="mark-all-read" style="padding:4px 10px;font-size:11px">Mark all read</button>
      </div>
      <div class="notif-scroll" id="notif-scroll">
        <div class="notif-empty">Loading…</div>
      </div>
    </div>`;
}

// Legacy aliases — kept so any old references still work
function partnerSidebar(activePage, user) { return partnerTopnav(activePage, user); }
function internalSidebar(activePage, user) { return internalTopnav(activePage, user); }
function topbar(title, subtitle, user) {
  return `<div class="page-header">
    <div>
      <div class="page-title">${title}</div>
      ${subtitle ? `<div class="page-subtitle">${subtitle}</div>` : ''}
    </div>
  </div>`;
}

function toggleUserMenu() {
  const d = document.getElementById('user-dropdown');
  if (d) d.style.display = d.style.display === 'none' ? '' : 'none';
}
document.addEventListener('click', function(e) {
  const d = document.getElementById('user-dropdown');
  if (!d) return;
  const btn = d.previousElementSibling;
  if (!d.contains(e.target) && btn && !btn.contains(e.target)) d.style.display = 'none';
});

window.Layout = { partnerTopnav, internalTopnav, partnerSidebar, internalSidebar, topbar, notifPanel, toggleUserMenu };
