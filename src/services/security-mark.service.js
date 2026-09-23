const crypto = require('crypto');
const config = require('../config');

const ALGORITHM = 'aes-256-gcm';
const key = crypto.createHash('sha256').update(config.securityMarkKey).digest();

function encryptPhrase(phrase) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(phrase, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ['v1', iv.toString('base64url'), tag.toString('base64url'), encrypted.toString('base64url')].join('.');
}

function decryptPhrase(value) {
  if (!value) return null;

  try {
    const [version, ivValue, tagValue, encryptedValue] = value.split('.');
    if (version !== 'v1' || !ivValue || !tagValue || !encryptedValue) return null;

    const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivValue, 'base64url'));
    decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(encryptedValue, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  } catch (_) {
    return null;
  }
}

function getSecurityMark(user) {
  const phrase = decryptPhrase(user?.securityPhrase);
  if (!user?.securityEmoji || !phrase) return null;
  return { emoji: user.securityEmoji, phrase };
}

module.exports = { encryptPhrase, decryptPhrase, getSecurityMark };
