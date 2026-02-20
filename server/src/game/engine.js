import { PHASE } from './GameRoom.js';
import { ROLES, TEAM, ROLE_LABELS } from './roles.js';
import {
  getBotIntroPhrase,
  getBotDayPhrase,
  getBotNightPhrase,
  botPickTarget,
  randomDelay,
} from './bots.js';

/**
 * Game Engine — orchestrates phases, narrator, and bot automation.
 */
export class GameEngine {
  constructor(io, room) {
    this.io = io;
    this.room = room;
    this.timers = [];
  }

  /* ───────── Utilities ───────── */

  clearTimers() {
    this.timers.forEach((t) => clearTimeout(t));
    this.timers = [];
  }

  schedule(fn, delayMs) {
    const t = setTimeout(fn, delayMs);
    this.timers.push(t);
    return t;
  }

  /** Set narrator text and broadcast state */
  narrate(message, sub = '') {
    this.room.narratorMessage = message;
    this.room.narratorSub = sub;
    console.log(`[narrator ${this.room.id}] 🎙️ ${message}${sub ? ' — ' + sub : ''}`);
    this.broadcastState();
  }

  /** Broadcast full state to all real (non-bot) players. */
  broadcastState() {
    for (const [sid, player] of this.room.players) {
      if (!player.isBot) {
        this.io.to(sid).emit('game:state', this.room.toPlayerState(sid));
      }
    }
  }

  /** Broadcast a single event to real players only. */
  broadcastEvent(event, data) {
    for (const [sid, player] of this.room.players) {
      if (!player.isBot) {
        this.io.to(sid).emit(event, data);
      }
    }
  }

  /* ══════════════════════════════════════════
     PHASE 0: DEALING — narrator deals cards
     ══════════════════════════════════════════ */

  startGame() {
    console.log(`[engine ${this.room.id}] 🎮 === ИГРА НАЧИНАЕТСЯ ===`);

    this.narrate('Добрый вечер, господа.', 'Добро пожаловать в город...');

    this.schedule(() => {
      this.narrate('Я раздаю карты...', 'Посмотрите свою роль');
      this.room.dealRoles();
      this.broadcastState();
    }, 3000);

    // Give players time to see their role
    this.schedule(() => {
      this.startIntroduction();
    }, 9000);
  }

  /* ══════════════════════════════════════════
     PHASE 1: INTRODUCTION — each player speaks
     ══════════════════════════════════════════ */

  startIntroduction() {
    this.room.startIntroduction();
    this.narrate('Фаза знакомства', 'Каждый представится по очереди');

    this.schedule(() => this.runSpeakerTurn(), 2000);
  }

  runSpeakerTurn() {
    const alivePlayers = this.room.alivePlayerList;
    const idx = this.room.currentSpeaker;

    if (idx >= alivePlayers.length) {
      this.narrate('Все представились.', 'Наступает первая ночь...');
      this.schedule(() => this.startNight(), 3000);
      return;
    }

    const speaker = alivePlayers[idx];
    this.narrate(
      `Слово игроку ${speaker.name}`,
      `${idx + 1} из ${alivePlayers.length} · 30 сек`
    );

    if (speaker.isBot) {
      const delay = randomDelay(2000, 4000);
      this.schedule(() => {
        const phrase = getBotIntroPhrase(speaker.role);
        this.emitChat(speaker, phrase);

        this.schedule(() => {
          this.room.currentSpeaker++;
          this.runSpeakerTurn();
        }, 1500);
      }, delay);
    } else {
      this.schedule(() => {
        this.room.currentSpeaker++;
        this.runSpeakerTurn();
      }, 30000);
    }
  }

  playerFinishedSpeaking(playerId) {
    const alive = this.room.alivePlayerList;
    const idx = this.room.currentSpeaker;
    if (idx >= alive.length) return;
    if (alive[idx].id !== playerId) return;

    this.clearTimers();
    this.room.currentSpeaker++;
    this.runSpeakerTurn();
  }

  /* ══════════════════════════════════════════
     PHASE 2: NIGHT — mafia kills, doctor heals
     ══════════════════════════════════════════ */

