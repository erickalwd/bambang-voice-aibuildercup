"use client";

import React, { createContext, useContext, useEffect, useState, useSyncExternalStore } from 'react';

export type Lang = 'id' | 'en';

const STORAGE_KEY = 'bambang-lang';

const id = {
  locale: 'id-ID',
  greeting: { morning: 'Selamat Pagi', noon: 'Selamat Siang', afternoon: 'Selamat Sore', evening: 'Selamat Malam' },
  heroQuestion: 'ada yang bisa Bambang bantu?',
  langSwitch: {
    label: 'Bahasa',
    locked: 'Hentikan percakapan untuk mengganti bahasa.',
  },
  topbar: { notifications: 'Notifikasi', profile: 'Profil' },
  nav: { home: 'Beranda', search: 'Cari', notif: 'Notif', settings: 'Setelan' },
  voice: {
    idle: { label: 'Sobat BRI', sub: 'Ketuk untuk mulai berbicara' },
    listening: { label: 'Mendengarkan', sub: 'Silakan bicara, Bambang mendengarkan' },
    speaking: { label: 'Bambang', sub: 'Bambang sedang menjawab' },
    start: 'Mulai percakapan suara',
    stop: 'Hentikan percakapan',
    micOn: 'Mikrofon Aktif',
    micOff: 'Mikrofon Mati',
    muteAria: 'Matikan mikrofon',
    unmuteAria: 'Aktifkan mikrofon',
    transcript: 'Bambang',
    error: 'Gagal mengakses mikrofon atau server.',
    limits: {
      busy: 'Bambang sedang melayani banyak pengguna. Silakan coba lagi sebentar lagi.',
      too_many_sessions: 'Anda sudah membuka percakapan di tab lain. Tutup dulu, lalu coba lagi.',
      session_timeout: 'Percakapan berakhir karena batas waktu. Ketuk untuk mulai lagi.',
    },
  },
  fraud: {
    eyebrow: 'Peringatan Keamanan',
    title: 'Terdeteksi Indikasi Penipuan',
    bodyBefore: 'Transaksi keluar telah ',
    bodyStrong: 'dibekukan sementara',
    bodyAfter: '. Jangan berikan kode OTP, PIN, atau Password Anda kepada siapa pun yang mengaku dari Bank BRI.',
  },
  search: {
    eyebrow: 'Pencarian',
    title: 'Cari Informasi BRI',
    placeholder: 'Cari fitur, produk, atau panduan',
    suggestions: 'Saran Pencarian',
    loadingSuggestions: 'Memuat saran.',
    results: 'Hasil Pencarian',
    count: (n: number) => `${n} hasil`,
    empty: 'Tidak ada hasil yang cocok. Coba kata kunci lain.',
  },
  products: {
    eyebrow: 'Temukan',
    title: 'Produk BRI',
    featured: 'Pilihan Utama',
    defaults: [
      'Super app keuangan digital',
      'Paylater & kartu kredit',
      'Siapkan biaya ibadah haji',
      'Modal usaha untuk UMKM',
      'Tabungan serba mudah',
      'Bayar nontunai praktis',
    ],
  },
  lead: {
    eyebrow: 'Formulir',
    title: 'Tinggalkan Kontak',
    subtitle: 'Tim kami akan segera menghubungi Anda.',
    name: 'Nama Lengkap',
    namePlaceholder: 'Masukkan nama Anda',
    phone: 'Nomor Telepon',
    email: 'Email',
    emailPlaceholder: 'email@contoh.com',
    submit: 'Kirim Data',
    thanks: 'Terima kasih.',
    received: 'Data Anda telah kami terima.',
  },
  faq: {
    eyebrow: 'Informasi',
    title: 'Panduan & Tata Cara',
    steps: (n: number) => `${n} langkah`,
    step: (n: number) => `Langkah ${n}`,
    loading: 'Memuat data.',
  },
  idle: {
    eyebrow: 'Ringkasan',
    title: 'Layanan Utama',
    savings: 'Tabungan',
    bills: 'Tagihan',
    billsValue: '2 Jatuh Tempo',
    billsAlert: 'Perlu tindakan',
    investment: 'Investasi',
    investmentValue: 'Portofolio Stabil',
    promos: 'Promo Aktif',
    promosValue: '12 Penawaran',
    helpEyebrow: 'Butuh bantuan?',
    helpTitle: 'Tanya Bambang langsung',
  },
};

export type Dict = typeof id;

