"use client";

import React, { useState } from 'react';
import VoiceAgent from '@/components/VoiceAgent';
import DynamicPanel from '@/components/DynamicPanel';

export default function Home() {
  const [panelState, setPanelState] = useState<{
    type: 'idle' | 'products' | 'faq' | 'lead_form';
    data?: any;
  }>({ type: 'idle' });

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-primary/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-secondary/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <header className="w-full py-6 px-8 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center text-white font-bold text-xl shadow-lg">
            B
          </div>
          <h1 className="text-2xl font-outfit font-bold text-primary">Bank BRI</h1>
        </div>
        <div className="text-sm font-medium text-slate-500 bg-white/60 px-4 py-2 rounded-full border border-slate-200">
          MVP Virtual Assistant
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 z-10">
        
        {/* Left Column: Voice Agent */}
        <section className="col-span-1 lg:col-span-5 flex flex-col items-center justify-center">
          <VoiceAgent onPanelChange={setPanelState} />
        </section>

        {/* Right Column: Dynamic Content */}
        <section className="col-span-1 lg:col-span-7 flex flex-col">
          <div className="flex-1 glass-panel rounded-3xl p-6 md:p-10 flex flex-col transition-all duration-500 ease-in-out h-[600px] overflow-y-auto">
            <DynamicPanel state={panelState} />
          </div>
        </section>

      </main>
    </div>
  );
}
