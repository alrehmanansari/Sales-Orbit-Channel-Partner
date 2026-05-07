// Renders shared sidebar + topbar for all pages
function renderPartnerLayout({ pageTitle, pageSubtitle, activePage }) {
  const user = Auth.getUser();
  document.body.innerHTML = `
    <div class="app-shell">
      ${partnerSidebar(activePage, user)}
      <div class="main-content">
        ${topbar(pageTitle, pageSubtitle, user)}
        <div class="page-body" id="page-body"></div>
      </div>
    </div>
    ${notifPanel()}
    <div class="toast-container"></div>
  ` + document.body.innerHTML;
}

function partnerSidebar(activePage, user) {
  const links = [
    { page: 'dashboard', href: '/partner/dashboard.html', label: 'Dashboard', icon: dashboardIcon() },
    { page: 'accounts',  href: '/partner/accounts.html',  label: 'My Accounts', icon: accountsIcon() },
  ];

  return `
    <aside class="sidebar" id="sidebar">
      <div class="sidebar-logo">
        <div class="sidebar-logo-mark">
          <svg width="20" height="20" viewBox="0 0 80 80" fill="none">
            <path d="M40 4C40 4 41.6 22 47 35C53 49 68 40 76 40C68 40 53 31 47 45C41.6 58 40 76 40 76C40 76 38.4 58 33 45C27 31 12 40 4 40C12 40 27 49 33 35C38.4 22 40 4 40 4Z" fill="#fff"/>
          </svg>
        </div>
        <span class="sidebar-logo-name">Sales Orbit</span>
      </div>
      <nav class="sidebar-nav">
        <div class="nav-section-label">Partner Portal</div>
        ${links.map(l => `
          <a class="nav-link${activePage === l.page ? ' active' : ''}" href="${l.href}">
            ${l.icon}<span>${l.label}</span>
          </a>`).join('')}
      </nav>
      <div class="sidebar-footer">
        <button class="nav-link w-full" onclick="Auth.logout()">
          <svg class="nav-link-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          <span>Sign out</span>
        </button>
      </div>
    </aside>`;
}

function internalSidebar(activePage, user) {
  const links = [
    { page: 'dashboard',  href: '/internal/dashboard.html',  label: 'Dashboard',  icon: dashboardIcon() },
    { page: 'accounts',   href: '/internal/accounts.html',   label: 'Accounts',   icon: accountsIcon() },
    { page: 'tickets',    href: '/internal/tickets.html',    label: 'Tickets',    icon: ticketIcon() },
  ];

  return `
    <aside class="sidebar" id="sidebar">
      <div class="sidebar-logo">
        <div class="sidebar-logo-mark">
          <svg width="20" height="20" viewBox="0 0 80 80" fill="none">
            <path d="M40 4C40 4 41.6 22 47 35C53 49 68 40 76 40C68 40 53 31 47 45C41.6 58 40 76 40 76C40 76 38.4 58 33 45C27 31 12 40 4 40C12 40 27 49 33 35C38.4 22 40 4 40 4Z" fill="#fff"/>
          </svg>
        </div>
        <span class="sidebar-logo-name">Sales Orbit</span>
      </div>
      <nav class="sidebar-nav">
        <div class="nav-section-label">Internal</div>
        ${links.map(l => `
          <a class="nav-link${activePage === l.page ? ' active' : ''}" href="${l.href}">
            ${l.icon}<span>${l.label}</span>
          </a>`).join('')}
      </nav>
      <div class="sidebar-footer">
        <button class="nav-link w-full" onclick="Auth.logout()">
          <svg class="nav-link-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          <span>Sign out</span>
        </button>
      </div>
    </aside>`;
}

function topbar(title, subtitle, user) {
  return `
    <header class="topbar">
      <div class="topbar-left">
        <div>
          <div class="page-title">${title}</div>
          ${subtitle ? `<div class="page-subtitle">${subtitle}</div>` : ''}
        </div>
      </div>
      <div class="topbar-right">
        <button class="theme-btn" onclick="Auth.toggleTheme()">
          <svg class="sun-icon" style="width:15px;height:15px;position:absolute;transition:all .35s cubic-bezier(.2,.8,.2,1)" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>
          <svg class="moon-icon" style="width:15px;height:15px;position:absolute;transition:all .35s cubic-bezier(.2,.8,.2,1)" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z"/></svg>
        </button>
        <div style="position:relative">
          <button class="notif-btn" id="notif-btn">
            <svg style="width:17px;height:17px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
            <span class="notif-badge hidden" id="notif-badge">0</span>
          </button>
        </div>
        <div class="user-menu-btn">
          <span class="av av-sm ${Auth.avatarColor(user?.name)}" id="user-avatar">${Auth.avatarInitials(user?.name)}</span>
          <div>
            <div class="user-name" id="user-name">${user?.name || ''}</div>
            <div class="user-role" id="user-role">${Auth.roleLabel(user?.role)}</div>
          </div>
        </div>
      </div>
    </header>`;
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

function dashboardIcon() {
  return `<svg class="nav-link-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>`;
}
function accountsIcon() {
  return `<svg class="nav-link-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>`;
}
function ticketIcon() {
  return `<svg class="nav-link-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M13 5v2M13 17v2M13 11v2"/></svg>`;
}

window.Layout = { partnerSidebar, internalSidebar, topbar, notifPanel };
