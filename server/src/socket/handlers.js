import { GameRoom, PHASE } from '../game/GameRoom.js';
import { GameEngine } from '../game/engine.js';

/** @type {Map<string, GameRoom>} roomId → GameRoom */
const rooms = new Map();

/** @type {Map<string, GameEngine>} roomId → GameEngine */
const engines = new Map();

/** Generate a unique 4-digit room ID */
function generateRoomId() {
  let id;
  do {
    id = String(Math.floor(1000 + Math.random() * 9000));
  } while (rooms.has(id));
  return id;
}

/**
 * Remove a socket from its current room cleanly.
 * Handles: leaving Socket.io room, removing player, cleaning up empty/bot-only rooms.
 */
function leaveCurrentRoom(socket, io) {
  const roomId = socket.data.roomId;
  if (!roomId) return;

  const room = rooms.get(roomId);
  socket.leave(roomId);
  socket.data.roomId = null;

  if (!room) return;

  room.removePlayer(socket.id);

  // Check if any HUMAN players remain
  const humanPlayers = [...room.players.values()].filter((p) => !p.isBot);

  if (humanPlayers.length === 0) {
    // No humans left → delete room (bots can't play alone)
    const engine = engines.get(roomId);
    if (engine) {
      engine.destroy();
      engines.delete(roomId);
    }
    rooms.delete(roomId);
    console.log(`[server] 🗑️  Комната ${roomId} удалена (нет живых игроков)`);
  } else {
    // Notify remaining humans
    const roomData = buildRoomData(room);
    io.to(roomId).emit('room-updated', roomData);
    console.log(`[server] 👥 Комната ${roomId}: осталось ${humanPlayers.length} игроков (+ ${room.botPlayers.length} ботов)`);
  }
}

/**
 * Register all Socket.io event handlers.
 */
