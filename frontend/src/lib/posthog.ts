import posthog from 'posthog-js';

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY;
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST || 'https://app.posthog.com';

export function initPostHog() {
  if (!POSTHOG_KEY) {
    if (import.meta.env.DEV) {
      console.warn('⚠️ PostHog key not found. Analytics will be disabled.');
    }
    return;
  }

  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    loaded: (posthog) => {
      if (import.meta.env.DEV) {
        console.log('✅ PostHog initialized');
      }
    },
    // Disable automatic pageview capture since we track manually with React Router
    capture_pageview: false,
    // Capture pageleaves automatically
    capture_pageleave: true,
  });
}

export { posthog };

