const { Markup } = require('telegraf');
const prisma = require('../../db/client');

function escapeHtml(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function statusLabel(status) {
  return status === 'pending' ? 'open' : status;
}

function statusEmoji(status) {
  return {
    pending: '⏳',
    paid: '✅',
    shipped: '🚚',
    cancelled: '❌',
  }[status] || '•';
}

async function showOrders(ctx) {
  const orders = await prisma.order.findMany({
    where: { userId: ctx.state.user.id },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  if (!orders.length) {
    const opts = {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([[Markup.button.callback('🏠 Home', 'home')]]),
    };
    const text = '📜 <b>Your Orders</b>\n\n<i>No orders yet.</i>';
    if (ctx.callbackQuery) {
      await ctx.answerCbQuery().catch(() => {});
      try { await ctx.editMessageText(text, opts); return; } catch (_) {}
    }
    return ctx.reply(text, opts);
  }

  const rows = orders.map((o) => [
    Markup.button.callback(
      `${statusEmoji(o.status)} ${o.orderNumber} — £${o.total.toFixed(2)}`,
      `order:${o.id}`,
    ),
  ]);
  rows.push([Markup.button.callback('🏠 Home', 'home')]);

  const text = '📜 <b>Your Orders</b> (10 most recent)\n\nTap an order for details.';
  const opts = { parse_mode: 'HTML', ...Markup.inlineKeyboard(rows) };
  if (ctx.callbackQuery) {
    await ctx.answerCbQuery().catch(() => {});
    try { await ctx.editMessageText(text, opts); return; } catch (_) {}
  }
  return ctx.reply(text, opts);
}

async function showOrderDetail(ctx) {
  const id = Number(ctx.match[1]);
  const order = await prisma.order.findFirst({
    where: { id, userId: ctx.state.user.id },
    include: { items: { include: { product: true } } },
  });
  if (!order) {
    await ctx.answerCbQuery('Order not found').catch(() => {});
    return;
  }
  const lines = order.items.map(
    (it) => `• ${it.quantity}× ${escapeHtml(it.product.name)} — £${(it.price * it.quantity).toFixed(2)}`,
  );
  const text =
    `📦 <b>Order ${escapeHtml(order.orderNumber)}</b>\n\n` +
    `Status: ${statusEmoji(order.status)} ${escapeHtml(statusLabel(order.status))}\n` +
    `Payment: ${escapeHtml(order.paymentMethod)}\n` +
    `Total: <b>£${order.total.toFixed(2)}</b>\n\n` +
    `<b>Items:</b>\n${lines.join('\n')}\n\n` +
    `📍 ${escapeHtml(order.shippingStreet)}\n` +
    (order.notes ? `📝 ${escapeHtml(order.notes)}\n` : '') +
    `🕒 ${order.createdAt.toLocaleString('en-GB')}`;

  await ctx.answerCbQuery().catch(() => {});
  const opts = {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard([
      [Markup.button.callback('⬅️ Back', 'orders'), Markup.button.callback('🏠 Home', 'home')],
    ]),
  };
  try { await ctx.editMessageText(text, opts); }
  catch (_) { await ctx.reply(text, opts); }
}

function register(bot) {
  bot.action('orders', showOrders);
  bot.command('orders', showOrders);
  bot.action(/^order:(\d+)$/, showOrderDetail);
}

module.exports = { register };
