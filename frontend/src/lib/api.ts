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

async function handleResponse<T>(response: Response): Promise<T> {
  const data = await response.json();
  if (!response.ok) {
    return { error: data.error || `Ошибка ${response.status}` } as T;
  }
  return data;
}

type CreatePubResponse = { id: number } | { error: string };

export const api = {
  airports: async (q: string) => {
    const response = await fetch(`${BASE}/airports?q=${encodeURIComponent(q)}`);
    return handleResponse(response);
  },

  createPub: async (body: any): Promise<CreatePubResponse> => {
    const response = await fetch(`${BASE}/publications`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...tgHeader() },
      body: JSON.stringify(body),
    });
    return handleResponse<CreatePubResponse>(response);
  },

  listPubs: async (from: string, to: string, kind?: string) => {
    const response = await fetch(
      `${BASE}/publications?from=${from}&to=${to}${kind ? `&kind=${kind}` : ""}`
    );
    return handleResponse(response);
  },

  listMyPubs: async (from?: string, to?: string, kind?: string) => {
    const params = new URLSearchParams();
    if (from) params.append("from", from);
    if (to) params.append("to", to);
    if (kind) params.append("kind", kind);
    const response = await fetch(
      `${BASE}/publications/mine?${params.toString()}`,
      { headers: tgHeader() }
    );
    return handleResponse(response);
  },

  updatePub: async (id: number, isActive?: boolean) => {
    const body: any = {};
    if (isActive !== undefined) {
      body.is_active = isActive;
    }
    const response = await fetch(`${BASE}/publications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...tgHeader() },
      body: JSON.stringify(body),
    });
    return handleResponse(response);
  },

  getPub: async (id: string) => {
    const response = await fetch(`${BASE}/publications/${id}`);
    return handleResponse(response);
  },

  createDeal: async (request_pub_id: number, trip_pub_id: number) => {
    const response = await fetch(`${BASE}/deals`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...tgHeader() },
      body: JSON.stringify({ request_pub_id, trip_pub_id }),
    });
    return handleResponse(response);
  },

  dealLink: async (id: number) => {
    const response = await fetch(`${BASE}/deals/${id}/deep-link`, { 
      headers: tgHeader() 
    });
    return handleResponse(response);
  },

  getProfile: async () => {
    const response = await fetch(`${BASE}/profile`, {
      headers: tgHeader()
    });
    return handleResponse(response);
  },
};
