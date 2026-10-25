// Remembers, per user and repo, that the tour invitation was answered. Wrapped in try/catch: storage can be blocked.
const key = (userId, repoId) => `tourInvite:${userId}:${repoId}`;

export function hasSeenTourInvite(userId, repoId) {
  try {
    return localStorage.getItem(key(userId, repoId)) === "1";
  } catch {
    return false;
  }
}

export function markTourInviteSeen(userId, repoId) {
  try {
    localStorage.setItem(key(userId, repoId), "1");
  } catch {}
}