  startNight() {
    this.room.startNight();
    this.narrate('Город засыпает...', 'Ночь ' + this.room.round);

    this.schedule(() => {
      this.narrate('Мафия просыпается.', 'Мафия выбирает жертву...');
      this.scheduleBotNightActions();
    }, 2000);

    this.schedule(() => this.resolveNight(), 30000);
  }

  scheduleBotNightActions() {
    const bots = this.room.aliveBots;
    const alive = this.room.alivePlayerList;

    for (const bot of bots) {
      const delay = randomDelay(2000, 6000);

      if (TEAM[bot.role] === 'mafia') {
        this.schedule(() => {
          const target = botPickTarget(alive, bot.id, 'enemy');
          if (target) {
            this.room.nightActions.mafiaVotes.set(bot.id, target.id);
            console.log(`[engine ${this.room.id}] 🤖🔪 ${bot.name} → ${target.name}`);
            const phrase = getBotNightPhrase(target.name);
            this.broadcastToMafia('game:mafia-chat', {
              playerId: bot.id, playerName: bot.name, text: phrase, targetId: target.id,
            });
          }
        }, delay);
      }
      if (bot.role === ROLES.DOCTOR) {
        this.schedule(() => {
          const target = botPickTarget(alive, bot.id);
          if (target) {
            this.room.nightActions.doctorTarget = target.id;
            console.log(`[engine ${this.room.id}] 🤖💊 ${bot.name} лечит ${target.name}`);
          }
        }, delay);
      }
      if (bot.role === ROLES.SHERIFF) {
        this.schedule(() => {
          const target = botPickTarget(alive, bot.id);
          if (target) {
            this.room.nightActions.sheriffTarget = target.id;
            console.log(`[engine ${this.room.id}] 🤖🔍 ${bot.name} проверяет ${target.name}`);
          }
        }, delay);
      }
    }
  }

  broadcastToMafia(event, data) {
    for (const [sid, player] of this.room.players) {
      if (!player.isBot && TEAM[player.role] === 'mafia') {
        this.io.to(sid).emit(event, data);
      }
    }
  }

  handleNightAction(playerId, action) {
    const player = this.room.getPlayer(playerId);
    if (!player || !player.alive) return;
    if (TEAM[player.role] === 'mafia' && action.targetId) {
      this.room.nightActions.mafiaVotes.set(playerId, action.targetId);
    }
    if (player.role === ROLES.DOCTOR && action.targetId) {
      this.room.nightActions.doctorTarget = action.targetId;
    }
    if (player.role === ROLES.SHERIFF && action.targetId) {
      this.room.nightActions.sheriffTarget = action.targetId;
      const target = this.room.getPlayer(action.targetId);
      const isMafia = target ? TEAM[target.role] === 'mafia' : false;
      this.io.to(playerId).emit('game:sheriff-result', {
        targetId: action.targetId, targetName: target?.name, isMafia,
      });
    }
  }

  resolveNight() {
    this.clearTimers();
    const result = this.room.resolveNight();

    this.narrate('Город просыпается!', 'Наступает утро...');

    this.schedule(() => {
      if (result.killed) {
        this.narrate(
          `Этой ночью был убит ${result.killed.name}`,
          result.saved ? 'Но доктор спас!' : 'Покойся с миром...'
        );
      } else {
        this.narrate('Этой ночью никто не погиб!', result.saved ? 'Доктор спас жертву!' : 'Мафия промахнулась');
      }

      this.broadcastEvent('game:night-result', result);

      const winner = this.room.checkWin();
      if (winner) {
        this.schedule(() => this.endGame(winner), 3000);
        return;
      }

      this.schedule(() => this.startDay(), 4000);
    }, 2000);
  }

  /* ══════════════════════════════════════════
     PHASE 3: DAY — discussion
     ══════════════════════════════════════════ */

  startDay() {
    this.room.startDay();
    this.narrate('День. Обсуждение.', 'Кого подозреваем?');

    this.schedule(() => this.runDaySpeakerTurn(), 2000);
  }

