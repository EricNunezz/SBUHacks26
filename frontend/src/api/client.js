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

// Ask the AI about a repo. Only the last 10 messages are sent as history.
// POST /api/repos/{repoId}/chat  { message, node_id, history }  ->  { content }
// TODO: replace this mock with the real endpoint. `mockNodeIds` exists only so the
// mock can cite real diagram ids; drop it (and the mock) when the backend is wired in.
export async function sendChatMessage(repoId, { message, nodeId, history = [] }, mockNodeIds = []) {
  const recent = history.slice(-10); // what the real request will send
  console.debug("chat request (mock)", repoId, { message, node_id: nodeId, history: recent });

  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Cite the attached node first, then a couple of others, so chips can be tested
  const ids = [...new Set([nodeId, ...mockNodeIds].filter(Boolean))].slice(0, 3);
  const ref = (i) => (ids[i] ? `[[${ids[i]}]]` : "that part of the app");
  return {
    content:
      `Here's a mock answer to "${message}".\n\n` +
      `A good place to look is ${ref(0)}, which does most of the work here. ` +
      `It hands things off to ${ref(1)}, and ${ref(2)} sits behind both.\n\n` +
      `Start with \`src/App.jsx\` and follow the imports. Unknown ids like [[not_a_real_node]] stay plain text.`,
  };
}
