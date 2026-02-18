import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Video, Square, Send, Trash2, X, RotateCcw } from 'lucide-react';

/**
 * VideoCircleRecorder — Telegram-style circular video messages.
 *
 * Tap to open camera → tap record → tap stop → preview → send.
 *
 * Props:
 *  - onSend(blob, durationSec): called with the recorded video Blob
 *  - maxDuration: max recording time (default 20)
 *  - disabled: disables the button
 */
export default function VideoCircleRecorder({ onSend, maxDuration = 20, disabled = false }) {
  const [state, setState] = useState('idle'); // idle | camera | recording | preview
  const [elapsed, setElapsed] = useState(0);
  const [videoUrl, setVideoUrl] = useState(null);
  const [facingMode, setFacingMode] = useState('user');

  const videoLiveRef = useRef(null);
  const videoPreviewRef = useRef(null);
  const mediaRecRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const startTimeRef = useRef(0);
  const blobRef = useRef(null);

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  const cleanup = useCallback(() => {
    clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoUrl) URL.revokeObjectURL(videoUrl);
  }, [videoUrl]);

  const openCamera = useCallback(async (facing = facingMode) => {
    try {
      // Stop existing stream
      streamRef.current?.getTracks().forEach((t) => t.stop());

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 480 }, height: { ideal: 480 } },
        audio: true,
      });
      streamRef.current = stream;

      if (videoLiveRef.current) {
        videoLiveRef.current.srcObject = stream;
        videoLiveRef.current.play().catch(() => {});
      }

      setState('camera');
    } catch (err) {
      console.error('[VideoCircle] Ошибка доступа к камере:', err);
      alert('Нет доступа к камере');
    }
  }, [facingMode]);

  const startRecording = useCallback(() => {
    if (!streamRef.current) return;

    const recorder = new MediaRecorder(streamRef.current, {
      mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
        ? 'video/webm;codecs=vp9,opus'
        : MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
          ? 'video/webm;codecs=vp8,opus'
          : 'video/webm',
    });
    mediaRecRef.current = recorder;
    chunksRef.current = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
      blobRef.current = blob;
      const url = URL.createObjectURL(blob);
      setVideoUrl(url);
      setState('preview');
      // Stop the camera stream
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };

    recorder.start(200);
    startTimeRef.current = Date.now();
    setState('recording');
    setElapsed(0);

    timerRef.current = setInterval(() => {
      const sec = Math.floor((Date.now() - startTimeRef.current) / 1000);
      setElapsed(sec);
      if (sec >= maxDuration) {
        stopRecording();
      }
    }, 200);
  }, [maxDuration]);

  const stopRecording = useCallback(() => {
    clearInterval(timerRef.current);
    if (mediaRecRef.current && mediaRecRef.current.state === 'recording') {
      mediaRecRef.current.stop();
    }
  }, []);

  const flipCamera = useCallback(() => {
    const newFacing = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(newFacing);
    openCamera(newFacing);
  }, [facingMode, openCamera]);

  const handleSend = useCallback(() => {
    if (!blobRef.current) return;
    onSend(blobRef.current, elapsed);
    discard();
  }, [elapsed, onSend]);

  const discard = useCallback(() => {
    cleanup();
    setVideoUrl(null);
    setState('idle');
    setElapsed(0);
    blobRef.current = null;
  }, [cleanup]);

  const close = useCallback(() => {
    cleanup();
    setState('idle');
    setElapsed(0);
  }, [cleanup]);

  const formatTime = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  // Progress ring for recording
  const progress = elapsed / maxDuration;
  const circumference = 2 * Math.PI * 56; // r=56 for the ring

  return (
    <>
      {/* Trigger button */}
      {state === 'idle' && (
        <motion.button
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          disabled={disabled}
          onClick={() => openCamera()}
          className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 active:scale-95 transition-all disabled:opacity-30"
          title="Записать кружочек"
        >
          <Video className="w-4 h-4 text-white/60" />
        </motion.button>
      )}

      {/* Fullscreen overlay for camera/recording/preview */}
      <AnimatePresence>
        {state !== 'idle' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/95 backdrop-blur-md"
          >
            {/* Close button */}
            <button
              onClick={state === 'preview' ? discard : close}
              className="absolute top-6 right-6 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center z-10"
            >
              <X className="w-5 h-5 text-white/70" />
            </button>

            {/* Flip camera button */}
            {(state === 'camera' || state === 'recording') && (
              <button
                onClick={flipCamera}
                className="absolute top-6 left-6 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center z-10"
              >
                <RotateCcw className="w-4 h-4 text-white/70" />
              </button>
            )}

            {/* Circular video container */}
            <div className="relative">
              {/* Progress ring (when recording) */}
              {state === 'recording' && (
                <svg
                  className="absolute -inset-2 z-20"
                  width="132"
                  height="132"
                  viewBox="0 0 132 132"
                >
                  <circle
                    cx="66" cy="66" r="56"
                    fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="4"
                  />
                  <circle
                    cx="66" cy="66" r="56"
                    fill="none" stroke="#ef4444" strokeWidth="4"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={circumference * (1 - progress)}
                    transform="rotate(-90 66 66)"
                    className="transition-all duration-200"
                  />
                </svg>
              )}

              {/* Circular mask */}
              <div className="w-[120px] h-[120px] rounded-full overflow-hidden border-2 border-white/20 shadow-2xl">
                {/* Live camera view */}
                {(state === 'camera' || state === 'recording') && (
                  <video
                    ref={videoLiveRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                    style={{ transform: facingMode === 'user' ? 'scaleX(-1)' : 'none' }}
                  />
                )}

                {/* Preview */}
                {state === 'preview' && videoUrl && (
                  <video
                    ref={videoPreviewRef}
                    src={videoUrl}
                    autoPlay
                    loop
                    playsInline
                    className="w-full h-full object-cover"
                  />
                )}
              </div>

              {/* Recording dot */}
              {state === 'recording' && (
                <motion.div
                  animate={{ opacity: [1, 0.3, 1] }}
                  transition={{ repeat: Infinity, duration: 1 }}
                  className="absolute -top-1 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-black/60 rounded-full px-2 py-0.5"
                >
                  <div className="w-2 h-2 rounded-full bg-red-500" />
                  <span className="text-[10px] text-white font-mono">{formatTime(elapsed)}</span>
                </motion.div>
              )}
            </div>

            {/* Label */}
            <p className="mt-6 text-sm text-white/40 font-medium">
              {state === 'camera' ? 'Нажмите для записи' :
               state === 'recording' ? 'Записываем...' :
               'Предпросмотр'}
            </p>

            {/* Action buttons */}
            <div className="mt-6 flex items-center gap-4">
              {state === 'camera' && (
                <motion.button
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  onClick={startRecording}
                  className="w-16 h-16 rounded-full border-4 border-white/30 flex items-center justify-center active:scale-95 transition-all"
                >
                  <div className="w-12 h-12 rounded-full bg-red-500" />
                </motion.button>
              )}

              {state === 'recording' && (
                <motion.button
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  onClick={stopRecording}
                  className="w-16 h-16 rounded-full border-4 border-red-500/50 flex items-center justify-center active:scale-95 transition-all"
                >
                  <Square className="w-6 h-6 text-red-400" />
                </motion.button>
              )}

              {state === 'preview' && (
                <>
                  <button
                    onClick={discard}
                    className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center active:scale-95 transition-all"
                  >
                    <Trash2 className="w-5 h-5 text-white/60" />
                  </button>
                  <motion.button
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    onClick={handleSend}
                    className="w-14 h-14 rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 flex items-center justify-center shadow-lg active:scale-95 transition-all"
                  >
                    <Send className="w-5 h-5 text-white" />
                  </motion.button>
                </>
              )}
            </div>

            {/* Duration badge (preview) */}
            {state === 'preview' && (
              <p className="mt-3 text-xs text-white/30 font-mono">{formatTime(elapsed)}</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
