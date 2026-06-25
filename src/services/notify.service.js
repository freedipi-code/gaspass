const config = require('../config');
const { formatPrice } = require('../bot/keyboards');

function formatOrderForAdmin(order, ctx) {
  const lines = order.items.map((it) => {
    const label = it.label ? ` (${it.label})` : '';
    return `• ${it.quantity}× ${it.product.name}${label} — ${formatPrice(it.price * it.quantity)}`;
  });
  
  const tgUser = ctx.from;
  const username = tgUser?.username ? `@${tgUser.username}` : `id:${tgUser?.id}`;

  return (
    `🛒 *New Order*\n\n` +
    `Order: *${order.orderNumber}*\n` +
    `Customer: ${order.fullName} (${username})\n` +
    `Amount: *${formatPrice(order.total)}*\n` +
    `Payment: ${order.paymentMethod}\n\n` +
    `*Products:*\n${lines.join('\n')}\n\n` +
    `📍 Address: ${order.address}\n` +
    (order.notes ? `📝 Notes: ${order.notes}\n` : '') +
    `🕒 ${order.createdAt.toLocaleString('en-GB')}`
  );
}

async function notifyNewOrder(bot, order, ctx) {
  try {
    await bot.telegram.sendMessage(config.adminId, formatOrderForAdmin(order, ctx), {
      parse_mode: 'Markdown',
    });
  } catch (e) {
    console.error('Admin notification failed:', e.message);
  }
}

async function forwardProofToAdmin(bot, order, ctx) {
  try {
    await bot.telegram.sendMessage(
      config.adminId,
      `📎 Proof of payment received for *${order.orderNumber}*`,
      { parse_mode: 'Markdown' },
    );
    await ctx.forwardMessage(config.adminId);
  } catch (e) {
    console.error('Proof forwarding failed:', e.message);
  }
}

module.exports = { notifyNewOrder, forwardProofToAdmin };
