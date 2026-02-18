import { getRoleDistribution, shuffle, ROLES, TEAM } from './roles.js';
import { createBotIdentity } from './bots.js';

/**
 * Game phases.
 */
export const PHASE = {
  LOBBY: 'lobby',
  DEALING: 'dealing',           // Phase 0: role reveal
  INTRODUCTION: 'introduction', // Phase 1: each player speaks
  NIGHT: 'night',               // Phase 2: mafia acts
  DAY: 'day',                   // Phase 3: discussion & vote
  VOTING: 'voting',             // Phase 3b: vote tally
  GAME_OVER: 'game_over',
};

const MIN_PLAYERS = 5;
const MAX_PLAYERS = 10;

export class GameRoom {
  constructor(id, hostId, options = {}) {
    this.id = id;
    this.hostId = hostId;
    this.isPrivate = options.isPrivate || false;
    this.maxPlayers = options.maxPlayers || MAX_PLAYERS;
    this.phase = PHASE.LOBBY;
    this.round = 0;

    /** @type {Map<string, object>} playerId → player */
    this.players = new Map();

    /** Night actions accumulator */
    this.nightActions = {
      mafiaVotes: new Map(),   // mafiaId → targetId
      doctorTarget: null,
      sheriffTarget: null,
    };

    /** Day votes accumulator: voterId → targetId */
    this.dayVotes = new Map();

    /** Current speaker index during speech phases */
    this.currentSpeaker = -1;
    this.speakerTimer = null;

    /** Chat / speech log for the current phase */
    this.phaseMessages = [];

    /** Last night result message */
    this.lastNightResult = null;

    /** Last vote result */
    this.lastVoteResult = null;

    /** Narrator announcement visible to all */
    this.narratorMessage = 'Ожидание игроков...';
    this.narratorSub = '';
  }

  /* ───────── Player management ───────── */

  addPlayer(socketId, userData) {
    if (this.players.size >= this.maxPlayers) return false;
    if (this.phase !== PHASE.LOBBY) return false;

    this.players.set(socketId, {
      id: socketId,
      tgId: userData.tgId,
      name: userData.name,
      avatar: userData.avatar || null,
      avatarColor: userData.avatarColor || null,
      isBot: userData.isBot || false,
      role: null,       // game role (mafia, sheriff, etc.) — assigned at dealing
      alive: true,
      seat: this.players.size,
    });
    return true;
  }

  /**
   * Fill remaining seats with bots.
   * Returns array of created bot identities.
   */
  fillWithBots() {
    const bots = [];
    while (this.players.size < this.maxPlayers) {
      const bot = createBotIdentity();
      this.addPlayer(bot.id, bot);
      bots.push(bot);
    }
    console.log(`[GameRoom ${this.id}] 🤖 Добавлено ${bots.length} ботов, всего ${this.playerCount}`);
    return bots;
  }

  /**
   * Add a single bot. Returns the bot or null if full.
   */
  addSingleBot() {
    if (this.players.size >= this.maxPlayers) return null;
    const bot = createBotIdentity();
    this.addPlayer(bot.id, bot);
    return bot;
  }

  removePlayer(socketId) {
    this.players.delete(socketId);
  }

  get playerCount() {
    return this.players.size;
  }

  get alivePlayers() {
    return [...this.players.values()].filter((p) => p.alive);
  }

  get alivePlayerList() {
    return this.alivePlayers;
  }

  get botPlayers() {
    return [...this.players.values()].filter((p) => p.isBot);
  }

  get aliveBots() {
    return this.alivePlayers.filter((p) => p.isBot);
  }

  getPlayer(id) {
    return this.players.get(id) || null;
  }

  /* ───────── Game flow ───────── */

  canStart() {
    return this.playerCount >= MIN_PLAYERS && this.phase === PHASE.LOBBY;
  }

  /** Phase 0 — deal roles */
  dealRoles() {
    const roles = shuffle(getRoleDistribution(this.playerCount));
    let i = 0;
    for (const player of this.players.values()) {
      player.role = roles[i++];
    }
    this.phase = PHASE.DEALING;
    console.log(`[GameRoom ${this.id}] 🃏 Роли розданы:`,
      [...this.players.values()].map((p) => `${p.name}=${p.role}${p.isBot ? '(bot)' : ''}`).join(', ')
    );
  }

  /** Advance to Introduction phase */
  startIntroduction() {
    this.phase = PHASE.INTRODUCTION;
    this.currentSpeaker = 0;
    this.phaseMessages = [];
  }

  /** Advance to Night phase */
  startNight() {
    this.phase = PHASE.NIGHT;
    this.round += 1;
    this.nightActions = {
      mafiaVotes: new Map(),
      doctorTarget: null,
      sheriffTarget: null,
    };
    this.phaseMessages = [];
  }

