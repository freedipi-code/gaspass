const config = require('../config');
const { formatPrice } = require('../bot/keyboards');

function formatOrderForAdmin(order, ctx) {
  const lines = order.items.map((it) => {
    const label = it.label ? ` (${it.label})` : '';
    return `• ${it.quantity}× ${it.product.name}${label} — ${formatPrice(it.price * it.quantity)}`;
  });
  
  const tgUser = ctx.from;
  const username = tgUser?.username ? `@${tgUser.username}` : `id:${tgUser?.id}`;

  // Escape HTML helper
  const escapeHtml = (text) => {
    if (!text) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  };

  return (
    `🛒 <b>New Order</b>\n\n` +
    `Order: <b>${escapeHtml(order.orderNumber)}</b>\n` +
    `Customer: ${escapeHtml(tgUser?.first_name || '')} (${escapeHtml(username)})\n` +
    `Amount: <b>${formatPrice(order.total)}</b>\n` +
    `Payment: ${escapeHtml(order.paymentMethod)}\n\n` +
    `<b>Products:</b>\n${lines.map(escapeHtml).join('\n')}\n\n` +
    `📍 Address: ${escapeHtml(order.shippingStreet || 'N/A')}\n` +
    (order.notes ? `📝 Notes: ${escapeHtml(order.notes)}\n` : '') +
    `🕒 ${order.createdAt.toLocaleString('en-GB')}`
  );
}

async function notifyNewOrder(bot, order, ctx) {
  try {
    await bot.telegram.sendMessage(config.adminId, formatOrderForAdmin(order, ctx), {
      parse_mode: 'HTML',
    });
  } catch (e) {
    console.error('Admin notification failed:', e.message);
  }
}

async function forwardProofToAdmin(bot, order, ctx) {
  try {
    await bot.telegram.sendMessage(
      config.adminId,
      `📎 Proof of payment received for <b>${order.orderNumber}</b>`,
      { parse_mode: 'HTML' },
    );
    await ctx.forwardMessage(config.adminId);
  } catch (e) {
    console.error('Proof forwarding failed:', e.message);
  }
}

module.exports = { notifyNewOrder, forwardProofToAdmin };
