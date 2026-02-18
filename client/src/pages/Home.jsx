import { useState } from 'react';
import { motion } from 'framer-motion';
import { Zap, List, Plus, Users, Lock, ArrowRight, Loader2 } from 'lucide-react';
import { useGameStore } from '../stores/gameStore';
import { socket } from '../lib/socket';
import RoomList from '../components/RoomList';
import CreateRoom from '../components/CreateRoom';

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.12, delayChildren: 0.3 },
  },
};

const item = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
};

export default function Home() {
  const [view, setView] = useState('home'); // 'home' | 'rooms' | 'create'
  const [loading, setLoading] = useState(false);
  const quickPlay = useGameStore((s) => s.quickPlay);
  const connected = useGameStore((s) => s.connected);

  const handleQuickPlay = () => {
    if (!socket.connected) {
      alert('Нет подключения к серверу');
      return;
    }
    setLoading(true);
    console.log('[Home] ⚡ Быстрая игра...');
    quickPlay();
    // Navigation happens via room-joined event in App.jsx
    setTimeout(() => setLoading(false), 5000);
  };

  if (view === 'rooms') return <RoomList onBack={() => setView('home')} />;
  if (view === 'create') return <CreateRoom onBack={() => setView('home')} />;

  return (
    <div className="relative flex flex-col h-full px-6 pb-8 pt-12 overflow-hidden">
      {/* Noise texture overlay */}
      <div className="noise" />

      {/* Ambient glow orbs */}
      <div className="absolute -top-32 -left-32 w-80 h-80 bg-blood-600/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-blood-700/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-60 h-60 bg-gold-500/5 rounded-full blur-[100px] pointer-events-none" />

      {/* Content */}
      <motion.div
        className="relative z-10 flex flex-col h-full"
        variants={container}
        initial="hidden"
        animate="show"
      >
        {/* Header */}
        <motion.div variants={item} className="mb-4">
          <h1 className="font-display text-5xl font-extrabold tracking-tight leading-none">
            <span className="text-white">МА</span>
            <span className="text-blood-500">ФИЯ</span>
          </h1>
          <p className="mt-2 text-noir-400 text-sm font-medium tracking-wide uppercase">
            Telegram Mini App
          </p>
        </motion.div>

        {/* Decorative line */}
        <motion.div variants={item} className="mb-8">
          <div className="h-px w-16 bg-gradient-to-r from-blood-600/60 to-transparent" />
        </motion.div>

        {/* Tagline */}
        <motion.p
          variants={item}
          className="text-noir-300 text-base leading-relaxed mb-10 max-w-[280px]"
        >
          Классическая мафия с видео-кружочками. Блефуй, раскрывай, побеждай.
        </motion.p>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Connection indicator */}
        <motion.div variants={item} className="flex items-center gap-2 mb-4 px-1">
          <div className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-500' : 'bg-red-500'} animate-pulse`} />
          <span className="text-xs text-noir-500">
            {connected ? 'Подключено' : 'Подключение к серверу...'}
          </span>
        </motion.div>

        {/* Action buttons */}
        <motion.div variants={item} className="space-y-3">
          {/* Quick Play */}
          <button
            onClick={handleQuickPlay}
            disabled={loading || !connected}
            className="glass-button-primary w-full group disabled:opacity-40"
          >
            <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-blood-600/20 text-blood-400 group-hover:bg-blood-600/30 transition-colors">
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Zap className="w-5 h-5" />
              )}
            </div>
            <div className="flex-1 text-left">
              <div className="font-semibold text-white text-[15px]">Быстрая игра</div>
              <div className="text-xs text-noir-400 mt-0.5">Случайный стол</div>
            </div>
            <ArrowRight className="w-4 h-4 text-noir-500 group-hover:text-blood-400 group-hover:translate-x-1 transition-all" />
          </button>

          {/* Room list */}
          <button
            onClick={() => setView('rooms')}
            className="glass-button w-full group"
          >
            <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-white/5 text-noir-300 group-hover:bg-white/10 transition-colors">
              <List className="w-5 h-5" />
            </div>
            <div className="flex-1 text-left">
              <div className="font-semibold text-white text-[15px]">Список столов</div>
              <div className="text-xs text-noir-400 mt-0.5">Открытые комнаты</div>
            </div>
            <ArrowRight className="w-4 h-4 text-noir-500 group-hover:text-white group-hover:translate-x-1 transition-all" />
          </button>

          {/* Create room */}
          <button
            onClick={() => setView('create')}
            className="glass-button-gold w-full group"
          >
            <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-gold-500/10 text-gold-400 group-hover:bg-gold-500/20 transition-colors">
              <Plus className="w-5 h-5" />
            </div>
            <div className="flex-1 text-left">
              <div className="font-semibold text-white text-[15px]">Создать стол</div>
              <div className="text-xs text-noir-400 mt-0.5">Приватная комната</div>
            </div>
            <ArrowRight className="w-4 h-4 text-noir-500 group-hover:text-gold-400 group-hover:translate-x-1 transition-all" />
          </button>
        </motion.div>

        {/* Footer */}
        <motion.div variants={item} className="mt-6 flex items-center justify-center gap-2">
          <Users className="w-3.5 h-3.5 text-noir-600" />
          <span className="text-xs text-noir-600">5–10 игроков</span>
          <span className="text-noir-700 mx-1">·</span>
          <Lock className="w-3.5 h-3.5 text-noir-600" />
          <span className="text-xs text-noir-600">E2E шифрование</span>
        </motion.div>
      </motion.div>
    </div>
  );
}
