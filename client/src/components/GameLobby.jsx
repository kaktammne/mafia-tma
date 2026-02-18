import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play, Share2, LogOut, Copy, Bot, UserPlus,
  Skull, Shield, Search, Heart,
  MessageCircle, Send, Mic, Video,
} from 'lucide-react';
import { useGameStore } from '../stores/gameStore';
import { shareInviteLink } from '../lib/telegram';
import { socket } from '../lib/socket';
import VoiceRecorder from './VoiceRecorder';
import VideoCircleRecorder from './VideoCircleRecorder';

/* ═══════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════ */

const ROLE_LABELS = {
  mafia: 'Мафия', don: 'Дон', sheriff: 'Шериф',
  doctor: 'Доктор', civilian: 'Мирный житель',
};
const ROLE_COLORS = {
  mafia: 'from-red-600 to-red-800', don: 'from-red-700 to-purple-900',
  sheriff: 'from-blue-500 to-blue-700', doctor: 'from-emerald-500 to-emerald-700',
  civilian: 'from-slate-500 to-slate-700',
};
const ROLE_EMOJI = {
  mafia: '🔪', don: '🎩', sheriff: '🔍', doctor: '💊', civilian: '🏠',
};
const ROLE_ICONS = { mafia: Skull, don: Skull, sheriff: Search, doctor: Heart, civilian: Shield };

/* ═══════════════════════════════════════════════════
   MATH: elliptical seat positions
   ═══════════════════════════════════════════════════ */

function getSeatPositions(count, rx, ry, cx, cy) {
  return Array.from({ length: count }, (_, i) => {
    const a = -Math.PI / 2 + (2 * Math.PI * i) / count;
    return { x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) };
  });
}

/* ═══════════════════════════════════════════════════
   SEAT
   ═══════════════════════════════════════════════════ */

function Seat({ player, index, x, y, isMe, isSpeaking, isDead, phase }) {
  const showRole = isMe && player?.role && phase !== 'lobby';
  const size = 44;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0 }}
      transition={{ delay: index * 0.035, type: 'spring', stiffness: 300, damping: 22 }}
      className="absolute flex flex-col items-center"
      style={{ left: x, top: y, transform: 'translate(-50%, -50%)' }}
    >
      {/* Glow ring for speaker */}
      {isSpeaking && player && (
        <motion.div
          className="absolute rounded-full"
          style={{ inset: -6 }}
          animate={{ scale: [1, 1.12, 1], opacity: [0.5, 0.9, 0.5] }}
          transition={{ repeat: Infinity, duration: 1.3 }}
        >
          <div className="w-full h-full rounded-full" style={{
            background: 'conic-gradient(from 0deg, rgba(234,179,8,0.6), rgba(251,146,60,0.4), rgba(234,179,8,0.6))',
            filter: 'blur(4px)',
          }} />
        </motion.div>
      )}

      {/* Avatar */}
      <div
        className={[
          `relative flex items-center justify-center rounded-full transition-all duration-300`,
          !player && 'border border-dashed border-white/[0.08]',
          player && isDead && 'grayscale opacity-30',
          player && isMe && !isSpeaking && 'ring-[1.5px] ring-gold-400/60 ring-offset-1 ring-offset-noir-950',
          player && isSpeaking && 'ring-2 ring-yellow-400 ring-offset-1 ring-offset-noir-950',
          player && !isMe && !isSpeaking && 'ring-[0.5px] ring-white/[0.07]',
        ].filter(Boolean).join(' ')}
        style={{
          width: size, height: size,
          background: player
            ? player.avatarColor
              ? `linear-gradient(145deg, ${player.avatarColor}55, ${player.avatarColor}20)`
              : 'linear-gradient(145deg, rgba(255,255,255,0.07), rgba(255,255,255,0.02))'
            : 'rgba(255,255,255,0.015)',
        }}
      >
        {player ? (
          <>
            {player.avatar ? (
              <img src={player.avatar} alt="" className="w-full h-full rounded-full object-cover" />
            ) : player.isBot ? (
              <Bot className="w-[18px] h-[18px] text-violet-300/80" />
            ) : (
              <span className="text-[15px] font-semibold text-white/80 select-none">
                {player.name?.[0]?.toUpperCase()}
              </span>
            )}
            {isDead && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Skull className="w-4 h-4 text-red-500/70" />
              </div>
            )}
            {player.isAdmin && (
              <span className="absolute -top-1.5 -right-0.5 text-[10px] leading-none">👑</span>
            )}
            {player.isBot && (
              <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 px-[5px] py-[1px] rounded-full bg-violet-500/70 text-[6px] font-extrabold text-white tracking-widest leading-none">AI</div>
            )}
          </>
        ) : (
          <span className="text-white/[0.12] text-sm select-none">+</span>
        )}
      </div>

      {/* Name */}
      {player && (
        <span className={[
          'mt-1 text-[8px] font-medium leading-none max-w-[56px] truncate text-center',
          isDead && 'text-red-400/50 line-through',
          !isDead && isMe && 'text-gold-400/90',
          !isDead && !isMe && player.isBot && 'text-violet-300/60',
          !isDead && !isMe && !player.isBot && 'text-white/30',
        ].filter(Boolean).join(' ')}>
          {isMe ? 'Вы' : player.name?.split('_').pop() || player.name}
        </span>
      )}

      {/* Role chip */}
      {showRole && !isDead && (
        <div className={`mt-[2px] px-1.5 py-[1px] rounded text-[6px] font-bold text-white/90 bg-gradient-to-r ${ROLE_COLORS[player.role] || 'from-slate-600 to-slate-700'}`}>
          {ROLE_EMOJI[player.role]} {ROLE_LABELS[player.role]}
        </div>
      )}
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════
   NARRATOR (center of table)
   ═══════════════════════════════════════════════════ */

