"use client";

import React, { useState, useEffect } from 'react';
import VoiceAgent from '@/components/VoiceAgent';
import DynamicPanel from '@/components/DynamicPanel';
import { Home as HomeIcon, Settings, Search, Bell } from 'lucide-react';
import { LanguageProvider, useI18n, type Lang } from '@/lib/i18n';

export default function Home() {
  return (
    <LanguageProvider>
      <HomeScreen />
    </LanguageProvider>
  );
}

function HomeScreen() {
  const { lang, setLang, t, locked } = useI18n();
  const [panelState, setPanelState] = useState<{
    type: 'idle' | 'products' | 'faq' | 'faq_steps' | 'lead_form' | 'search';
    data?: any;
  }>({ type: 'idle' });

  const [greeting, setGreeting] = useState('');
  const [currentDate, setCurrentDate] = useState('');

  useEffect(() => {
    const h = new Date().getHours();
    if (h < 11) setGreeting(t.greeting.morning);
    else if (h < 15) setGreeting(t.greeting.noon);
    else if (h < 18) setGreeting(t.greeting.afternoon);
    else setGreeting(t.greeting.evening);

    const d = new Date();
    setCurrentDate(
      d.toLocaleDateString(t.locale, { weekday: 'long', day: 'numeric', month: 'long' })
    );
  }, [t]);

  const isNavActive = (key: string) =>
    key === 'search' ? panelState.type === 'search' : key === 'home' && panelState.type !== 'search';

  return (
    <div className="min-h-screen flex items-center justify-center p-0 md:p-6" style={{ background: 'var(--bg2)' }}>
      {/* Phone Frame */}
      <div
        className="phone-frame w-full h-[100dvh] md:h-[900px] max-w-[430px] overflow-hidden flex flex-col relative"
        style={{ background: 'var(--bg1)' }}
      >
        <style>{`
          @media (min-width: 768px) {
            .phone-frame {
              border-radius: 36px;
              border: 1px solid var(--border-2);
              box-shadow: 0 20px 40px rgba(15, 23, 42, .12);
            }
          }
        `}</style>

        {/* ── Scrollable Main ────────────────────────────────── */}
        <main className="flex-1 w-full overflow-y-auto flex flex-col no-scrollbar">

          {/* ── Brand hero ─────────────────────────────────── */}
          <section className="hero flex-shrink-0">
            {/* Top bar */}
            <div className="flex items-center justify-between" style={{ height: 64 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/bri-logo-mark.svg" alt="BRI" className="logo-on-brand" style={{ height: 22, width: 'auto' }} />
              <div className="flex items-center gap-2">
                {/* Language switch */}
                <div
                  role="radiogroup"
                  aria-label={t.langSwitch.label}
                  title={locked ? t.langSwitch.locked : t.langSwitch.label}
                  className={`lang-switch ${locked ? 'is-locked' : ''}`}
                >
                  {(['id', 'en'] as Lang[]).map(code => (
                    <button
                      key={code}
                      role="radio"
                      aria-checked={lang === code}
                      disabled={locked}
                      onClick={() => setLang(code)}
                      className={lang === code ? 'is-active' : ''}
                    >
                      {code.toUpperCase()}
                    </button>
                  ))}
                </div>
                <button className="btn-on-brand" aria-label={t.topbar.notifications}>
                  <Bell size={18} strokeWidth={1.75} />
                  <span
                    className="absolute rounded-full"
                    style={{ top: 9, right: 10, width: 7, height: 7, background: 'var(--primary-light)' }}
                  />
                </button>
                <div
                  className="flex items-center justify-center"
                  style={{ width: 40, height: 40, borderRadius: 'var(--r-md)', background: '#fff', color: 'var(--primary-deep)', font: '700 15px/20px var(--font-sans)' }}
                  aria-label={t.topbar.profile}
                >
                  B
                </div>
              </div>
            </div>

            {/* Greeting */}
            <div style={{ marginTop: 12 }}>
              <p className="hero-eyebrow">{currentDate}</p>
              <h1 className="hero-title" style={{ marginTop: 6 }}>
                {greeting},<br />
                <span className="muted">{t.heroQuestion}</span>
              </h1>
            </div>

            {/* Voice Agent */}
            <div className="w-full flex flex-col items-center" style={{ marginTop: 20 }}>
              <VoiceAgent onPanelChange={setPanelState} />
            </div>
          </section>

          {/* ── Content sheet ──────────────────────────────── */}
          <section className="sheet">
            <DynamicPanel state={panelState} />
          </section>
        </main>

        {/* ── Floating Bottom Navigation ─────────────────────── */}
        <nav className="bottom-nav z-50">
          {[
            { icon: HomeIcon, key: 'home', label: t.nav.home },
            { icon: Search, key: 'search', label: t.nav.search },
            { icon: Bell, key: 'notif', label: t.nav.notif },
            { icon: Settings, key: 'settings', label: t.nav.settings },
          ].map(({ icon: Icon, key, label }) => {
            const active = isNavActive(key);
            return (
              <button
                key={key}
                title={label}
                aria-label={label}
                aria-current={active ? 'page' : undefined}
                onClick={() => {
                  if (key === 'search') setPanelState({ type: 'search' });
                  if (key === 'home') setPanelState({ type: 'idle' });
                }}
                className={`nav-item ${active ? 'is-active' : ''}`}
              >
                <Icon size={20} strokeWidth={active ? 2 : 1.75} />
                <span className="nav-label">{label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
