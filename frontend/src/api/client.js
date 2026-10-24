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

// Remove a repo from the user's list only
export async function deleteMyRepo(repoId) {
  await request(`/api/me/repos/${repoId}`, { method: "DELETE" });
}
