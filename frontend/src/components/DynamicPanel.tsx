"use client";

import React, { useState, useEffect } from 'react';
import { CreditCard, Building2, HelpCircle, Send } from 'lucide-react';

interface DynamicPanelProps {
  state: {
    type: 'idle' | 'products' | 'faq' | 'lead_form';
    data?: any;
  };
}

export default function DynamicPanel({ state }: DynamicPanelProps) {
  
  // Controlled Form State
  const [formData, setFormData] = useState({ name: '', phone: '', email: '' });
  const [submitted, setSubmitted] = useState(false);

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
      case 'products':
        const defaultProducts = [
          { title: 'BRImo', desc: 'Financial super app untuk transaksi digital', icon: <Send /> },
          { title: 'BRI Ceria', desc: 'Pinjaman paylater tanpa agunan & kartu kredit', icon: <CreditCard /> },
          { title: 'Tabungan Haji BRI', desc: 'Persiapkan biaya ibadah haji Anda', icon: <Building2 /> },
          { title: 'Kredit Usaha Rakyat (KUR)', desc: 'Solusi permodalan untuk UMKM', icon: <CreditCard /> },
          { title: 'Tabungan BRI BritAma', desc: 'Tabungan dengan beragam kemudahan transaksi', icon: <CreditCard /> },
          { title: 'QRIS BRI', desc: 'Solusi pembayaran non-tunai yang praktis', icon: <Send /> },
        ];
        const displayProducts = state.data && state.data.length > 0 ? state.data : defaultProducts;
        
        return (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-2xl font-bold text-primary mb-6">Produk Pilihan BRI</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {displayProducts.map((p: any, i: number) => (
                <div key={i} className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                  <div className="text-secondary mb-3">{p.icon || <Building2 />}</div>
                  <h3 className="font-semibold text-lg text-slate-800">{p.title}</h3>
                  <p className="text-sm text-slate-500 mt-2">{p.desc}</p>
                </div>
              ))}
            </div>
          </div>
        );
      
      case 'lead_form':
        return (
          <div className="animate-in zoom-in-95 duration-500 max-w-md mx-auto w-full">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-primary">Tinggalkan Kontak Anda</h2>
              <p className="text-slate-500 mt-2">Tim kami akan segera menghubungi Anda untuk informasi lebih lanjut.</p>
            </div>
            
            {submitted ? (
              <div className="bg-green-50 border border-green-200 text-green-700 p-6 rounded-2xl text-center">
                <h3 className="font-bold text-xl mb-2">Terima Kasih!</h3>
                <p>Data Anda telah berhasil kami terima.</p>
              </div>
            ) : (
              <form 
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  setSubmitted(true);
                }}
              >
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nama Lengkap</label>
                  <input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required type="text" className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all bg-white" placeholder="Masukkan nama Anda" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nomor Telepon</label>
                  <input value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} required type="tel" className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all bg-white" placeholder="08xxxxxxxxxx" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                  <input value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} required type="email" className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all bg-white" placeholder="email@contoh.com" />
                </div>
                
                <button type="submit" className="w-full bg-primary hover:bg-primary/90 text-white font-semibold py-4 rounded-xl shadow-lg transition-all flex justify-center items-center gap-2 mt-6">
                  <Send className="w-5 h-5" /> Kirim Data
                </button>
              </form>
            )}
          </div>
        );

      case 'idle':
      default:
        const defaultCategories = [
          { title: 'Tabungan', count: 'Rp 4.500.000', icon: <Building2 className="text-primary w-5 h-5" />, badgeBg: 'bg-primary/10', badgeText: 'text-primary' },
          { title: 'Tagihan', count: '2 Jatuh Tempo', icon: <CreditCard className="text-secondary w-5 h-5" />, badgeBg: 'bg-red-100', badgeText: 'text-red-600', alert: true },
          { title: 'Investasi', count: 'Portofolio Stabil', icon: <Send className="text-accent-foreground w-5 h-5" />, badgeBg: 'bg-accent/30', badgeText: 'text-accent-foreground' },
          { title: 'Promo', count: '12 Baru', icon: <HelpCircle className="text-green-600 w-5 h-5" />, badgeBg: 'bg-green-100', badgeText: 'text-green-700' },
        ];
        return (
          <div className="w-full flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-500 pb-4 relative z-10">
            <h3 className="text-slate-800 font-bold mb-3 px-1 text-sm tracking-wide">Layanan Utama</h3>
            <div className="grid grid-cols-2 gap-3">
              {defaultCategories.map((c, i) => (
                <div key={i} className="bg-white/50 backdrop-blur-xl border border-white shadow-[0_8px_24px_-8px_rgba(8,87,195,0.15)] rounded-[20px] p-4 flex flex-col hover:bg-white/70 hover:shadow-[0_16px_32px_-12px_rgba(8,87,195,0.25)] transition-all cursor-pointer relative overflow-hidden group">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  
                  <div className="flex justify-between items-start mb-3 relative z-10">
                    <div className="w-10 h-10 rounded-2xl bg-white shadow-sm flex items-center justify-center border border-slate-100/50">
                      {c.icon}
                    </div>
                    {c.alert && <div className="px-2 py-0.5 bg-red-500 text-white text-[9px] font-bold tracking-widest rounded-full animate-pulse shadow-md shadow-red-500/20">!</div>}
                  </div>
                  <h4 className="text-slate-800 font-bold text-sm mb-2 relative z-10">{c.title}</h4>
                  <div className="flex items-center justify-between mt-auto pt-1 relative z-10">
                    <div className={`text-[10px] px-2.5 py-1 rounded-lg font-bold tracking-wide border border-white/60 shadow-sm ${c.badgeBg} ${c.badgeText}`}>
                      {c.count}
                    </div>
                    <div className="text-slate-400 group-hover:text-primary group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all text-sm font-bold">
                      ↗
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
    }
  };

  return (
    <div className="w-full h-full flex flex-col">

      {/* Content wrapper */}
      <div className="flex-1 flex flex-col justify-center">
        {renderContent()}
      </div>
    </div>
  );
}
