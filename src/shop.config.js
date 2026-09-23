// ───────────────────────────────────────────────────────────────────
// SHOP BRANDING CONFIG
// Edit this file to customize your shop's identity (name, shipping policy,
// channel link, owner username, footer signature, etc.).
// No need to touch any other file in the project.
// ───────────────────────────────────────────────────────────────────

module.exports = {
  // Display name shown in welcome message header
  name: "SamMcrPharma_tbcshop",

  // Vendor name shown on product pages (-- by VendorName)
  vendorName: "Buaking",
  vendorCommand: "/vendor",

  // Emoji prepended/appended to the shop name in welcome
  emoji: "",

  // Entry message shown before the main menu.
  welcomeText: [
    "‼️ PLACE YOUR ORDERS NOW ‼️",
    "",
    "Shop Open Taking Orders 24/7",
    "",
    "🛍️ Start Viewing Our Large Range Of Products 🛍️",
    "",
    "We Are The Most Reliable And Trusted",
    "🤝 Fast & Discreet Service ⚡📮",
    "⭐ ⭐ ⭐ ⭐ ⭐",
    "",
    "📮 Same Day Dispatch Cut Off Time:",
    "📮 Monday - Friday 02:30pm",
    "📮 Saturday 09:00am",
    "",
    "⚠️ Orders Placed After Cut Off Time Will Be Dispatched Next Day ⚠️",
    "",
    "🏦 Yes We Accept Bank Transfer 🏦",
    "(£100 minimum)",
    "For Bank Transfer Send Message And Your Order To: @SamMcrPharmaUK",
    "",
    "For Any Questions Or Assistance Feel Free To Contact Us:",
    "@SamMcrPharmaUK",
  ].join("\n"),

  mainMenuTitle: "Choose an option:",
  categoriesTitle: "📁 Main Categories\n\nChoose a category:",
  categoryHeader: "Choose a subcategory:",

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
  ownerUsername: "@SamMcrPharmaUK",         // e.g. "yourhandle" — empty hides the line
  ownerStatusLine: "🟢 Online",  // overridden if you want dynamic status later

  // Footer ////////////////////////////
 //// don't forget this place is for channel link

  footerLink: "https://t.me/SamMcrPharmaUK",
  footerText: "Powered by SamMcrPharma_01_TBC Shop",


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
