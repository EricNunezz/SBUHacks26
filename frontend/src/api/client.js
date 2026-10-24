import { getAccessToken } from "@/context/AuthContext";

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

// One file's code for the viewer: { path, language, content, truncated, line_count }
export async function getRepoFile(repoId, path) {
  return request(`/api/repos/${repoId}/file?path=${encodeURIComponent(path)}`);
}

// Ask the AI about a repo. Only the last 10 messages are sent as history.
// POST /api/repos/{repoId}/chat  { message, node_id, file_path, history }  ->  { content }
export async function sendChatMessage(repoId, { message, nodeId, filePath = null, history = [] }) {
  return request(`/api/repos/${repoId}/chat`, {
    method: "POST",
    body: JSON.stringify({
      message,
      node_id: nodeId,
      file_path: filePath,
      history: history.slice(-10).map(({ role, content }) => ({ role, content })),
    }),
  });
}

// The repo's saved thread (all nodes), oldest first: [{ id, role, content, node_id, created_at }]
export async function getChatHistory(repoId) {
  return request(`/api/repos/${repoId}/chat`);
}
