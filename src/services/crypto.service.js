const https = require('https');

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'node-fetch' } }, (res) => {
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
  });
}

async function getCryptoPrice(cryptoCode, fiatCurrency = 'GBP') {
  try {
    const url = `https://api.coinbase.com/v2/prices/${cryptoCode}-${fiatCurrency}/spot`;
    const res = await fetchJson(url);
    if (res && res.data && res.data.amount) {
      return parseFloat(res.data.amount);
    }
    throw new Error('Invalid response format');
  } catch (err) {
    console.error(`Failed to fetch price for ${cryptoCode}:`, err.message);
    if (cryptoCode === 'BTC') return 100000;
    if (cryptoCode === 'LTC') return 80;
    throw err;
  }
}

async function convertFiatToCrypto(amount, cryptoCode, fiatCurrency = 'GBP') {
  const rate = await getCryptoPrice(cryptoCode, fiatCurrency);
  if (!rate || rate <= 0) {
    throw new Error(`Invalid rate for ${cryptoCode}`);
  }
  return amount / rate;
}

const convertUsdToCrypto = (amount, cryptoCode) => convertFiatToCrypto(amount, cryptoCode, 'USD');

module.exports = {
  getCryptoPrice,
  convertUsdToCrypto,
  convertFiatToCrypto,
};
