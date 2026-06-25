const { showCatalog } = require('./catalog');

// In the storefront design, clicking a category filter in the catalog
// just filters the catalog list, which is already handled in catalog.js
// We keep this file around and register empty handlers or redirects
// in case old deep links are still floating around.

function register(bot) {
  // Redirect old shop/category actions to the new catalog
  bot.action(/^cat:root:(.+)$/, async (ctx) => {
    return showCatalog(ctx, 0, 'all'); 
  });
  bot.action(/^cat:(\d+)$/, async (ctx) => {
    const catId = ctx.match[1];
    return showCatalog(ctx, 0, catId);
  });
}

module.exports = { register };