const PHASE_ICON = {
  lobby: '🎭', dealing: '🃏', introduction: '🎤',
  night: '🌙', day: '☀️', voting: '🗳️', game_over: '🏆',
};

function Narrator({ message, sub, phase }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10">
      <motion.div
        key={phase}
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-11 h-11 rounded-full flex items-center justify-center mb-1"
        style={{
          background: 'radial-gradient(circle at 40% 35%, rgba(255,255,255,0.06), rgba(0,0,0,0.3))',
          boxShadow: '0 2px 12px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)',
        }}
      >
        <span className="text-lg select-none">{PHASE_ICON[phase] || '🎭'}</span>
      </motion.div>

      <div className="px-2 py-[2px] rounded-full bg-black/40 border border-white/[0.05] backdrop-blur-sm">
        <span className="text-[7px] font-bold text-white/30 uppercase tracking-[0.15em] select-none">Ведущий</span>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={message}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.25 }}
          className="mt-1.5 px-3 py-1.5 rounded-xl bg-black/50 border border-white/[0.06] backdrop-blur-md max-w-[180px] text-center"
        >
          <p className="text-[10px] font-semibold text-white/90 leading-snug">{message}</p>
          {sub && <p className="text-[8px] text-white/30 mt-0.5 leading-snug">{sub}</p>}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   ROLE CARD REVEAL
   ═══════════════════════════════════════════════════ */

