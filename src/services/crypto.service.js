const https = require('https');

const COINGECKO_IDS = Object.freeze({
  BTC: 'bitcoin',
  XMR: 'monero',
});

const KRAKEN_PAIRS = Object.freeze({
  BTC: 'XBTUSD',
  XMR: 'XMRUSD',
});

function fetchJson(url, headers = {}, provider = 'Price API') {
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
          reject(new Error(`${provider} HTTP ${res.statusCode || 'unknown'}`));
          return;
        }
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Invalid ${provider} response: ${e.message}`));
        }
      });
    });

    request.setTimeout(10000, () => {
      request.destroy(new Error(`${provider} request timed out`));
    });
    request.on('error', reject);
  });
}

async function getCoinGeckoPrice(code) {
  const coinId = COINGECKO_IDS[code];
  const params = new URLSearchParams({ ids: coinId, vs_currencies: 'usd' });
  const headers = {};
  if (process.env.COINGECKO_API_KEY) {
    headers['x-cg-demo-api-key'] = process.env.COINGECKO_API_KEY;
  }

  const res = await fetchJson(
    `https://api.coingecko.com/api/v3/simple/price?${params}`,
    headers,
    'CoinGecko',
  );
  const price = Number(res?.[coinId]?.usd);
  if (!Number.isFinite(price) || price <= 0) {
    throw new Error(`Invalid CoinGecko price for ${code}`);
  }
  return price;
}

async function getKrakenPrice(code) {
  const pair = KRAKEN_PAIRS[code];
  const params = new URLSearchParams({ pair });
  const res = await fetchJson(
    `https://api.kraken.com/0/public/Ticker?${params}`,
    {},
    'Kraken',
  );
  if (Array.isArray(res?.error) && res.error.length > 0) {
    throw new Error(`Kraken error: ${res.error.join(', ')}`);
  }

  const ticker = Object.values(res?.result || {})[0];
  const price = Number(ticker?.c?.[0]);
  if (!Number.isFinite(price) || price <= 0) {
    throw new Error(`Invalid Kraken price for ${code}`);
  }
  return price;
}

async function getCryptoPrice(cryptoCode) {
  const code = String(cryptoCode).toUpperCase();
  if (!COINGECKO_IDS[code] || !KRAKEN_PAIRS[code]) {
    throw new Error(`Unsupported cryptocurrency: ${cryptoCode}`);
  }

  // CoinGecko blocks some server IPs unless a Demo API key is supplied.
  // Prefer Kraken without a key, while keeping both providers as fallbacks.
  const providers = process.env.COINGECKO_API_KEY
    ? [getCoinGeckoPrice, getKrakenPrice]
    : [getKrakenPrice, getCoinGeckoPrice];
  const errors = [];

  for (const provider of providers) {
    try {
      return await provider(code);
    } catch (error) {
      errors.push(error.message);
    }
  }

  throw new Error(`All crypto price providers failed: ${errors.join(' | ')}`);
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
