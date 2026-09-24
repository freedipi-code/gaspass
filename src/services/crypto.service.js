const https = require('https');

const COINGECKO_IDS = Object.freeze({
  BTC: 'bitcoin',
  XMR: 'monero',
});

function fetchJson(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'telegram-shop/0.1',
        ...headers,
      },
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`CoinGecko HTTP ${res.statusCode || 'unknown'}`));
          return;
        }
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Invalid CoinGecko response: ${e.message}`));
        }
      });
    });

    request.setTimeout(10000, () => {
      request.destroy(new Error('CoinGecko request timed out'));
    });
    request.on('error', reject);
  });
}

async function getCryptoPrice(cryptoCode) {
  const code = String(cryptoCode).toUpperCase();
  const coinId = COINGECKO_IDS[code];
  if (!coinId) {
    throw new Error(`Unsupported cryptocurrency: ${cryptoCode}`);
  }

  const params = new URLSearchParams({ ids: coinId, vs_currencies: 'usd' });
  const headers = {};
  if (process.env.COINGECKO_API_KEY) {
    headers['x-cg-demo-api-key'] = process.env.COINGECKO_API_KEY;
  }

  const res = await fetchJson(`https://api.coingecko.com/api/v3/simple/price?${params}`, headers);
  const price = Number(res?.[coinId]?.usd);
  if (!Number.isFinite(price) || price <= 0) {
    throw new Error(`Invalid CoinGecko price for ${code}`);
  }
  return price;
}

async function convertUsdToCrypto(amountInUsd, cryptoCode) {
  const rate = await getCryptoPrice(cryptoCode);
  if (!rate || rate <= 0) {
    throw new Error(`Invalid rate for ${cryptoCode}`);
  }
  return amountInUsd / rate;
}

module.exports = {
  getCryptoPrice,
  convertUsdToCrypto,
};
