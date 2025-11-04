const BASE = import.meta.env.VITE_API_BASE || "http://localhost:8080/api";
const TG = import.meta.env.VITE_TG_BOT || "your_bot";

export function tgHeader() {
  // MVP: hardcode or read from localStorage after bot auth
  const uid = localStorage.getItem("tg_uid") || "123456789";
  return { "X-TG-User-ID": uid };
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
      `${BASE}/publications?from=${from}&to=${to}${kind ? `&kind=${kind}` : ""}`,
      { headers: tgHeader() }
    );
    return handleResponse(response);
  },

  getPub: async (id: string) => {
    const response = await fetch(`${BASE}/publications/${id}`, { 
      headers: tgHeader() 
    });
    return handleResponse(response);
  },

  matches: async (pubId: string) => {
    const response = await fetch(`${BASE}/matches?pub_id=${pubId}`, { 
      headers: tgHeader() 
    });
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
};