export function registerHandlers(io) {
  io.on('connection', (socket) => {
    console.log(`[server] ✅ Игрок подключился: ${socket.id}`);

    /* ───────── Create room ───────── */

    socket.on('create-room', (data) => {
      // IMPORTANT: leave any previous room first!
      leaveCurrentRoom(socket, io);

      const userId = data?.userId || socket.id;
      const maxPlayers = data?.maxPlayers || 10;
      const isPrivate = data?.isPrivate ?? true;

      const roomId = generateRoomId();
      console.log(`[server] 🏠 Создаём комнату ${roomId} (создатель: ${userId})`);

      const room = new GameRoom(roomId, socket.id, { isPrivate, maxPlayers });
      rooms.set(roomId, room);

      room.addPlayer(socket.id, {
        tgId: userId,
        name: data?.name || `Player_${userId}`,
        avatar: data?.avatar || null,
        isBot: false,
      });

      socket.join(roomId);
      socket.data.roomId = roomId;

      const roomData = buildRoomData(room);
      console.log(`[server] 📤 room-created: ${roomId}, игроков: ${room.playerCount}`);
      socket.emit('room-created', roomData);
    });

    /* ───────── Join room ───────── */

    socket.on('join-room', (data) => {
      // Leave any previous room first!
      leaveCurrentRoom(socket, io);

      const { roomId, userId, name, avatar } = data || {};
      console.log(`[server] 🚪 Игрок ${userId || socket.id} → комната ${roomId}`);

      const room = rooms.get(roomId);
      if (!room) return socket.emit('error-message', { message: 'Комната не найдена' });
      if (room.phase !== PHASE.LOBBY) return socket.emit('error-message', { message: 'Игра уже началась' });
      if (room.playerCount >= room.maxPlayers) return socket.emit('error-message', { message: 'Комната заполнена' });

      room.addPlayer(socket.id, {
        tgId: userId || socket.id,
        name: name || `Player_${socket.id.slice(0, 4)}`,
        avatar: avatar || null,
        isBot: false,
      });

      socket.join(roomId);
      socket.data.roomId = roomId;

      const roomData = buildRoomData(room);
      socket.emit('room-joined', roomData);
      io.to(roomId).emit('room-updated', roomData);
      console.log(`[server] 📤 Игрок присоединился к ${roomId}, всего: ${room.playerCount}`);
    });

    /* ───────── Leave room (explicit) ───────── */

    socket.on('leave-room', () => {
      console.log(`[server] 🚶 Игрок ${socket.id} покидает комнату`);
      leaveCurrentRoom(socket, io);
      socket.emit('room-left');
    });

    /* ───────── List rooms ───────── */

    socket.on('list-rooms', () => {
      const publicRooms = [...rooms.values()]
        .filter((r) => !r.isPrivate && r.phase === PHASE.LOBBY)
        .map((r) => ({
          roomId: r.id,
          playerCount: r.playerCount,
          maxPlayers: r.maxPlayers,
        }));
      console.log(`[server] 📋 Список комнат: ${publicRooms.length} открытых`);
      socket.emit('rooms-list', publicRooms);
    });

    /* ───────── Quick play ───────── */

    socket.on('quick-play', (data) => {
      // Leave any previous room first!
      leaveCurrentRoom(socket, io);

      const userId = data?.userId || socket.id;
      console.log(`[server] ⚡ Быстрая игра для ${userId}`);

      let room = [...rooms.values()].find(
        (r) => !r.isPrivate && r.phase === PHASE.LOBBY && r.playerCount < r.maxPlayers
      );

      if (!room) {
        const roomId = generateRoomId();
        room = new GameRoom(roomId, socket.id, { isPrivate: false });
        rooms.set(roomId, room);
        console.log(`[server] 🏠 Создана новая публичная: ${roomId}`);
      }

      room.addPlayer(socket.id, {
        tgId: userId,
        name: data?.name || `Player_${userId}`,
        avatar: data?.avatar || null,
        isBot: false,
      });

      socket.join(room.id);
      socket.data.roomId = room.id;

      const roomData = buildRoomData(room);
      socket.emit('room-joined', roomData);
      io.to(room.id).emit('room-updated', roomData);
    });

    /* ═══════════════════════════════════════
       ███  BOT MANAGEMENT
       ═══════════════════════════════════════ */

    socket.on('add-bots', () => {
      const room = getPlayerRoom(socket);
      if (!room) return socket.emit('error-message', { message: 'Вы не в комнате' });
      if (room.hostId !== socket.id) return socket.emit('error-message', { message: 'Только хост может добавлять ботов' });
      if (room.phase !== PHASE.LOBBY) return socket.emit('error-message', { message: 'Нельзя добавить ботов после старта' });

      const freeSlots = room.maxPlayers - room.playerCount;
      if (freeSlots <= 0) return socket.emit('error-message', { message: 'Стол уже полон' });

      const bots = room.fillWithBots();
      console.log(`[server] 🤖 Добавлено ${bots.length} ботов в комнату ${room.id}`);

      const roomData = buildRoomData(room);
      io.to(room.id).emit('room-updated', roomData);
    });

    socket.on('add-bot', () => {
      const room = getPlayerRoom(socket);
      if (!room) return socket.emit('error-message', { message: 'Вы не в комнате' });
      if (room.hostId !== socket.id) return socket.emit('error-message', { message: 'Только хост' });
      if (room.phase !== PHASE.LOBBY) return socket.emit('error-message', { message: 'Игра уже идёт' });

      const bot = room.addSingleBot();
      if (!bot) return socket.emit('error-message', { message: 'Стол полон' });

      console.log(`[server] 🤖 Добавлен бот ${bot.name} в комнату ${room.id}`);
      const roomData = buildRoomData(room);
      io.to(room.id).emit('room-updated', roomData);
    });

    /* ═══════════════════════════════════════
       ███  GAME FLOW
       ═══════════════════════════════════════ */

    socket.on('start-game', () => {
      const room = getPlayerRoom(socket);
      if (!room) {
        console.log(`[server] ❌ start-game: socket ${socket.id} не в комнате (roomId: ${socket.data.roomId})`);
        return socket.emit('error-message', { message: 'Вы не в комнате' });
      }
      if (room.hostId !== socket.id) {
        console.log(`[server] ❌ start-game: ${socket.id} не хост (хост: ${room.hostId})`);
        return socket.emit('error-message', { message: 'Только хост может начать' });
      }
      if (!room.canStart()) {
        console.log(`[server] ❌ start-game: недостаточно игроков (${room.playerCount})`);
        return socket.emit('error-message', { message: `Недостаточно игроков (мин. 5, сейчас: ${room.playerCount})` });
      }

      console.log(`[server] 🎮 Запуск игры в комнате ${room.id} (${room.playerCount} игроков)`);

      const engine = new GameEngine(io, room);
      engines.set(room.id, engine);
      engine.startGame();
    });

    socket.on('game:done-speaking', () => {
      const room = getPlayerRoom(socket);
      if (!room) return;
      const engine = engines.get(room.id);
      if (engine) engine.playerFinishedSpeaking(socket.id);
    });

    socket.on('game:night-action', (action) => {
      const room = getPlayerRoom(socket);
      if (!room || room.phase !== PHASE.NIGHT) return;
      const engine = engines.get(room.id);
      if (engine) engine.handleNightAction(socket.id, action);
    });

    socket.on('game:day-vote', ({ targetId }) => {
      const room = getPlayerRoom(socket);
      if (!room || (room.phase !== PHASE.VOTING && room.phase !== PHASE.DAY)) return;
      const engine = engines.get(room.id);
      if (engine) engine.handleDayVote(socket.id, targetId);
    });

    socket.on('game:chat', ({ text }) => {
      const room = getPlayerRoom(socket);
      if (!room) return;
      const player = room.getPlayer(socket.id);
      if (!player) return;

      room.phaseMessages.push({
        playerId: socket.id,
        playerName: player.name,
        text,
        timestamp: Date.now(),
      });

      io.to(room.id).emit('game:chat', {
        playerId: socket.id,
        playerName: player.name,
        text,
        isBot: false,
      });
    });

    /* ───────── Voice / Video circle messages ───────── */

    socket.on('game:media', ({ type, data, duration }) => {
      const room = getPlayerRoom(socket);
      if (!room) return;
      const player = room.getPlayer(socket.id);
      if (!player) return;

      // type: 'voice' | 'video'
      // data: ArrayBuffer (binary)
      // duration: seconds

      const msg = {
        playerId: socket.id,
        playerName: player.name,
        avatarColor: player.avatarColor,
        isBot: false,
        type,        // 'voice' or 'video'
        data,        // binary (ArrayBuffer)
        duration,
        timestamp: Date.now(),
      };

      console.log(`[server] 🎙️ ${player.name} отправил ${type} (${duration}s, ${Math.round((data?.byteLength || 0) / 1024)}KB)`);

      // Relay to all players in the room (including sender for confirmation)
      io.to(room.id).emit('game:media', msg);
    });

    /* ───────── Reactions ───────── */

    socket.on('game:reaction', ({ targetId, type }) => {
      const room = getPlayerRoom(socket);
      if (!room) return;
      io.to(room.id).emit('game:reaction', {
        from: socket.id,
        target: targetId,
        type,
      });
    });

    /* ───────── Disconnect ───────── */

    socket.on('disconnect', () => {
      console.log(`[server] ❌ Игрок отключился: ${socket.id}`);
      leaveCurrentRoom(socket, io);
    });
  });
}

/* ───────── Helpers ───────── */

function getPlayerRoom(socket) {
  const roomId = socket.data.roomId;
  return roomId ? rooms.get(roomId) : null;
}

function buildRoomData(room) {
  return {
    roomId: room.id,
    players: serializePlayers(room),
    maxPlayers: room.maxPlayers,
    phase: room.phase,
    isPrivate: room.isPrivate,
    narratorMessage: room.narratorMessage,
    narratorSub: room.narratorSub,
  };
}

function serializePlayers(room) {
  return [...room.players.values()].map((p) => ({
    id: p.id,
    tgId: p.tgId,
    name: p.name,
    avatar: p.avatar,
    avatarColor: p.avatarColor || null,
    seat: p.seat,
    alive: p.alive,
    isBot: p.isBot,
    isAdmin: p.id === room.hostId,
  }));
}
