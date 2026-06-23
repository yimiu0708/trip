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

function tracked<T>(promise: Promise<T>, eventName: string, properties: Record<string, unknown> = {}) {
  return promise.then((result) => {
    void request('/events/track', { method: 'POST', body: JSON.stringify({ eventName, page: window.location.pathname, source: 'app', clientType: 'web', eventTime: new Date().toISOString(), properties }) }).catch(() => undefined);
    const unlocked = (result as any)?.newAchievements;
    if (Array.isArray(unlocked)) {
      unlocked.forEach((achievement: any) => {
        void request('/events/track', { method: 'POST', body: JSON.stringify({ eventName: 'achievement_unlock', page: window.location.pathname, source: 'app', clientType: 'web', eventTime: new Date().toISOString(), properties: { achievementId: achievement.id, achievementName: achievement.name } }) }).catch(() => undefined);
      });
    }
    return result;
  });
}

export const api = {
  auth: {
    register: (username: string, password: string) =>
      request('/auth/register', { method: 'POST', body: JSON.stringify({ username, password }) }),
    login: (username: string, password: string) =>
      request('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
    me: () => request('/auth/me'),
    changePassword: (oldPassword: string, newPassword: string) =>
      request('/auth/password', { method: 'PUT', body: JSON.stringify({ oldPassword, newPassword }) }).then((data) => {
        if (data.token) localStorage.setItem('trip_token', data.token);
        return data;
      }),
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
    lit: (id: number, lit_at?: string) => tracked(
      request(`/attractions/${id}/lit`, { method: 'POST', body: JSON.stringify({ lit_at }) }),
      'lighting_submit', { attractionId: id, mode: 'single' },
    ),
    unlit: (id: number) => request(`/attractions/${id}/lit`, { method: 'DELETE' }),
    batchLit: (ids: number[], lit_at?: string) => tracked(
      request('/attractions/batch/lit', { method: 'POST', body: JSON.stringify({ ids, lit_at }) }),
      'lighting_submit', { count: ids.length, mode: 'batch' },
    ),
  },
  categories: {
    list: () => request('/categories'),
  },
  achievements: {
    list: () => request('/achievements'),
    mine: () => request('/achievements/mine'),
    equip: (achievementId: number) => request('/achievements/equipped', { method: 'PUT', body: JSON.stringify({ achievementId }) }),
    unequip: () => request('/achievements/equipped', { method: 'DELETE' }),
  },
  favorites: {
    list: (params?: { targetType?: string; status?: string; sort?: string }) => {
      const qs = new URLSearchParams();
      if (params?.targetType) qs.set('targetType', params.targetType);
      if (params?.status) qs.set('status', params.status);
      if (params?.sort) qs.set('sort', params.sort);
      return request(`/favorites?${qs.toString()}`);
    },
    keys: () => request('/favorites/keys'),
    add: (targetType: 'city' | 'attraction', targetId: number, source = 'manual') => tracked(
      request('/favorites', { method: 'POST', body: JSON.stringify({ targetType, targetId, source }) }),
      'favorite_add', { targetType, targetId, source },
    ),
    remove: (id: number) => tracked(request(`/favorites/${id}`, { method: 'DELETE' }), 'favorite_remove', { favoriteId: id }),
  },
  recommendations: {
    nextTrip: (params?: { source?: string; limit?: number; cityIds?: number[] }) => {
      const qs = new URLSearchParams();
      if (params?.source) qs.set('source', params.source);
      if (params?.limit) qs.set('limit', String(params.limit));
      if (params?.cityIds?.length) qs.set('cityIds', params.cityIds.join(','));
      return request(`/recommendations/next-trip?${qs.toString()}`);
    },
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
    nextGoal: () => request('/user/next-goal'),
    lightingRecommendations: (params?: { source?: string; limit?: number; cityIds?: number[] }) => {
      const qs = new URLSearchParams();
      if (params?.source) qs.set('source', params.source);
      if (params?.limit) qs.set('limit', String(params.limit));
      if (params?.cityIds?.length) qs.set('cityIds', params.cityIds.join(','));
      return request(`/user/lighting-recommendations?${qs.toString()}`);
    },
    regionProgress: () => request('/user/region-progress'),
  },
  personality: {
    mine: () => request('/personality/mine'),
    submit: (answers: Array<{ questionId: string; value: string }>) => tracked(
      request('/personality/submit', { method: 'POST', body: JSON.stringify({ answers }) }),
      'personality_test_submit',
    ),
    shareCard: () => tracked(request('/personality/share-card'), 'share_poster_generate', { shareType: 'personality_poster' }),
  },
  events: {
    track: (eventName: string, properties: Record<string, unknown> = {}) =>
      request('/events/track', { method: 'POST', body: JSON.stringify({ eventName, page: window.location.pathname, source: 'app', clientType: 'web', eventTime: new Date().toISOString(), properties }) }),
  },
};
