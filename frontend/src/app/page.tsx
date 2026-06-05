"use client";

import React, { useState, useEffect } from 'react';
import VoiceAgent from '@/components/VoiceAgent';
import DynamicPanel from '@/components/DynamicPanel';
import { Home as HomeIcon, Settings, Search, Bell } from 'lucide-react';

export default function Home() {
  const [panelState, setPanelState] = useState<{
    type: 'idle' | 'products' | 'faq' | 'faq_steps' | 'lead_form' | 'search';
    data?: any;
  }>({ type: 'idle' });

  const [greeting, setGreeting] = useState('');
  const [currentDate, setCurrentDate] = useState('');



  useEffect(() => {
    const h = new Date().getHours();
    if (h < 11) setGreeting('Selamat Pagi');
    else if (h < 15) setGreeting('Selamat Siang');
    else if (h < 18) setGreeting('Selamat Sore');
    else setGreeting('Selamat Malam');

    const d = new Date();
    setCurrentDate(
      d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })
    );
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center p-0 md:p-6">
      {/* ── Ambient liquid blobs (fixed, behind everything) ── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {/* Top-left sky blob */}
        <div style={{ position:'absolute', top:'-20%', left:'-15%', width:'75vw', height:'75vw', borderRadius:'50%', background:'radial-gradient(circle, rgba(189,213,245,0.9) 0%, transparent 68%)', filter:'blur(55px)', animation:'glow-pulse 9s ease-in-out infinite' }} />
        {/* Top-right lavender blob */}
        <div style={{ position:'absolute', top:'-5%', right:'-20%', width:'65vw', height:'65vw', borderRadius:'50%', background:'radial-gradient(circle, rgba(205,192,240,0.85) 0%, transparent 65%)', filter:'blur(50px)', animation:'glow-pulse 11s ease-in-out infinite 1.5s reverse' }} />
        {/* Bottom-center rose blob */}
        <div style={{ position:'absolute', bottom:'-15%', left:'15%', width:'70vw', height:'70vw', borderRadius:'50%', background:'radial-gradient(circle, rgba(240,192,218,0.8) 0%, transparent 65%)', filter:'blur(60px)', animation:'glow-pulse 13s ease-in-out infinite 3s' }} />
        {/* Mid mint accent */}
        <div style={{ position:'absolute', top:'40%', right:'-10%', width:'40vw', height:'40vw', borderRadius:'50%', background:'radial-gradient(circle, rgba(163,245,216,0.5) 0%, transparent 70%)', filter:'blur(40px)', animation:'glow-pulse 7s ease-in-out infinite 0.5s' }} />
        {/* Golden accent */}
        <div style={{ position:'absolute', bottom:'20%', left:'-5%', width:'35vw', height:'35vw', borderRadius:'50%', background:'radial-gradient(circle, rgba(245,228,160,0.45) 0%, transparent 70%)', filter:'blur(36px)', animation:'glow-pulse 8s ease-in-out infinite 2s reverse' }} />
      </div>

      {/* Phone Frame */}
      <div
        className="w-full h-[100dvh] md:h-[900px] max-w-[430px] overflow-hidden flex flex-col relative no-scrollbar"
        style={{
          background: 'rgba(255,255,255,0.18)',
          backdropFilter: 'blur(2px)',
          borderRadius: '0 0 0 0',
        }}
      >
        {/* MD screen: show as phone frame */}
        <style>{`
          @media (min-width: 768px) {
            .phone-frame {
              border-radius: 48px !important;
              border: 10px solid rgba(255,255,255,0.4) !important;
              box-shadow: 0 40px 80px rgba(100,120,180,0.25), inset 0 1px 0 rgba(255,255,255,0.6) !important;
            }
          }
        `}</style>

        {/* ── Header ─────────────────────────────────────────── */}
        <header className="w-full pt-12 pb-3 px-6 flex items-center justify-between z-20 relative flex-shrink-0">
          {/* Greeting */}
          <div className="flex flex-col leading-snug">
            <span
              className="text-[11px] font-semibold tracking-[0.18em] uppercase"
              style={{ color: 'rgba(26,26,46,0.45)' }}
            >
              {currentDate}
            </span>
            <span
              className="text-2xl font-bold tracking-tight mt-0.5"
              style={{ color: '#1a1a2e' }}
            >
              {greeting} 👋
            </span>
          </div>

          {/* Avatar + Notif */}
          <div className="flex items-center gap-3">
            <button
              className="glass-pill w-10 h-10 rounded-full flex items-center justify-center relative"
              style={{ color: 'rgba(26,26,46,0.55)' }}
            >
              <Bell size={18} />
              <span
                className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full"
                style={{ background: '#f5b8d5', border: '1.5px solid white' }}
              />
            </button>
            <div
              className="glass-pill w-11 h-11 rounded-full flex items-center justify-center font-bold text-base"
              style={{ color: '#3a7bd5', fontSize: '1.1rem' }}
            >
              B
            </div>
          </div>
        </header>

        {/* ── Scrollable Main ────────────────────────────────── */}
        <main className="flex-1 w-full overflow-y-auto pb-36 z-10 flex flex-col no-scrollbar">

          {/* Section Label */}


          {/* Voice Agent */}
          <div className="w-full flex-shrink-0 flex items-center justify-center py-2 px-6">
            <VoiceAgent onPanelChange={setPanelState} />
          </div>

          {/* Dynamic Panel */}
          <div className="w-full flex-1 px-6">
            <DynamicPanel state={panelState} />
          </div>
        </main>



        {/* ── Bottom Navigation — compact auto-width pill ── */}
        <div className="absolute bottom-7 left-0 right-0 flex justify-center z-50">
          <nav
            className="glass-pill"
            style={{ 
              borderRadius: 40, 
              padding: '8px 8px', 
              display: 'inline-flex', 
              gap: 2,
              background: 'rgba(255, 255, 255, 0.45)',
              backdropFilter: 'blur(30px) saturate(210%) brightness(1.07)',
              WebkitBackdropFilter: 'blur(30px) saturate(210%) brightness(1.07)',
              border: '1.5px solid rgba(255, 255, 255, 0.75)',
              boxShadow: '0 8px 32px rgba(80,100,160,0.15), inset 0 1.5px 0 rgba(255,255,255,0.9), inset 0 -1px 0 rgba(255,255,255,0.2)'
            }}
          >
            {[
              { icon: HomeIcon, active: true, label: 'Home' },
              { icon: Search, active: false, label: 'Cari' },
              { icon: Bell, active: false, label: 'Notif' },
              { icon: Settings, active: false, label: 'Setelan' },
            ].map(({ icon: Icon, active, label }) => (
              <button
                key={label}
                title={label}
                onClick={() => {
                  if (label === 'Cari') setPanelState({ type: 'search' });
                  if (label === 'Home') setPanelState({ type: 'idle' });
                }}
                className="flex flex-col items-center justify-center transition-all"
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 30,
                  background: active && panelState.type !== 'search'
                    ? 'rgba(255,255,255,0.55)'
                    : label === 'Cari' && panelState.type === 'search'
                    ? 'rgba(255,255,255,0.55)'
                    : 'transparent',
                  boxShadow: active && panelState.type !== 'search'
                    ? '0 2px 10px rgba(80,100,160,0.14), inset 0 1px 0 rgba(255,255,255,0.9)'
                    : label === 'Cari' && panelState.type === 'search'
                    ? '0 2px 10px rgba(80,100,160,0.14), inset 0 1px 0 rgba(255,255,255,0.9)'
                    : 'none',
                  color: (active && panelState.type !== 'search') || (label === 'Cari' && panelState.type === 'search') ? '#3a7bd5' : 'rgba(26,26,46,0.4)',
                  border: (active && panelState.type !== 'search') || (label === 'Cari' && panelState.type === 'search') ? '1px solid rgba(255,255,255,0.75)' : '1px solid transparent',
                }}
              >
                <Icon size={19} strokeWidth={active ? 2.2 : 1.7} />
                {active && (
                  <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.05em', marginTop: 1, color: '#3a7bd5' }}>
                    {label}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>
      </div>
    </div>
  );
}
