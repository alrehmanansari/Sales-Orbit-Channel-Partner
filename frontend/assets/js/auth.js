// Auth helpers
const PARTNER_ROLE   = 'channel_partner';
const INTERNAL_ROLES = ['customer_onboarding_specialist','senior_bdm','manager_partnerships','head_of_sales','head_of_mena'];
const MANAGEMENT_ROLES = ['senior_bdm','manager_partnerships','head_of_sales','head_of_mena'];

function getUser() {
  try { return JSON.parse(localStorage.getItem('so_user')); }
  catch { return null; }
}

function getToken() {
  return localStorage.getItem('so_token');
}

function setSession(token, user) {
  localStorage.setItem('so_token', token);
  localStorage.setItem('so_user', JSON.stringify(user));
}

function clearSession() {
  localStorage.removeItem('so_token');
  localStorage.removeItem('so_user');
}

function logout() {
  clearSession();
  window.location.href = '/index.html';
}

function requireAuth() {
  const token = getToken();
  const user  = getUser();
  if (!token || !user) {
    window.location.href = '/index.html';
    return null;
  }
  return user;
}

function requirePartnerAuth() {
  const user = requireAuth();
  if (!user) return null;
  if (user.role !== PARTNER_ROLE) {
    window.location.href = '/internal/dashboard.html';
    return null;
  }
  return user;
}

function requireInternalAuth() {
  const user = requireAuth();
  if (!user) return null;
  if (user.role === PARTNER_ROLE) {
    window.location.href = '/partner/dashboard.html';
    return null;
  }
  return user;
}

function isInternal(user) {
  return !!user?.role && user.role !== PARTNER_ROLE;
}

function isManagement(user) {
  return MANAGEMENT_ROLES.includes(user?.role);
}

function isCOS(user) {
  return user?.role === 'customer_onboarding_specialist';
}

function roleLabel(role) {
  const labels = {
    channel_partner: 'Channel Partner',
    customer_onboarding_specialist: 'Onboarding Specialist',
    senior_bdm: 'Senior BDM',
    manager_partnerships: 'Manager Partnerships',
    head_of_sales: 'Head of Sales',
    head_of_mena: 'Head of MENA'
  };
  return labels[role] || role;
}

function statusBadge(status) {
  const map = {
    registered: 'badge-gray',
    in_review:  'badge-yellow',
    onboarded:  'badge-blue',
    activated:  'badge-green',
    rejected:   'badge-red'
  };
  const labels = {
    registered: 'Registered',
    in_review:  'In Review',
    onboarded:  'Onboarded',
    activated:  'Activated',
    rejected:   'Rejected'
  };
  const cls = map[status] || 'badge-gray';
  const lbl = labels[status] || status;
  return `<span class="badge ${cls}"><span class="badge-dot"></span>${lbl}</span>`;
}

function ticketStatusBadge(status) {
  const map = {
    open:             'badge-blue',
    in_review:        'badge-purple',
    pending_partner:  'badge-yellow',
    pending_customer: 'badge-yellow',
    resolved:         'badge-green',
    declined:         'badge-red'
  };
  const labels = {
    open:             'Open',
    in_review:        'In Review',
    pending_partner:  'Pending Partner',
    pending_customer: 'Pending Customer',
    resolved:         'Resolved',
    declined:         'Declined'
  };
  return `<span class="badge ${map[status]||'badge-gray'}"><span class="badge-dot"></span>${labels[status]||status}</span>`;
}

function verticalLabel(v) {
  const map = {
    it_services_provider: 'IT Services',
    ecomm_seller: 'E-comm Seller',
    b2b_seller: 'B2B Goods Exports',
    freelancer: 'Freelancer'
  };
  return map[v] || v || '—';
}

function businessTypeLabel(bt) {
  const map = { new: 'New', established: 'Established' };
  return map[bt] || bt || '—';
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });
}

function timeAgo(d) {
  if (!d) return '—';
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function avatarInitials(name) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
}

function avatarColor(name) {
  const colors = ['av-blue','av-purple','av-pink','av-green','av-gold'];
  let hash = 0;
  for (const c of (name || '')) hash = c.charCodeAt(0) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

// ── THEME ──
function initTheme() {
  const stored = localStorage.getItem('so_theme') || 'light';
  document.documentElement.setAttribute('data-theme', stored);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('so_theme', next);
}

// ── TOAST ──
function showToast(message, type = 'info', duration = 4000) {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span class="toast-msg">${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ── SIDEBAR ACTIVE LINK ──
function setActiveSidebarLink() {
  const path = window.location.pathname;
  document.querySelectorAll('.nav-link[data-page]').forEach(link => {
    const page = link.getAttribute('data-page');
    if (path.includes(page)) {
      link.classList.add('active');
    }
  });
}

// ── POPULATE USER INFO IN TOPBAR ──
function renderUserInfo(user) {
  const nameEl = document.getElementById('user-name');
  const roleEl = document.getElementById('user-role');
  const avEl   = document.getElementById('user-avatar');
  if (nameEl) nameEl.textContent = user.name;
  if (roleEl) roleEl.textContent = roleLabel(user.role);
  if (avEl) {
    avEl.textContent = avatarInitials(user.name);
    avEl.className = `av av-sm ${avatarColor(user.name)}`;
  }
}

initTheme();
window.Auth = {
  getUser, getToken, setSession, clearSession, logout,
  requireAuth, requirePartnerAuth, requireInternalAuth,
  isInternal, isManagement, isCOS,
  roleLabel, statusBadge, ticketStatusBadge,
  verticalLabel, businessTypeLabel,
  formatDate, timeAgo, avatarInitials, avatarColor,
  toggleTheme, showToast, setActiveSidebarLink, renderUserInfo
};
