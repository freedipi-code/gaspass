const path = require('path');
const fs = require('fs');
const { Input } = require('telegraf');

// Project root = 3 levels up from src/utils/image.js
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

// Returns one of:
//   - null               → no image / invalid
//   - "https://..."      → URL string (Telegraf fetches it)
//   - Input.fromLocalFile(absPath) → local file source
function resolveImage(value) {
  if (!value || typeof value !== 'string') return null;
  const v = value.trim();
  if (!v) return null;

  // URL
  if (/^https?:\/\//i.test(v)) return v;

  // Local path (absolute or relative to project root)
  const abs = path.isAbsolute(v) ? v : path.resolve(PROJECT_ROOT, v);
  if (fs.existsSync(abs)) return Input.fromLocalFile(abs);

  return null;
}

module.exports = { resolveImage, PROJECT_ROOT };
