const config = require('../config');
const { formatPrice } = require('../bot/keyboards');

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function formatOrderForAdmin(order, ctx) {
  const lines = order.items.map((it) => {
    const label = it.label ? ` (${it.label})` : '';
    return `• ${it.quantity}× ${escapeHtml(it.product.name)}${escapeHtml(label)} — ${formatPrice(it.price * it.quantity)}`;
  });

  const tgUser = ctx.from;
  const username = tgUser?.username ? `@${tgUser.username}` : `id:${tgUser?.id}`;
  const address = [
    order.shippingStreet,
    order.shippingApt && order.shippingApt !== 'n/a' ? order.shippingApt : null,
    order.shippingCity,
    order.shippingCountry,
  ].filter(Boolean).join(', ');

  return (
    `🛒 <b>New Order</b>\n\n` +
    `Order: <b>${escapeHtml(order.orderNumber)}</b>\n` +
    `Customer: ${escapeHtml(order.shippingName)} (${escapeHtml(username)})\n` +
    `Amount: <b>${escapeHtml(formatPrice(order.total))}</b>\n` +
    `Payment: ${escapeHtml(order.paymentMethod)}\n\n` +
    `<b>Products:</b>\n${lines.join('\n')}\n\n` +
    `📍 Address: ${escapeHtml(address)}\n` +
    (order.notes ? `📝 Notes: ${escapeHtml(order.notes)}\n` : '') +
    `🕒 ${escapeHtml(order.createdAt.toLocaleString('en-GB'))}`
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
      `📎 Proof of payment received for <b>${escapeHtml(order.orderNumber)}</b>`,
      { parse_mode: 'HTML' },
    );
    await ctx.forwardMessage(config.adminId);
  } catch (e) {
    console.error('Proof forwarding failed:', e.message);
  }
}

module.exports = { notifyNewOrder, forwardProofToAdmin, formatOrderForAdmin, escapeHtml };
