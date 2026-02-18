import { useEffect } from 'react';
import { useGameStore } from './stores/gameStore';
import { socket } from './lib/socket';
import { initTelegram, getTelegramUser, getStartParam } from './lib/telegram';
import Home from './pages/Home';
import GameLobby from './components/GameLobby';

export default function App() {
  const setConnected = useGameStore((s) => s.setConnected);
  const setUserData = useGameStore((s) => s.setUserData);
  const setGameState = useGameStore((s) => s.setGameState);
  const setCurrentRoom = useGameStore((s) => s.setCurrentRoom);
  const gameState = useGameStore((s) => s.gameState);
  const currentRoom = useGameStore((s) => s.currentRoom);

  useEffect(() => {
    // Telegram WebApp init
    initTelegram();

    // Set user data from Telegram (or dev fallback)
    const user = getTelegramUser();
    setUserData(user);
    console.log('[app] 👤 User data:', user);

    // Connect socket (only if not already connected)
    if (!socket.connected) {
      console.log('[app] 🔌 Подключаемся к серверу...');
      socket.connect();
    }

    // ── Connection events ──

    const onConnect = () => {
      console.log('[app] ✅ Socket подключён:', socket.id);
      setConnected(true);

      // Auto-join room from invite link (t.me/themafiaclub_bot/play?startapp=ROOM_ID)
      const inviteRoomId = getStartParam();
      if (inviteRoomId && !useGameStore.getState().currentRoom) {
        console.log('[app] 🔗 Приглашение в комнату:', inviteRoomId);
        useGameStore.getState().joinRoom(inviteRoomId);
      }
    };

    const onDisconnect = () => {
      console.log('[app] ❌ Socket отключён');
      setConnected(false);
    };

    // ── Room events ──

    const onRoomCreated = (data) => {
      console.log('[app] 🏠 Комната создана!', data.roomId);
      setCurrentRoom(data.roomId);
      setGameState(data);
    };

    const onRoomJoined = (data) => {
      console.log('[app] 🚪 Вошли в комнату!', data.roomId);
      setCurrentRoom(data.roomId);
      setGameState(data);
    };

    const onRoomUpdated = (data) => {
      // IMPORTANT: only accept updates for OUR current room
      const myRoom = useGameStore.getState().currentRoom;
      if (myRoom && data.roomId !== myRoom) {
        console.warn(`[app] ⚠️ Игнорируем room-updated для чужой комнаты ${data.roomId} (мы в ${myRoom})`);
        return;
      }
      console.log('[app] 🔄 Комната обновлена:', data.roomId, 'игроков:', data.players?.length);
      setGameState(data);
    };

    const onRoomLeft = () => {
      console.log('[app] 🚶 Вышли из комнаты');
    };

    const onRoomsList = (list) => {
      console.log('[app] 📋 Список комнат:', list.length);
      useGameStore.getState().setRooms(list);
    };

    const onErrorMessage = (data) => {
      console.error('[app] ⚠️ Ошибка от сервера:', data.message);
      alert(data.message);
    };

    // ── Game events ──

    const onGameState = (state) => {
      // Validate this is for our room
      const myRoom = useGameStore.getState().currentRoom;
      if (myRoom && state.roomId !== myRoom) {
        console.warn(`[app] ⚠️ Игнорируем game:state для ${state.roomId} (мы в ${myRoom})`);
        return;
      }
      // Clear chat/votes when phase changes
      const prevPhase = useGameStore.getState().gameState?.phase;
      if (prevPhase && prevPhase !== state.phase) {
        console.log(`[app] 🔄 Фаза: ${prevPhase} → ${state.phase}`);
        useGameStore.getState().clearChat();
        useGameStore.getState().clearVotes();
      }
      console.log('[app] 🎮 game:state phase:', state.phase, 'narrator:', state.narratorMessage);
      setGameState(state);
    };

    const onGameChat = (msg) => {
      console.log(`[app] 💬 ${msg.playerName}: ${msg.text}`);
      useGameStore.getState().addChatMessage(msg);
    };

    const onVoteCast = (vote) => {
      console.log(`[app] 🗳️ ${vote.voterName} → ${vote.targetName}`);
      useGameStore.getState().addVote(vote);
    };

    const onVoteResult = (result) => {
      console.log('[app] 🗳️ Результат:', result);
    };

    const onNightResult = (result) => {
      console.log('[app] 🌙 Ночь:', result);
    };

    const onMafiaChat = (msg) => {
      console.log(`[app] 🔪 Мафия: ${msg.playerName}: ${msg.text}`);
      useGameStore.getState().addChatMessage({ ...msg, isMafia: true });
    };

    const onSheriffResult = (result) => {
      console.log(`[app] 🔍 Шериф: ${result.targetName} — ${result.isMafia ? 'МАФИЯ' : 'мирный'}`);
    };

    const onGameOver = (result) => {
      console.log(`[app] 🏆 Игра окончена! Победа: ${result.winner}`);
    };

    const onGameMedia = (msg) => {
      console.log(`[app] 🎙️ ${msg.playerName} прислал ${msg.type} (${msg.duration}s)`);
      useGameStore.getState().addMediaMessage(msg);
    };

    // Register all listeners
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('room-created', onRoomCreated);
    socket.on('room-joined', onRoomJoined);
    socket.on('room-updated', onRoomUpdated);
    socket.on('room-left', onRoomLeft);
    socket.on('rooms-list', onRoomsList);
    socket.on('error-message', onErrorMessage);
    socket.on('game:state', onGameState);
    socket.on('game:chat', onGameChat);
    socket.on('game:vote-cast', onVoteCast);
    socket.on('game:vote-result', onVoteResult);
    socket.on('game:night-result', onNightResult);
    socket.on('game:mafia-chat', onMafiaChat);
    socket.on('game:sheriff-result', onSheriffResult);
    socket.on('game:over', onGameOver);
    socket.on('game:media', onGameMedia);

    return () => {
      // Remove specific listener references (not all listeners!)
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('room-created', onRoomCreated);
      socket.off('room-joined', onRoomJoined);
      socket.off('room-updated', onRoomUpdated);
      socket.off('room-left', onRoomLeft);
      socket.off('rooms-list', onRoomsList);
      socket.off('error-message', onErrorMessage);
      socket.off('game:state', onGameState);
      socket.off('game:chat', onGameChat);
      socket.off('game:vote-cast', onVoteCast);
      socket.off('game:vote-result', onVoteResult);
      socket.off('game:night-result', onNightResult);
      socket.off('game:mafia-chat', onMafiaChat);
      socket.off('game:sheriff-result', onSheriffResult);
      socket.off('game:over', onGameOver);
      socket.off('game:media', onGameMedia);
      // DON'T disconnect socket here — StrictMode calls cleanup then re-mounts
    };
  }, [setConnected, setUserData, setGameState, setCurrentRoom]);

  // Route based on state
  if (currentRoom && gameState) {
    return <GameLobby />;
  }

  return <Home />;
}
