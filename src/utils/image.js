const path = require('path');
const fs = require('fs');
const { Input } = require('telegraf');

// Project root = 3 levels up from src/utils/image.js
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const telegramPhotoFileIds = new Map();

function imageCacheKey(value) {
  if (!value || typeof value !== 'string') return null;
  const v = value.trim();
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return v;
  return path.isAbsolute(v) ? v : path.resolve(PROJECT_ROOT, v);
}

function rememberTelegramPhoto(value, message) {
  const key = imageCacheKey(value);
  const sizes = message?.photo;
  if (!key || !Array.isArray(sizes) || sizes.length === 0) return;

  const score = (size) => size.file_size || ((size.width || 0) * (size.height || 0));
  const largest = sizes.reduce((best, current) => (
    score(current) > score(best) ? current : best
  ), sizes[0]);

  if (largest?.file_id) telegramPhotoFileIds.set(key, largest.file_id);
}

// Returns one of:
//   - null               → no image / invalid
//   - "https://..."      → URL string (Telegraf fetches it)
//   - Telegram file_id   → for local photos that were already uploaded
//   - Input.fromLocalFile(absPath) → local file source
function resolveImage(value) {
  if (!value || typeof value !== 'string') return null;
  const v = value.trim();
  if (!v) return null;

  // URL
  if (/^https?:\/\//i.test(v)) return v;

  // Local path (absolute or relative to project root)
  const abs = imageCacheKey(v);
  const fileId = telegramPhotoFileIds.get(abs);
  if (fileId) return fileId;
  if (fs.existsSync(abs)) return Input.fromLocalFile(abs);

  return null;
}

module.exports = { resolveImage, rememberTelegramPhoto, PROJECT_ROOT };
