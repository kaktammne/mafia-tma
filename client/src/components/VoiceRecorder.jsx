import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, Square, Send, Trash2 } from 'lucide-react';

/**
 * VoiceRecorder — hold-to-record audio, with waveform visualization.
 *
 * Props:
 *  - onSend(blob, durationSec): called with the recorded audio Blob
 *  - maxDuration: max recording time in seconds (default 30)
 *  - disabled: disables the recorder
 */
export default function VoiceRecorder({ onSend, maxDuration = 30, disabled = false }) {
  const [state, setState] = useState('idle'); // idle | recording | preview
  const [elapsed, setElapsed] = useState(0);
  const [audioUrl, setAudioUrl] = useState(null);
  const [levels, setLevels] = useState([]);

  const mediaRecRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const analyserRef = useRef(null);
  const animFrameRef = useRef(null);
  const startTimeRef = useRef(0);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopStream();
      clearInterval(timerRef.current);
      cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    cancelAnimationFrame(animFrameRef.current);
  }, []);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Analyser for waveform
      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 128;
      source.connect(analyser);
      analyserRef.current = analyser;

      const recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm',
      });
      mediaRecRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        setState('preview');
        stopStream();
      };

      recorder.start(200); // collect chunks every 200ms
      startTimeRef.current = Date.now();
      setState('recording');
      setElapsed(0);
      setLevels([]);

      // Timer
      timerRef.current = setInterval(() => {
        const sec = Math.floor((Date.now() - startTimeRef.current) / 1000);
        setElapsed(sec);
        if (sec >= maxDuration) {
          stopRecording();
        }
      }, 200);

      // Waveform animation
      const drawWave = () => {
        if (!analyserRef.current) return;
        const data = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length / 255;
        setLevels((prev) => [...prev.slice(-30), avg]);
        animFrameRef.current = requestAnimationFrame(drawWave);
      };
      drawWave();
    } catch (err) {
      console.error('[VoiceRecorder] Ошибка доступа к микрофону:', err);
      alert('Нет доступа к микрофону');
    }
  }, [maxDuration, stopStream]);

  const stopRecording = useCallback(() => {
    clearInterval(timerRef.current);
    if (mediaRecRef.current && mediaRecRef.current.state === 'recording') {
      mediaRecRef.current.stop();
    }
  }, []);

  const handleSend = useCallback(() => {
    if (chunksRef.current.length === 0) return;
    const blob = new Blob(chunksRef.current, {
      type: mediaRecRef.current?.mimeType || 'audio/webm',
    });
    const duration = elapsed;
    onSend(blob, duration);
    discard();
  }, [elapsed, onSend]);

  const discard = useCallback(() => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setState('idle');
    setElapsed(0);
    setLevels([]);
    chunksRef.current = [];
  }, [audioUrl]);

  const formatTime = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center gap-2">
      <AnimatePresence mode="wait">
        {state === 'idle' && (
          <motion.button
            key="mic"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            disabled={disabled}
            onClick={startRecording}
            className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 active:scale-95 transition-all disabled:opacity-30"
            title="Записать голосовое"
          >
            <Mic className="w-4 h-4 text-white/60" />
          </motion.button>
        )}

        {state === 'recording' && (
          <motion.div
            key="recording"
            initial={{ width: 40, opacity: 0 }}
            animate={{ width: 'auto', opacity: 1 }}
            exit={{ width: 40, opacity: 0 }}
            className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-red-500/10 border border-red-500/20"
          >
            {/* Waveform */}
            <div className="flex items-center gap-px h-6">
              {levels.slice(-16).map((level, i) => (
                <motion.div
                  key={i}
                  className="w-[3px] rounded-full bg-red-400"
                  animate={{ height: Math.max(4, level * 24) }}
                  transition={{ duration: 0.1 }}
                />
              ))}
            </div>

            {/* Timer */}
            <motion.div
              animate={{ opacity: [1, 0.4, 1] }}
              transition={{ repeat: Infinity, duration: 1 }}
              className="flex items-center gap-1"
            >
              <div className="w-2 h-2 rounded-full bg-red-500" />
              <span className="text-xs text-red-400 font-mono font-medium w-8">{formatTime(elapsed)}</span>
            </motion.div>

            {/* Stop */}
            <button
              onClick={stopRecording}
              className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center hover:bg-red-500/30 active:scale-95 transition-all"
            >
              <Square className="w-3.5 h-3.5 text-red-400" />
            </button>
          </motion.div>
        )}

        {state === 'preview' && (
          <motion.div
            key="preview"
            initial={{ width: 40, opacity: 0 }}
            animate={{ width: 'auto', opacity: 1 }}
            exit={{ width: 40, opacity: 0 }}
            className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-white/5 border border-white/10"
          >
            {/* Playback */}
            <audio src={audioUrl} controls className="h-7 max-w-[120px]" style={{ filter: 'invert(1) brightness(0.7)' }} />

            <span className="text-[10px] text-noir-400 font-mono">{formatTime(elapsed)}</span>

            {/* Discard */}
            <button
              onClick={discard}
              className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center hover:bg-red-500/20 transition-all"
            >
              <Trash2 className="w-3 h-3 text-noir-400" />
            </button>

            {/* Send */}
            <button
              onClick={handleSend}
              className="w-8 h-8 rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 flex items-center justify-center hover:brightness-110 active:scale-95 transition-all"
            >
              <Send className="w-3.5 h-3.5 text-white" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
