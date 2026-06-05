"use client";

import React, { useState, useEffect } from 'react';
import { CreditCard, Building2, HelpCircle, Send, Wallet, Zap, ArrowRight, CheckCircle2, Sparkles, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface DynamicPanelProps {
  state: {
    type: 'idle' | 'products' | 'faq' | 'faq_steps' | 'lead_form' | 'search';
    data?: any;
  };
}

/* ── Bento card palette ───────────────────────────────────── */
const bentoColors = [
  { bg: 'linear-gradient(135deg, #c8e6ff 0%, #a8d4ff 100%)', accent: '#5b9ee8', text: '#1a3a5c' },
  { bg: 'linear-gradient(135deg, #e4d9ff 0%, #cbbcf5 100%)', accent: '#9278dc', text: '#2d1f5c' },
  { bg: 'linear-gradient(135deg, #ffe4f0 0%, #f5c5d8 100%)', accent: '#d46090', text: '#5c1f3a' },
  { bg: 'linear-gradient(135deg, #fff8d0 0%, #f5e4a0 100%)', accent: '#c4980a', text: '#5c3a00' },
  { bg: 'linear-gradient(135deg, #d0ffe8 0%, #a8f0cc 100%)', accent: '#28b870', text: '#0c4028' },
  { bg: 'linear-gradient(135deg, #ffe4d0 0%, #f5c4a0 100%)', accent: '#e07840', text: '#5c2800' },
];

const cardVariants = {
  hidden: { opacity: 0, y: 16, scale: 0.96 },
  visible: (i: number) => ({
    opacity: 1, y: 0, scale: 1,
    transition: { delay: i * 0.07, duration: 0.4, ease: [0.22, 1, 0.36, 1] },
  }),
};

export default function DynamicPanel({ state }: DynamicPanelProps) {
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

      /* ── SEARCH ───────────────────────────────────────── */
      case 'search': {
        return (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="flex flex-col h-full">
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input 
                  autoFocus
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch(searchQuery)}
                  placeholder="Cari fitur, produk, atau panduan..."
                  className="w-full pl-11 pr-4 py-3 rounded-full outline-none"
                  style={{ background: 'rgba(255,255,255,0.6)', border: '1.5px solid rgba(255,255,255,0.8)', boxShadow: '0 4px 15px rgba(0,0,0,0.03)', color: '#1a1a2e', fontSize: 14 }}
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar pb-24">
              {/* Saran Pencarian */}
              {!searchResults && !isSearching && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Saran Pencarian</p>
                  <div className="flex flex-wrap gap-2">
                    {suggestions.map((s, i) => (
                      <button 
                        key={i} 
                        onClick={() => handleSearch(s)}
                        className="px-4 py-2 rounded-full text-sm font-medium transition-all hover:scale-105"
                        style={{ background: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.8)', color: '#3a7bd5', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}
                      >
                        {s}
                      </button>
                    ))}
                    {suggestions.length === 0 && <span className="text-sm text-gray-400">Memuat...</span>}
                  </div>
                </motion.div>
              )}

              {/* Loading State */}
              {isSearching && (
                <div className="mt-8 flex flex-col items-center justify-center text-center text-sm text-gray-500 animate-pulse gap-2">
                  <Search size={24} className="text-gray-300" />
                  Mencari dari Knowledge Base BRI...
                </div>
              )}

              {/* Hasil Pencarian */}
              {searchResults && !isSearching && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">Hasil Pencarian</p>
                  {searchResults.map((res: any, i: number) => {
                    const col = bentoColors[i % bentoColors.length];
                    return (
                      <div 
                        key={i}
                        className="p-4 rounded-2xl flex flex-col gap-1"
                        style={{ 
                          background: col.bg.replace(/rgba\((\d+),(\d+),(\d+),([\.\d]+)\)/g, (m: string, r: string, g: string, b: string, a: string) => `rgba(${r},${g},${b},${Math.min(parseFloat(a), 0.72)})`),
                          border: '1.5px solid rgba(255,255,255,0.7)', 
                          boxShadow: '0 4px 16px rgba(80,100,160,0.05)' 
                        }}
                      >
                        <h3 style={{ fontSize: 14, fontWeight: 800, color: col.text, letterSpacing: '-0.01em' }}>{res.title}</h3>
                        <p style={{ fontSize: 12, color: col.text, opacity: 0.75, lineHeight: 1.5 }}>{res.desc}</p>
                      </div>
                    );
                  })}
                  {searchResults.length === 0 && (
                    <div className="text-center py-8 text-sm text-gray-400">
                      Tidak ada hasil yang cocok.
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
          { title: 'BRImo', desc: 'Super app keuangan digital', icon: <Zap size={22} /> },
          { title: 'BRI Ceria', desc: 'Paylater & kartu kredit', icon: <CreditCard size={22} /> },
          { title: 'Tabungan Haji', desc: 'Siapkan biaya ibadah haji', icon: <Building2 size={22} /> },
          { title: 'KUR BRI', desc: 'Modal usaha untuk UMKM', icon: <Wallet size={22} /> },
          { title: 'BritAma', desc: 'Tabungan serba mudah', icon: <CreditCard size={22} /> },
          { title: 'QRIS BRI', desc: 'Bayar nontunai praktis', icon: <Send size={22} /> },
        ];
        const products = state.data?.length > 0 ? state.data : defaultProducts;

        return (
          <motion.div initial="hidden" animate="visible">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(26,26,46,0.42)', marginBottom: 2 }}>
                  Temukan
                </p>
                <h2 style={{ fontSize: 22, fontWeight: 800, color: '#1a1a2e', letterSpacing: '-0.02em' }}>
                  Produk BRI
                </h2>
              </div>
              <Sparkles size={20} style={{ color: '#b8a9f5' }} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              {products.map((p: any, i: number) => {
                const col = bentoColors[i % bentoColors.length];
                return (
                  <motion.div
                    key={i}
                    custom={i}
                    variants={cardVariants}
                    whileHover={{ y: -4, scale: 1.03 }}
                    style={{
                      background: col.bg.replace(/rgba\((\d+),(\d+),(\d+),([\.\d]+)\)/g, (m: string, r: string, g: string, b: string, a: string) => `rgba(${r},${g},${b},${Math.min(parseFloat(a), 0.72)})`),
                      borderRadius: 22,
                      padding: '16px 14px',
                      border: '1.5px solid rgba(255,255,255,0.72)',
                      backdropFilter: 'blur(32px) saturate(200%)',
                      WebkitBackdropFilter: 'blur(32px) saturate(200%)',
                      boxShadow: '0 4px 20px rgba(80,100,160,0.12), inset 0 1.5px 0 rgba(255,255,255,0.85)',
                      cursor: 'pointer',
                      position: 'relative',
                      overflow: 'hidden',
                    }}
                  >
                    {/* Glass top highlight */}
                    <div style={{
                      position: 'absolute', top: 0, left: 0, right: 0, height: '42%',
                      background: 'linear-gradient(180deg, rgba(255,255,255,0.42) 0%, transparent 100%)',
                      borderRadius: '22px 22px 0 0', pointerEvents: 'none',
                    }} />
                    {/* Shimmer sweep */}

                    <div style={{ color: col.accent, marginBottom: 10 }}>{p.icon || <Building2 size={22} />}</div>
                    <h3 style={{ fontSize: 14, fontWeight: 800, color: col.text, marginBottom: 4, letterSpacing: '-0.01em' }}>{p.title}</h3>
                    <p style={{ fontSize: 11, color: col.text, opacity: 0.65, lineHeight: 1.45 }}>{p.desc}</p>
                    <div style={{ marginTop: 10, display: 'flex', justifyContent: 'flex-end' }}>
                      <ArrowRight size={14} style={{ color: col.accent }} />
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
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            style={{ maxWidth: 400, margin: '0 auto', width: '100%' }}
          >
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{
                width: 52, height: 52, borderRadius: 18,
                background: 'linear-gradient(135deg, #e4d9ff, #cbbcf5)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 12px',
                border: '1.5px solid rgba(255,255,255,0.8)',
                boxShadow: '0 4px 16px rgba(184,169,245,0.3)',
              }}>
                <Send size={22} style={{ color: '#9278dc' }} />
              </div>
              <h2 style={{ fontSize: 22, fontWeight: 800, color: '#1a1a2e', letterSpacing: '-0.02em', marginBottom: 6 }}>
                Tinggalkan Kontak
              </h2>
              <p style={{ fontSize: 13, color: 'rgba(26,26,46,0.5)', lineHeight: 1.55 }}>
                Tim kami akan segera menghubungi Anda.
              </p>
            </div>

            <AnimatePresence mode="wait">
              {submitted ? (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  style={{
                    background: 'linear-gradient(135deg, #d0ffe8, #a8f0cc)',
                    border: '1.5px solid rgba(255,255,255,0.8)',
                    borderRadius: 24,
                    padding: '28px 20px',
                    textAlign: 'center',
                    boxShadow: '0 6px 24px rgba(40,184,112,0.18)',
                  }}
                >
                  <CheckCircle2 size={40} style={{ color: '#28b870', margin: '0 auto 10px' }} />
                  <h3 style={{ fontSize: 18, fontWeight: 800, color: '#0c4028', marginBottom: 6 }}>Terima Kasih!</h3>
                  <p style={{ fontSize: 13, color: 'rgba(12,64,40,0.65)' }}>Data Anda telah berhasil kami terima.</p>
                </motion.div>
              ) : (
                <motion.form
                  key="form"
                  onSubmit={(e) => { e.preventDefault(); setSubmitted(true); }}
                  style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
                >
                  {[
                    { field: 'name', label: 'Nama Lengkap', type: 'text', placeholder: 'Masukkan nama Anda' },
                    { field: 'phone', label: 'Nomor Telepon', type: 'tel', placeholder: '08xxxxxxxxxx' },
                    { field: 'email', label: 'Email', type: 'email', placeholder: 'email@contoh.com' },
                  ].map(({ field, label, type, placeholder }) => (
                    <div key={field}>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'rgba(26,26,46,0.6)', marginBottom: 5, letterSpacing: '0.04em' }}>
                        {label}
                      </label>
                      <input
                        className="glass-input"
                        value={(formData as any)[field]}
                        onChange={e => setFormData({ ...formData, [field]: e.target.value })}
                        required
                        type={type}
                        placeholder={placeholder}
                        style={{
                          width: '100%',
                          padding: '12px 16px',
                          borderRadius: 14,
                          border: '1.5px solid rgba(255,255,255,0.75)',
                          background: 'rgba(255,255,255,0.52)',
                          fontSize: 14,
                          color: '#1a1a2e',
                          outline: 'none',
                          boxShadow: '0 2px 10px rgba(100,120,180,0.08)',
                          transition: 'all 0.2s',
                        }}
                      />
                    </div>
                  ))}

                  <motion.button
                    type="submit"
                    whileHover={{ scale: 1.02, y: -1 }}
                    whileTap={{ scale: 0.97 }}
                    style={{
                      width: '100%',
                      padding: '14px',
                      borderRadius: 18,
                      border: '1.5px solid rgba(255,255,255,0.5)',
                      background: 'linear-gradient(135deg, #b8a9f5 0%, #9278dc 100%)',
                      color: '#fff',
                      fontSize: 15,
                      fontWeight: 700,
                      letterSpacing: '0.02em',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      cursor: 'pointer',
                      boxShadow: '0 8px 24px rgba(146,120,220,0.35)',
                      marginTop: 6,
                    }}
                  >
                    <Send size={16} /> Kirim Data
                  </motion.button>
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
            <div className="flex items-center justify-between mb-4">
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(26,26,46,0.42)', marginBottom: 2 }}>
                  Informasi
                </p>
                <h2 style={{ fontSize: 22, fontWeight: 800, color: '#1a1a2e', letterSpacing: '-0.02em' }}>
                  Panduan & Tata Cara
                </h2>
              </div>
              <HelpCircle size={20} style={{ color: '#b8a9f5' }} />
            </div>
            
            <div className="flex flex-col gap-3">
              {steps.map((step: any, i: number) => {
                const col = bentoColors[i % bentoColors.length];
                return (
                  <motion.div
                    key={i}
                    custom={i}
                    variants={cardVariants}
                    whileHover={{ scale: 1.01, x: 2 }}
                    style={{
                      background: col.bg.replace(/rgba\((\d+),(\d+),(\d+),([\.\d]+)\)/g, (m: string, r: string, g: string, b: string, a: string) => `rgba(${r},${g},${b},${Math.min(parseFloat(a), 0.72)})`),
                      borderRadius: 18,
                      padding: '16px 14px',
                      border: '1.5px solid rgba(255,255,255,0.72)',
                      backdropFilter: 'blur(32px) saturate(200%)',
                      WebkitBackdropFilter: 'blur(32px) saturate(200%)',
                      boxShadow: '0 4px 16px rgba(80,100,160,0.08), inset 0 1.5px 0 rgba(255,255,255,0.85)',
                      display: 'flex',
                      gap: 12,
                      alignItems: 'flex-start',
                      position: 'relative',
                      overflow: 'hidden'
                    }}
                  >
                    {/* Glass top highlight */}
                    <div style={{
                      position: 'absolute', top: 0, left: 0, right: 0, height: '42%',
                      background: 'linear-gradient(180deg, rgba(255,255,255,0.42) 0%, transparent 100%)',
                      borderRadius: '18px 18px 0 0', pointerEvents: 'none',
                    }} />
                    
                    {/* Number Badge */}
                    <div style={{
                      width: 28, height: 28, flexShrink: 0, borderRadius: '50%',
                      background: 'rgba(255,255,255,0.6)', border: '1.5px solid rgba(255,255,255,0.9)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 13, fontWeight: 800, color: col.accent,
                      boxShadow: '0 2px 8px rgba(0,0,0,0.05)', marginTop: 2
                    }}>
                      {i + 1}
                    </div>
                    
                    <div style={{ flex: 1 }}>
                      <h3 style={{ fontSize: 14, fontWeight: 800, color: col.text, marginBottom: 4, letterSpacing: '-0.01em' }}>
                        {step.title || 'Langkah ' + (i + 1)}
                      </h3>
                      <p style={{ fontSize: 12, color: col.text, opacity: 0.75, lineHeight: 1.5 }}>
                        {step.desc}
                      </p>
                    </div>
                  </motion.div>
                );
              })}
              
              {steps.length === 0 && (
                <div style={{ textAlign: 'center', padding: '20px', color: 'rgba(26,26,46,0.5)', fontSize: 13 }}>
                  Sedang memuat data...
                </div>
              )}
            </div>
          </motion.div>
        );
      }

      /* ── IDLE / DEFAULT dashboard ─────────────────────── */
      case 'idle':
      default: {
        const categories = [
          {
            title: 'Tabungan',
            value: 'Rp 4.500.000',
            icon: <Building2 size={20} />,
            col: bentoColors[0],
            span: 1,
          },
          {
            title: 'Tagihan',
            value: '2 Jatuh Tempo',
            icon: <CreditCard size={20} />,
            col: bentoColors[2],
            span: 1,
            alert: true,
          },
          {
            title: 'Investasi',
            value: 'Portofolio Stabil',
            icon: <Zap size={20} />,
            col: bentoColors[4],
            span: 1,
          },
          {
            title: 'Promo Aktif',
            value: '12 Penawaran',
            icon: <Sparkles size={20} />,
            col: bentoColors[3],
            span: 1,
          },
        ];

        return (
          <motion.div initial="hidden" animate="visible">
            {/* Section header */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(26,26,46,0.42)', marginBottom: 2 }}>
                  Overview
                </p>
                <h2 style={{ fontSize: 22, fontWeight: 800, color: '#1a1a2e', letterSpacing: '-0.02em' }}>
                  Layanan Utama
                </h2>
              </div>
              <HelpCircle size={18} style={{ color: 'rgba(26,26,46,0.3)' }} />
            </div>

            {/* Bento grid */}
            <div className="grid grid-cols-2 gap-3">
              {categories.map((c, i) => (
                <motion.div
                  key={i}
                  custom={i}
                  variants={cardVariants}
                  whileHover={{ y: -4, scale: 1.03 }}
                  style={{
                    background: c.col.bg.replace('0.72', '0.55'),
                    backdropFilter: 'blur(34px) saturate(210%)',
                    WebkitBackdropFilter: 'blur(34px) saturate(210%)',
                    borderRadius: 22,
                    padding: '18px 16px',
                    border: '1.5px solid rgba(255,255,255,0.75)',
                    boxShadow: '0 4px 22px rgba(80,100,160,0.12), inset 0 1.5px 0 rgba(255,255,255,0.85)',
                    cursor: 'pointer',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  {/* Glass highlight */}
                  <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0, height: '40%',
                    background: 'linear-gradient(180deg, rgba(255,255,255,0.44) 0%, transparent 100%)',
                    borderRadius: '22px 22px 0 0', pointerEvents: 'none',
                  }} />
                  {/* Shimmer */}


                  {/* Alert dot */}
                  {c.alert && (
                    <motion.div
                      animate={{ scale: [1, 1.3, 1] }}
                      transition={{ repeat: Infinity, duration: 1.5 }}
                      style={{
                        position: 'absolute', top: 12, right: 12,
                        width: 8, height: 8, borderRadius: '50%',
                        background: '#f5b8d5',
                        boxShadow: '0 0 8px rgba(245,184,213,0.7)',
                      }}
                    />
                  )}

                  <div style={{ color: c.col.accent, marginBottom: 12 }}>{c.icon}</div>
                  <h4 style={{ fontSize: 13, fontWeight: 700, color: c.col.text, marginBottom: 4, letterSpacing: '-0.01em' }}>
                    {c.title}
                  </h4>
                  <div style={{
                    display: 'inline-block',
                    fontSize: 11,
                    fontWeight: 700,
                    color: c.col.accent,
                    background: 'rgba(255,255,255,0.5)',
                    border: '1px solid rgba(255,255,255,0.7)',
                    borderRadius: 10,
                    padding: '3px 8px',
                    letterSpacing: '0.02em',
                  }}>
                    {c.value}
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Quick action strip */}
            <motion.div
              custom={4}
              variants={cardVariants}
              style={{
                marginTop: 12,
                background: 'linear-gradient(135deg, rgba(255,255,255,0.48) 0%, rgba(220,210,255,0.32) 100%)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                border: '1.5px solid rgba(255,255,255,0.75)',
                borderRadius: 20,
                padding: '14px 18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                boxShadow: '0 4px 16px rgba(100,120,180,0.1)',
              }}
            >
              <div>
                <p style={{ fontSize: 11, fontWeight: 600, color: 'rgba(26,26,46,0.45)', marginBottom: 2, letterSpacing: '0.04em' }}>
                  Butuh bantuan?
                </p>
                <p style={{ fontSize: 14, fontWeight: 700, color: '#1a1a2e' }}>
                  Tanya Bambang langsung 🎙️
                </p>
              </div>
              <div style={{
                width: 36, height: 36, borderRadius: 12,
                background: 'linear-gradient(135deg, #b8a9f5, #9278dc)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(146,120,220,0.3)',
              }}>
                <ArrowRight size={16} style={{ color: '#fff' }} />
              </div>
            </motion.div>
          </motion.div>
        );
      }
    }
  };

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex-1 flex flex-col justify-start pb-4">
        {renderContent()}
      </div>
    </div>
  );
}
