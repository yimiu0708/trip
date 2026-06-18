type AnalyticsPayload = Record<string, string | number | boolean | null | undefined>;

const ANALYTICS_STORAGE_KEY = 'trip_analytics_events';
const MAX_BUFFERED_EVENTS = 200;

export function trackEvent(name: string, payload: AnalyticsPayload = {}) {
  const event = {
    name,
    payload,
    path: window.location.pathname,
    ts: new Date().toISOString(),
  };

  window.dispatchEvent(new CustomEvent('trip:analytics', { detail: event }));

  try {
    const current = JSON.parse(localStorage.getItem(ANALYTICS_STORAGE_KEY) || '[]');
    const next = Array.isArray(current) ? [...current, event].slice(-MAX_BUFFERED_EVENTS) : [event];
    localStorage.setItem(ANALYTICS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // 埋点缓存失败不应影响主流程。
  }

  if (import.meta.env.DEV) {
    console.info('[analytics]', name, payload);
  }
}

export function trackRecallEvent(name: string, payload: AnalyticsPayload = {}) {
  trackEvent(name, payload);
}
