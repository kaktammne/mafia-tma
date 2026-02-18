import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Users, RefreshCw, Wifi } from 'lucide-react';
import { useGameStore } from '../stores/gameStore';

const listItem = {
  hidden: { opacity: 0, x: -12 },
  show: { opacity: 1, x: 0 },
};

export default function RoomList({ onBack }) {
  const rooms = useGameStore((s) => s.rooms);
  const fetchRooms = useGameStore((s) => s.fetchRooms);
  const joinRoom = useGameStore((s) => s.joinRoom);

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  return (
    <div className="relative flex flex-col h-full px-6 pb-8 pt-8 overflow-hidden">
      <div className="noise" />
      <div className="absolute -top-32 -left-32 w-80 h-80 bg-blood-600/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative z-10 flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={onBack}
            className="flex items-center justify-center w-10 h-10 rounded-xl glass hover:border-white/20 transition-all"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div className="flex-1">
            <h2 className="font-display text-2xl font-bold text-white">Столы</h2>
            <p className="text-xs text-noir-400 mt-0.5">Открытые комнаты</p>
          </div>
          <button
            onClick={fetchRooms}
            className="flex items-center justify-center w-10 h-10 rounded-xl glass hover:border-white/20 transition-all active:scale-95"
          >
            <RefreshCw className="w-4 h-4 text-noir-300" />
          </button>
        </div>

        {/* List */}
        <motion.div
          className="flex-1 overflow-y-auto space-y-2 pr-1"
          initial="hidden"
          animate="show"
          variants={{ show: { transition: { staggerChildren: 0.06 } } }}
        >
          {rooms.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Wifi className="w-10 h-10 text-noir-700 mb-3" />
              <p className="text-noir-500 text-sm">Нет открытых комнат</p>
              <p className="text-noir-600 text-xs mt-1">
                Создайте свой стол или попробуйте &laquo;Быструю игру&raquo;
              </p>
            </div>
          ) : (
            rooms.map((room) => (
              <motion.button
                key={room.roomId}
                variants={listItem}
                onClick={() => joinRoom(room.roomId)}
                className="glass-button w-full group"
              >
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-white/5 text-noir-300">
                  <Users className="w-4 h-4" />
                </div>
                <div className="flex-1 text-left">
                  <div className="font-medium text-white text-sm">Стол #{room.roomId}</div>
                  <div className="text-xs text-noir-400 mt-0.5">
                    {room.playerCount}/{room.maxPlayers} игроков
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs text-noir-400">Live</span>
                </div>
              </motion.button>
            ))
          )}
        </motion.div>
      </div>
    </div>
  );
}
