/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  Eye,
  EyeOff,
  Lock,
  User as UserIcon,
  ShieldCheck,
  ShoppingCart,
  ArrowLeft,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { PWAInstallButton } from '../common/PWAInstallButton';
import { Spinner } from '../ui/Spinner';
import type { User } from '../../types';

/** Jumlah digit PIN kasir (6 digit, seperti lockscreen HP). */
const PIN_LENGTH = 6;

export const LoginPage: React.FC = () => {
  const { login, getKasirList } = useAuth();

  const [authMode, setAuthMode] = useState<'owner' | 'kasir'>('owner');

  // Form Owner: username & password
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Form Kasir: pilih akun lalu PIN 6 digit
  const [kasirList, setKasirList] = useState<User[]>([]);
  const [isLoadingKasir, setIsLoadingKasir] = useState(true);
  const [selectedKasir, setSelectedKasir] = useState<User | null>(null);
  const [pin, setPin] = useState('');
  const pinInputRef = useRef<HTMLInputElement>(null);

  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Daftar kasir diambil dari DB supaya akun yang baru dibuat Owner langsung muncul.
  // Deps sengaja kosong: cukup dibaca sekali saat halaman login dimuat.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const list = await getKasirList();
        if (active) setKasirList(list);
      } catch (err) {
        console.error('Gagal memuat daftar kasir:', err);
      } finally {
        if (active) setIsLoadingKasir(false);
      }
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const switchMode = (mode: 'owner' | 'kasir') => {
    setAuthMode(mode);
    setErrorMessage('');
    setSelectedKasir(null);
    setPin('');
  };

  const handleOwnerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    if (!username.trim() || !password) {
      setErrorMessage('Harap isi username dan password.');
      return;
    }

    setIsSubmitting(true);
    const res = await login(username, password);
    setIsSubmitting(false);

    if (!res.success) {
      setErrorMessage(res.message || 'Username atau password salah.');
    }
  };

  const verifyPin = async (value: string) => {
    if (!selectedKasir || isSubmitting) return;

    setErrorMessage('');
    setIsSubmitting(true);
    const res = await login(selectedKasir.username, value);
    setIsSubmitting(false);

    if (!res.success) {
      setErrorMessage(
        res.message && res.message.includes('tidak ditemukan')
          ? res.message
          : 'PIN salah. Silakan coba lagi.'
      );
      setPin('');
    }
  };

  const handlePinChange = (raw: string) => {
    if (isSubmitting) return;
    const digits = raw.replace(/\D/g, '').slice(0, PIN_LENGTH);
    setPin(digits);
    setErrorMessage('');
    // Verifikasi otomatis begitu PIN penuh
    if (digits.length === PIN_LENGTH) {
      void verifyPin(digits);
    }
  };

  const pilihKasir = (k: User) => {
    setSelectedKasir(k);
    setPin('');
    setErrorMessage('');
  };

  const tabCls = (aktif: boolean) =>
    `py-2 rounded-md font-medium transition flex items-center justify-center gap-1.5 ${
      aktif
        ? 'bg-[var(--kartu)] text-[var(--utama-teks)] shadow-xs'
        : 'text-[var(--redup)] hover:text-[var(--teks)]'
    }`;

  return (
    <div className="min-h-screen flex flex-col justify-center items-center p-4 bg-[var(--latar)] text-[var(--teks)] font-sans">
      <div className="w-full max-w-md">
        {/* Header Branding dengan Logo Baru */}
        <div className="text-center mb-6">
          <img
            src="/LogoSKB.png"
            alt="Logo Ayam Bebek S.K.B"
            className="h-20 sm:h-24 mx-auto object-contain mb-2"
          />
          <p className="text-xs text-[var(--redup)]">
            Rumah Makan Ayam Bebek S.K.B &mdash; Kasir &amp; Laporan Penjualan
          </p>
        </div>

        {/* Kartu Utama */}
        <div className="bg-[var(--kartu)] rounded-xl p-6 sm:p-7 shadow-sm border border-[var(--garis)]">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-[var(--teks)]">
              {authMode === 'owner' ? 'Masuk sebagai Owner' : 'Masuk sebagai Kasir'}
            </h2>
            <PWAInstallButton />
          </div>

          {/* Tab Pilihan Owner / Kasir */}
          <div className="grid grid-cols-2 p-1 bg-[var(--latar)] rounded-lg mb-5 border border-[var(--garis)] text-xs">
            <button type="button" onClick={() => switchMode('owner')} className={tabCls(authMode === 'owner')}>
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Owner</span>
            </button>
            <button type="button" onClick={() => switchMode('kasir')} className={tabCls(authMode === 'kasir')}>
              <ShoppingCart className="w-3.5 h-3.5" />
              <span>Kasir</span>
            </button>
          </div>

          {errorMessage && (
            <div className="mb-4 p-3 rounded-lg bg-[var(--bahaya-muda)] border border-[var(--garis)] text-[var(--bahaya-teks)] text-xs flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--bahaya)] mt-1.5 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {authMode === 'owner' ? (
            /* --- FORM OWNER (username & password) --- */
            <form onSubmit={handleOwnerSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[var(--teks)] mb-1">
                  Username
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[var(--redup)]">
                    <UserIcon className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Masukkan username Anda"
                    className="w-full pl-9 pr-3 py-2 text-sm bg-[var(--latar)]/50 border border-[var(--garis-kuat)] rounded-lg focus:outline-none focus:bg-[var(--kartu)] focus:border-[var(--utama-teks)] focus:ring-1 focus:ring-[var(--utama-teks)] transition"
                    autoComplete="username"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--teks)] mb-1">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[var(--redup)]">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Masukkan password"
                    className="w-full pl-9 pr-9 py-2 text-sm bg-[var(--latar)]/50 border border-[var(--garis-kuat)] rounded-lg focus:outline-none focus:bg-[var(--kartu)] focus:border-[var(--utama-teks)] focus:ring-1 focus:ring-[var(--utama-teks)] transition"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-[var(--redup)] hover:text-[var(--redup)]"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 px-4 rounded-lg font-medium text-white bg-[var(--utama)] hover:bg-[var(--utama-tua)] active:bg-[var(--utama)] transition text-sm disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
              >
                {isSubmitting ? <Spinner size="sm" /> : null}
                {isSubmitting ? 'Memproses...' : 'Masuk sebagai Owner'}
              </button>
            </form>
          ) : selectedKasir ? (
            /* --- FORM PIN KASIR (6 digit, tampilan bulatan lockscreen) --- */
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => {
                  setSelectedKasir(null);
                  setPin('');
                  setErrorMessage('');
                }}
                className="inline-flex items-center gap-1 text-xs text-[var(--redup)] hover:text-[var(--teks)] transition"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Pilih kasir lain
              </button>

              <div className="p-3 rounded-lg bg-[var(--latar)] border border-[var(--garis)] flex items-center gap-3">
                <span className="w-9 h-9 rounded-full bg-[var(--utama-muda)] text-[var(--utama-teks)] flex items-center justify-center shrink-0">
                  <UserIcon className="w-4 h-4" />
                </span>
                <div>
                  <div className="text-sm font-semibold text-[var(--teks)]">{selectedKasir.username}</div>
                  <div className="text-xs text-[var(--redup)]">{selectedKasir.cabang || '—'}</div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--teks)] mb-1">
                  PIN (6 digit)
                </label>

                {/* Kotak input: 6 bulatan terisi sesuai jumlah digit yang diketik */}
                <div className="relative rounded-lg border border-[var(--garis-kuat)] bg-[var(--latar)]/50 focus-within:border-[var(--utama-teks)] focus-within:ring-1 focus-within:ring-[var(--utama-teks)] transition">
                  <input
                    ref={pinInputRef}
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={PIN_LENGTH}
                    value={pin}
                    onChange={(e) => handlePinChange(e.target.value)}
                    readOnly={isSubmitting}
                    autoFocus
                    aria-label="PIN 6 digit"
                    className="absolute inset-0 z-10 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div
                    className="flex justify-center items-center gap-4 py-5 pointer-events-none"
                    aria-hidden="true"
                  >
                    {Array.from({ length: PIN_LENGTH }).map((_, i) => {
                      const terisi = i < pin.length;
                      const salah = !!errorMessage;
                      return (
                        <span
                          key={i}
                          className={`w-4 h-4 rounded-full border-2 transition-all duration-150 ${
                            terisi
                              ? salah
                                ? 'bg-[var(--bahaya)] border-[var(--bahaya)] scale-110'
                                : 'bg-[var(--teks)] border-[var(--teks)] scale-110'
                              : salah
                                ? 'border-[var(--bahaya)]/60'
                                : 'border-[var(--garis-kuat)]'
                          }`}
                        />
                      );
                    })}
                  </div>
                </div>

                <p className="text-[11px] text-[var(--redup)] mt-1.5">
                  {isSubmitting
                    ? 'Memverifikasi PIN...'
                    : 'Ketuk kotak lalu masukkan 6 digit PIN Anda.'}
                </p>
              </div>
            </div>
          ) : (
            /* --- PILIH AKUN KASIR (daftar dari database) --- */
            <div>
              <p className="text-xs text-[var(--redup)] mb-3">
                Pilih akun kasir Anda, lalu masukkan PIN 6 digit.
              </p>

              {isLoadingKasir ? (
                <div className="py-6 text-center text-xs text-[var(--redup)] flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-[var(--utama-teks)] border-t-transparent rounded-full animate-spin" />
                  <span>Memuat daftar kasir...</span>
                </div>
              ) : kasirList.length === 0 ? (
                <div className="py-6 text-center bg-[var(--latar)] rounded-lg border border-dashed border-[var(--garis-kuat)] p-4">
                  <p className="text-xs font-medium text-[var(--teks)]">Belum ada akun kasir</p>
                  <p className="text-[11px] text-[var(--redup)] mt-0.5">
                    Minta Owner membuat akun lewat menu Profil &rarr; Kelola Kasir.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {kasirList.map((k) => (
                    <button
                      key={k.id ?? k.username}
                      type="button"
                      onClick={() => pilihKasir(k)}
                      className="p-3 text-left rounded-lg border border-[var(--garis)] hover:bg-[var(--latar)] transition"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-7 h-7 rounded-full bg-[var(--utama-muda)] text-[var(--utama-teks)] flex items-center justify-center shrink-0">
                          <UserIcon className="w-3.5 h-3.5" />
                        </span>
                        <span className="text-xs font-semibold text-[var(--teks)] truncate">
                          {k.username}
                        </span>
                      </div>
                      <div className="text-[10px] text-[var(--redup)] mt-1.5">
                        {k.cabang || '—'}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer info sederhana */}
        <div className="mt-4 text-center text-xs text-[var(--redup)] flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-[var(--redup)]" />
          <span>Keamanan password terenkripsi bcrypt & penyimpanan lokal IndexedDB</span>
        </div>
      </div>
    </div>
  );
};
