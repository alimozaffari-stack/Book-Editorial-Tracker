const path = require('node:path');
const fs = require('node:fs');

function pathApi(...values) {
  return values.some(value => typeof value === 'string' && /^[a-z]:\\/i.test(value)) ? path.win32 : path;
}

function isPathInsideRoot(root, candidate) {
  const api = pathApi(root, candidate);
  if (typeof root !== 'string' || typeof candidate !== 'string' || !api.isAbsolute(root) || !api.isAbsolute(candidate)) return false;
  const relative = api.relative(api.resolve(root), api.resolve(candidate));
  return relative === '' || (!relative.startsWith('..') && !api.isAbsolute(relative));
}

/** Fails closed when the selected root or destination parent cannot be resolved. */
function isPathInsideResolvedRoot(root, destination, realpathSync = fs.realpathSync) {
  const api = pathApi(root, destination);
  if (typeof root !== 'string' || typeof destination !== 'string' || !api.isAbsolute(root) || !api.isAbsolute(destination)) return true;
  try {
    const realRoot = realpathSync(root);
    const realParent = realpathSync(api.dirname(destination));
    return isPathInsideRoot(realRoot, api.join(realParent, api.basename(destination)));
  } catch {
    return true;
  }
}

module.exports = { isPathInsideRoot, isPathInsideResolvedRoot };
