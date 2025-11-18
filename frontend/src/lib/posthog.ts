import { usePostHog } from "posthog-js/react";

/**
 * Custom hook for PostHog analytics
 * Provides typed event tracking
 */
export function usePostHogAnalytics() {
  const posthog = usePostHog();

  const track = (eventName: string, properties?: Record<string, any>) => {
    if (posthog) {
      posthog.capture(eventName, properties);
    }
  };

  return { track };
}