  runDaySpeakerTurn() {
    const alive = this.room.alivePlayerList;
    const idx = this.room.currentSpeaker;

    if (idx >= alive.length) {
      this.narrate('Обсуждение окончено.', 'Переходим к голосованию...');
      this.schedule(() => this.startVoting(), 2500);
      return;
    }

    const speaker = alive[idx];
    this.narrate(
      `Говорит ${speaker.name}`,
      `${idx + 1} из ${alive.length} · 30 сек`
    );

    if (speaker.isBot) {
      const delay = randomDelay(1500, 3000);
      this.schedule(() => {
        const target = botPickTarget(alive, speaker.id, 'ally-exclude');
        const phrase = target ? getBotDayPhrase(target.name) : getBotDayPhrase(null, true);
        this.emitChat(speaker, phrase);

        this.schedule(() => {
          this.room.currentSpeaker++;
          this.runDaySpeakerTurn();
        }, 1500);
      }, delay);
    } else {
      this.schedule(() => {
        this.room.currentSpeaker++;
        this.runDaySpeakerTurn();
      }, 30000);
    }
  }

  /* ══════════════════════════════════════════
     PHASE 3b: VOTING
     ══════════════════════════════════════════ */

  startVoting() {
    this.room.phase = PHASE.VOTING;
    this.narrate('Голосование!', 'Выберите кого исключить');

    const bots = this.room.aliveBots;
    const alive = this.room.alivePlayerList;

    for (const bot of bots) {
      this.schedule(() => {
        const target = botPickTarget(alive, bot.id, 'ally-exclude');
        if (target) {
          this.room.addDayVote(bot.id, target.id);
          this.broadcastEvent('game:vote-cast', {
            voterId: bot.id, voterName: bot.name,
            targetId: target.id, targetName: target.name,
          });
        }
      }, randomDelay(1000, 4000));
    }

    this.schedule(() => this.resolveVoting(), 10000);
  }

  handleDayVote(voterId, targetId) {
    this.room.addDayVote(voterId, targetId);
    const voter = this.room.getPlayer(voterId);
    const target = this.room.getPlayer(targetId);
    this.broadcastEvent('game:vote-cast', {
      voterId, voterName: voter?.name,
      targetId, targetName: target?.name || 'Пропуск',
    });
  }

  resolveVoting() {
    this.clearTimers();
    const result = this.room.resolveDayVote();

    if (result.ejected) {
      this.narrate(
        `${result.ejected.name} покидает стол!`,
        `Роль: ${ROLE_LABELS[result.ejected.role] || result.ejected.role}`
      );
    } else {
      this.narrate('Никто не выбыл.', 'Не набрано большинство голосов');
    }

    this.broadcastEvent('game:vote-result', result);

    const winner = this.room.checkWin();
    if (winner) {
      this.schedule(() => this.endGame(winner), 3000);
      return;
    }

    this.schedule(() => this.startNight(), 4000);
  }

  /* ══════════════════════════════════════════
     GAME OVER
     ══════════════════════════════════════════ */

  endGame(winner) {
    this.clearTimers();
    this.room.phase = PHASE.GAME_OVER;

    if (winner === 'town') {
      this.narrate('Город победил!', 'Мафия уничтожена. Мир восстановлен.');
    } else {
      this.narrate('Мафия победила!', 'Город пал. Тьма поглотила всех.');
    }

    this.broadcastEvent('game:over', {
      winner,
      players: [...this.room.players.values()].map((p) => ({
        id: p.id, name: p.name, role: p.role, alive: p.alive, isBot: p.isBot,
      })),
    });
    this.broadcastState();
  }

  /* ───────── Helpers ───────── */

  emitChat(speaker, text) {
    this.room.phaseMessages.push({
      playerId: speaker.id, playerName: speaker.name, text, timestamp: Date.now(),
    });
    this.broadcastEvent('game:chat', {
      playerId: speaker.id, playerName: speaker.name, text, isBot: speaker.isBot,
    });
    console.log(`[engine ${this.room.id}] 💬 ${speaker.name}: "${text}"`);
  }

  destroy() {
    this.clearTimers();
  }
}
