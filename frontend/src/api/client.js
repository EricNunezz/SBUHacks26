import { getAccessToken } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";

// Error with the HTTP status attached, so callers can check for 401 etc.
export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

// App registers this to sign the user out when a request comes back 401 (expired session)
let onUnauthorized = null;
export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn;
}

// fetch wrapper: adds the Bearer token when logged in and returns parsed JSON (null for 204)
async function request(path, options = {}) {
  const token = await getAccessToken();
  const res = await fetch(path, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (res.status === 401) onUnauthorized?.();
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(body?.detail || `Request failed (${res.status})`, res.status);
  }
  return res.status === 204 ? null : res.json();
}

// Backend row { id, owner, name, ... } -> the shape the UI uses: { id, name: "owner/repo", url }
function toRepo(row) {
  return { id: row.id, name: `${row.owner}/${row.name}`, url: row.url };
}

// The logged-in user's repos, newest added first
export async function getMyRepos() {
  const rows = await request("/api/me/repos");
  return rows.map(toRepo);
}

// Add a repo to the user's list (the backend reuses the shared cached repo if it has one)
export async function addMyRepo(url) {
  return toRepo(await request("/api/me/repos", { method: "POST", body: JSON.stringify({ url }) }));
}

// One repo's diagram: { id, owner, name, url, summary, nodes, edges, status: "ready" | "pending" }
export async function getRepoDiagram(repoId) {
  return request(`/api/repos/${repoId}`);
}

// One repo's stats: { fetched_at, repo, activity, community, issues, languages }; any section may be null
export async function getRepoStats(repoId) {
  return request(`/api/repos/${repoId}/stats`);
}

// Remove a repo from the user's list only
export async function deleteMyRepo(repoId) {
  await request(`/api/me/repos/${repoId}`, { method: "DELETE" });
}

// Ask the AI about a repo. Only the last 10 messages are sent as history.
// POST /api/repos/{repoId}/chat  { message, node_id, history }  ->  { content }
// TODO: replace this mock with the real endpoint. `mockNodeIds` exists only so the
// mock can cite real diagram ids; drop it (and the mock) when the backend is wired in.
export async function sendChatMessage(repoId, { message, nodeId, history = [] }) {
  // 1. Get the current active user session token from Supabase
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  // 2. Make the HTTP POST request to your FastAPI backend chat endpoint
  const response = await fetch(`http://localhost:8000/api/repos/${repoId}/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { "Authorization": `Bearer ${token}` } : {})
    },
    body: JSON.stringify({
      message: message,
      node_id: nodeId,
      history: history.map(h => ({
        role: h.role === "user" ? "user" : "ai",
        content: h.content
      }))
    })
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.detail || "Failed to get response from AI assistant.");
  }

  // 3. Returns the JSON containing the real Gemini reply: { content: "..." }
  return await response.json();
}
