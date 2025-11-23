const BASE = import.meta.env.VITE_API_BASE || "http://localhost:8080/api";
const TG = import.meta.env.VITE_TG_BOT || "your_bot";

/**
 * Get Telegram user ID for authentication
 * Uses localStorage (set after Telegram Login Widget callback)
 */
function getTelegramUserIdForAuth(): string | null {
  // Get from localStorage (set after Telegram auth)
  const saved = localStorage.getItem("tg_uid");
  if (saved) {
    return saved;
  }

  // Development fallback (only in dev, not in production)
  if (import.meta.env.DEV) {
    console.warn("⚠️ Using development fallback user ID. Please authenticate via /auth");
    return "123456789"; // Dev fallback
  }

  return null;
}

export function tgHeader(): { "X-TG-User-ID": string } | {} {
  const uid = getTelegramUserIdForAuth();
  if (!uid) {
    console.error("❌ No Telegram user ID available. Redirect to /auth");
    // Could redirect to /auth here, but better let the component handle it
    return {};
  }
  return { "X-TG-User-ID": uid };
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  return getTelegramUserIdForAuth() !== null;
}

// Helper to create fetch with timeout
function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs: number = 10000): Promise<Response> {
  return Promise.race([
    fetch(url, options),
    new Promise<Response>((_, reject) =>
      setTimeout(() => reject(new Error("TIMEOUT")), timeoutMs)
    ),
  ]);
}

async function handleResponse<T>(response: Response): Promise<T> {
  // Check content type before parsing
  const contentType = response.headers.get("content-type");
  const isJson = contentType && contentType.includes("application/json");
  
  let data: any;
  if (isJson) {
    try {
      data = await response.json();
    } catch (err) {
      // If JSON parsing fails even though content-type says JSON, return generic error
      if (!response.ok) {
        // Try to get status text for better error message
        const statusText = response.statusText || "Неизвестная ошибка";
        return { error: `Ошибка сервера: ${statusText} (${response.status})` } as T;
      }
      throw new Error("Не удалось обработать ответ сервера");
    }
  } else {
    // Server returned non-JSON (HTML error page, etc.)
    if (!response.ok) {
      const statusText = response.statusText || "Неизвестная ошибка";
      // Provide user-friendly messages for common status codes
      let errorMsg = `Ошибка ${response.status}`;
      if (response.status === 404) {
        errorMsg = "Запрашиваемый ресурс не найден";
      } else if (response.status === 500) {
        errorMsg = "Внутренняя ошибка сервера. Попробуйте позже.";
      } else if (response.status === 503) {
        errorMsg = "Сервис временно недоступен. Попробуйте позже.";
      } else if (response.status === 504) {
        errorMsg = "Сервер не отвечает. Попробуйте позже.";
      } else if (response.status >= 400 && response.status < 500) {
        errorMsg = `Ошибка запроса (${response.status})`;
      } else if (response.status >= 500) {
        errorMsg = `Ошибка сервера (${response.status})`;
      }
      return { error: errorMsg } as T;
    }
    // If response is OK but not JSON, try to parse as text or return empty object
    try {
      const text = await response.text();
      // If it's empty or just whitespace, return empty object
      if (!text.trim()) {
        return {} as T;
      }
      // Try to parse as JSON anyway (maybe content-type was wrong)
      data = JSON.parse(text);
    } catch {
      // If all parsing fails, return empty object for OK responses
      return {} as T;
    }
  }
  
  if (!response.ok) {
    // Try to get user-friendly error message from JSON response
    const errorMsg = data?.error || `Ошибка ${response.status}`;
    return { error: errorMsg } as T;
  }
  return data;
}

// Wrapper for API calls with error handling
async function apiCall<T>(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = 10000
): Promise<T> {
  try {
    const response = await fetchWithTimeout(url, options, timeoutMs);
    return await handleResponse<T>(response);
  } catch (err: any) {
    // Handle network errors, timeouts, etc.
    if (err.message === "TIMEOUT") {
      return { error: "Сервер не отвечает. Проверьте подключение к интернету и попробуйте позже." } as T;
    }
    if (err.name === "TypeError" && err.message.includes("fetch")) {
      return { error: "Не удалось подключиться к серверу. Проверьте подключение к интернету." } as T;
    }
    return { error: "Произошла ошибка. Попробуйте позже." } as T;
  }
}

type CreatePubResponse = { id: number } | { error: string };

export const api = {
  airports: async (q: string) => {
    return apiCall(`${BASE}/airports?q=${encodeURIComponent(q)}`, {}, 5000);
  },

  createPub: async (body: any): Promise<CreatePubResponse> => {
    return apiCall<CreatePubResponse>(`${BASE}/publications`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...tgHeader() },
      body: JSON.stringify(body),
    }, 15000); // Longer timeout for creation
  },

  listPubs: async (from: string, to: string, kind?: string) => {
    return apiCall(
      `${BASE}/publications?from=${from}&to=${to}${kind ? `&kind=${kind}` : ""}`,
      {},
      10000
    );
  },

  listMyPubs: async (from?: string, to?: string, kind?: string) => {
    const params = new URLSearchParams();
    if (from) params.append("from", from);
    if (to) params.append("to", to);
    if (kind) params.append("kind", kind);
    return apiCall(
      `${BASE}/publications/mine?${params.toString()}`,
      { headers: tgHeader() },
      10000
    );
  },

  updatePub: async (id: number, isActive?: boolean) => {
    const body: any = {};
    if (isActive !== undefined) {
      body.is_active = isActive;
    }
    return apiCall(`${BASE}/publications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...tgHeader() },
      body: JSON.stringify(body),
    });
  },

  getPub: async (id: string) => {
    return apiCall(`${BASE}/publications/${id}`, {}, 8000);
  },

  createDeal: async (request_pub_id: number, trip_pub_id: number) => {
    return apiCall(`${BASE}/deals`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...tgHeader() },
      body: JSON.stringify({ request_pub_id, trip_pub_id }),
    }, 15000);
  },

  dealLink: async (id: number) => {
    return apiCall(`${BASE}/deals/${id}/deep-link`, { 
      headers: tgHeader() 
    });
  },

  getProfile: async () => {
    return apiCall(`${BASE}/profile`, {
      headers: tgHeader()
    });
  },

  requestContacts: async (pubId: number) => {
    return apiCall(`${BASE}/publications/${pubId}/request-contacts`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...tgHeader() },
    }, 15000);
  },

  getPopularRoutes: async () => {
    return apiCall(`${BASE}/publications/popular-routes`, {}, 8000);
  },

  createAdminPub: async (body: any): Promise<CreatePubResponse> => {
    return apiCall<CreatePubResponse>(`${BASE}/admin/publications`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json", 
        ...tgHeader() 
      },
      body: JSON.stringify(body),
    }, 15000);
  },
};
