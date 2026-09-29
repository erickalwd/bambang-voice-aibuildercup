"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, MessageSquareText } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useI18n } from '@/lib/i18n';
import { wsUrl } from '@/lib/api';

type AgentState = 'idle' | 'listening' | 'speaking';

export default function VoiceAgent({
  onPanelChange,
}: {
  onPanelChange: (state: any) => void;
}) {
  const { lang, t, setLocked } = useI18n();
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

  // Barge-in: Gemini streams a reply much faster than it plays, so by the time the
  // user interrupts, the server turn has often finished and never sends `interrupted`.
  // The client therefore stops playback itself when the user starts talking.
  const serverGeneratingRef = useRef<boolean>(false); // audio for the current turn still arriving
  const dropAudioRef = useRef<boolean>(false);        // discard leftovers of an interrupted turn
  const bargeInTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const BARGE_IN_CONFIRM_MS = 300; // speech must persist this long, so speaker echo doesn't cut Bambang off

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

  const stopPlayback = () => {
    audioQueueRef.current = [];
    nextStartTimeRef.current = 0;
    isPlayingRef.current = false;
    activeSourcesRef.current.forEach(source => { try { source.stop(); } catch(e){} });
    activeSourcesRef.current = [];
    currentSourceNodeRef.current = null;
    setAgentState('listening');
  };

  const bargeIn = () => {
    if (agentStateRef.current !== 'speaking') return;
    // If Gemini is still sending the old reply, drop the rest until that turn ends.
    if (serverGeneratingRef.current) dropAudioRef.current = true;
    stopPlayback();
  };

  const onUserSpeechStart = () => {
    userIsSpeakingRef.current = true;
    if (agentStateRef.current !== 'speaking' || bargeInTimerRef.current) return;
    bargeInTimerRef.current = setTimeout(() => {
      bargeInTimerRef.current = null;
      if (userIsSpeakingRef.current) bargeIn();
    }, BARGE_IN_CONFIRM_MS);
  };

  const onUserSpeechStop = () => {
    userIsSpeakingRef.current = false;
    if (bargeInTimerRef.current) { clearTimeout(bargeInTimerRef.current); bargeInTimerRef.current = null; }
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
          onSpeechStart: onUserSpeechStart,
          onSpeechEnd: onUserSpeechStop,
          onVADMisfire: onUserSpeechStop,
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

      ws.current = new WebSocket(wsUrl(`/ws/voice?lang=${lang}`));
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
            if (dropAudioRef.current) return;
            serverGeneratingRef.current = true;
            const pcmFloat32 = base64ToFloat32PCM(data.data);
            audioQueueRef.current.push(pcmFloat32);
            if (!isPlayingRef.current) nextStartTimeRef.current = audioContext.current?.currentTime || 0;
            scheduleAudio();
          } else if (data.type === 'interrupt') {
            serverGeneratingRef.current = false;
            dropAudioRef.current = false;
            stopPlayback();
          } else if (data.type === 'turn_complete') {
            serverGeneratingRef.current = false;
            dropAudioRef.current = false;
          }
        } catch (e) { console.error("Error parsing WS message", e); }
      };
      ws.current.onclose = () => { console.log("WebSocket Closed"); stopSession(); };
      ws.current.onerror = (e) => { console.error("WebSocket Error", e); };

    } catch (e) {
      console.error("Session start error:", e);
      alert(t.voice.error);
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
      serverGeneratingRef.current = false;
      dropAudioRef.current = false;
      if (bargeInTimerRef.current) { clearTimeout(bargeInTimerRef.current); bargeInTimerRef.current = null; }
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

  // The session's language is fixed at connect time, so lock the switch while connected.
  useEffect(() => { setLocked(connected); }, [connected, setLocked]);

  /* ─── Presentation per state (BRI Design System) ─────── */
  const stateConfig = {
    idle: {
      label: t.voice.idle.label,
      title: 'Mulai Bicara',
      sub: t.voice.idle.sub,
      frame: '#FFFFFF',
      fill: '#FFFFFF',
      fg: 'var(--primary-deep)',
      dot: null as string | null,
    },
    listening: {
      label: t.voice.listening.label,
      title: '...',
      sub: t.voice.listening.sub,
      frame: 'var(--primary-light)',
      fill: 'var(--primary-light)',
      fg: 'var(--blue-700)',
      dot: 'var(--primary-light)',
    },
    speaking: {
      label: t.voice.speaking.label,
      title: 'Berbicara',
      sub: t.voice.speaking.sub,
      frame: '#FFFFFF',
      fill: 'var(--primary-mid)',
      fg: '#FFFFFF',
      dot: '#FFFFFF',
    },
  };

  const cfg = stateConfig[agentState];
  const ease = [0.4, 0, 0.2, 1] as const;

  /* ─── Wave bars for speaking state ───────────────────── */
  const waveBars = Array.from({ length: 7 });

  return (
    <>
      {/* ── Voice Control: BRI graphic frame ───────────── */}
      <div className="flex flex-col items-center w-full">
        <div className="relative" style={{ width: 176, height: 176 }}>
          {agentState === 'listening' && (
            <>
              <span className="gframe-echo" />
              <span className="gframe-echo delay" />
            </>
          )}

          <button
            id="voice-orb-btn"
            onClick={!connected ? startSession : stopSession}
            aria-label={connected ? t.voice.stop : t.voice.start}
            className="gframe gframe-btn"
            style={{ width: '100%', height: '100%', borderColor: cfg.frame }}
          >
            <div className="gframe-inner" style={{ background: cfg.fill }}>
              <AnimatePresence mode="wait">
                <motion.div
                  key={agentState}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2, ease }}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}
                >
                  {agentState === 'speaking' ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, height: 36 }}>
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
                            borderRadius: 2,
                            background: '#FFFFFF',
                          }}
                        />
                      ))}
                    </div>
                  ) : (
                    <Mic size={40} color={cfg.fg} strokeWidth={1.75} />
                  )}

                  <span
                    style={{
                      font: '700 11px/16px var(--font-sans)',
                      letterSpacing: '.06em',
                      textTransform: 'uppercase',
                      color: cfg.fg,
                    }}
                  >
                    {cfg.label}
                  </span>
                </motion.div>
              </AnimatePresence>
            </div>
          </button>
        </div>

        {/* Status + mute controls */}
        <div className="flex items-center justify-center flex-wrap" style={{ marginTop: 20, gap: 8 }}>
          <span className="pill-on-brand">
            {cfg.dot && (
              <span className="inline-block rounded-full" style={{ width: 8, height: 8, background: cfg.dot }} />
            )}
            {cfg.sub}
          </span>

          {/* Mute button — only when connected */}
          {connected && (
            <button
              id="mute-btn"
              onClick={toggleMute}
              className={`pill-on-brand ${isMuted ? 'is-off' : ''}`}
              aria-label={isMuted ? t.voice.unmuteAria : t.voice.muteAria}
            >
              {isMuted ? <MicOff size={16} /> : <Mic size={16} />}
              {isMuted ? t.voice.micOff : t.voice.micOn}
            </button>
          )}
        </div>
      </div>

      {/* ── Bot Transcript Bubble ───────────────────────── */}
      <AnimatePresence>
        {botTranscript && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease }}
            className="w-full flex items-start"
            style={{ marginTop: 24, gap: 10 }}
          >
            <div
              className="flex items-center justify-center flex-shrink-0"
              style={{ width: 32, height: 32, borderRadius: '22%', background: 'var(--primary-light)', color: 'var(--blue-700)' }}
            >
              <MessageSquareText size={16} />
            </div>
            <div
              style={{
                flex: 1,
                background: '#FFFFFF',
                borderRadius: '4px 16px 16px 16px',
                padding: '12px 14px',
                boxShadow: 'var(--shadow-pop)',
              }}
            >
              <p className="eyebrow" style={{ color: 'var(--primary-deep)', marginBottom: 4 }}>{t.voice.transcript}</p>
              <p style={{ font: '400 14px/22px var(--font-sans)', color: 'var(--fg1)' }}>
                {botTranscript}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
