import { create } from 'zustand';
import { socket } from '../lib/socket';

/**
 * Main game store (Zustand).
 *
 * Manages: connection state, room list, current room state, and player info.
 */
export const useGameStore = create((set, get) => ({
  /* ── Connection ── */
  connected: false,
  setConnected: (v) => set({ connected: v }),

  /* ── User ── */
  userData: null,
  setUserData: (data) => set({ userData: data }),

  /* ── Room list ── */
  rooms: [],
  setRooms: (rooms) => set({ rooms }),
  fetchRooms: () => {
    console.log('[store] 📋 Запрашиваем список комнат...');
    socket.emit('list-rooms');
  },

  /* ── Current game state ── */
  gameState: null,
  setGameState: (state) => set({ gameState: state }),

  currentRoom: null,
  setCurrentRoom: (roomId) => set({ currentRoom: roomId }),

  /* ── Actions ── */

  quickPlay: () => {
    const { userData } = get();
    console.log('[store] ⚡ Быстрая игра:', userData);
    socket.emit('quick-play', {
      userId: userData?.tgId,
      name: userData?.name,
      avatar: userData?.avatar,
    });
  },

  createRoom: (isPrivate = true, maxPlayers = 10) => {
    const { userData } = get();
    const payload = {
      userId: userData?.tgId,
      name: userData?.name,
      avatar: userData?.avatar,
      isPrivate,
      maxPlayers,
    };
    console.log('[store] 🏠 Создаём комнату:', payload);
    socket.emit('create-room', payload);
  },

  joinRoom: (roomId) => {
    const { userData } = get();
    console.log('[store] 🚪 Входим в комнату:', roomId);
    socket.emit('join-room', {
      roomId,
      userId: userData?.tgId,
      name: userData?.name,
      avatar: userData?.avatar,
    });
  },

  startGame: () => {
    console.log('[store] 🎮 Запускаем игру');
    socket.emit('start-game');
  },

  addBots: () => {
    console.log('[store] 🤖 Заполняем стол ботами');
    socket.emit('add-bots');
  },

  addBot: () => {
    console.log('[store] 🤖 Добавляем одного бота');
    socket.emit('add-bot');
  },

  doneSpeaking: () => {
    console.log('[store] 🎤 Закончил говорить');
    socket.emit('game:done-speaking');
  },

  nightAction: (targetId) => {
    console.log('[store] 🌙 Ночное действие →', targetId);
    socket.emit('game:night-action', { targetId });
  },

  dayVote: (targetId) => {
    console.log('[store] 🗳️ Голос за', targetId);
    socket.emit('game:day-vote', { targetId });
  },

  sendChat: (text) => {
    socket.emit('game:chat', { text });
  },

  sendReaction: (targetId, type) => {
    socket.emit('game:reaction', { targetId, type });
  },

  /* ── Media (voice/video) ── */
  sendMedia: (type, blob, duration) => {
    // Convert Blob → ArrayBuffer for Socket.io binary transport
    blob.arrayBuffer().then((buffer) => {
      socket.emit('game:media', { type, data: buffer, duration });
    });
  },

  /* ── Chat messages (text + media) ── */
  chatMessages: [],
  addChatMessage: (msg) => set((s) => ({ chatMessages: [...s.chatMessages, msg] })),
  addMediaMessage: (msg) => {
    // Convert ArrayBuffer → Blob URL for playback
    const mimeType = msg.type === 'voice' ? 'audio/webm' : 'video/webm';
    const blob = new Blob([msg.data], { type: mimeType });
    const blobUrl = URL.createObjectURL(blob);
    set((s) => ({
      chatMessages: [...s.chatMessages, {
        ...msg,
        blobUrl,
        mediaType: msg.type, // 'voice' or 'video'
      }],
    }));
  },
  clearChat: () => set({ chatMessages: [] }),

  /* ── Vote tracking ── */
  votes: [],
  addVote: (vote) => set((s) => ({ votes: [...s.votes, vote] })),
  clearVotes: () => set({ votes: [] }),

  /* ── Reset (leave room) ── */
  reset: () => {
    console.log('[store] 🔄 Выход из комнаты');
    // IMPORTANT: tell the server to leave the room!
    socket.emit('leave-room');
    set({
      gameState: null,
      currentRoom: null,
      chatMessages: [],
      votes: [],
    });
  },
}));
