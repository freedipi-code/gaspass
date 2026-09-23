const { Markup } = require('telegraf');
const prisma = require('../../db/client');
const securityMarkService = require('../../services/security-mark.service');

const EMOJIS = [
  '🦉', '🚀', '⚡', '🌙', '🎯', '🌵',
  '🍕', '🦊', '🐼', '🌈', '🍀', '🔥',
  '🐬', '🍉', '🎸', '🧩', '💎', '🌻',
  '🐯', '🍒', '🛸', '🎲', '🦋', '🏝️',
];

const PAGE_SIZE = 6;

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function emojiKeyboard(page = 0) {
  const pageCount = Math.ceil(EMOJIS.length / PAGE_SIZE);
  const safePage = ((page % pageCount) + pageCount) % pageCount;
  const choices = EMOJIS.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);
  const rows = [];
  for (let i = 0; i < choices.length; i += 3) {
    rows.push(choices.slice(i, i + 3).map((emoji) =>
      Markup.button.callback(emoji, `security:emoji:${EMOJIS.indexOf(emoji)}`)
    ));
  }
  rows.push([Markup.button.callback('🎲 Show different emojis', `security:page:${safePage + 1}`)]);
  return Markup.inlineKeyboard(rows);
}

function resetSecuritySession(ctx) {
  ctx.session = ctx.session || {};
  ctx.session.securityMark = { step: 'emoji' };
  ctx.session.awaitingSupport = false;
  ctx.session.awaitingProofFor = null;
}

async function beginSetup(ctx, { edit = false, replacing = false } = {}) {
  resetSecuritySession(ctx);
  const heading = replacing
    ? '🛡️ <b>Choose a new security mark</b>'
    : '🛡️ <b>Welcome! First, set your security mark</b>';
  const text = [
    heading,
    '',
    'Before you can browse, set your unique security mark — an emoji plus a secret phrase. Every genuine bot will show it at the top of the menu; fake copy-cat bots cannot know it.',
    '',
    '<b>Step 1:</b> pick your emoji below.',
    '',
    '<i>Your mark never expires, and we will NEVER message you asking you to type it.</i>',
  ].join('\n');
  const opts = { parse_mode: 'HTML', ...emojiKeyboard(0) };

  if (ctx.callbackQuery) await ctx.answerCbQuery().catch(() => {});
  if (edit && ctx.callbackQuery) {
    try {
      await ctx.editMessageText(text, opts);
      return;
    } catch (_) {}
  }
  await ctx.reply(text, opts);
}

async function selectEmoji(ctx) {
  const index = Number(ctx.match[1]);
  const emoji = EMOJIS[index];
  if (!emoji) return ctx.answerCbQuery('Invalid emoji.', { show_alert: true });

  ctx.session = ctx.session || {};
  ctx.session.securityMark = { step: 'phrase', emoji };
  await ctx.answerCbQuery().catch(() => {});
  await ctx.reply([
    `Your emoji: ${emoji}`,
    '',
    '<b>Step 2:</b> now type your secret phrase (3–32 characters). Your message is deleted immediately after you send it. Pick something only you would recognise.',
  ].join('\n'), { parse_mode: 'HTML' });
}

async function previewPhrase(ctx, phrase) {
  const setup = ctx.session.securityMark;
  setup.step = 'preview';
  setup.phrase = phrase;

  await ctx.reply([
    '🛡️ Your security mark will be:',
    '',
    `<tg-spoiler>${escapeHtml(`${setup.emoji} ${phrase}`)}</tg-spoiler>`,
    '',
    'Tap to reveal it, check it carefully, then save.\n(Or type a different phrase.)',
  ].join('\n'), {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard([
      [Markup.button.callback('✅ Save this mark', 'security:save')],
      [Markup.button.callback('✏️ Type a different phrase', 'security:phrase')],
      [Markup.button.callback('🔄 Pick a different emoji', 'security:restart')],
    ]),
  });
}

async function handlePhrase(ctx, next) {
  const setup = ctx.session?.securityMark;
  if (!setup || !['phrase', 'preview'].includes(setup.step)) return next();
  if (ctx.message.text.startsWith('/')) return next();

  const phrase = ctx.message.text.trim();
  await ctx.deleteMessage().catch(() => {});

  const length = Array.from(phrase).length;
  if (length < 3 || length > 32) {
    setup.step = 'phrase';
    await ctx.reply('⚠️ Your secret phrase must contain between 3 and 32 characters. Please try again.');
    return;
  }
  await previewPhrase(ctx, phrase);
}

async function saveMark(ctx) {
  const setup = ctx.session?.securityMark;
  if (!setup?.emoji || !setup?.phrase) {
    if (securityMarkService.getSecurityMark(ctx.state.user)) {
      await ctx.answerCbQuery('Your security mark is already saved.', { show_alert: true });
      return;
    }
    await ctx.answerCbQuery('This setup session expired. Please start again.', { show_alert: true });
    return beginSetup(ctx);
  }

  const user = await prisma.user.update({
    where: { id: ctx.state.user.id },
    data: {
      securityEmoji: setup.emoji,
      securityPhrase: securityMarkService.encryptPhrase(setup.phrase),
    },
  });
  ctx.state.user = user;
  delete ctx.session.securityMark;

  await ctx.answerCbQuery('Security mark saved ✅').catch(() => {});
  await ctx.reply([
    '✅ <b>Your security mark is saved.</b>',
    '',
    'Every genuine bot now shows it above the main menu. If a bot does not show your mark, it is fake — do not pay.',
    '',
    '<i>We will never message you asking you to type your phrase.</i>',
  ].join('\n'), {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard([[Markup.button.callback('🏠 Main Menu', 'home')]]),
  });
}

async function showExistingMark(ctx) {
  const mark = securityMarkService.getSecurityMark(ctx.state.user);
  if (!mark) return beginSetup(ctx, { edit: true });

  await ctx.answerCbQuery().catch(() => {});
  const text = [
    '🛡️ <b>Your security mark</b>',
    '',
    `<tg-spoiler>${escapeHtml(`${mark.emoji} ${mark.phrase}`)}</tg-spoiler>`,
    '',
    'Tap the hidden mark to reveal it.',
  ].join('\n');
  const opts = {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard([
      [Markup.button.callback('🔄 Change security mark', 'security:change')],
      [Markup.button.callback('🏠 Main Menu', 'home')],
    ]),
  };
  try { await ctx.editMessageText(text, opts); } catch (_) { await ctx.reply(text, opts); }
}

function register(bot) {
  bot.action(/^security:page:(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});
    await ctx.editMessageReplyMarkup(emojiKeyboard(Number(ctx.match[1])).reply_markup);
  });
  bot.action(/^security:emoji:(\d+)$/, selectEmoji);
  bot.action('security:save', saveMark);
  bot.action('security:phrase', async (ctx) => {
    const setup = ctx.session?.securityMark;
    if (!setup?.emoji) return beginSetup(ctx);
    setup.step = 'phrase';
    delete setup.phrase;
    await ctx.answerCbQuery().catch(() => {});
    const text = '✏️ Type your new secret phrase (3–32 characters). It will be deleted immediately.';
    try { await ctx.editMessageText(text); } catch (_) { await ctx.reply(text); }
  });
  bot.action('security:restart', (ctx) => beginSetup(ctx, { edit: true }));
  bot.action('security:mark', showExistingMark);
  bot.action('security:change', (ctx) => beginSetup(ctx, { edit: true, replacing: true }));
  bot.on('text', handlePhrase);
}

module.exports = { register, beginSetup };
