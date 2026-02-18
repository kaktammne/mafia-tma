/**
 * Telegram WebApp helpers.
 * In dev mode (outside Telegram), returns mocked data.
 */

const tg = window.Telegram?.WebApp;

export function initTelegram() {
  if (tg) {
    tg.ready();
    tg.expand();
    tg.setHeaderColor('#0d0d10');
    tg.setBackgroundColor('#0d0d10');
  }
}

export function getTelegramUser() {
  const user = tg?.initDataUnsafe?.user;

  if (user) {
    return {
      tgId: user.id,
      name: user.first_name + (user.last_name ? ` ${user.last_name}` : ''),
      avatar: user.photo_url || null,
    };
  }

  // Dev fallback
  return {
    tgId: Math.floor(Math.random() * 100000),
    name: `Player_${Math.floor(Math.random() * 999)}`,
    avatar: null,
  };
}

export function shareInviteLink(roomId) {
  const link = `https://t.me/themafiaclub_bot/play?startapp=${roomId}`;
  const text = 'Присоединяйся к игре в Мафию! 🎭';

  if (tg?.openTelegramLink) {
    tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`);
  } else {
    navigator.clipboard?.writeText(link);
    alert('Ссылка скопирована!');
  }
}

/**
 * Get the startapp parameter (room ID) passed via invite link.
 * When someone opens t.me/themafiaclub_bot/play?startapp=1234,
 * Telegram passes "1234" as tg.initDataUnsafe.start_param.
 */
export function getStartParam() {
  return tg?.initDataUnsafe?.start_param || null;
}

export { tg };
