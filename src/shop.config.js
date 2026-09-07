// ───────────────────────────────────────────────────────────────────
// SHOP BRANDING CONFIG
// Edit this file to customize your shop's identity (name, shipping policy,
// channel link, owner username, footer signature, etc.).
// No need to touch any other file in the project.
// ───────────────────────────────────────────────────────────────────

module.exports = {
  // Display name shown in welcome message header
  name: "Best of The Bay",

  // Detailed storefront heading displayed before the product listing
  telegramUsername: "BESTOFTHEBAYOG",
  signalUsername: "BESTOFTHEBAYCS.01",
  marketUrl: "https://t.me/NewSI420bot?start=v_botb",
  mediaUrl: "https://bestofthebay.net",
  mediaLabel: "BESTOFTHEBAY.NET",
  licenseLine: "LICENSED WORK / AUTHENTICS / REPLICAS / BOT ONLY",
  bulkDiscountText: "-25 per p 5+ / -50 per p 10+ / Forward your cart to the CS account to acquire the bulk discount voucher / (5+ Unit orders please reach out to the CS account for current bulk shipping methods)",

  // Vendor name shown on product pages (-- by VendorName)
  vendorName: "QueenTetrassit",
  vendorCommand: "/vendor",

  // Emoji prepended/appended to the shop name in welcome
  emoji: "",

  // Welcome intro text (storefront style)
  welcomeText: [
    "Welcome to Queen Tetra.",
    "",
    "All orders are shipped within 24-48hrs and traking will be provided upon request. "
    + "$10 shipping on all orders. "
    + "Wholesale pricing available. "
    + "Exclusive Products."
    + "$50 minimum on first time orders ONLY, after that its $100 minimum.",
  ].join("\n"),

  // Shipping policy line (1-2 short lines max)
  shippingLine: "🌍 Worldwide Shipping",
  dispatchLine: "⏰ All orders placed before 1pm are dispatched the same day for fast and reliable delivery.",

  // Bulk enquiries line
  bulkLine: "🎫 For bulk enquiries, please open a ticket via the Support button.",

  // Channel / community
  channelUrl: "",            // e.g. "https://t.me/your_channel" — empty hides the button
  channelLabel: "Join our Channel",

  // Owner / support contact (Telegram username without @)
  ownerUsername: "",         // e.g. "yourhandle" — empty hides the line
  ownerStatusLine: "🟢 Online",  // overridden if you want dynamic status later

  // Footer
  footerLink: "https://t.me/QueenTetrassit",
  footerText: "Powered by SI Market",

  // About page command
  aboutCommand: "/info",

  // Welcome cover image (path to local file OR public URL OR empty for text-only)
  welcomeImage: "images/best-of-the-bay.jpeg",

  // Currency symbol
  currency: "$",

  // Number of products per catalog page
  productsPerPage: 5,

  // Information page content (shown when user clicks ℹ️ Information)
  information: [
    "📦 *Shipping*",
    "All orders placed before 1pm are dispatched the same day.",
    "Worldwide shipping available.",
    "",
    "💳 *Payment*",
    "We accept BTC and XMR.",
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
