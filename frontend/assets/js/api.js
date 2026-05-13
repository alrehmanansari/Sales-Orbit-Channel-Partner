// Sales Orbit – API client
const API_BASE = window.API_BASE || 'http://localhost:3002/api';

function getToken() {
  return localStorage.getItem('so_token');
}

async function apiFetch(path, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };

  // Remove Content-Type for FormData
  if (options.body instanceof FormData) {
    delete headers['Content-Type'];
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers
  });

  if (response.status === 401) {
    localStorage.removeItem('so_token');
    localStorage.removeItem('so_user');
    window.location.href = '/index.html';
    return;
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const err = new Error(data.error || `HTTP ${response.status}`);
    err.status = response.status;
    err.data = data;
    throw err;
  }

  return data;
}

const API = {
  // Auth
  login:          (body)            => apiFetch('/auth/login',           { method: 'POST', body: JSON.stringify(body) }),
  register:       (body)            => apiFetch('/auth/register',        { method: 'POST', body: JSON.stringify(body) }),
  verifyOtp:      (body)            => apiFetch('/auth/verify-otp',      { method: 'POST', body: JSON.stringify(body) }),
  resendOtp:      (body)            => apiFetch('/auth/resend-otp',      { method: 'POST', body: JSON.stringify(body) }),
  getMe:          ()                => apiFetch('/auth/me'),
  changePassword: (body)            => apiFetch('/auth/change-password', { method: 'PUT',  body: JSON.stringify(body) }),

  // Accounts
  getAccounts:    (params = {})     => apiFetch('/accounts?' + new URLSearchParams(params)),
  getAccount:     (id)              => apiFetch(`/accounts/${id}`),
  createAccount:  (body)            => apiFetch('/accounts',             { method: 'POST', body: JSON.stringify(body) }),
  updateAccount:  (id, body)        => apiFetch(`/accounts/${id}`,       { method: 'PUT',  body: JSON.stringify(body) }),
  bulkUpload:     (formData)        => apiFetch('/accounts/bulk',        { method: 'POST', body: formData }),
  exportAccounts: (params = {})     => `${API_BASE}/accounts/export?` + new URLSearchParams({ ...params, _t: getToken() }),

  // Notes
  getNotes:       (accountId)       => apiFetch(`/accounts/${accountId}/notes`),
  createNote:     (accountId, body) => apiFetch(`/accounts/${accountId}/notes`, { method: 'POST', body: JSON.stringify(body) }),
  getAuditLog:    (accountId)       => apiFetch(`/accounts/${accountId}/audit`),

  // Notifications
  getNotifications:  (params = {}) => apiFetch('/notifications?' + new URLSearchParams(params)),
  getUnreadCount:    ()             => apiFetch('/notifications/unread-count'),
  markRead:          (id)           => apiFetch(`/notifications/${id}/read`, { method: 'PUT' }),
  markAllRead:       ()             => apiFetch('/notifications/read-all',   { method: 'PUT' }),

  // Tickets
  getTickets:       (params = {})   => apiFetch('/tickets?' + new URLSearchParams(params)),
  getTicket:        (id)            => apiFetch(`/tickets/${id}`),
  createTicket:     (body)          => apiFetch('/tickets',              { method: 'POST', body: JSON.stringify(body) }),
  updateTicketStatus:(id, body)     => apiFetch(`/tickets/${id}/status`, { method: 'PUT',  body: JSON.stringify(body) }),
  exportTickets:    (params = {})   => `${API_BASE}/tickets/export?` + new URLSearchParams({ ...params, _t: getToken() }),

  // Dashboard
  getDashboardStats:    (p = {}) => apiFetch('/dashboard/stats?'                + new URLSearchParams(p)),
  getRegistrationTrend: (p = {}) => apiFetch('/dashboard/trend/registrations?' + new URLSearchParams(p)),
  getBusinessTypeTrend: (p = {}) => apiFetch('/dashboard/trend/business-type?' + new URLSearchParams(p)),
  getKpiTable:          (p = {}) => apiFetch('/dashboard/kpi?'                 + new URLSearchParams(p)),
  getPartnerKpi:        (p = {}) => apiFetch('/dashboard/partner-kpi?'         + new URLSearchParams(p)),
  getTicketReport:      (p = {}) => apiFetch('/dashboard/tickets?'             + new URLSearchParams(p)),

  // Users
  getUsers:       (params = {})   => apiFetch('/users?' + new URLSearchParams(params)),
  getPartners:    ()               => apiFetch('/users/partners'),
  getSpecialists: ()               => apiFetch('/users/specialists'),
  createUser:     (body)           => apiFetch('/users',         { method: 'POST', body: JSON.stringify(body) }),
  updateUser:     (id, body)       => apiFetch(`/users/${id}`,   { method: 'PUT',  body: JSON.stringify(body) }),
};

window.API = API;
