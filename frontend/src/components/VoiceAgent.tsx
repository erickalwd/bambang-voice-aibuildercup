"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Loader2, Volume2 } from 'lucide-react';
import { motion } from 'framer-motion';

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
      // Prevent scheduling empty buffers (e.g. 0 length)
      if (pcmData.length === 0) continue;

      const audioBuffer = audioContext.current.createBuffer(1, pcmData.length, 24000); // Gemini Live outputs 24kHz PCM
      audioBuffer.getChannelData(0).set(pcmData);

      const source = audioContext.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.current.destination);
      currentSourceNodeRef.current = source;
      activeSourcesRef.current.push(source);

      const currentTime = audioContext.current.currentTime;
      // Revert to 50ms buffer to avoid massive delay penalties on slow networks
      if (nextStartTimeRef.current < currentTime) {
         nextStartTimeRef.current = currentTime + 0.05;
      }
      
      const startTime = nextStartTimeRef.current;
      source.start(startTime);
      nextStartTimeRef.current = startTime + audioBuffer.duration;

      source.onended = () => {
        // Clean up from active sources
        activeSourcesRef.current = activeSourcesRef.current.filter(s => s !== source);
        // If the playback time has reached the end of the last scheduled chunk, we are done
        if (audioContext.current && audioContext.current.currentTime >= nextStartTimeRef.current - 0.05) {
          isPlayingRef.current = false;
          // Use an 1000ms debounce before reverting to "listening" state to absorb any network lag spikes without UI flicker
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
      // Request mic permissions and open context
      const stream = await navigator.mediaDevices.getUserMedia({ audio: {
        sampleRate: 16000,
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
      } });
      
      mediaStream.current = stream;
      
      // Initialize Silero VAD (Dynamic CDN Load to completely bypass Next.js Turbopack bugs)
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
          stream: stream,
          redemptionFrames: 5, 
          minSpeechFrames: 4, // Force user to speak for at least ~4 frames to trigger, filters out short acoustic echo blips!
          positiveSpeechThreshold: 0.65, // Balanced threshold, not too hard to trigger but ignores background hum
          negativeSpeechThreshold: 0.4, 
          onSpeechStart: () => {
            userIsSpeakingRef.current = true;
          },
          onSpeechEnd: () => {
            userIsSpeakingRef.current = false;
          },
          onVADMisfire: () => {
            userIsSpeakingRef.current = false;
          }
        });
        vadRef.current.start();
      } catch (err) {
        console.error("Failed to initialize Silero VAD:", err);
      }

      const actx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      if (actx.state === 'suspended') {
        await actx.resume();
      }
      audioContext.current = actx;

      const source = actx.createMediaStreamSource(stream);
      const processor = actx.createScriptProcessor(2048, 1, 1); // Reduced from 4096 to lower audio chunking delay
      
      processor.onaudioprocess = (e) => {
        if (isMutedRef.current || !ws.current || ws.current.readyState !== WebSocket.OPEN) return;
        
        const inputData = e.inputBuffer.getChannelData(0);
        // Ensure audio is exactly 16000Hz before converting to PCM16
        const resampledData = downsampleTo16k(inputData, audioContext.current?.sampleRate || 16000);
        
        // DYNAMIC STREAMING WITH SILERO VAD GATE (NOISE GATE APPROACH)
        // Gemini's internal VAD expects a continuous stream. If we cut it off, it hangs.
        // Instead, we send pure silence when the user is not speaking.
        if (userIsSpeakingRef.current) {
           // Flush pre-speech buffer
           if (preSpeechBufferRef.current.length > 0) {
              preSpeechBufferRef.current.forEach(chunk => {
                 const bufferedB64 = float32ToInt16Base64(chunk);
                 ws.current?.send(JSON.stringify({ type: "realtime_input", data: bufferedB64 }));
              });
              preSpeechBufferRef.current = [];
           }
           
           // Send live frame
           const b64 = float32ToInt16Base64(resampledData);
           ws.current.send(JSON.stringify({
             type: "realtime_input",
             data: b64
           }));
        } else {
           // Maintain rolling buffer for the next speech onset
           preSpeechBufferRef.current.push(resampledData);
           if (preSpeechBufferRef.current.length > 3) {
              preSpeechBufferRef.current.shift();
           }

           // Send pure silence to Gemini so its internal VAD knows we stopped speaking
           const silence = new Float32Array(resampledData.length);
           const silenceB64 = float32ToInt16Base64(silence);
           ws.current.send(JSON.stringify({
             type: "realtime_input",
             data: silenceB64
           }));
        }
      };

      source.connect(processor);
      processor.connect(actx.destination);
      scriptProcessor.current = processor;

      // Open WebSocket
      ws.current = new WebSocket('ws://localhost:8000/ws/voice');
      
      ws.current.onopen = () => {
        setConnected(true);
        setAgentState('listening');
      };

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
            // Receive Native Audio PCM
            const pcmFloat32 = base64ToFloat32PCM(data.data);
            audioQueueRef.current.push(pcmFloat32);
            if (!isPlayingRef.current) {
              nextStartTimeRef.current = audioContext.current?.currentTime || 0;
            }
            scheduleAudio();
          } else if (data.type === 'interrupt') {
            // Clear queue on interrupt
            audioQueueRef.current = [];
            nextStartTimeRef.current = 0;
            isPlayingRef.current = false;
            activeSourcesRef.current.forEach(source => {
              try { source.stop(); } catch(e){}
            });
            activeSourcesRef.current = [];
            currentSourceNodeRef.current = null;
            setAgentState('listening');
          }
        } catch (e) {
          console.error("Error parsing WS message", e);
        }
      };

      ws.current.onclose = () => {
        console.log("WebSocket Closed by server/network");
        stopSession();
      };
      
      ws.current.onerror = (e) => {
        console.error("WebSocket Error", e);
      };
      
    } catch (e) {
      console.error("Session start error:", e);
      alert("Gagal mengakses mikrofon atau server.");
    }
  };

  const stopSession = () => {
    try {
        if (vadRef.current) {
            try { vadRef.current.pause(); } catch(e){}
            vadRef.current = null;
        }
        if (scriptProcessor.current) {
            scriptProcessor.current.disconnect();
            scriptProcessor.current = null;
        }
        if (mediaStream.current) {
            mediaStream.current.getTracks().forEach(track => track.stop());
            mediaStream.current = null;
        }
        if (audioContext.current) {
            audioContext.current.close();
            audioContext.current = null;
        }
        if (ws.current) {
          ws.current.close();
          ws.current = null;
        }
    } catch (err) {
        console.error("Error during stopSession:", err);
    } finally {
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
      mediaStream.current.getAudioTracks().forEach(track => {
        track.enabled = !isMutedRef.current;
      });
    }
  };

  useEffect(() => {
    return () => {
      stopSession();
    };
  }, []);

  return (
    <>
      <div className="flex flex-col items-center justify-center w-full relative h-[320px]">
        {/* Dynamic Glowing Background Behind Orb */}
        {agentState !== 'idle' && (
          <>
            <motion.div animate={{ scale: [1, 1.2, 1], opacity: [0.15, 0.3, 0.15] }} transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }} className="absolute w-72 h-72 rounded-full bg-primary blur-[50px] mix-blend-multiply" />
            <motion.div animate={{ scale: [1, 1.4, 1], opacity: [0.1, 0.25, 0.1] }} transition={{ repeat: Infinity, duration: 2.5, delay: 0.3, ease: "easeInOut" }} className="absolute w-64 h-64 rounded-full bg-accent blur-[40px] mix-blend-multiply" />
          </>
        )}

        {/* The Sci-Fi HUD Orb */}
        <motion.div 
          onClick={!connected ? startSession : stopSession}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className={`relative w-72 h-72 rounded-full flex flex-col items-center justify-center overflow-hidden z-10 cursor-pointer transition-all duration-700 shadow-[0_0_50px_-15px_rgba(8,87,195,0.3)] ${
            agentState === 'idle' ? 'bg-white' : 'bg-slate-50'
          }`}
        >
          {/* Glass Layer */}
          <div className="absolute inset-0 bg-white/40 backdrop-blur-2xl rounded-full border border-white/80" />
          
          {/* HUD Rings */}
          <div className="absolute inset-2 border-[1px] border-primary/20 rounded-full" />
          <div className="absolute inset-4 border-[2px] border-dashed border-secondary/40 rounded-full animate-[spin_12s_linear_infinite]" />
          <div className="absolute inset-8 border-[1.5px] border-dotted border-accent/60 rounded-full animate-[spin_18s_linear_infinite_reverse]" />

          {/* Inner mesh/wave effect */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent opacity-100" />
          
          {/* Audio Wave lines (simulated HUD core) */}
          {agentState !== 'idle' && (
            <div className="absolute inset-12 flex items-center justify-center opacity-80">
              <motion.div animate={{ scale: agentState === 'speaking' ? [1, 1.4, 1] : [1, 1.05, 1], opacity: agentState === 'speaking' ? [0.6, 1, 0.6] : 0.4 }} transition={{ repeat: Infinity, duration: agentState === 'speaking' ? 0.8 : 2 }} className="w-full h-full rounded-full bg-gradient-to-tr from-primary/30 to-accent/30 blur-xl" />
            </div>
          )}

          <div className="z-10 flex flex-col items-center text-center">
             {agentState === 'idle' ? (
                <>
                  <span className="text-primary/70 text-xs tracking-widest uppercase mb-1 font-semibold">Sobat BRI</span>
                  <span className="text-slate-800 font-extrabold text-2xl tracking-tight">Tap to Start</span>
                </>
             ) : (
                <>
                  <span className="text-primary/70 text-xs tracking-widest uppercase mb-2 font-semibold">
                    {agentState === 'speaking' ? 'Bambang' : 'Listening'}
                  </span>
                  <span className="text-slate-800 font-extrabold text-2xl tracking-tight mb-2">
                    {agentState === 'speaking' ? 'Berbicara...' : '...'}
                  </span>
                  <span className="text-slate-400 text-[10px] uppercase font-bold tracking-widest mt-2 border border-slate-200 px-3 py-1 rounded-full bg-white/50">
                    Tap to Stop
                  </span>
                </>
             )}
          </div>
        </motion.div>
      </div>

      {/* Bot Transcript */}
      {botTranscript && (
        <div className="w-full px-6 mt-4 z-20 relative">
          <div className="bg-white/70 backdrop-blur-md border border-white shadow-sm rounded-2xl p-4 text-sm text-slate-700 italic h-20 overflow-y-auto font-medium text-center">
            "{botTranscript}"
          </div>
        </div>
      )}
    </>
  );
}
