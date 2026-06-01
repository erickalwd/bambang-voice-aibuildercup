"use client";

import React, { useState, useEffect } from 'react';
import VoiceAgent from '@/components/VoiceAgent';
import DynamicPanel from '@/components/DynamicPanel';
import { Home as HomeIcon, Settings, Search, MessageSquare, Menu } from 'lucide-react';

export default function Home() {
  const [panelState, setPanelState] = useState<{
    type: 'idle' | 'products' | 'faq' | 'lead_form';
    data?: any;
  }>({ type: 'idle' });

  // Format current date like "08 Jul"
  const [currentDate, setCurrentDate] = useState("");
  useEffect(() => {
    const d = new Date();
    const day = d.getDate().toString().padStart(2, '0');
    const month = d.toLocaleString('en-US', { month: 'short' });
    setCurrentDate(`${day}\n${month}`);
  }, []);

  return (
    <div className="min-h-screen bg-slate-200 flex items-center justify-center p-0 md:p-4 font-sans">
      
      {/* Mobile Frame Container */}
      <div className="w-full h-[100dvh] md:h-[900px] max-w-[430px] bg-white md:rounded-[48px] md:shadow-2xl overflow-hidden flex flex-col relative border-0 md:border-[12px] border-slate-900">
        
        {/* Subtle Background Glows */}
        <div className="absolute top-[-10%] left-[-20%] w-[120%] h-[50%] bg-gradient-to-br from-primary/5 to-accent/10 rounded-[100%] blur-[80px] pointer-events-none animate-[pulse_8s_ease-in-out_infinite]" />
        <div className="absolute bottom-[10%] right-[-30%] w-[100%] h-[60%] bg-gradient-to-tl from-secondary/5 to-accent/10 rounded-[100%] blur-[100px] pointer-events-none animate-[pulse_12s_ease-in-out_infinite_reverse]" />

        {/* Top Header */}
        <header className="w-full pt-12 pb-2 px-6 flex items-start justify-between z-10 relative">
          <div className="flex flex-col text-slate-800 leading-tight">
            {currentDate.split('\n').map((line, i) => (
              <span key={i} className={i === 1 ? 'text-xs text-slate-400 font-medium tracking-widest uppercase' : 'text-3xl font-bold tracking-tighter'}>{line}</span>
            ))}
          </div>
          <div className="w-12 h-12 bg-white rounded-full border border-slate-200 shadow-sm overflow-hidden flex items-center justify-center relative">
            <div className="absolute inset-0 bg-gradient-to-tr from-primary/10 to-accent/10" />
            <div className="w-full h-full text-primary flex items-center justify-center font-bold text-lg relative z-10">B</div>
          </div>
        </header>

        {/* Main Scrolling Content (No horizontal padding here to allow edge-to-edge scrolling) */}
        <main className="flex-1 w-full overflow-y-auto pb-32 z-10 flex flex-col no-scrollbar">
          
          {/* Visualizer & Connection (VoiceAgent) */}
          <div className="w-full flex-shrink-0 flex items-center justify-center py-4 px-6">
            <VoiceAgent onPanelChange={setPanelState} />
          </div>


          {/* Dynamic Dashboard / Cards */}
          <div className="w-full flex-1 px-6">
            <DynamicPanel state={panelState} />
          </div>
        </main>

        {/* Bottom Navigation Bar (Floating Pill) */}
        <nav className="absolute bottom-6 left-6 right-6 bg-white/70 backdrop-blur-2xl border border-white shadow-[0_20px_40px_-10px_rgba(0,0,0,0.15)] rounded-[32px] z-50">
          <div className="flex items-center justify-between px-8 py-4">
            <button className="text-slate-400 hover:text-primary transition-colors">
              <HomeIcon size={24} className="text-primary fill-primary/10" />
            </button>
            <button className="text-slate-400 hover:text-primary transition-colors">
              <Settings size={24} />
            </button>
            <button className="text-slate-400 hover:text-primary transition-colors">
              <Search size={24} />
            </button>
            <button className="text-slate-400 hover:text-primary transition-colors">
              <Menu size={24} />
            </button>
          </div>
        </nav>
        
      </div>
    </div>
  );
}