function RoleCard({ role, onClose }) {
  if (!role) return null;
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ rotateY: 180, scale: 0.5 }}
        animate={{ rotateY: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 20, delay: 0.15 }}
        className="relative w-52 h-72 cursor-pointer"
        style={{ perspective: 1000 }}
        onClick={onClose}
      >
        <div className={`w-full h-full rounded-3xl bg-gradient-to-b ${ROLE_COLORS[role] || 'from-slate-600 to-slate-800'} border border-white/20 shadow-2xl flex flex-col items-center justify-center gap-3 p-5`}>
          <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center">
            <span className="text-4xl">{ROLE_EMOJI[role]}</span>
          </div>
          <h3 className="text-xl font-display font-bold text-white">{ROLE_LABELS[role]}</h3>
          <p className="text-xs text-white/50 text-center leading-snug">
            {role === 'mafia' || role === 'don' ? 'Убивайте мирных. Не попадитесь.' :
             role === 'sheriff' ? 'Найдите мафию. Проверяйте игроков.' :
             role === 'doctor' ? 'Спасайте жизни. Лечите раненых.' :
             'Вычислите мафию. Голосуйте верно.'}
          </p>
          <p className="text-[10px] text-white/20 mt-2">Нажмите, чтобы закрыть</p>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════
   NIGHT ACTION OVERLAY
   ═══════════════════════════════════════════════════ */

function NightOverlay({ myRole, alivePlayers, me, onAction }) {
  const isMafia = myRole === 'mafia' || myRole === 'don';
  const isDoctor = myRole === 'doctor';
  const isSheriff = myRole === 'sheriff';
  const hasAction = isMafia || isDoctor || isSheriff;
  const [sel, setSel] = useState(null);
  const [done, setDone] = useState(false);
  const label = isMafia ? 'Убить' : isDoctor ? 'Лечить' : isSheriff ? 'Проверить' : '';
  const targets = alivePlayers.filter(p => p.id !== me?.id);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-20 pointer-events-auto">
      <div className="absolute inset-0 bg-gradient-to-b from-indigo-950/50 to-black/60 rounded-[50%]" />
      {hasAction && !done ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 z-30">
          <p className="text-[9px] text-white/40 font-medium uppercase tracking-wider">{label} кого?</p>
          <div className="flex flex-wrap gap-1 justify-center max-w-[180px]">
            {targets.map(p => (
              <button key={p.id} onClick={() => setSel(p.id)}
                className={`px-2 py-1 rounded-lg text-[9px] font-medium transition-all ${sel === p.id ? 'bg-red-500/30 text-white ring-1 ring-red-400' : 'bg-white/5 text-white/50 hover:bg-white/10'}`}
              >{p.name?.split('_').pop()}</button>
            ))}
          </div>
          {sel && (
            <motion.button initial={{ scale: 0 }} animate={{ scale: 1 }}
              onClick={() => { onAction(sel); setDone(true); }}
              className="mt-1 px-4 py-1.5 rounded-xl bg-red-600 text-white text-[10px] font-bold active:scale-95 transition-all"
            >{label}</motion.button>
          )}
        </div>
      ) : done ? (
        <div className="absolute inset-0 flex items-center justify-center z-30">
          <p className="text-[10px] text-white/30">Ожидайте утра...</p>
        </div>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center z-30">
          <motion.p animate={{ opacity: [0.2, 0.6, 0.2] }} transition={{ repeat: Infinity, duration: 2 }} className="text-[10px] text-white/30">
            Вы спите...
          </motion.p>
        </div>
      )}
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════
   VOTING PANEL
   ═══════════════════════════════════════════════════ */

