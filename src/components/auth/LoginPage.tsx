/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Eye,
  EyeOff,
  Lock,
  User as UserIcon,
  Store,
  ShieldCheck,
  UserPlus,
  LogIn,
  Info,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { PWAInstallButton } from '../common/PWAInstallButton';

export const LoginPage: React.FC = () => {
  const { login, registerOwner, quickLogin } = useAuth();

  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  // Login form state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Register form state (khusus Owner)
  const [regNamaLengkap, setRegNamaLengkap] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);

  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');
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

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!regNamaLengkap.trim() || !regUsername.trim() || !regPassword) {
      setErrorMessage('Harap lengkapi semua kolom pendaftaran.');
      return;
    }

    if (regPassword.length < 4) {
      setErrorMessage('Password minimal 4 karakter.');
      return;
    }

    if (regPassword !== regConfirmPassword) {
      setErrorMessage('Konfirmasi password tidak sesuai.');
      return;
    }

    setIsSubmitting(true);
    const res = await registerOwner({
      namaLengkap: regNamaLengkap,
      username: regUsername,
      password: regPassword,
    });
    setIsSubmitting(false);

    if (!res.success) {
      setErrorMessage(res.message || 'Pendaftaran gagal.');
    } else {
      setSuccessMessage('Pendaftaran berhasil! Mengalihkan ke dashboard...');
    }
  };

  const handleQuick = async (usernameTarget: string) => {
    setIsSubmitting(true);
    setErrorMessage('');
    setSuccessMessage('');
    await quickLogin(usernameTarget);
    setIsSubmitting(false);
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center p-4 bg-gray-50 text-gray-800 font-sans">
      <div className="w-full max-w-md">
        {/* Header Branding dengan Logo Baru */}
        <div className="text-center mb-6">
          <img
            src="/logo.png"
            alt="BukuPOS Logo"
            className="h-20 sm:h-24 mx-auto object-contain mb-2 drop-shadow-xs"
          />
          <p className="text-xs text-gray-500">
            Sistem Informasi Kasir & Manajemen Penjualan Toko
          </p>
        </div>

        {/* Kartu Utama */}
        <div className="bg-white rounded-xl p-6 sm:p-7 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-800">
              {authMode === 'login' ? 'Masuk ke Sistem' : 'Pendaftaran Pemilik Toko'}
            </h2>
            <PWAInstallButton />
          </div>

          {/* Tab Pilihan Masuk / Daftar */}
          <div className="grid grid-cols-2 p-1 bg-gray-100 rounded-lg mb-5 border border-gray-200 text-xs">
            <button
              type="button"
              onClick={() => {
                setAuthMode('login');
                setErrorMessage('');
                setSuccessMessage('');
              }}
              className={`py-2 rounded-md font-medium transition flex items-center justify-center gap-1.5 ${
                authMode === 'login'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Masuk (Login)</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMode('register');
                setErrorMessage('');
                setSuccessMessage('');
              }}
              className={`py-2 rounded-md font-medium transition flex items-center justify-center gap-1.5 ${
                authMode === 'register'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Daftar Owner</span>
            </button>
          </div>

          {errorMessage && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {authMode === 'login' ? (
            /* --- FORM MASUK --- */
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Username
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                    <UserIcon className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Masukkan username Anda"
                    className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50/50 border border-gray-300 rounded-lg focus:outline-none focus:bg-white focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition"
                    autoComplete="username"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Masukkan password"
                    className="w-full pl-9 pr-9 py-2 text-sm bg-gray-50/50 border border-gray-300 rounded-lg focus:outline-none focus:bg-white focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 px-4 rounded-lg font-medium text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 transition text-sm disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? 'Memproses...' : 'Masuk ke Akun'}
              </button>

              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 text-xs text-gray-600 flex items-start gap-2">
                <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  Belum punya akun kasir? Akun kasir hanya dapat dibuat oleh <strong className="text-gray-800">Pemilik Usaha (Owner)</strong> melalui menu Kelola Kasir.
                </p>
              </div>
            </form>
          ) : (
            /* --- FORM REGISTER OWNER --- */
            <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
              <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-blue-900 text-xs flex items-start gap-2">
                <Info className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-blue-900">Pendaftaran Khusus Owner</p>
                  <p className="text-blue-800 mt-0.5 leading-relaxed">
                    Formulir ini untuk mendaftarkan akun Pemilik Usaha baru. Akun kasir nantinya dibuat oleh Owner dari menu pengaturan.
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Nama Lengkap Pemilik
                </label>
                <input
                  type="text"
                  value={regNamaLengkap}
                  onChange={(e) => setRegNamaLengkap(e.target.value)}
                  placeholder="Contoh: Budi Santoso"
                  className="w-full px-3 py-2 text-sm bg-gray-50/50 border border-gray-300 rounded-lg focus:outline-none focus:bg-white focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Username Akun
                </label>
                <input
                  type="text"
                  value={regUsername}
                  onChange={(e) => setRegUsername(e.target.value)}
                  placeholder="Contoh: budi_owner"
                  className="w-full px-3 py-2 text-sm bg-gray-50/50 border border-gray-300 rounded-lg focus:outline-none focus:bg-white focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition"
                  autoComplete="username"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showRegPassword ? 'text' : 'password'}
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="Minimal 4 karakter"
                    className="w-full pl-3 pr-9 py-2 text-sm bg-gray-50/50 border border-gray-300 rounded-lg focus:outline-none focus:bg-white focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition"
                    autoComplete="new-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegPassword(!showRegPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                  >
                    {showRegPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Konfirmasi Password
                </label>
                <input
                  type="password"
                  value={regConfirmPassword}
                  onChange={(e) => setRegConfirmPassword(e.target.value)}
                  placeholder="Ketik ulang password"
                  className="w-full px-3 py-2 text-sm bg-gray-50/50 border border-gray-300 rounded-lg focus:outline-none focus:bg-white focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition"
                  autoComplete="new-password"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 px-4 rounded-lg font-medium text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 transition text-sm disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? 'Mendaftarkan...' : 'Daftar Sebagai Owner'}
              </button>
            </form>
          )}

          {/* Kotak Akun Pengujian Demo (Ciri Khas Proyek Mahasiswa untuk Presentasi & Testing) */}
          {authMode === 'login' && (
            <div className="mt-6 pt-5 border-t border-gray-200">
              <div className="text-xs font-semibold text-gray-500 mb-2">
                Akun Percobaan (Demo Testing):
              </div>

              <div className="space-y-1.5">
                <button
                  type="button"
                  onClick={() => handleQuick('owner')}
                  className="w-full p-2.5 text-left rounded-lg border border-gray-200 hover:bg-gray-50 transition flex items-center justify-between"
                >
                  <div>
                    <span className="text-xs font-semibold text-gray-900">Owner (Bpk. Agus)</span>
                    <span className="text-[11px] text-gray-500 block">Username: owner · Akses penuh dashboard</span>
                  </div>
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-blue-100 text-blue-700">
                    Owner
                  </span>
                </button>

                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleQuick('kasir1')}
                    className="p-2 text-left rounded-lg border border-gray-200 hover:bg-gray-50 transition"
                  >
                    <div className="text-xs font-semibold text-gray-900">Kasir 1 (Siti)</div>
                    <div className="text-[10px] text-gray-500">Cabang 1</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleQuick('kasir2')}
                    className="p-2 text-left rounded-lg border border-gray-200 hover:bg-gray-50 transition"
                  >
                    <div className="text-xs font-semibold text-gray-900">Kasir 2 (Rian)</div>
                    <div className="text-[10px] text-gray-500">Cabang 2</div>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer info sederhana */}
        <div className="mt-4 text-center text-xs text-gray-400 flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-gray-500" />
          <span>Keamanan password terenkripsi bcrypt & penyimpanan lokal IndexedDB</span>
        </div>
      </div>
    </div>
  );
};

