// Accepts https://github.com/owner/repo (optional trailing slash)
const GITHUB_URL = /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/?$/;

export function isValidGithubUrl(url) {
  return GITHUB_URL.test(url.trim());
}
