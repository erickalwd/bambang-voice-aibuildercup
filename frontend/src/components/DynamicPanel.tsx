"use client";

import React, { useState, useEffect } from 'react';
import { CreditCard, Building2, Send, Wallet, Zap, ArrowRight, ArrowUpRight, CheckCircle2, Sparkles, Search, ShieldAlert, Mic, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useI18n } from '@/lib/i18n';

interface DynamicPanelProps {
  state: {
    type: 'idle' | 'products' | 'faq' | 'faq_steps' | 'lead_form' | 'search' | 'fraud_alert';
    data?: any;
  };
}

/* ── Motion — BRI standard curve, fade only (no scale, no spring) ── */
const EASE = [0.4, 0, 0.2, 1] as const;

const cardVariants: any = {
  hidden: { opacity: 0, y: 4 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.05, duration: 0.3, ease: EASE },
  }),
};

const fadeIn = {
  initial: { opacity: 0, y: 4 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3, ease: EASE },
};

function SectionHeader({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <p className="eyebrow">{eyebrow}</p>
      <h2 className="section-title" style={{ marginTop: 2 }}>{title}</h2>
    </div>
  );
}

export default function DynamicPanel({ state }: DynamicPanelProps) {
  const { t } = useI18n();
  const [formData, setFormData] = useState({ name: '', phone: '', email: '' });
  const [submitted, setSubmitted] = useState(false);

  // Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[] | null>(null);

  useEffect(() => {
    if (state.type === 'search' && suggestions.length === 0) {
      fetch('http://localhost:8000/api/suggestions')
        .then(res => res.json())
        .then(data => {
          if (data.suggestions) setSuggestions(data.suggestions);
        })
        .catch(console.error);
    }
  }, [state.type]);

  const handleSearch = async (query: string) => {
    if (!query.trim()) return;
    setSearchQuery(query);
    setIsSearching(true);
    setSearchResults(null);
    try {
      const res = await fetch(`http://localhost:8000/api/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (data.results) {
        setSearchResults(data.results);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    const handleFormFill = (e: any) => {
      const data = e.detail;
      setFormData(prev => ({ ...prev, [data.field]: data.value }));
    };
    window.addEventListener('form-fill', handleFormFill);
    return () => window.removeEventListener('form-fill', handleFormFill);
  }, []);

  const renderContent = () => {
    switch (state.type) {

      /* ── FRAUD ALERT ──────────────────────────────────── */
      case 'fraud_alert': {
        return (
          <motion.div {...fadeIn} className="list" style={{ borderColor: 'var(--danger-border)' }}>
            <div className="flex items-center" style={{ gap: 14, padding: 16, background: 'var(--danger-bg)' }}>
              <div
                className="flex items-center justify-center flex-shrink-0"
                style={{ width: 52, height: 52, borderRadius: '22%', background: 'var(--danger-fg)', color: '#fff' }}
              >
                <ShieldAlert size={26} strokeWidth={1.75} />
              </div>
              <div>
                <p className="eyebrow" style={{ color: 'var(--danger-fg)' }}>{t.fraud.eyebrow}</p>
                <h2 style={{ font: '700 18px/26px var(--font-sans)', color: 'var(--fg1)' }}>
                  {t.fraud.title}
                </h2>
              </div>
            </div>
            <div style={{ padding: 16, font: '400 14px/22px var(--font-sans)', color: 'var(--fg2)' }}>
              {t.fraud.bodyBefore}<strong style={{ color: 'var(--fg1)' }}>{t.fraud.bodyStrong}</strong>{t.fraud.bodyAfter}
            </div>
          </motion.div>
        );
      }

      /* ── SEARCH ───────────────────────────────────────── */
      case 'search': {
        return (
          <motion.div {...fadeIn} className="flex flex-col h-full">
            <SectionHeader eyebrow={t.search.eyebrow} title={t.search.title} />
            <div className="relative" style={{ marginBottom: 20 }}>
              <Search
                className="absolute top-1/2 -translate-y-1/2"
                style={{ left: 16, color: 'var(--primary-deep)' }}
                size={18}
              />
              <input
                autoFocus
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch(searchQuery)}
                placeholder={t.search.placeholder}
                className="input input-search"
                style={{ height: 48, boxShadow: 'var(--shadow-card)' }}
              />
            </div>

            <div className="flex-1">
              {/* Saran Pencarian */}
              {!searchResults && !isSearching && (
                <motion.div {...fadeIn}>
                  <p className="eyebrow" style={{ marginBottom: 10 }}>{t.search.suggestions}</p>
                  <div className="list">
                    {suggestions.map((s, i) => (
                      <button
                        key={i}
                        onClick={() => handleSearch(s)}
                        className="list-row w-full text-left items-center"
                        style={{ cursor: 'pointer' }}
                      >
                        <Search size={16} style={{ color: 'var(--fg5)', flexShrink: 0 }} />
                        <span style={{ flex: 1, font: '500 14px/22px var(--font-sans)', color: 'var(--fg1)' }}>{s}</span>
                        <ArrowUpRight size={16} style={{ color: 'var(--primary-mid)', flexShrink: 0 }} />
                      </button>
                    ))}
                    {suggestions.length === 0 && (
                      <div className="list-row" style={{ fontSize: 14, color: 'var(--fg5)' }}>{t.search.loadingSuggestions}</div>
                    )}
                  </div>
                </motion.div>
              )}

              {/* Loading State */}
              {isSearching && (
                <div className="list">
                  {[0, 1, 2].map(i => (
                    <div key={i} className="list-row animate-pulse">
                      <div className="icon-chip" style={{ background: 'var(--bg2)' }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ height: 12, width: '60%', borderRadius: 6, background: 'var(--bg2)', marginBottom: 8 }} />
                        <div style={{ height: 10, width: '90%', borderRadius: 5, background: 'var(--bg2)' }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Hasil Pencarian */}
              {searchResults && !isSearching && (
                <motion.div {...fadeIn}>
                  <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
                    <p className="eyebrow">{t.search.results}</p>
                    <span className="tag tag-blue">{t.search.count(searchResults.length)}</span>
                  </div>
                  {searchResults.length > 0 ? (
                    <div className="list">
                      {searchResults.map((res: any, i: number) => (
                        <motion.div key={i} custom={i} variants={cardVariants} initial="hidden" animate="visible" className="list-row">
                          <div className="icon-chip"><FileText size={18} strokeWidth={1.75} /></div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <h3 style={{ font: '700 14px/22px var(--font-sans)', color: 'var(--fg1)', marginBottom: 2 }}>{res.title}</h3>
                            <p style={{ font: '400 13px/20px var(--font-sans)', color: 'var(--fg2)' }}>{res.desc}</p>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  ) : (
                    <div className="card text-center" style={{ padding: '28px 16px', fontSize: 14, color: 'var(--fg3)' }}>
                      {t.search.empty}
                    </div>
                  )}
                </motion.div>
              )}
            </div>
          </motion.div>
        );
      }

      /* ── PRODUCTS ─────────────────────────────────────── */
      case 'products': {
        const defaultProducts = [
          { title: 'BRImo', desc: t.products.defaults[0], icon: <Zap size={20} strokeWidth={1.75} /> },
          { title: 'BRI Ceria', desc: t.products.defaults[1], icon: <CreditCard size={20} strokeWidth={1.75} /> },
          { title: 'Tabungan Haji', desc: t.products.defaults[2], icon: <Building2 size={20} strokeWidth={1.75} /> },
          { title: 'KUR BRI', desc: t.products.defaults[3], icon: <Wallet size={20} strokeWidth={1.75} /> },
          { title: 'BritAma', desc: t.products.defaults[4], icon: <CreditCard size={20} strokeWidth={1.75} /> },
          { title: 'QRIS BRI', desc: t.products.defaults[5], icon: <Send size={20} strokeWidth={1.75} /> },
        ];
        const products = state.data?.length > 0 ? state.data : defaultProducts;

        return (
          <motion.div initial="hidden" animate="visible">
            <SectionHeader eyebrow={t.products.eyebrow} title={t.products.title} />
            <div className="grid grid-cols-2" style={{ gap: 12 }}>
              {products.map((p: any, i: number) => {
                const featured = i === 0;
                return (
                  <motion.div
                    key={i}
                    custom={i}
                    variants={cardVariants}
                    className={`card hoverable flex ${featured ? 'card-hero col-span-2 items-center' : 'flex-col justify-between'}`}
                    style={{ minHeight: featured ? 96 : 150, gap: featured ? 14 : 0, padding: featured ? 16 : 14 }}
                  >
                    <div className={featured ? 'flex items-center' : ''} style={{ gap: 14, flex: featured ? 1 : undefined }}>
                      <div
                        className="icon-chip"
                        style={featured ? { width: 48, height: 48, borderRadius: '22%' } : { marginBottom: 12 }}
                      >
                        {p.icon || <Building2 size={20} strokeWidth={1.75} />}
                      </div>
                      <div>
                        {featured && <p className="eyebrow" style={{ color: 'var(--primary-light)', marginBottom: 2 }}>{t.products.featured}</p>}
                        <h3 style={{ font: featured ? '700 18px/26px var(--font-sans)' : '700 14px/20px var(--font-sans)', color: featured ? '#fff' : 'var(--fg1)', marginBottom: 2 }}>{p.title}</h3>
                        <p style={{ font: '400 12px/18px var(--font-sans)', color: featured ? 'var(--blue-100)' : 'var(--fg3)' }}>{p.desc}</p>
                      </div>
                    </div>
                    <div className="flex justify-end" style={{ marginTop: featured ? 0 : 8, color: featured ? '#fff' : 'var(--primary-mid)' }}>
                      <ArrowUpRight size={featured ? 20 : 16} />
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        );
      }

      /* ── LEAD FORM ────────────────────────────────────── */
      case 'lead_form': {
        return (
          <motion.div {...fadeIn} style={{ maxWidth: 400, margin: '0 auto', width: '100%' }}>
            <SectionHeader eyebrow={t.lead.eyebrow} title={t.lead.title} />
            <p style={{ font: '400 14px/22px var(--font-sans)', color: 'var(--fg3)', marginTop: -6, marginBottom: 16 }}>
              {t.lead.subtitle}
            </p>

            <AnimatePresence mode="wait">
              {submitted ? (
                <motion.div
                  key="success"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3, ease: EASE }}
                  className="card flex flex-col items-center text-center"
                  style={{ padding: '28px 16px', gap: 12 }}
                >
                  <div
                    className="flex items-center justify-center"
                    style={{ width: 56, height: 56, borderRadius: '22%', background: 'var(--success-bg)', border: '1px solid var(--success-border)', color: 'var(--success-fg)' }}
                  >
                    <CheckCircle2 size={28} strokeWidth={1.75} />
                  </div>
                  <div>
                    <h3 style={{ font: '700 18px/26px var(--font-sans)', color: 'var(--fg1)' }}>{t.lead.thanks}</h3>
                    <p style={{ font: '400 14px/22px var(--font-sans)', color: 'var(--fg3)' }}>{t.lead.received}</p>
                  </div>
                </motion.div>
              ) : (
                <motion.form
                  key="form"
                  onSubmit={(e) => { e.preventDefault(); setSubmitted(true); }}
                  className="card"
                  style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: 16 }}
                >
                  {[
                    { field: 'name', label: t.lead.name, type: 'text', placeholder: t.lead.namePlaceholder },
                    { field: 'phone', label: t.lead.phone, type: 'tel', placeholder: '08xxxxxxxxxx' },
                    { field: 'email', label: t.lead.email, type: 'email', placeholder: t.lead.emailPlaceholder },
                  ].map(({ field, label, type, placeholder }) => (
                    <div key={field}>
                      <label className="field-label" htmlFor={`lead-${field}`}>{label}</label>
                      <input
                        id={`lead-${field}`}
                        className="input"
                        value={(formData as any)[field]}
                        onChange={e => setFormData({ ...formData, [field]: e.target.value })}
                        required
                        type={type}
                        placeholder={placeholder}
                      />
                    </div>
                  ))}

                  <button type="submit" className="btn btn-primary btn-lg btn-block" style={{ marginTop: 4, borderRadius: 12, height: 48 }}>
                    <Send size={16} /> {t.lead.submit}
                  </button>
                </motion.form>
              )}
            </AnimatePresence>
          </motion.div>
        );
      }

      /* ── FAQ STEPS ────────────────────────────────────── */
      case 'faq_steps': {
        const steps = Array.isArray(state.data) && state.data.length > 0 ? state.data : [];

        return (
          <motion.div initial="hidden" animate="visible">
            <div className="flex items-end justify-between">
              <SectionHeader eyebrow={t.faq.eyebrow} title={t.faq.title} />
              {steps.length > 0 && <span className="tag tag-blue" style={{ marginBottom: 16 }}>{t.faq.steps(steps.length)}</span>}
            </div>

            <div className="timeline">
              {steps.map((step: any, i: number) => (
                <motion.div key={i} custom={i} variants={cardVariants} className="timeline-item">
                  <div className="timeline-node">{i + 1}</div>
                  <div className="card" style={{ flex: 1, padding: '12px 14px' }}>
                    <h3 style={{ font: '700 14px/22px var(--font-sans)', color: 'var(--fg1)', marginBottom: 2 }}>
                      {step.title || t.faq.step(i + 1)}
                    </h3>
                    <p style={{ font: '400 13px/20px var(--font-sans)', color: 'var(--fg2)' }}>
                      {step.desc}
                    </p>
                  </div>
                </motion.div>
              ))}

              {steps.length === 0 && (
                <div className="card text-center" style={{ padding: 20, color: 'var(--fg3)', fontSize: 14 }}>
                  {t.faq.loading}
                </div>
              )}
            </div>
          </motion.div>
        );
      }

      /* ── IDLE / DEFAULT dashboard ─────────────────────── */
      case 'idle':
      default: {
        const tiles = [
          { title: t.idle.bills, value: t.idle.billsValue, icon: <CreditCard size={18} strokeWidth={1.75} />, alert: true },
          { title: t.idle.investment, value: t.idle.investmentValue, icon: <Zap size={18} strokeWidth={1.75} /> },
          { title: t.idle.promos, value: t.idle.promosValue, icon: <Sparkles size={18} strokeWidth={1.75} /> },
        ];

        return (
          <motion.div initial="hidden" animate="visible">
            <SectionHeader eyebrow={t.idle.eyebrow} title={t.idle.title} />

            {/* Balance card */}
            <motion.div custom={0} variants={cardVariants} className="card hoverable" style={{ padding: 16 }}>
              <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
                <div className="flex items-center" style={{ gap: 10 }}>
                  <div className="icon-chip" style={{ width: 32, height: 32 }}><Building2 size={18} strokeWidth={1.75} /></div>
                  <p className="eyebrow">{t.idle.savings}</p>
                </div>
                <ArrowUpRight size={18} style={{ color: 'var(--primary-mid)' }} />
              </div>
              <p className="stat">Rp 4.500.000</p>
            </motion.div>

            {/* Tiles */}
            <div className="grid grid-cols-3" style={{ gap: 10, marginTop: 10 }}>
              {tiles.map((c, i) => (
                <motion.div
                  key={i}
                  custom={i + 1}
                  variants={cardVariants}
                  className="card hoverable flex flex-col justify-between relative"
                  style={{ minHeight: 118, padding: 12, gap: 10 }}
                >
                  {c.alert && (
                    <span
                      className="absolute rounded-full"
                      style={{ top: 12, right: 12, width: 8, height: 8, background: 'var(--danger-fg)' }}
                      aria-label={t.idle.billsAlert}
                    />
                  )}
                  <div className="icon-chip" style={{ width: 32, height: 32 }}>{c.icon}</div>
                  <div>
                    <p style={{ font: '500 12px/16px var(--font-sans)', color: 'var(--fg3)', marginBottom: 2 }}>{c.title}</p>
                    <p style={{ font: '700 13px/18px var(--font-sans)', color: c.alert ? 'var(--danger-fg)' : 'var(--fg1)' }}>{c.value}</p>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Quick action strip */}
            <motion.div
              custom={4}
              variants={cardVariants}
              className="card hoverable flex items-center justify-between"
              style={{ marginTop: 12, gap: 12, background: 'var(--blue-50)', borderColor: 'var(--blue-200)' }}
            >
              <div className="flex items-center" style={{ gap: 12 }}>
                <div
                  className="flex items-center justify-center flex-shrink-0"
                  style={{ width: 40, height: 40, borderRadius: '22%', background: 'var(--primary-deep)', color: '#fff' }}
                >
                  <Mic size={18} strokeWidth={1.75} />
                </div>
                <div>
                  <p style={{ font: '400 12px/18px var(--font-sans)', color: 'var(--blue-700)' }}>
                    {t.idle.helpEyebrow}
                  </p>
                  <p style={{ font: '700 14px/22px var(--font-sans)', color: 'var(--fg1)' }}>
                    {t.idle.helpTitle}
                  </p>
                </div>
              </div>
              <ArrowRight size={18} style={{ color: 'var(--primary-deep)' }} />
            </motion.div>
          </motion.div>
        );
      }
    }
  };

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex-1 flex flex-col justify-start">
        {renderContent()}
      </div>
    </div>
  );
}
