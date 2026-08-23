// ───────────────────────────────────────────────────────────────────
// SHOP BRANDING CONFIG
// Edit this file to customize your shop's identity (name, shipping policy,
// channel link, owner username, footer signature, etc.).
// No need to touch any other file in the project.
// ───────────────────────────────────────────────────────────────────

module.exports = {
  // Display name shown in welcome message header
  name: "NCUK SHOP",

  // Vendor name shown on product pages (-- by VendorName)
  vendorName: "NarcosCityUK",
  vendorCommand: "/vendor",

  // Emoji prepended/appended to the shop name in welcome
  emoji: "",

  // Welcome intro text (storefront style)
  welcomeText: "Welcome to NarcosCityUK Shop",

  // Full home-page message. HTML entities are used because Telegram renders it
  // with parse_mode: HTML.
  homeText: [
    "<b>✅ Shop is Online:</b>",
    "",
    "📦 3,152 Sales",
    "⭐ 5.0 Average Review",
    "⚡ 6hr Average Ticket Response",
    "",
    "Welcome to NarcosCityUK Shop👋",
    "",
    "Established vendor on the DarkNetMarkets &amp; other platforms 🏆with thousands of successful sales &amp; years of experience ☑️",
    "",
    "Well known for our amazing service &amp; generous prices✅",
    "",
    "Cut off is 8pm day before for next day shipping",
    "",
    "Any inquiries contact - /tickets",
    "",
    "🔔Tracking uploaded daily 🔔",
    "",
    "💰Drop Shipping is available 💰",
    "",
    "⭐Leave a reveiw &amp; Thank you for shopping!",
    "⭐",
    "",
    "PLEASE NOTE: 📸 ONCE YOU RECEIVE YOUR ORDER YOU MUST VIDEO YOURSELF OPENING IT. INCASE OF ANY PROBLEMS. NO VIDEO - NO PROOF, SO NO RESHIPS!!",
    "",
    "<i>*SAVE THIS LINK TO NEVER LOSE CONTACT WITH US*</i>",
  ].join("\n"),

  // Storefront trust indicators
  averageReview: "5.0",
  averageTicketResponse: "6hr",
  reviewCount: 132,

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
  footerLink: "",
  footerText: "NarcosCityUK Shop",

  // About page command
  aboutCommand: "/info",

  // Welcome cover image (path to local file OR public URL OR empty for text-only)
  welcomeImage: "images/ncuk-logo.jpeg",

  // Shared image displayed on every navigation page except product details
  pageImage: "images/ncuk-logo.jpeg",

  // Currency code
  currency: "GBP",

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
