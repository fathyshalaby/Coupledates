type AnalyticsData = Record<string, string | number | boolean>;

declare global {
  interface Window {
    umami?: {
      track(name: string, data?: AnalyticsData): void | Promise<unknown>;
    };
  }
}

/** The publishing proxy supplies the optional tracker; never load one ourselves. */
export function trackEvent(name: string, data?: AnalyticsData): void {
  if (typeof window === 'undefined') return;
  try {
    const result = window.umami?.track(name, data);
    // Blocked network requests can reject asynchronously as well as throw.
    if (result) void Promise.resolve(result).catch(() => {});
  } catch {
    // Analytics must never break the app.
  }
}