  /** Resolve night: apply mafia kill, doctor save */
  resolveNight() {
    // Count mafia votes
    const voteCount = new Map();
    for (const targetId of this.nightActions.mafiaVotes.values()) {
      voteCount.set(targetId, (voteCount.get(targetId) || 0) + 1);
    }

    // Find target with most votes
    let mafiaTarget = null;
    let maxVotes = 0;
    for (const [targetId, count] of voteCount) {
      if (count > maxVotes) {
        maxVotes = count;
        mafiaTarget = targetId;
      }
    }

    // Doctor save?
    const saved = mafiaTarget && this.nightActions.doctorTarget === mafiaTarget;
    let killedPlayer = null;

    if (mafiaTarget && !saved) {
      const target = this.players.get(mafiaTarget);
      if (target) {
        target.alive = false;
        killedPlayer = target;
        console.log(`[GameRoom ${this.id}] 💀 Ночью убит: ${target.name}`);
      }
    } else if (saved) {
      console.log(`[GameRoom ${this.id}] 💊 Доктор спас: ${this.players.get(mafiaTarget)?.name}`);
    }

    this.lastNightResult = {
      killed: killedPlayer ? { id: killedPlayer.id, name: killedPlayer.name } : null,
      saved: saved,
    };

    return this.lastNightResult;
  }

  /** Advance to Day phase */
  startDay() {
    this.phase = PHASE.DAY;
    this.currentSpeaker = 0;
    this.dayVotes = new Map();
    this.phaseMessages = [];
  }

  /** Register a day vote */
  addDayVote(voterId, targetId) {
    this.dayVotes.set(voterId, targetId);
  }

  /** Resolve day vote */
  resolveDayVote() {
    const voteCount = new Map();
    for (const targetId of this.dayVotes.values()) {
      if (targetId === 'skip') continue;
      voteCount.set(targetId, (voteCount.get(targetId) || 0) + 1);
    }

    let ejectedId = null;
    let maxVotes = 0;
    for (const [targetId, count] of voteCount) {
      if (count > maxVotes) {
        maxVotes = count;
        ejectedId = targetId;
      }
    }

    // Need majority (more than half of alive players)
    const majority = Math.floor(this.alivePlayers.length / 2) + 1;
    let ejectedPlayer = null;

    if (ejectedId && maxVotes >= majority) {
      const target = this.players.get(ejectedId);
      if (target) {
        target.alive = false;
        ejectedPlayer = target;
        console.log(`[GameRoom ${this.id}] 🗳️ Голосованием выбывает: ${target.name} (${target.role})`);
      }
    } else {
      console.log(`[GameRoom ${this.id}] 🗳️ Голосование: никто не выбыл (нет большинства)`);
    }

    this.lastVoteResult = {
      votes: Object.fromEntries(this.dayVotes),
      ejected: ejectedPlayer ? { id: ejectedPlayer.id, name: ejectedPlayer.name, role: ejectedPlayer.role } : null,
    };

    return this.lastVoteResult;
  }

  /* ───────── Serialisation ───────── */

  /** Public lobby info (for room list). */
  toLobbyInfo() {
    return {
      id: this.id,
      host: this.hostId,
      playerCount: this.playerCount,
      maxPlayers: this.maxPlayers,
      phase: this.phase,
      isPrivate: this.isPrivate,
    };
  }

  /** Full state visible to a specific player (or broadcast). */
  toPlayerState(socketId) {
    const me = this.players.get(socketId);
    const isGameOver = this.phase === PHASE.GAME_OVER;

    const players = [...this.players.values()].map((p) => ({
      id: p.id,
      tgId: p.tgId,
      name: p.name,
      avatar: p.avatar,
      avatarColor: p.avatarColor || null,
      seat: p.seat,
      alive: p.alive,
      isBot: p.isBot,
      isAdmin: p.id === this.hostId,
      // Reveal role only to self, or all if game over
      role: p.id === socketId || isGameOver ? p.role : null,
    }));

    return {
      roomId: this.id,
      phase: this.phase,
      round: this.round,
      players,
      myRole: me?.role || null,
      currentSpeaker: this.currentSpeaker,
      maxPlayers: this.maxPlayers,
      phaseMessages: this.phaseMessages,
      lastNightResult: this.lastNightResult,
      lastVoteResult: this.lastVoteResult,
      narratorMessage: this.narratorMessage,
      narratorSub: this.narratorSub,
    };
  }

  /** Broadcast-safe state (no per-player role). */
  toBroadcastState() {
    const players = [...this.players.values()].map((p) => ({
      id: p.id,
      tgId: p.tgId,
      name: p.name,
      avatar: p.avatar,
      avatarColor: p.avatarColor || null,
      seat: p.seat,
      alive: p.alive,
      isBot: p.isBot,
      isAdmin: p.id === this.hostId,
      role: this.phase === PHASE.GAME_OVER ? p.role : null,
    }));

    return {
      roomId: this.id,
      phase: this.phase,
      round: this.round,
      players,
      currentSpeaker: this.currentSpeaker,
      maxPlayers: this.maxPlayers,
      phaseMessages: this.phaseMessages,
      lastNightResult: this.lastNightResult,
      lastVoteResult: this.lastVoteResult,
      narratorMessage: this.narratorMessage,
      narratorSub: this.narratorSub,
    };
  }

  /* ───────── Win condition check ───────── */

  checkWin() {
    const alive = this.alivePlayers;
    const mafiaAlive = alive.filter((p) => TEAM[p.role] === 'mafia').length;
    const townAlive = alive.filter((p) => TEAM[p.role] === 'town').length;

    if (mafiaAlive === 0) return 'town';
    if (mafiaAlive >= townAlive) return 'mafia';
    return null;
  }
}
