"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Square } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

type AgentState = 'idle' | 'listening' | 'speaking';

export default function VoiceAgent({
  onPanelChange,
}: {
  onPanelChange: (state: any) => void;
}) {
  const [agentState, setAgentStateState] = useState<AgentState>('idle');
  const agentStateRef = useRef<AgentState>('idle');
  const setAgentState = (s: AgentState) => {
    agentStateRef.current = s;
    setAgentStateState(s);
  };
  const [connected, setConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const isMutedRef = useRef<boolean>(false);

  const ws = useRef<WebSocket | null>(null);
  const [botTranscript, setBotTranscript] = useState<string>('');

  // Audio Processing Refs
  const audioContext = useRef<AudioContext | null>(null);
  const mediaStream = useRef<MediaStream | null>(null);
  const scriptProcessor = useRef<ScriptProcessorNode | null>(null);

  // Audio Playback
  const audioQueueRef = useRef<Float32Array[]>([]);
  const isPlayingRef = useRef<boolean>(false);
  const nextStartTimeRef = useRef<number>(0);
  const [errorMsg, setErrorMsg] = useState('');

  // VAD state
  const silenceCounterRef = useRef<number>(0);
  const userIsSpeakingRef = useRef<boolean>(false);
  const currentSourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const vadRef = useRef<any>(null);
  const preSpeechBufferRef = useRef<Float32Array[]>([]);

  const downsampleTo16k = (buffer: Float32Array, currentRate: number): Float32Array => {
    if (currentRate === 16000) return buffer;
    const ratio = currentRate / 16000;
    const newLength = Math.round(buffer.length / ratio);
    const result = new Float32Array(newLength);
    let offsetResult = 0;
    let offsetBuffer = 0;
    while (offsetResult < result.length) {
      let nextOffsetBuffer = Math.round((offsetResult + 1) * ratio);
      let sum = 0;
      let count = 0;
      for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
        sum += buffer[i];
        count++;
      }
      result[offsetResult] = sum / (count || 1);
      offsetResult++;
      offsetBuffer = nextOffsetBuffer;
    }
    return result;
  };

  const float32ToInt16Base64 = (float32Array: Float32Array): string => {
    const int16Array = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      let s = Math.max(-1, Math.min(1, float32Array[i]));
      int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    const buffer = new Uint8Array(int16Array.buffer);
    let binary = '';
    for (let i = 0; i < buffer.byteLength; i++) {
      binary += String.fromCharCode(buffer[i]);
    }
    return btoa(binary);
  };

  const base64ToFloat32PCM = (b64: string): Float32Array => {
    const binary = atob(b64);
    const buffer = new ArrayBuffer(binary.length);
    const view = new Uint8Array(buffer);
    for (let i = 0; i < binary.length; i++) {
      view[i] = binary.charCodeAt(i);
    }
    const int16Array = new Int16Array(buffer);
    const float32Array = new Float32Array(int16Array.length);
    for (let i = 0; i < int16Array.length; i++) {
      float32Array[i] = int16Array[i] / 0x8000;
    }
    return float32Array;
  };

  const scheduleAudio = () => {
    if (!audioContext.current) return;
    setAgentState('speaking');
    isPlayingRef.current = true;

    while (audioQueueRef.current.length > 0) {
      const pcmData = audioQueueRef.current.shift()!;
      if (pcmData.length === 0) continue;

      const audioBuffer = audioContext.current.createBuffer(1, pcmData.length, 24000);
      audioBuffer.getChannelData(0).set(pcmData);

      const source = audioContext.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.current.destination);
      currentSourceNodeRef.current = source;
      activeSourcesRef.current.push(source);

      const currentTime = audioContext.current.currentTime;
      if (nextStartTimeRef.current < currentTime) {
        nextStartTimeRef.current = currentTime + 0.05;
      }

      const startTime = nextStartTimeRef.current;
      source.start(startTime);
      nextStartTimeRef.current = startTime + audioBuffer.duration;

      source.onended = () => {
        activeSourcesRef.current = activeSourcesRef.current.filter(s => s !== source);
        if (audioContext.current && audioContext.current.currentTime >= nextStartTimeRef.current - 0.05) {
          isPlayingRef.current = false;
          setTimeout(() => {
            if (!isPlayingRef.current && agentStateRef.current === 'speaking') {
              setAgentState('listening');
            }
          }, 1000);
        }
      };
    }
  };

  const startSession = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
      mediaStream.current = stream;

      try {
        const loadScript = (src: string) => new Promise((resolve, reject) => {
          if (document.querySelector(`script[src="${src}"]`)) return resolve(true);
          const script = document.createElement('script');
          script.src = src;
          script.onload = resolve;
          script.onerror = reject;
          document.body.appendChild(script);
        });
        await loadScript("https://cdn.jsdelivr.net/npm/onnxruntime-web@1.14.0/dist/ort.js");
        await loadScript("https://cdn.jsdelivr.net/npm/@ricky0123/vad-web@0.0.19/dist/bundle.min.js");

        vadRef.current = await (window as any).vad.MicVAD.new({
          stream,
          redemptionFrames: 5,
          minSpeechFrames: 4,
          positiveSpeechThreshold: 0.65,
          negativeSpeechThreshold: 0.4,
          onSpeechStart: () => { userIsSpeakingRef.current = true; },
          onSpeechEnd: () => { userIsSpeakingRef.current = false; },
          onVADMisfire: () => { userIsSpeakingRef.current = false; },
        });
        vadRef.current.start();
      } catch (err) {
        console.error("Failed to initialize Silero VAD:", err);
      }

      const actx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      if (actx.state === 'suspended') await actx.resume();
      audioContext.current = actx;

      const source = actx.createMediaStreamSource(stream);
      const processor = actx.createScriptProcessor(2048, 1, 1);

      processor.onaudioprocess = (e) => {
        if (isMutedRef.current || !ws.current || ws.current.readyState !== WebSocket.OPEN) return;
        const inputData = e.inputBuffer.getChannelData(0);
        const resampledData = downsampleTo16k(inputData, audioContext.current?.sampleRate || 16000);

        if (userIsSpeakingRef.current) {
          if (preSpeechBufferRef.current.length > 0) {
            preSpeechBufferRef.current.forEach(chunk => {
              const bufferedB64 = float32ToInt16Base64(chunk);
              ws.current?.send(JSON.stringify({ type: "realtime_input", data: bufferedB64 }));
            });
            preSpeechBufferRef.current = [];
          }
          const b64 = float32ToInt16Base64(resampledData);
          ws.current.send(JSON.stringify({ type: "realtime_input", data: b64 }));
        } else {
          preSpeechBufferRef.current.push(resampledData);
          if (preSpeechBufferRef.current.length > 3) preSpeechBufferRef.current.shift();
          const silence = new Float32Array(resampledData.length);
          ws.current.send(JSON.stringify({ type: "realtime_input", data: float32ToInt16Base64(silence) }));
        }
      };

      source.connect(processor);
      processor.connect(actx.destination);
      scriptProcessor.current = processor;

      ws.current = new WebSocket('ws://localhost:8000/ws/voice');
      ws.current.onopen = () => { setConnected(true); setAgentState('listening'); };
      ws.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'ui_update') {
            onPanelChange({ type: data.ui_state, data: data.data });
            window.dispatchEvent(new CustomEvent('demo-state-change', { detail: data.ui_state }));
          } else if (data.type === 'form_fill') {
            window.dispatchEvent(new CustomEvent('form-fill', { detail: data }));
          } else if (data.type === 'bot_text') {
            setBotTranscript(prev => prev ? prev + " " + data.text : data.text);
          } else if (data.type === 'audio') {
            const pcmFloat32 = base64ToFloat32PCM(data.data);
            audioQueueRef.current.push(pcmFloat32);
            if (!isPlayingRef.current) nextStartTimeRef.current = audioContext.current?.currentTime || 0;
            scheduleAudio();
          } else if (data.type === 'interrupt') {
            audioQueueRef.current = [];
            nextStartTimeRef.current = 0;
            isPlayingRef.current = false;
            activeSourcesRef.current.forEach(source => { try { source.stop(); } catch(e){} });
            activeSourcesRef.current = [];
            currentSourceNodeRef.current = null;
            setAgentState('listening');
          }
        } catch (e) { console.error("Error parsing WS message", e); }
      };
      ws.current.onclose = () => { console.log("WebSocket Closed"); stopSession(); };
      ws.current.onerror = (e) => { console.error("WebSocket Error", e); };

    } catch (e) {
      console.error("Session start error:", e);
      alert("Gagal mengakses mikrofon atau server.");
    }
  };

  const stopSession = () => {
    try {
      if (vadRef.current) { try { vadRef.current.pause(); } catch(e){} vadRef.current = null; }
      if (scriptProcessor.current) { scriptProcessor.current.disconnect(); scriptProcessor.current = null; }
      if (mediaStream.current) { mediaStream.current.getTracks().forEach(t => t.stop()); mediaStream.current = null; }
      if (audioContext.current) { audioContext.current.close(); audioContext.current = null; }
      if (ws.current) { ws.current.close(); ws.current = null; }
    } catch (err) { console.error("Error during stopSession:", err); }
    finally {
      setConnected(false);
      setAgentState('idle');
      audioQueueRef.current = [];
      isPlayingRef.current = false;
    }
  };

  const toggleMute = () => {
    isMutedRef.current = !isMutedRef.current;
    setIsMuted(isMutedRef.current);
    if (mediaStream.current) {
      mediaStream.current.getAudioTracks().forEach(t => { t.enabled = !isMutedRef.current; });
    }
  };

  useEffect(() => { return () => { stopSession(); }; }, []);

  /* ─── Color map per state ─────────────────────────────── */
  const stateConfig = {
    idle: {
      aura1: 'rgba(184, 169, 245, 0.35)',
      aura2: 'rgba(245, 184, 213, 0.28)',
      orbBg: 'linear-gradient(145deg, rgba(255,255,255,0.55) 0%, rgba(220,210,255,0.45) 100%)',
      ring: '#b8a9f5',
      label: 'Sobat BRI',
      title: 'Mulai Bicara',
      sub: 'Tap untuk memulai',
    },
    listening: {
      aura1: 'rgba(110, 168, 247, 0.4)',
      aura2: 'rgba(163, 245, 216, 0.3)',
      orbBg: 'linear-gradient(145deg, rgba(200,225,255,0.55) 0%, rgba(163,245,216,0.35) 100%)',
      ring: '#6ea8f7',
      label: 'Mendengarkan',
      title: '...',
      sub: 'Tap untuk berhenti',
    },
    speaking: {
      aura1: 'rgba(245, 184, 213, 0.45)',
      aura2: 'rgba(245, 232, 163, 0.35)',
      orbBg: 'linear-gradient(145deg, rgba(255,210,230,0.55) 0%, rgba(255,240,200,0.4) 100%)',
      ring: '#f5b8d5',
      label: 'Bambang',
      title: 'Berbicara',
      sub: 'Tap untuk berhenti',
    },
  };

  const cfg = stateConfig[agentState];

  /* ─── Wave bars for speaking state ───────────────────── */
  const waveBars = Array.from({ length: 7 });

  return (
    <>
      {/* ── Voice Orb Area ─────────────────────────────── */}
      <div className="flex flex-col items-center w-full" style={{ paddingTop: 8, paddingBottom: 4 }}>

        {/* Ambient aura blobs */}
        <div className="relative flex items-center justify-center" style={{ width: 300, height: 300 }}>
          <motion.div
            animate={{ scale: [1, 1.18, 1], opacity: [0.5, 0.8, 0.5] }}
            transition={{ repeat: Infinity, duration: 3.5, ease: 'easeInOut' }}
            style={{
              position: 'absolute',
              width: 260,
              height: 260,
              borderRadius: '50%',
              background: cfg.aura1,
              filter: 'blur(38px)',
            }}
          />
          <motion.div
            animate={{ scale: [1, 1.25, 1], opacity: [0.4, 0.65, 0.4] }}
            transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut', delay: 0.6 }}
            style={{
              position: 'absolute',
              width: 210,
              height: 210,
              borderRadius: '50%',
              background: cfg.aura2,
              filter: 'blur(28px)',
            }}
          />

          {/* Main Orb Button */}
          <motion.button
            id="voice-orb-btn"
            onClick={!connected ? startSession : stopSession}
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.93 }}
            className={`glass-orb ${agentState === 'listening' ? 'listening-ring' : ''}`}
            style={{
              position: 'relative',
              width: 210,
              height: 210,
              borderRadius: '50%',
              /* tint the glass orb with state colour very lightly */
              background: agentState === 'idle'
                ? 'rgba(255,255,255,0.22)'
                : agentState === 'listening'
                  ? 'rgba(180,215,255,0.2)'
                  : 'rgba(255,210,230,0.2)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              overflow: 'hidden',
              zIndex: 10,
            }}
          >
            {/* Curved top highlight — mimics liquid glass sphere */}
            <div
              style={{
                position: 'absolute',
                top: 0, left: 0, right: 0,
                height: '46%',
                borderRadius: '50% 50% 0 0 / 42% 42% 0 0',
                background: 'linear-gradient(180deg, rgba(255,255,255,0.52) 0%, rgba(255,255,255,0.06) 100%)',
                pointerEvents: 'none',
              }}
            />
            {/* Moving shimmer band */}


            {/* Spinning ring decoration */}
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 14, ease: 'linear' }}
              style={{
                position: 'absolute',
                inset: 10,
                borderRadius: '50%',
                border: `1.5px dashed ${cfg.ring}55`,
              }}
            />

            {/* Content */}
            <AnimatePresence mode="wait">
              <motion.div
                key={agentState}
                initial={{ opacity: 0, scale: 0.85, y: 6 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: -4 }}
                transition={{ duration: 0.3 }}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, zIndex: 2 }}
              >
                {agentState === 'speaking' ? (
                  /* Wave bars */
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 36 }}>
                    {waveBars.map((_, i) => (
                      <motion.div
                        key={i}
                        animate={{ scaleY: [0.3, 1, 0.3] }}
                        transition={{
                          repeat: Infinity,
                          duration: 0.7 + i * 0.08,
                          delay: i * 0.09,
                          ease: 'easeInOut',
                        }}
                        style={{
                          width: 4,
                          height: 32,
                          borderRadius: 4,
                          background: `linear-gradient(180deg, #f5b8d5, #b8a9f5)`,
                          transformOrigin: 'bottom',
                        }}
                      />
                    ))}
                  </div>
                ) : agentState === 'listening' ? (
                  <motion.div
                    animate={{ scale: [1, 1.15, 1], opacity: [0.8, 1, 0.8] }}
                    transition={{ repeat: Infinity, duration: 1.6, ease: 'easeInOut' }}
                  >
                    <Mic size={36} color="#6ea8f7" strokeWidth={1.8} />
                  </motion.div>
                ) : (
                  <Mic size={36} color="#b8a9f5" strokeWidth={1.6} />
                )}

                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: '0.13em',
                    textTransform: 'uppercase',
                    color: agentState === 'idle' ? '#8b7ec8' : agentState === 'listening' ? '#4a8ed4' : '#c07090',
                    marginTop: 2,
                  }}
                >
                  {cfg.label}
                </span>
              </motion.div>
            </AnimatePresence>
          </motion.button>
        </div>

        {/* Status pill below orb */}
        <AnimatePresence mode="wait">
          <motion.div
            key={agentState + '-pill'}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35 }}
            style={{
              marginTop: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: 'rgba(255,255,255,0.5)',
              backdropFilter: 'blur(14px)',
              WebkitBackdropFilter: 'blur(14px)',
              border: '1.5px solid rgba(255,255,255,0.8)',
              borderRadius: 32,
              padding: '7px 18px',
              boxShadow: '0 4px 16px rgba(100,120,180,0.12)',
            }}
          >
            {agentState !== 'idle' && (
              <motion.span
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ repeat: Infinity, duration: 1.4 }}
                style={{
                  width: 7, height: 7, borderRadius: '50%',
                  background: agentState === 'listening' ? '#6ea8f7' : '#f5b8d5',
                  display: 'inline-block',
                }}
              />
            )}
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: 'rgba(26,26,46,0.6)',
                letterSpacing: '0.04em',
              }}
            >
              {cfg.sub}
            </span>
          </motion.div>
        </AnimatePresence>

        {/* Mute button — only when connected */}
        <AnimatePresence>
          {connected && (
            <motion.button
              id="mute-btn"
              initial={{ opacity: 0, y: 8, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: 0.9 }}
              onClick={toggleMute}
              style={{
                marginTop: 10,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: isMuted ? 'rgba(245,184,213,0.4)' : 'rgba(255,255,255,0.38)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: '1.5px solid rgba(255,255,255,0.7)',
                borderRadius: 24,
                padding: '6px 16px',
                fontSize: 12,
                fontWeight: 600,
                color: isMuted ? '#c07090' : 'rgba(26,26,46,0.5)',
                cursor: 'pointer',
                boxShadow: '0 2px 10px rgba(100,120,180,0.1)',
              }}
            >
              {isMuted ? <MicOff size={14} /> : <Mic size={14} />}
              {isMuted ? 'Mic Off' : 'Mic On'}
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* ── Bot Transcript Card ─────────────────────────── */}
      <AnimatePresence>
        {botTranscript && (
          <motion.div
            initial={{ opacity: 0, y: 14, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="w-full px-6 mt-2 mb-1"
          >
            <div
              style={{
                background: 'rgba(255,255,255,0.52)',
                backdropFilter: 'blur(20px) saturate(160%)',
                WebkitBackdropFilter: 'blur(20px) saturate(160%)',
                border: '1.5px solid rgba(255,255,255,0.78)',
                borderRadius: 24,
                padding: '14px 18px',
                boxShadow: '0 6px 28px rgba(100,120,180,0.14), inset 0 1px 0 rgba(255,255,255,0.85)',
              }}
            >
              <p
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: '#b8a9f5',
                  marginBottom: 5,
                }}
              >
                🤖 Bambang berkata
              </p>
              <p
                style={{
                  fontSize: 14,
                  fontWeight: 500,
                  color: '#2d2a4a',
                  lineHeight: 1.55,
                  fontStyle: 'italic',
                }}
              >
                "{botTranscript}"
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
