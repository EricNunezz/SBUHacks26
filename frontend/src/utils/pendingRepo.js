// Storage helpers for the add-repo flow. Every access is wrapped in try/catch
// because storage can be blocked (private mode, disabled cookies).
const PENDING_KEY = "pendingRepoUrl"; // sessionStorage: survives a refresh during the popup
const GUEST_KEY = "guestState"; // localStorage: guest's repos survive a refresh

export function savePendingRepo(url) {
  try {
    sessionStorage.setItem(PENDING_KEY, url);
  } catch {}
}

export function loadPendingRepo() {
  try {
    return sessionStorage.getItem(PENDING_KEY) || "";
  } catch {
    return "";
  }
}

export function clearPendingRepo() {
  try {
    sessionStorage.removeItem(PENDING_KEY);
  } catch {}
}

// Returns { repos, entered } or null if nothing saved
export function loadGuestState() {
  try {
    return JSON.parse(localStorage.getItem(GUEST_KEY));
  } catch {
    return null;
  }
}

export function saveGuestState(state) {
  try {
    localStorage.setItem(GUEST_KEY, JSON.stringify(state));
  } catch {}
}

export function clearGuestState() {
  try {
    localStorage.removeItem(GUEST_KEY);
  } catch {}
}
