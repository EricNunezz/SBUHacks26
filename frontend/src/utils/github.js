const NAME = /^[\w.-]+$/;

// Forgiving parse of a pasted GitHub link. Returns "https://github.com/owner/repo" or null.
// Accepts a missing https://, www., a trailing slash, ".git", and extra paths or ?query/#hash.
export function normalizeGithubUrl(input) {
  const rest = input
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "");
  if (!/^github\.com\//i.test(rest)) return null;

  const [owner, repoPart] = rest.split(/[?#]/)[0].split("/").slice(1);
  const repo = repoPart?.replace(/\.git$/i, "");
  if (!owner || !repo || !NAME.test(owner) || !NAME.test(repo) || /^\.+$/.test(repo)) return null;
  return `https://github.com/${owner}/${repo}`;
}

export function isValidGithubUrl(url) {
  return normalizeGithubUrl(url) !== null;
}
