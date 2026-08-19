/** Allows an empty value, an HTTPS URL, or a project-relative path without traversal. */
export function isSafeProjectReference(value: string): boolean {
  const reference = value.trim();
  if (!reference) return true;
  if (/^https:\/\/[^\s]+$/i.test(reference)) return true;
  if (reference.includes('\\') || /^[a-z]:[\\/]/i.test(reference) || /^file:/i.test(reference) || /^\//.test(reference)) return false;
  const segments = reference.split('/');
  return !reference.includes(':') && segments.every(segment => segment.length > 0 && segment !== '.' && segment !== '..');
}
