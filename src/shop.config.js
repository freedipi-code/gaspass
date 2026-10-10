// ───────────────────────────────────────────────────────────────────
// SHOP BRANDING CONFIG
// Edit this file to customize your shop's identity (name, shipping policy,
// channel link, owner username, footer signature, etc.).
// No need to touch any other file in the project.
// ───────────────────────────────────────────────────────────────────

module.exports = {
  // Display name shown in welcome message header
  name: "The 10/10 Boys Global Shop",

  // Vendor name shown on product pages (-- by VendorName)
  vendorName: "Buaking",
  vendorCommand: "/vendor",

  // Emoji prepended/appended to the shop name in welcome
  emoji: "",

  // Entry message shown before the main menu.
  welcomeText: [
    "Welcome to The 10/10 Boys self-service vape shop 🍃 .",
    "",
    "Ships From/To: United Kingdom 🇬🇧 / 🇪🇺 European Union ⚡🚚",
    "",
    "Currency: GBP / EUR 💷💶",
    "",
    "Currently Accepting: Crypto Tether (USDT), Ethereum (ETH), Bitcoin (BTC), and Solana (SOL)",
    "",
    "Rating & Reviews: 5 ⭐ : 5 ⭐ 97.33% (2625)",
    "",
    "🆓🚚 Free UK tracked next day delivery on orders over £250 / Free EU tracked 2 - 4 days delivery on orders over €300!",
    "",
    "⏰ Place your order before 12:00 PM Monday - Friday, and we'll dispatch it on the same day!",
    "All orders placed after 12:00 PM will be dispatched on the next business day.",
    "",
    "-- -- -- -- -- -- --",
    "",
    "Start with Help! /help or /support 📘 .",
    "",
    "Type /menu then click Products (Button) or just type in /products 📦 .",
    "",
    "Type /coupons to find discount codes 💰 .",
    "",
    "Happy shopping 🛍️",
    "",
    "-- -- -- -- -- -- --",
    "",
    "Note: For Spain and Portugal we only ship to Mainland and not the islands.",
    "",
    "Peace and Love ✌️❤️",
    "",
    "The 10/10 Boys ®",
    "",
    "Telegram Support: @The1010Boys_Support 📢",
    "",
    "Instagram: @the1010boys.global 📸",
  ].join("\n"),

  // Rich-text version used by the country-selection welcome screen.
  welcomeHtml: [
    "Welcome to <b>The 10/10 Boys</b> self-service vape shop 🍃 .",
    "",
    "Ships From/To: <b>United Kingdom 🇬🇧 / 🇪🇺 European Union</b> ⚡🚚",
    "",
    "Currency: <b>GBP / EUR</b> 💷💶",
    "",
    "Currently Accepting: <b>Crypto</b> Tether (USDT), Ethereum (ETH), Bitcoin (BTC), and Solana (SOL)",
    "",
    "<b>Rating &amp; Reviews:</b> 5 ⭐ : 5 ⭐ 97.33% (2625)",
    "",
    "🆓🚚 <b>Free UK tracked next day delivery on orders over £250 / Free EU tracked 2 - 4 days delivery on orders over €300!</b>",
    "",
    "⏰ Place your order before 12:00 PM Monday - Friday, and we'll dispatch it on the same day!",
    "All orders placed after 12:00 PM will be dispatched on the next business day.",
    "",
    "-- -- -- -- -- -- --",
    "",
    "Start with Help! /help or /support 📘 .",
    "",
    "Type /menu then click Products (Button) or just type in /products 📦 .",
    "",
    "Type /coupons to find discount codes 💰 .",
    "",
    "Happy shopping 🛍️",
    "",
    "-- -- -- -- -- -- --",
    "",
    "<b>Note: For Spain and Portugal we only ship to Mainland and not the islands.</b>",
    "",
    "Peace and Love ✌️❤️",
    "",
    "<b>The 10/10 Boys ®</b>",
    "",
    "<b>Telegram Support: <a href=\"https://t.me/The1010Boys_Support\">@The1010Boys_Support</a></b> 📢",
    "",
    "Instagram: <b><a href=\"https://www.instagram.com/the1010boys.global\">@the1010boys.global</a></b> 📸",
  ].join("\n"),

  mainMenuTitle: "🔷 Main Menu\nChoose an option below:",
  categoriesTitle: "<b>Products</b>\nSelect a category or product:",
  categoryHeader: "Select a category or product:",

  // Products are global. Country selection controls checkout and delivery only.
  countries: [
    { code: "GB", flag: "🇬🇧", name: "United Kingdom", currency: "GBP", shippingFee: 8, shippingLabel: "UK Tracked Next Day Delivery" },
    { code: "ES", flag: "🇪🇸", name: "Spain", currency: "GBP", shippingFee: 15, shippingLabel: "EU Tracked Delivery (2–4 days)" },
    { code: "IT", flag: "🇮🇹", name: "Italy", currency: "GBP", shippingFee: 15, shippingLabel: "EU Tracked Delivery (2–4 days)" },
    { code: "FR", flag: "🇫🇷", name: "France", currency: "GBP", shippingFee: 15, shippingLabel: "EU Tracked Delivery (2–4 days)" },
    { code: "DE", flag: "🇩🇪", name: "Germany", currency: "GBP", shippingFee: 15, shippingLabel: "EU Tracked Delivery (2–4 days)" },
    { code: "CH", flag: "🇨🇭", name: "Switzerland", currency: "GBP", shippingFee: 18, shippingLabel: "Tracked International Delivery" },
    { code: "AT", flag: "🇦🇹", name: "Austria", currency: "GBP", shippingFee: 15, shippingLabel: "EU Tracked Delivery (2–4 days)" },
    { code: "PT", flag: "🇵🇹", name: "Portugal", currency: "GBP", shippingFee: 15, shippingLabel: "EU Tracked Delivery (2–4 days)" },
    { code: "NL", flag: "🇳🇱", name: "Netherlands", currency: "GBP", shippingFee: 15, shippingLabel: "EU Tracked Delivery (2–4 days)" },
  ],

  // Shipping policy line (1-2 short lines max)
  shippingLine: "🌍 Worldwide Shipping",
  dispatchLine: "⏰ All orders placed before 1pm are dispatched the same day for fast and reliable delivery.",

  // Bulk enquiries line
  bulkLine: "🎫 For bulk enquiries, please open a ticket via the Support button.",

  // Channel / community
  channelUrl: "",            // e.g. "https://t.me/your_channel" — empty hides the button
  channelLabel: "News Feed",
  reviewCount: null,          // Use a verified number, or null to hide the count
  groupUrl: "",
  groupLabel: "Element Group",
  backupBotUrl: "",
  backupBotLabel: "Backup Bot",

  // Owner / support contact (Telegram username without @)
  ownerUsername: "@The1010Boys_Support",         // e.g. "yourhandle" — empty hides the line
  ownerStatusLine: "🟢 Online",  // overridden if you want dynamic status later

  // Footer ////////////////////////////
 //// don't forget this place is for channel link

  footerLink: "",
  footerText: "",


  ///////////

  // About page command
  aboutCommand: "/info",

  // Welcome cover image (path to local file OR public URL OR empty for text-only)
  welcomeImage: "images/00.jpeg",

  // Currency symbol
  currency: "£",

  // Number of products per catalog page
  productsPerPage: 5,

  // Information page content (shown when user clicks ℹ️ Information)
  information: [
    "📦 *Shipping*",
    "All orders placed before 1pm are dispatched the same day.",
    "Worldwide shipping available.",
    "",
    "💳 *Payment*",
    "We accept BTC and LTC.",
    "Payment instructions are shown after checkout.",
    "",
    "↩️ *Returns*",
    "14-day return policy on unopened items.",
    "Contact support for return instructions.",
    "",
    "🔒 *Privacy*",
    "Your shipping address is used only for delivery and is never shared.",
  ].join("\n"),
};