const en: Dict = {
  locale: 'en-US',
  greeting: { morning: 'Good Morning', noon: 'Good Afternoon', afternoon: 'Good Afternoon', evening: 'Good Evening' },
  heroQuestion: 'how can Bambang help you?',
  langSwitch: {
    label: 'Language',
    locked: 'End the conversation to change the language.',
  },
  topbar: { notifications: 'Notifications', profile: 'Profile' },
  nav: { home: 'Home', search: 'Search', notif: 'Alerts', settings: 'Settings' },
  voice: {
    idle: { label: 'Sobat BRI', sub: 'Tap to start talking' },
    listening: { label: 'Listening', sub: 'Go ahead, Bambang is listening' },
    speaking: { label: 'Bambang', sub: 'Bambang is answering' },
    start: 'Start voice conversation',
    stop: 'End conversation',
    micOn: 'Mic On',
    micOff: 'Mic Off',
    muteAria: 'Mute microphone',
    unmuteAria: 'Unmute microphone',
    transcript: 'Bambang',
    error: 'Unable to access the microphone or server.',
    limits: {
      busy: 'Bambang is helping many people right now. Please try again shortly.',
      too_many_sessions: 'You already have a conversation open in another tab. Close it and try again.',
      session_timeout: 'The conversation ended because it reached the time limit. Tap to start again.',
    },
  },
  fraud: {
    eyebrow: 'Security Alert',
    title: 'Possible Fraud Detected',
    bodyBefore: 'Outgoing transactions have been ',
    bodyStrong: 'temporarily frozen',
    bodyAfter: '. Never share your OTP, PIN, or password with anyone claiming to be from Bank BRI.',
  },
  search: {
    eyebrow: 'Search',
    title: 'Search BRI Information',
    placeholder: 'Search features, products, or guides',
    suggestions: 'Suggested Searches',
    loadingSuggestions: 'Loading suggestions.',
    results: 'Search Results',
    count: (n: number) => `${n} ${n === 1 ? 'result' : 'results'}`,
    empty: 'No matching results. Try another keyword.',
  },
  products: {
    eyebrow: 'Discover',
    title: 'BRI Products',
    featured: 'Top Pick',
    defaults: [
      'All-in-one digital banking app',
      'Paylater & credit card',
      'Plan ahead for your Hajj',
      'Business capital for MSMEs',
      'Everyday savings made easy',
      'Simple cashless payments',
    ],
  },
  lead: {
    eyebrow: 'Form',
    title: 'Leave Your Contact',
    subtitle: 'Our team will reach out to you shortly.',
    name: 'Full Name',
    namePlaceholder: 'Enter your name',
    phone: 'Phone Number',
    email: 'Email',
    emailPlaceholder: 'email@example.com',
    submit: 'Submit',
    thanks: 'Thank you.',
    received: 'We have received your details.',
  },
  faq: {
    eyebrow: 'Information',
    title: 'Guides & Steps',
    steps: (n: number) => `${n} ${n === 1 ? 'step' : 'steps'}`,
    step: (n: number) => `Step ${n}`,
    loading: 'Loading data.',
  },
  idle: {
    eyebrow: 'Overview',
    title: 'Main Services',
    savings: 'Savings',
    bills: 'Bills',
    billsValue: '2 Due Soon',
    billsAlert: 'Action needed',
    investment: 'Investments',
    investmentValue: 'Stable Portfolio',
    promos: 'Active Promos',
    promosValue: '12 Offers',
    helpEyebrow: 'Need help?',
    helpTitle: 'Ask Bambang directly',
  },
};

export const dictionaries: Record<Lang, Dict> = { id, en };

type I18nContextValue = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: Dict;
  /** True while a voice session is running — the language is fixed for that session. */
  locked: boolean;
  setLocked: (locked: boolean) => void;
};

const I18nContext = createContext<I18nContextValue | null>(null);

/* Language preference lives in localStorage; read it through an external store
   so SSR renders the default and the client picks up the saved choice. */
const langListeners = new Set<() => void>();
let memoryLang: Lang | null = null; // used when storage is unavailable

function readLang(): Lang {
  if (memoryLang) return memoryLang;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'en' ? 'en' : 'id';
  } catch {
    return 'id';
  }
}

function subscribeLang(cb: () => void) {
  langListeners.add(cb);
  return () => { langListeners.delete(cb); };
}

function writeLang(next: Lang) {
  memoryLang = next;
  try { window.localStorage.setItem(STORAGE_KEY, next); } catch { /* keep in memory only */ }
  langListeners.forEach(l => l());
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const lang = useSyncExternalStore(subscribeLang, readLang, () => 'id' as Lang);
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = (next: Lang) => {
    if (!locked) writeLang(next);
  };

  return (
    <I18nContext.Provider value={{ lang, setLang, t: dictionaries[lang], locked, setLocked }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside <LanguageProvider>');
  return ctx;
}
