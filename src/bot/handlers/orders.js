const { Markup } = require('telegraf');
const prisma = require('../../db/client');

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
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([[Markup.button.callback('🏠 Home', 'home')]]),
    };
    const text = '📜 *Your Orders*\n\n_No orders yet._';
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

  const text = '📜 *Your Orders* (10 most recent)\n\nTap an order for details.';
  const opts = { parse_mode: 'Markdown', ...Markup.inlineKeyboard(rows) };
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
    (it) => `• ${it.quantity}× ${it.product.name} — £${(it.price * it.quantity).toFixed(2)}`,
  );
  const text =
    `📦 *Order ${order.orderNumber}*\n\n` +
    `Status: ${statusEmoji(order.status)} ${order.status}\n` +
    `Payment: ${order.paymentMethod}\n` +
    `Total: *£${order.total.toFixed(2)}*\n\n` +
    `*Items:*\n${lines.join('\n')}\n\n` +
    `📍 ${order.address}\n` +
    (order.notes ? `📝 ${order.notes}\n` : '') +
    `🕒 ${order.createdAt.toLocaleString('en-GB')}`;

  await ctx.answerCbQuery().catch(() => {});
  const opts = {
    parse_mode: 'Markdown',
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
