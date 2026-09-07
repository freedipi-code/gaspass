const path = require('path');
const prisma = require('../db/client');

const PHOTO_PATH = path.join(__dirname, '../../images/dank_of_wales.jpeg');

const CAPTION = `Dank Of Wales Exotics

Good morning people! ☀️☀️

✅ online and taking orders!

Bringing you the best selection of flowers
on telegram 40+ strains here at DOW
ranging from edibles to extracts we have
have it ALL ‼️ 🔥

✅Trusted Vendor
✅Unmatched quality
✅Unmatched prices
✅Premiun products
✅All aspects THC
✅Sam day dispatch
✅10/10 customer service

Smoke with us for that true coffee shop
experience 👌 we guarantee you won't look
back 🔌🔌🔌

We hope you all have a lovely day stat lit
and stay safe team DOW 😎

@DankofWales

Dank Of Wales Exotics
The Home of Topshelf Flowers`;

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function createAutomaticPublisher(bot, { prismaClient = prisma, sendDelayMs = 50 } = {}) {
  let photoFileId = null;

  return async function publish() {
    const users = await prismaClient.user.findMany({
      select: { telegramId: true },
      orderBy: { id: 'asc' },
    });

    let sent = 0;
    let failed = 0;

    for (const user of users) {
      try {
        const message = await bot.telegram.sendPhoto(
          user.telegramId,
          photoFileId || { source: PHOTO_PATH },
          { caption: CAPTION },
        );

        if (!photoFileId && message.photo?.length) {
          photoFileId = message.photo[message.photo.length - 1].file_id;
        }
        sent += 1;
      } catch (error) {
        failed += 1;
        console.error(
          `❌ Message automatique non envoyé à l'utilisateur ${user.telegramId} :`,
          error?.description || error?.message || error,
        );
      }

      if (sendDelayMs > 0) await wait(sendDelayMs);
    }

    console.log(`📣 Diffusion automatique terminée : ${sent} envoyé(s), ${failed} échec(s)`);
    return { sent, failed };
  };
}

function getTimeParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);

  return Object.fromEntries(
    parts.filter(({ type }) => type !== 'literal').map(({ type, value }) => [type, value]),
  );
}

async function startAutoMessageScheduler(
  bot,
  {
    hour,
    minute,
    timeZone,
    checkIntervalMs,
    sendDelayMs,
  },
  {
    prismaClient = prisma,
    now = () => new Date(),
    setIntervalFn = setInterval,
    clearIntervalFn = clearInterval,
  } = {},
) {
  const me = await bot.telegram.getMe();

  const publish = createAutomaticPublisher(
    bot,
    { prismaClient, sendDelayMs },
  );

  let sending = false;
  let lastRunDate = null;

  const run = async () => {
    const current = getTimeParts(now(), timeZone);
    const dateKey = `${current.year}-${current.month}-${current.day}`;

    if (
      Number(current.hour) !== hour
      || Number(current.minute) !== minute
      || lastRunDate === dateKey
      || sending
    ) return;

    sending = true;
    lastRunDate = dateKey;

    try {
      await publish();
    } catch (error) {
      console.error('❌ Échec de la diffusion automatique :', error);
    } finally {
      sending = false;
    }
  };

  await run();
  const timer = setIntervalFn(run, checkIntervalMs);
  console.log(
    `⏱️ Diffusion quotidienne activée via @${me.username} à ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')} (${timeZone})`,
  );

  return () => clearIntervalFn(timer);
}

module.exports = {
  CAPTION,
  PHOTO_PATH,
  createAutomaticPublisher,
  getTimeParts,
  startAutoMessageScheduler,
};
