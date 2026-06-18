const API_BASE = import.meta.env.VITE_API_BASE || '/api';

function getToken() {
  return localStorage.getItem('trip_token');
}

async function request(path: string, options: RequestInit = {}) {
  const url = `${API_BASE}${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(url, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export const api = {
  auth: {
    register: (username: string, password: string) =>
      request('/auth/register', { method: 'POST', body: JSON.stringify({ username, password }) }),
    login: (username: string, password: string) =>
      request('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
    me: () => request('/auth/me'),
    changePassword: (oldPassword: string, newPassword: string) =>
      request('/auth/password', { method: 'PUT', body: JSON.stringify({ oldPassword, newPassword }) }),
  },
  provinces: {
    list: () => request('/provinces'),
    detail: (id: number) => request(`/provinces/${id}`),
  },
  attractions: {
    list: (params?: { provinceId?: number; categoryId?: number; level?: string; q?: string }) => {
      const qs = new URLSearchParams();
      if (params?.provinceId) qs.set('provinceId', String(params.provinceId));
      if (params?.categoryId) qs.set('categoryId', String(params.categoryId));
      if (params?.level) qs.set('level', params.level);
      if (params?.q) qs.set('q', params.q);
      return request(`/attractions?${qs.toString()}`);
    },
    lit: (id: number, lit_at?: string) =>
      request(`/attractions/${id}/lit`, { method: 'POST', body: JSON.stringify({ lit_at }) }),
    unlit: (id: number) => request(`/attractions/${id}/lit`, { method: 'DELETE' }),
    batchLit: (ids: number[], lit_at?: string) =>
      request('/attractions/batch/lit', { method: 'POST', body: JSON.stringify({ ids, lit_at }) }),
  },
  categories: {
    list: () => request('/categories'),
  },
  achievements: {
    list: () => request('/achievements'),
    mine: () => request('/achievements/mine'),
  },
  recall: {
    hotCities: (limit?: number) => {
      const qs = new URLSearchParams();
      if (limit) qs.set('limit', String(limit));
      return request(`/recall/cities/hot?${qs.toString()}`);
    },
    searchCities: (q: string, limit?: number) => {
      const qs = new URLSearchParams({ q });
      if (limit) qs.set('limit', String(limit));
      return request(`/recall/cities/search?${qs.toString()}`);
    },
    provinceCities: (provinceId: number) => request(`/recall/provinces/${provinceId}/cities`),
    cityAttractions: (cityId: number) => request(`/recall/cities/${cityId}/attractions`),
    guide: () => request('/recall/guide'),
    updateGuide: (action: 'seen' | 'skipped' | 'completed') =>
      request('/recall/guide', { method: 'PUT', body: JSON.stringify({ action }) }),
    batch: (payload: {
      ids?: number[];
      items?: Array<{
        id?: number;
        attraction_id?: number;
        attractionId?: number;
        lit_at?: string;
        litAt?: string;
        time_precision?: string;
        timePrecision?: string;
        season?: string;
        display_time_text?: string;
        displayTimeText?: string;
        source?: string;
      }>;
      lit_at?: string;
      litAt?: string;
      time_precision?: string;
      timePrecision?: string;
      season?: string;
      display_time_text?: string;
      displayTimeText?: string;
      source?: string;
    }) => request('/recall/batch', { method: 'POST', body: JSON.stringify(payload) }),
  },
  user: {
    progress: () => request('/user/progress'),
    litList: () => request('/user/lit-list'),
  },
  admin: {
    users: () => request('/admin/users'),
    updatePassword: (userId: number, newPassword: string) =>
      request(`/admin/users/${userId}/password`, { method: 'PUT', body: JSON.stringify({ newPassword }) }),
    deleteUser: (userId: number) => request(`/admin/users/${userId}`, { method: 'DELETE' }),
    settings: () => request('/admin/settings'),
    updateSettings: (settings: Record<string, string>) =>
      request('/admin/settings', { method: 'PUT', body: JSON.stringify(settings) }),
  },
};
