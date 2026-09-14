// ───────────────────────────────────────────────────────────────────
// SHOP BRANDING CONFIG
// Edit this file to customize your shop's identity (name, shipping policy,
// channel link, owner username, footer signature, etc.).
// No need to touch any other file in the project.
// ───────────────────────────────────────────────────────────────────

module.exports = {
  // Display name shown in welcome message header
  name: "Hash Heroes",

  // Complete formatted introduction shown before the database product listing
  welcomeHtml: [
    "<b>HEROES</b>",
    "",
    "<b>***AS OF 7/9/26 - SHIPPING",
    "CHARGE IS NOW $15***</b>",
    "",
    "<b>Our only OFFICIAL TELEGRAM AS",
    "OF 7/8/26 IS</b>",
    '<a href="https://t.me/HEADiestOFFICIAL">@HEADiestOFFICIAL</a>',
    '<b>CHAT/MENU LINK :</b> <a href="https://t.me/unfairfades">https://t.me/unfairfades</a>',
    "",
    "<b>WE DO NOT HAVE ANY OTHER",
    "TELEGRAM ACCOUNTS OR",
    "CHANNELS OTHER THAN THOSE",
    "LISTED ABOVE !</b>",
    "",
    "<b>*******OUR STORE ORDER",
    "MINIMIUM is $100*******</b>",
    "",
    "<u><i><b>orders placed under the minimum",
    "will be subject to refund!</b></i></u>",
    "",
    "FOR ROSIN PURCHASES SPLITS GO",
    "AS STATED --",
    "4g - CAN SPLIT 2 WAYS",
    "7g - CAN SPLIT 2 WAYS",
    "14g - CAN SPLIT 4 WAYS",
    "28g - CAN SPLIT 4 WAYS",
    "<b>SPLITS MUST ALL BE WITHIN THE",
    "SAME TIER !!!!!!!!",
    "PLACE IT IN YOUR ORDER NOTES !!</b>",
    "",
    "Welcome to Hash Heroes ! thanks",
    "for checking out the store.",
    "<b>(Telegram OR Potato FOR DIRECT",
    "ORDERS OR QUESTIONS!)</b>",
  ].join("\n"),
  showHomeFooter: false,

  // Vendor name shown on product pages (-- by VendorName)
  vendorName: "Hash Heroes",
  vendorCommand: "/vendor",

  // Emoji prepended/appended to the shop name in welcome
  emoji: "",

  // Welcome intro text (storefront style)
  welcomeText: [
    "Welcome to Hash Heroes.",
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
  footerLink: "https://t.me/HEADiestOFFICIAL",
  footerText: "Powered by SI Market",

  // About page command
  aboutCommand: "/info",

  // Welcome cover image (path to local file OR public URL OR empty for text-only)
  welcomeImage: "images/hashheroes.jpeg",

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
