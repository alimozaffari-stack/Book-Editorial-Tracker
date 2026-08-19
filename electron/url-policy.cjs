function resolveAuthHostname(authDomain) {
  if (typeof authDomain !== 'string' || !authDomain.trim()) return null;
  const trimmed = authDomain.trim();
  try {
    const parsed = new URL(trimmed.startsWith('http://') || trimmed.startsWith('https://') ? trimmed : `https://${trimmed}`);
    if (parsed.protocol !== 'https:' || parsed.pathname !== '/' || parsed.search || parsed.hash || !parsed.hostname) return null;
    return parsed.hostname;
  } catch {
    return null;
  }
}

function isFirebaseAuthPopup(url, authDomain) {
  try {
    const allowedHostname = resolveAuthHostname(authDomain);
    if (!allowedHostname) return false;
    const candidate = new URL(url);
    return candidate.protocol === 'https:'
      && candidate.hostname === allowedHostname
      && candidate.pathname.startsWith('/__/auth/');
  } catch {
    return false;
  }
}

module.exports = { isFirebaseAuthPopup, resolveAuthHostname };
