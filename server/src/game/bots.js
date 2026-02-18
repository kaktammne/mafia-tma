import { ROLES, TEAM, ROLE_LABELS } from './roles.js';

/* ───────── Bot identity pools ───────── */

const FIRST_NAMES = [
  'Иван', 'Анна', 'Дмитрий', 'Мария', 'Алексей',
  'Елена', 'Сергей', 'Ольга', 'Николай', 'Татьяна',
  'Артём', 'Юлия', 'Максим', 'Светлана', 'Павел',
  'Наталья', 'Андрей', 'Виктория', 'Кирилл', 'Дарья',
];

const AVATAR_COLORS = [
  '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
  '#ec4899', '#f43f5e', '#ef4444', '#f97316',
  '#eab308', '#84cc16', '#22c55e', '#14b8a6',
  '#06b6d4', '#3b82f6', '#2563eb', '#7c3aed',
];

let botCounter = 0;

/**
 * Create a unique bot identity.
 */
export function createBotIdentity() {
  botCounter++;
  const name = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
  const color = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
  const botId = `bot_${botCounter}_${Date.now().toString(36)}`;

  return {
    id: botId,
    tgId: botId,
    name: `Bot_${name}`,
    avatar: null,
    avatarColor: color,
    isBot: true,
  };
}

/* ───────── Bot speech generation ───────── */

const INTRO_PHRASES = {
  [ROLES.CIVILIAN]: [
    'Привет всем! Я мирный житель, просто хочу пережить эту ночь.',
    'Всем доброго вечера! Никого не знаю тут, но выгляжу подозрительно? Нет? Ну и отлично.',
    'Здравствуйте! Я обычный горожанин, мне скрывать нечего.',
    'Приветики! Я тут новенький, но клянусь — я за город!',
    'Добрый вечер! Мирный, спокойный, никого убивать не собираюсь.',
    'Хей! Поверьте, я самый мирный человек за этим столом.',
  ],
  [ROLES.MAFIA]: [
    'Всем привет! Я абсолютно мирный, честное слово.',
    'Добрый вечер! Выгляжу подозрительно? Да нет, я просто нервничаю...',
    'Привет-привет! За город играю, без вопросов.',
    'Здравствуйте! Мирный житель, готов помочь найти мафию!',
    'Приветствую! Я на стороне города, давайте вычислим мафию.',
    'Всем хай! Клянусь мамой, я мирный!',
  ],
  [ROLES.DON]: [
    'Добрый вечер, господа. Я уважаемый гражданин этого города.',
    'Приветствую всех! Я бизнесмен, у меня алиби на каждую ночь.',
    'Всем привет! Готов возглавить расследование, я опытный игрок.',
    'Здравствуйте! Давайте логично подойдём к поиску мафии.',
  ],
  [ROLES.SHERIFF]: [
    'Добрый вечер! Я за справедливость. Мафия — берегитесь.',
    'Привет! У меня хорошая интуиция, давайте найдём злодеев.',
    'Всем здравствуйте! Внимательно слежу за каждым.',
    'Приветствую! Я здесь чтобы защитить город.',
  ],
  [ROLES.DOCTOR]: [
    'Добрый вечер! Я за мирных, и у меня есть способы помочь.',
    'Привет! Постараюсь спасти кого смогу. Верьте мне.',
    'Здравствуйте! Я человек мирной профессии, никому зла не желаю.',
    'Всем привет! Я тут чтобы помогать, а не вредить.',
  ],
};

const DAY_PHRASES_ACCUSE = [
  'Мне кажется, {target} ведёт себя подозрительно. Голосую за него!',
  '{target} слишком тихий, это подозрительно. Давайте проверим!',
  'Я думаю {target} — мафия. У меня плохое предчувствие.',
  'Обратите внимание на {target}, что-то тут не так.',
  '{target} слишком уверенно защищается. Подозрительно!',
  'Мне не нравится как {target} отводит глаза. Голосую!',
];

const DAY_PHRASES_DEFEND = [
  'Я точно мирный! Проверьте лучше других.',
  'Не голосуйте за меня, я не мафия! Поверьте!',
  'Это ошибка! Я за город, давайте подумаем логически.',
  'Я невиновен! Мафия пытается подставить меня.',
];

const NIGHT_MAFIA_PHRASES = [
  'Давайте уберём {target}, он слишком опасен.',
  '{target} — наша цель. Он может нас раскрыть.',
  'Предлагаю {target}. Он слишком активный.',
  'Голосую за {target}.',
];

/**
 * Pick a random phrase for the bot during introduction.
 */
export function getBotIntroPhrase(gameRole) {
  const pool = INTRO_PHRASES[gameRole] || INTRO_PHRASES[ROLES.CIVILIAN];
  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * Pick a random accusation phrase for day discussion.
 */
export function getBotDayPhrase(targetName, isDefending = false) {
  if (isDefending) {
    const pool = DAY_PHRASES_DEFEND;
    return pool[Math.floor(Math.random() * pool.length)];
  }
  const pool = DAY_PHRASES_ACCUSE;
  return pool[Math.floor(Math.random() * pool.length)].replace('{target}', targetName);
}

/**
 * Pick a random mafia night chat phrase.
 */
export function getBotNightPhrase(targetName) {
  const pool = NIGHT_MAFIA_PHRASES;
  return pool[Math.floor(Math.random() * pool.length)].replace('{target}', targetName);
}

/**
 * Bot picks a random alive target (excluding self).
 */
export function botPickTarget(alivePlayers, selfId, teamFilter = null) {
  let candidates = alivePlayers.filter((p) => p.id !== selfId);

  // If teamFilter is provided, filter by team
  if (teamFilter === 'enemy') {
    // Mafia targets town players
    candidates = candidates.filter((p) => TEAM[p.role] === 'town');
  } else if (teamFilter === 'ally-exclude') {
    // Don't vote for own team
    const selfPlayer = alivePlayers.find((p) => p.id === selfId);
    const selfTeam = selfPlayer ? TEAM[selfPlayer.role] : null;
    if (selfTeam) {
      candidates = candidates.filter((p) => TEAM[p.role] !== selfTeam);
    }
  }

  if (candidates.length === 0) {
    // Fallback: anyone alive except self
    candidates = alivePlayers.filter((p) => p.id !== selfId);
  }

  return candidates[Math.floor(Math.random() * candidates.length)] || null;
}

/**
 * Random delay between min and max ms.
 */
export function randomDelay(minMs = 1500, maxMs = 3500) {
  return Math.floor(minMs + Math.random() * (maxMs - minMs));
}
