// Telegram Web App API utilities

declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        initData: string;
        initDataUnsafe: {
          user?: {
            id: number;
            first_name?: string;
            last_name?: string;
            username?: string;
            language_code?: string;
          };
          auth_date?: number;
          hash?: string;
        };
        ready: () => void;
        expand: () => void;
        close: () => void;
      };
    };
  }
}

/**
 * Get Telegram user ID from Web App API
 * Returns user ID if available, null otherwise
 */
export function getTelegramUserId(): number | null {
  // Check if running in Telegram Web App
  if (typeof window === "undefined" || !window.Telegram?.WebApp) {
    return null;
  }

  const webApp = window.Telegram.WebApp;
  
  // Initialize Web App
  webApp.ready();
  webApp.expand();

  // Try to get user ID from initDataUnsafe (available in development)
  const user = webApp.initDataUnsafe?.user;
  if (user?.id) {
    return user.id;
  }

  // Fallback: try to parse initData manually
  if (webApp.initData) {
    try {
      const params = new URLSearchParams(webApp.initData);
      const userStr = params.get("user");
      if (userStr) {
        const userObj = JSON.parse(decodeURIComponent(userStr));
        if (userObj?.id) {
          return userObj.id;
        }
      }
    } catch (e) {
      console.warn("Failed to parse Telegram initData:", e);
    }
  }

  return null;
}

/**
 * Initialize Telegram Web App
 * Call this when app starts
 */
export function initTelegramWebApp(): void {
  if (typeof window === "undefined" || !window.Telegram?.WebApp) {
    console.warn("Not running in Telegram Web App");
    return;
  }

  const webApp = window.Telegram.WebApp;
  webApp.ready();
  webApp.expand();
}

/**
 * Check if running inside Telegram Web App
 */
export function isTelegramWebApp(): boolean {
  return typeof window !== "undefined" && !!window.Telegram?.WebApp;
}

