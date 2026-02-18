/**
 * Role definitions for Mafia game.
 *
 * Distribution depends on player count:
 *   5  players → 1 Mafia, 1 Sheriff, 3 Civilians
 *   6  players → 1 Mafia, 1 Don, 1 Sheriff, 3 Civilians
 *   7  players → 2 Mafia, 1 Sheriff, 1 Doctor, 3 Civilians
 *   8  players → 2 Mafia, 1 Don, 1 Sheriff, 1 Doctor, 3 Civilians
 *   9  players → 2 Mafia, 1 Don, 1 Sheriff, 1 Doctor, 4 Civilians
 *   10 players → 3 Mafia (1 Don + 2 Mafia), 1 Sheriff, 1 Doctor, 5 Civilians
 */

export const ROLES = {
  MAFIA: 'mafia',
  DON: 'don',
  SHERIFF: 'sheriff',
  DOCTOR: 'doctor',
  CIVILIAN: 'civilian',
};

export const ROLE_LABELS = {
  [ROLES.MAFIA]: 'Мафия',
  [ROLES.DON]: 'Дон',
  [ROLES.SHERIFF]: 'Шериф',
  [ROLES.DOCTOR]: 'Доктор',
  [ROLES.CIVILIAN]: 'Мирный житель',
};

export const TEAM = {
  [ROLES.MAFIA]: 'mafia',
  [ROLES.DON]: 'mafia',
  [ROLES.SHERIFF]: 'town',
  [ROLES.DOCTOR]: 'town',
  [ROLES.CIVILIAN]: 'town',
};

/**
 * Returns an array of roles for the given player count.
 */
export function getRoleDistribution(playerCount) {
  const roles = [];

  if (playerCount <= 5) {
    roles.push(ROLES.MAFIA);
    roles.push(ROLES.SHERIFF);
    while (roles.length < playerCount) roles.push(ROLES.CIVILIAN);
  } else if (playerCount === 6) {
    roles.push(ROLES.DON, ROLES.MAFIA);
    roles.push(ROLES.SHERIFF);
    while (roles.length < playerCount) roles.push(ROLES.CIVILIAN);
  } else if (playerCount <= 8) {
    roles.push(ROLES.DON, ROLES.MAFIA);
    roles.push(ROLES.SHERIFF, ROLES.DOCTOR);
    while (roles.length < playerCount) roles.push(ROLES.CIVILIAN);
  } else {
    // 9-10 players
    roles.push(ROLES.DON, ROLES.MAFIA, ROLES.MAFIA);
    roles.push(ROLES.SHERIFF, ROLES.DOCTOR);
    while (roles.length < playerCount) roles.push(ROLES.CIVILIAN);
  }

  return roles;
}

/**
 * Fisher-Yates shuffle.
 */
export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
