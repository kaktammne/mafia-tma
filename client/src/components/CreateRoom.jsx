import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Copy, Share2, Users, Loader2 } from 'lucide-react';
import { useGameStore } from '../stores/gameStore';
import { shareInviteLink } from '../lib/telegram';
import { socket } from '../lib/socket';

export default function CreateRoom({ onBack }) {
  const [maxPlayers, setMaxPlayers] = useState(10);
  const [isPrivate, setIsPrivate] = useState(true);
  const [loading, setLoading] = useState(false);
  const userData = useGameStore((s) => s.userData);

  const handleCreate = () => {
    if (!socket.connected) {
      console.error('[CreateRoom] ❌ Сокет не подключён!');
      alert('Нет подключения к серверу. Попробуйте обновить страницу.');
      return;
    }

    setLoading(true);

    const payload = {
      userId: userData?.tgId || socket.id,
      name: userData?.name || 'Аноним',
      avatar: userData?.avatar || null,
      maxPlayers,
      isPrivate,
    };

    console.log('[CreateRoom] 📤 Отправляем create-room:', payload);
    socket.emit('create-room', payload);

    // room-created event is handled in App.jsx → navigates to GameLobby
    // If no response in 5s, stop loading
    setTimeout(() => setLoading(false), 5000);
  };

  return (
    <div className="relative flex flex-col h-full px-6 pb-8 pt-8 overflow-hidden">
      <div className="noise" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-gold-500/10 rounded-full blur-[140px] pointer-events-none" />

      <div className="relative z-10 flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={onBack}
            className="flex items-center justify-center w-10 h-10 rounded-xl glass hover:border-white/20 transition-all"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div>
            <h2 className="font-display text-2xl font-bold text-white">Новый стол</h2>
            <p className="text-xs text-noir-400 mt-0.5">Настройте комнату</p>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Max players */}
          <div className="glass p-5">
            <label className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-noir-400" />
                Макс. игроков
              </span>
              <span className="text-2xl font-bold font-display text-gold-400">{maxPlayers}</span>
            </label>
            <input
              type="range"
              min={5}
              max={10}
              value={maxPlayers}
              onChange={(e) => setMaxPlayers(Number(e.target.value))}
              className="w-full accent-gold-500"
            />
            <div className="flex justify-between mt-1 text-xs text-noir-500">
              <span>5</span>
              <span>10</span>
            </div>
          </div>

          {/* Private toggle */}
          <div className="glass p-5 flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-white">Приватная комната</div>
              <div className="text-xs text-noir-400 mt-0.5">Только по приглашению</div>
            </div>
            <button
              onClick={() => setIsPrivate(!isPrivate)}
              className={`relative w-12 h-7 rounded-full transition-colors ${
                isPrivate ? 'bg-gold-500' : 'bg-noir-700'
              }`}
            >
              <div
                className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${
                  isPrivate ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>

          {/* Connection status */}
          <div className="flex items-center gap-2 px-1">
            <div className={`w-2 h-2 rounded-full ${socket.connected ? 'bg-emerald-500' : 'bg-red-500'} animate-pulse`} />
            <span className="text-xs text-noir-500">
              {socket.connected ? 'Подключено к серверу' : 'Нет подключения к серверу'}
            </span>
          </div>

          {/* Create button */}
          <button
            onClick={handleCreate}
            disabled={loading}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-gold-500 to-gold-400 text-noir-950 font-bold text-[15px] flex items-center justify-center gap-2 hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Создаём...
              </>
            ) : (
              'Создать стол'
            )}
          </button>
        </motion.div>
      </div>
    </div>
  );
}
