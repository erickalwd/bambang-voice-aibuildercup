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
        return (
          <div className="h-full flex flex-col items-center justify-center text-center opacity-70 animate-in fade-in duration-1000">
            <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-6">
              <HelpCircle className="w-10 h-10 text-slate-400" />
            </div>
            <h2 className="text-2xl font-semibold text-slate-700 mb-2">Pusat Informasi</h2>
            <p className="text-slate-500 max-w-sm">
              Silakan berbicara dengan asisten virtual kami. Informasi yang relevan akan muncul di sini.
            </p>
          </div>
        );
    }
  };

  return (
    <div className="w-full h-full flex flex-col">
      {/* Dev toolbar to simulate states */}
      <div className="flex gap-2 mb-6 pb-4 border-b border-slate-200">
        <span className="text-xs font-semibold text-slate-400 uppercase mr-2 mt-1">Simulate:</span>
        {['idle', 'products', 'lead_form'].map((t) => (
          <button 
            key={t}
            onClick={() => {
              if (t === 'lead_form') setSubmitted(false); // reset form
              // In real app, we wouldn't change this from inside but just a hack for MVP dev view
              state.type = t as any; 
              // React state hack for dev demo, normally comes from props
              window.dispatchEvent(new CustomEvent('demo-state-change', { detail: t }));
            }}
            className={`text-xs px-3 py-1 rounded-full border ${state.type === t ? 'bg-primary text-white border-primary' : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'}`}
          >
            {t}
          </button>
        ))}
      </div>
      
      {/* Content wrapper */}
      <div className="flex-1 flex flex-col justify-center">
        {renderContent()}
      </div>
    </div>
  );
}