function VotingPanel({ alivePlayers, me, onVote, votes }) {
  const [myVote, setMyVote] = useState(null);
  const targets = alivePlayers.filter(p => p.id !== me?.id);
  const counts = {};
  votes.forEach(v => { counts[v.targetId] = (counts[v.targetId] || 0) + 1; });

  return (
    <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
      {targets.map(p => (
        <button key={p.id} disabled={!!myVote}
          onClick={() => { setMyVote(p.id); onVote(p.id); }}
          className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-left transition-all
            ${myVote === p.id ? 'bg-red-500/15 ring-1 ring-red-400/50' : 'bg-white/[0.03] hover:bg-white/[0.06]'}
            ${myVote && myVote !== p.id ? 'opacity-30' : ''} disabled:cursor-default`}
        >
          <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white/70 shrink-0"
            style={{ background: p.avatarColor ? `linear-gradient(135deg,${p.avatarColor}40,${p.avatarColor}15)` : 'rgba(255,255,255,0.05)' }}>
            {p.isBot ? <Bot className="w-3 h-3 text-violet-300/70" /> : p.name?.[0]?.toUpperCase()}
          </div>
          <span className="text-[10px] text-white/70 font-medium flex-1 truncate">{p.name?.split('_').pop()}</span>
          {counts[p.id] > 0 && <span className="text-[9px] text-red-400/80 font-bold">{counts[p.id]}</span>}
          {myVote === p.id && <span className="text-[10px] text-red-400">✓</span>}
        </button>
      ))}
      {!myVote && (
        <button onClick={() => { setMyVote('skip'); onVote('skip'); }}
          className="w-full px-2.5 py-1.5 rounded-xl bg-white/[0.02] text-[10px] text-white/20 hover:bg-white/[0.05] transition-all">
          Пропустить
        </button>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   VOICE / VIDEO BUBBLES
   ═══════════════════════════════════════════════════ */

function VoiceBubble({ blobUrl, duration }) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef(null);
  const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;

  return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded-xl bg-emerald-500/[0.07] border border-emerald-500/[0.12] max-w-[180px]">
      <audio ref={audioRef} src={blobUrl}
        onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setProgress(0); }}
        onTimeUpdate={(e) => { const a = e.currentTarget; setProgress(a.duration ? a.currentTime / a.duration : 0); }}
      />
      <button onClick={() => { const a = audioRef.current; playing ? a?.pause() : a?.play().catch(() => {}); }}
        className="w-6 h-6 rounded-full bg-emerald-500/15 flex items-center justify-center shrink-0">
        {playing
          ? <div className="flex gap-[1.5px]"><div className="w-[1.5px] h-2.5 bg-emerald-400 rounded-full" /><div className="w-[1.5px] h-2.5 bg-emerald-400 rounded-full" /></div>
          : <div className="w-0 h-0 border-t-[4px] border-b-[4px] border-l-[7px] border-transparent border-l-emerald-400 ml-0.5" />}
      </button>
      <div className="flex-1 h-3 flex items-center gap-[1.5px]">
        {Array.from({ length: 18 }).map((_, i) => (
          <div key={i} className={`w-[1.5px] rounded-full transition-colors ${i / 18 <= progress ? 'bg-emerald-400' : 'bg-emerald-400/20'}`}
            style={{ height: Math.max(2, Math.sin((i / 18) * Math.PI) * 10 + 2) }} />
        ))}
      </div>
      <span className="text-[8px] text-emerald-400/50 font-mono shrink-0">{fmt(duration || 0)}</span>
    </div>
  );
}

function VideoCircleBubble({ blobUrl, duration }) {
  const [playing, setPlaying] = useState(false);
  const vRef = useRef(null);
  const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;

  return (
    <div className="relative inline-block cursor-pointer" onClick={() => { const v = vRef.current; playing ? v?.pause() : v?.play().catch(() => {}); }}>
      <div className="w-14 h-14 rounded-full overflow-hidden border border-blue-400/20 shadow-lg">
        <video ref={vRef} src={blobUrl} loop playsInline onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} className="w-full h-full object-cover" />
      </div>
      {!playing && <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/30">
        <div className="w-0 h-0 border-t-[5px] border-b-[5px] border-l-[8px] border-transparent border-l-white/70 ml-0.5" />
      </div>}
      <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 bg-black/50 rounded-full px-1 py-px">
        <span className="text-[7px] text-white/50 font-mono">{fmt(duration || 0)}</span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   CHAT PANEL
   ═══════════════════════════════════════════════════ */

function ChatPanel({ messages }) {
  const ref = useRef(null);
  useEffect(() => { ref.current && (ref.current.scrollTop = ref.current.scrollHeight); }, [messages.length]);
  if (!messages.length) return null;

  return (
    <div ref={ref} className="space-y-1 max-h-28 overflow-y-auto pr-1 scrollbar-thin">
      {messages.slice(-15).map((msg, i) => {
        if (msg.mediaType === 'voice') return (
          <div key={i} className="flex gap-1.5 items-center">
            <span className="text-[9px] font-bold text-gold-400/70 shrink-0">{msg.playerName?.split('_').pop()}</span>
            <VoiceBubble blobUrl={msg.blobUrl} duration={msg.duration} />
          </div>
        );
        if (msg.mediaType === 'video') return (
          <div key={i} className="flex gap-1.5 items-start">
            <span className="text-[9px] font-bold text-gold-400/70 shrink-0 mt-4">{msg.playerName?.split('_').pop()}</span>
            <VideoCircleBubble blobUrl={msg.blobUrl} duration={msg.duration} />
          </div>
        );
        return (
          <div key={i} className={`flex gap-1.5 items-start ${msg.isMafia ? 'bg-red-500/[0.04] rounded-lg px-1.5 py-0.5' : ''}`}>
            <span className={`text-[9px] font-bold shrink-0 ${msg.isMafia ? 'text-red-400/70' : 'text-gold-400/70'}`}>{msg.playerName?.split('_').pop()}</span>
            <span className="text-[9px] text-white/50 leading-snug">{msg.text}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   TEXT CHAT INPUT
   ═══════════════════════════════════════════════════ */

function ChatInput({ onSend, disabled }) {
  const [text, setText] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText('');
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-1.5">
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={disabled}
        placeholder="Сообщение..."
        className="flex-1 h-9 px-3 rounded-xl bg-white/[0.04] border border-white/[0.06] text-[11px] text-white placeholder-white/20 outline-none focus:border-white/15 focus:bg-white/[0.06] transition-all disabled:opacity-30"
      />
      <button
        type="submit"
        disabled={!text.trim() || disabled}
        className="w-9 h-9 rounded-xl bg-gold-500/20 border border-gold-500/20 flex items-center justify-center hover:bg-gold-500/30 active:scale-95 transition-all disabled:opacity-20"
      >
        <Send className="w-3.5 h-3.5 text-gold-400" />
      </button>
    </form>
  );
}

/* ═══════════════════════════════════════════════════
   ████  MAIN COMPONENT
   ═══════════════════════════════════════════════════ */

export default function GameLobby() {
  const gameState  = useGameStore(s => s.gameState);
  const startGame  = useGameStore(s => s.startGame);
  const addBots    = useGameStore(s => s.addBots);
  const addBot     = useGameStore(s => s.addBot);
  const doneSpeak  = useGameStore(s => s.doneSpeaking);
  const nightAct   = useGameStore(s => s.nightAction);
  const dayVote    = useGameStore(s => s.dayVote);
  const sendMedia  = useGameStore(s => s.sendMedia);
  const sendChat   = useGameStore(s => s.sendChat);
  const reset      = useGameStore(s => s.reset);
  const chatMsgs   = useGameStore(s => s.chatMessages);
  const votes      = useGameStore(s => s.votes);

  const [showRole, setShowRole] = useState(false);
  const [seenRole, setSeenRole] = useState(false);

  if (!gameState) return null;

  const {
    players = [], roomId, maxPlayers = 10, phase,
    narratorMessage = '', narratorSub = '',
    myRole, currentSpeaker, round,
  } = gameState;

  const me         = players.find(p => p.id === socket.id);
  const isHost     = me?.isAdmin ?? false;
  const canStart   = players.length >= 5;
  const freeSlots  = maxPlayers - players.length;
  const botCount   = players.filter(p => p.isBot).length;

  const isLobby    = phase === 'lobby';
  const isNight    = phase === 'night';
  const isDay      = phase === 'day';
  const isVoting   = phase === 'voting';
  const isDealing  = phase === 'dealing';
  const isIntro    = phase === 'introduction';
  const isOver     = phase === 'game_over';

  const alive      = players.filter(p => p.alive);
  const speaker    = (isIntro || isDay) && currentSpeaker >= 0 && currentSpeaker < alive.length ? alive[currentSpeaker] : null;
  const myTurn     = speaker?.id === socket.id;
  const canChat    = me?.alive && (isIntro || isDay);

  // Auto-reveal role card
  useEffect(() => {
    if (isDealing && myRole && !seenRole) {
      const t = setTimeout(() => setShowRole(true), 500);
      return () => clearTimeout(t);
    }
  }, [isDealing, myRole, seenRole]);

  // ─── Layout math ───
  const seats = Array.from({ length: maxPlayers }, (_, i) => players.find(p => p.seat === i) || null);
  const TW = 310, TH = 280;
  const cx = TW / 2, cy = TH / 2;
  const pos = getSeatPositions(maxPlayers, TW / 2 - 10, TH / 2 - 6, cx, cy);

  // ─── Render ───
  return (
    <div className={[
      'relative flex flex-col h-full px-3 pb-3 pt-4 overflow-hidden transition-all duration-1000',
      isNight && 'bg-[#06060e]',
      !isNight && 'bg-noir-950',
    ].filter(Boolean).join(' ')}>

      <div className="noise" />

      {/* Ambient lighting */}
      {isNight && <>
        <div className="absolute inset-0 bg-gradient-to-b from-indigo-950/20 via-transparent to-transparent pointer-events-none" />
        <motion.div animate={{ opacity: [0.02, 0.06, 0.02] }} transition={{ repeat: Infinity, duration: 5 }}
          className="absolute top-[-10%] right-[-5%] w-[60%] h-[60%] bg-indigo-500/[0.06] rounded-full blur-[80px] pointer-events-none" />
      </>}
      {isDay && <div className="absolute -top-24 -right-24 w-72 h-72 bg-amber-300/[0.03] rounded-full blur-[100px] pointer-events-none" />}
      {!isNight && !isDay && <div className="absolute -top-24 -right-24 w-72 h-72 bg-blood-600/[0.06] rounded-full blur-[100px] pointer-events-none" />}

      <div className="relative z-10 flex flex-col h-full justify-between">

        {/* ─── TOP SECTION ─── */}
        <div>

        {/* ─── HEADER ─── */}
        <div className="flex items-center justify-between mb-1.5">
          <div>
            <h2 className="font-display text-base font-bold text-white/90 leading-tight tracking-wide">Стол #{roomId}</h2>
            <p className="text-[9px] text-white/20 mt-px">
              {isLobby ? `${players.length}/${maxPlayers}` : isOver ? 'Игра окончена' : `Раунд ${round || 1} · ${alive.length} живых`}
              {botCount > 0 && <span className="text-violet-400/60 ml-1">· {botCount} AI</span>}
            </p>
          </div>
          <div className="flex items-center gap-1">
            {isLobby && (
              <button onClick={() => navigator.clipboard?.writeText(roomId)}
                className="w-7 h-7 rounded-lg bg-white/[0.03] border border-white/[0.06] flex items-center justify-center hover:bg-white/[0.06] transition-all">
                <Copy className="w-3 h-3 text-white/30" />
              </button>
            )}
            <button onClick={reset}
              className="w-7 h-7 rounded-lg bg-white/[0.03] border border-white/[0.06] flex items-center justify-center hover:bg-red-500/10 hover:border-red-500/20 transition-all">
              <LogOut className="w-3 h-3 text-white/30" />
            </button>
          </div>
        </div>

        {/* ─── PHASE BANNER ─── */}
        {!isLobby && (
          <motion.div key={phase} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
            className={[
              'mb-1.5 px-3 py-1 rounded-lg text-center border',
              isNight && 'bg-indigo-950/30 border-indigo-500/[0.12]',
              isVoting && 'bg-red-950/20 border-red-500/[0.12]',
              isOver && 'bg-gold-500/[0.06] border-gold-500/[0.12]',
              !isNight && !isVoting && !isOver && 'bg-white/[0.02] border-white/[0.06]',
            ].filter(Boolean).join(' ')}>
            <p className={[
              'text-[10px] font-bold uppercase tracking-widest',
              isNight && 'text-indigo-300/70',
              isVoting && 'text-red-300/70',
              isOver && 'text-gold-400/80',
              !isNight && !isVoting && !isOver && 'text-white/40',
            ].filter(Boolean).join(' ')}>
              {phase === 'dealing' ? '🃏 Раздача карт' : phase === 'introduction' ? '🎤 Знакомство' :
               phase === 'night' ? '🌙 Ночь' : phase === 'day' ? '☀️ День' :
               phase === 'voting' ? '🗳️ Голосование' : phase === 'game_over' ? '🏆 Конец' : phase}
            </p>
          </motion.div>
        )}

        </div>{/* end top section */}

        {/* ═══════ TABLE (centered in remaining space) ═══════ */}
        <div className="flex-1 flex items-center justify-center min-h-0">
          <div className="relative" style={{ width: TW, height: TH }}>

            {/* Outer rim glow */}
            <div className="absolute rounded-[50%] pointer-events-none"
              style={{
                width: TW * 0.72, height: TH * 0.60,
                left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
                boxShadow: isNight
                  ? '0 0 50px 5px rgba(79,70,229,0.04), 0 0 100px 10px rgba(79,70,229,0.02)'
                  : '0 0 50px 5px rgba(234,179,8,0.02), 0 0 100px 10px rgba(234,179,8,0.01)',
                transition: 'box-shadow 1s',
              }}
            />

            {/* Table surface — elegant felt */}
            <div
              className="absolute rounded-[50%]"
              style={{
                width: TW * 0.66, height: TH * 0.54,
                left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
                background: isNight
                  ? `radial-gradient(ellipse at 50% 38%, rgba(22,22,45,0.7) 0%, rgba(12,12,22,0.8) 60%, rgba(6,6,14,0.9) 100%)`
                  : `radial-gradient(ellipse at 50% 38%, rgba(26,52,26,0.5) 0%, rgba(18,38,18,0.4) 40%, rgba(10,14,10,0.5) 100%)`,
                border: '1px solid rgba(255,255,255,0.04)',
                boxShadow: `
                  inset 0 0 60px rgba(0,0,0,0.4),
                  inset 0 2px 0 rgba(255,255,255,0.02),
                  0 8px 30px rgba(0,0,0,0.5),
                  0 2px 8px rgba(0,0,0,0.3)
                `,
                transition: 'background 1s',
              }}
            >
              {/* Inner highlight rim */}
              <div className="absolute inset-[2px] rounded-[50%] pointer-events-none"
                style={{ border: '1px solid rgba(255,255,255,0.02)' }} />

              {/* Light reflection */}
              <div className="absolute inset-0 rounded-[50%] pointer-events-none"
                style={{ background: 'radial-gradient(ellipse at 50% 20%, rgba(255,255,255,0.025) 0%, transparent 50%)' }} />

              {/* Narrator */}
              <Narrator message={narratorMessage} sub={narratorSub} phase={phase} />

              {/* Night overlay */}
              {isNight && me?.alive && (
                <NightOverlay myRole={myRole} alivePlayers={alive} me={me} onAction={nightAct} />
              )}
            </div>

            {/* Seats */}
            <AnimatePresence mode="popLayout">
              {seats.map((p, i) => (
                <Seat key={p ? p.id : `e-${i}`} player={p} index={i}
                  x={pos[i].x} y={pos[i].y}
                  isMe={p?.id === socket.id}
                  isSpeaking={speaker?.id === p?.id}
                  isDead={p ? !p.alive : false}
                  phase={phase}
                />
              ))}
            </AnimatePresence>
          </div>
        </div>

        {/* ═══════ BOTTOM SECTION ═══════ */}
        <div>

        {/* ─── CHAT ─── */}
        {(isIntro || isDay || isVoting) && chatMsgs.length > 0 && (
          <div className="mb-1.5 rounded-xl bg-white/[0.02] border border-white/[0.05] px-2.5 py-2 backdrop-blur-sm">
            <ChatPanel messages={chatMsgs} />
          </div>
        )}

        {/* ─── VOTING ─── */}
        {isVoting && me?.alive && (
          <div className="mb-1.5 rounded-xl bg-white/[0.02] border border-white/[0.05] px-2.5 py-2 backdrop-blur-sm">
            <p className="text-[8px] text-white/25 font-medium mb-1 uppercase tracking-widest">Кого исключить?</p>
            <VotingPanel alivePlayers={alive} me={me} onVote={dayVote} votes={votes} />
          </div>
        )}

        {/* ═══════ BOTTOM ACTIONS ═══════ */}
        <div className="space-y-1.5">

          {/* My speaking turn: text + media + finish */}
          {myTurn && me?.alive && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-1.5">
              <ChatInput onSend={sendChat} />
              <div className="flex items-center gap-1.5">
                <VoiceRecorder onSend={(b, d) => sendMedia('voice', b, d)} />
                <VideoCircleRecorder onSend={(b, d) => sendMedia('video', b, d)} />
                <button onClick={doneSpeak}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-gold-500/90 to-gold-400/90 text-noir-950 font-bold text-[11px] flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all">
                  <MessageCircle className="w-3.5 h-3.5" />Закончить речь
                </button>
              </div>
            </motion.div>
          )}

          {/* Chat / media when listening (day/intro, not my turn) */}
          {!myTurn && canChat && (
            <div className="space-y-1.5">
              <ChatInput onSend={sendChat} />
              <div className="flex items-center gap-1.5">
                <VoiceRecorder onSend={(b, d) => sendMedia('voice', b, d)} />
                <VideoCircleRecorder onSend={(b, d) => sendMedia('video', b, d)} />
                <span className="text-[9px] text-white/15 ml-1">Голосовое · Кружочек</span>
              </div>
            </div>
          )}

          {/* Lobby */}
          {isLobby && (
            <div className="space-y-1.5">
              <button onClick={() => shareInviteLink(roomId)} className="glass-button w-full group">
                <Share2 className="w-4 h-4 text-white/30" />
                <span className="text-sm font-medium text-white/70">Пригласить друзей</span>
              </button>
              {isHost && freeSlots > 0 && (
                <div className="flex gap-1.5">
                  <button onClick={addBot} className="glass-button flex-1 group">
                    <UserPlus className="w-4 h-4 text-violet-400/70" />
                    <span className="text-sm font-medium text-white/70">+1 бот</span>
                  </button>
                  <button onClick={addBots}
                    className="flex-1 px-3 py-3 rounded-2xl bg-gradient-to-r from-violet-600/80 to-violet-500/80 text-white font-semibold text-sm flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all">
                    <Bot className="w-4 h-4" />Заполнить<span className="text-violet-200/70 text-xs">({freeSlots})</span>
                  </button>
                </div>
              )}
              {isHost && (
                <button onClick={startGame} disabled={!canStart}
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-blood-600 to-blood-500 text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-20 disabled:cursor-not-allowed">
                  <Play className="w-4 h-4" />
                  {canStart ? 'Начать игру' : `Нужно ещё ${5 - players.length}`}
                </button>
              )}
            </div>
          )}

          {/* Game over */}
          {isOver && (
            <button onClick={reset}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-gold-500 to-gold-400 text-noir-950 font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all">
              Вернуться в меню
            </button>
          )}
        </div>
        </div>{/* end bottom section */}
      </div>

      {/* Role card overlay */}
      <AnimatePresence>
        {showRole && <RoleCard role={myRole} onClose={() => { setShowRole(false); setSeenRole(true); }} />}
      </AnimatePresence>
    </div>
  );
}
