const https = require('https');
const priceCache = new Map();
const PRICE_CACHE_TTL_MS = 60 * 1000;

function fetchJson(url, timeoutMs = 4000) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'node-fetch' } }, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', (err) => {
      reject(err);
    });

    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error('Request timed out'));
    });
  });
}

async function getCryptoPrice(cryptoCode) {
  const cached = priceCache.get(cryptoCode);
  if (cached && cached.expiresAt > Date.now()) return cached.rate;

  try {
    const url = `https://api.coinbase.com/v2/prices/${cryptoCode}-GBP/spot`;
    const res = await fetchJson(url);
    if (res && res.data && res.data.amount) {
      const rate = parseFloat(res.data.amount);
      priceCache.set(cryptoCode, { rate, expiresAt: Date.now() + PRICE_CACHE_TTL_MS });
      return rate;
    }
    throw new Error('Invalid response format');
  } catch (err) {
    console.error(`Failed to fetch price for ${cryptoCode}:`, err.message);
    if (cryptoCode === 'BTC') return 75000;
    if (cryptoCode === 'LTC') return 60;
    throw err;
  }
}

async function convertGbpToCrypto(amountInGbp, cryptoCode) {
  const rate = await getCryptoPrice(cryptoCode);
  if (!rate || rate <= 0) {
    throw new Error(`Invalid rate for ${cryptoCode}`);
  }
  return amountInGbp / rate;
}

module.exports = {
  getCryptoPrice,
  convertGbpToCrypto,
};
