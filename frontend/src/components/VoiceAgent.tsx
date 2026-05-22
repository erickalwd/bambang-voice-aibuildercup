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

  const playAudioQueue = () => {
    if (!audioContext.current || audioQueueRef.current.length === 0) {
      isPlayingRef.current = false;
      if (agentStateRef.current === 'speaking') setAgentState('listening');
      return;
    }

    setAgentState('speaking');
    isPlayingRef.current = true;
    const pcmData = audioQueueRef.current.shift()!;
    const audioBuffer = audioContext.current.createBuffer(1, pcmData.length, 24000); // Gemini Live outputs 24kHz PCM
    audioBuffer.getChannelData(0).set(pcmData);

    const source = audioContext.current.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContext.current.destination);
    currentSourceNodeRef.current = source;

    const currentTime = audioContext.current.currentTime;
    const startTime = Math.max(currentTime, nextStartTimeRef.current);
    source.start(startTime);
    nextStartTimeRef.current = startTime + audioBuffer.duration;

    source.onended = () => {
      playAudioQueue();
    };
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
      const actx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      if (actx.state === 'suspended') {
        await actx.resume();
      }
      audioContext.current = actx;

      const source = actx.createMediaStreamSource(stream);
      const processor = actx.createScriptProcessor(4096, 1, 1);
      
      processor.onaudioprocess = (e) => {
        if (isMutedRef.current || !ws.current || ws.current.readyState !== WebSocket.OPEN) return;
        
        const inputData = e.inputBuffer.getChannelData(0);
        // Ensure audio is exactly 16000Hz before converting to PCM16
        const resampledData = downsampleTo16k(inputData, audioContext.current?.sampleRate || 16000);
        
        // Simple RMS-based VAD
        let sumSq = 0;
        for (let i = 0; i < resampledData.length; i++) {
          sumSq += resampledData[i] * resampledData[i];
        }
        const rms = Math.sqrt(sumSq / resampledData.length);
        
        if (rms > 0.02) { // Speech threshold
          silenceCounterRef.current = 0;
          userIsSpeakingRef.current = true;
        } else {
          silenceCounterRef.current++;
          // ~1.5 seconds of silence (about 6 chunks at 16kHz if 4096 frames/chunk = 256ms)
          if (userIsSpeakingRef.current && silenceCounterRef.current > 6) {
            userIsSpeakingRef.current = false;
            ws.current.send(JSON.stringify({ type: "end_of_speech" }));
          }
        }
        
        const b64 = float32ToInt16Base64(resampledData);
        ws.current.send(JSON.stringify({
          type: "realtime_input",
          data: b64
        }));
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
              playAudioQueue();
            }
          } else if (data.type === 'interrupt') {
            // Clear queue on interrupt
            audioQueueRef.current = [];
            nextStartTimeRef.current = 0;
            isPlayingRef.current = false;
            if (currentSourceNodeRef.current) {
              try { currentSourceNodeRef.current.stop(); } catch(e){}
              currentSourceNodeRef.current = null;
            }
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
    <div className="flex flex-col items-center justify-center p-8 bg-white/80 backdrop-blur-md rounded-3xl shadow-xl w-full max-w-sm border border-slate-100 transition-all">
      <div className="relative mb-8 mt-4 flex items-center justify-center">
        {agentState === 'speaking' && (
          <>
            <motion.div animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0.8, 0.5] }} transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }} className="absolute w-32 h-32 rounded-full bg-blue-300 blur-xl" />
            <motion.div animate={{ scale: [1, 1.5, 1], opacity: [0.3, 0.6, 0.3] }} transition={{ repeat: Infinity, duration: 1.5, delay: 0.2, ease: "easeInOut" }} className="absolute w-24 h-24 rounded-full bg-blue-400 blur-lg" />
          </>
        )}
        {agentState === 'listening' && (
          <motion.div animate={{ scale: [1, 1.1, 1], opacity: [0.2, 0.4, 0.2] }} transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }} className="absolute w-32 h-32 rounded-full bg-green-200 blur-xl" />
        )}
        
        <div className={`relative w-28 h-28 rounded-full flex flex-col items-center justify-center shadow-lg border-4 z-10 bg-gradient-to-br ${
          agentState === 'idle' ? 'from-slate-100 to-slate-200 border-slate-100 text-slate-400' :
          agentState === 'speaking' ? 'from-blue-500 to-primary border-blue-200 text-white shadow-blue-500/50' :
          'from-green-400 to-emerald-500 border-green-200 text-white shadow-green-500/40'
        }`}>
          <span className="text-white/60 text-sm font-medium">Status</span>
          <span className="text-white font-bold">{connected ? 'Connected' : 'Offline'}</span>
        </div>
      </div>

      {botTranscript && (
        <div className="mt-4 p-3 bg-slate-100 rounded-lg border border-slate-200 text-slate-700 text-sm italic h-32 overflow-y-auto w-full mb-4">
          Bambang: "{botTranscript}"
        </div>
      )}

      <div className="text-center mb-8 h-10 flex flex-col justify-center">
        <h3 className="text-xl font-bold text-slate-800 mb-1">
          {agentState === 'idle' ? 'Voice Assistant' : 
           agentState === 'speaking' ? 'Bambang Berbicara...' :
           isMuted ? 'Mikrofon Dimatikan' : 'Mendengarkan (Bicara sekarang)'}
        </h3>
      </div>

      <div className="w-full flex flex-col gap-3">
        {!connected ? (
          <button onClick={startSession} className="w-full bg-primary hover:bg-primary/90 text-white rounded-2xl py-4 font-semibold shadow-md transition-all">
            Mulai Sesi
          </button>
        ) : (
          <>
            <button onClick={toggleMute} className={`w-full py-3 rounded-2xl font-semibold transition-all border ${
                isMuted ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
              }`}>
              {isMuted ? 'Nyalakan Mikrofon' : 'Mute Mikrofon'}
            </button>
            <button onClick={stopSession} className="w-full bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-2xl py-3 font-semibold transition-all">
              Akhiri Sesi
            </button>
          </>
        )}
      </div>
    </div>
  );
}
