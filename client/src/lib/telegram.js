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
  const botUrl = import.meta.env.VITE_BOT_URL || 'https://t.me/mafia_tma_bot';
  const link = `${botUrl}?startapp=${roomId}`;

  if (tg?.openTelegramLink) {
    tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent('Присоединяйся к игре в Мафию! 🎭')}`);
  } else {
    navigator.clipboard?.writeText(link);
    alert('Ссылка скопирована!');
  }
}

export { tg };
