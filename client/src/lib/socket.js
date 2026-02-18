import { io } from 'socket.io-client';

// In dev mode, Vite proxy forwards /socket.io → localhost:3001.
// In production, set VITE_WS_URL to the real server URL.
const URL = import.meta.env.VITE_WS_URL || 'http://localhost:3001';

console.log('[socket] Инициализация, URL:', URL);

export const socket = io(URL, {
  autoConnect: false,
  transports: ['websocket', 'polling'],
});

// Global debug listeners
socket.on('connect', () => {
  console.log('[socket] ✅ Подключено! id:', socket.id);
});

socket.on('connect_error', (err) => {
  console.error('[socket] ❌ Ошибка подключения:', err.message);
});

socket.on('disconnect', (reason) => {
  console.log('[socket] ❌ Отключено. Причина:', reason);
});
