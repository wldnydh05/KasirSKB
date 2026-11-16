/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Lock,
  User,
  KeyRound,
  Shield,
  LogOut,
  Trash2,
  Camera,
  Loader2,
  Users,
  Plus,
  Edit2,
  Crown,
  Building2,
  Check,
  AlertCircle,
  Eye,
  EyeOff,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useCabang } from '../../context/CabangContext';
import { compressImageFile } from '../../utils/imageUtils';
import type { User as UserType } from '../../types';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({ isOpen, onClose }) => {
  const {
    user,
    updateProfile,
    changePassword,
    logout,
    createKasir,
    getKasirList,
    deleteKasir,
    updateKasir,
  } = useAuth();
  const { showToast } = useToast();
  const { cabangList } = useCabang();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isOwner = user?.role === 'owner';
  const [activeTab, setActiveTab] = useState<'profile' | 'password' | 'kasir'>('profile');

  // Profile fields
  const [namaLengkap, setNamaLengkap] = useState(user?.nama_lengkap || '');
  const [fotoUrl, setFotoUrl] = useState(user?.foto_url || '');
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  // Password fields
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Kasir Management fields (Khusus Owner)
  const [kasirList, setKasirList] = useState<UserType[]>([]);
  const [isLoadingKasir, setIsLoadingKasir] = useState(false);
  const [showAddKasirForm, setShowAddKasirForm] = useState(false);
  const [newKasirNama, setNewKasirNama] = useState('');
  const [newKasirUsername, setNewKasirUsername] = useState('');
  const [newKasirPassword, setNewKasirPassword] = useState('');
  const [newKasirCabang, setNewKasirCabang] = useState('Cabang 1');
  const [showNewKasirPassword, setShowNewKasirPassword] = useState(false);

  // Editing Kasir
  const [editingKasirId, setEditingKasirId] = useState<number | null>(null);
  const [editKasirNama, setEditKasirNama] = useState('');
  const [editKasirCabang, setEditKasirCabang] = useState('');
  const [editKasirNewPassword, setEditKasirNewPassword] = useState('');
  const [showEditKasirPassword, setShowEditKasirPassword] = useState(false);

  // Load kasir list when modal opens or tab changes to 'kasir'
  const loadKasirList = async () => {
    if (!isOwner) return;
    setIsLoadingKasir(true);
    try {
      const list = await getKasirList();
      setKasirList(list);
    } catch (err) {
      console.error('Failed to load kasir list:', err);
    } finally {
      setIsLoadingKasir(false);
    }
  };

  useEffect(() => {
    if (isOpen && isOwner) {
      loadKasirList();
    }
  }, [isOpen, isOwner]);

  if (!isOpen || !user) return null;

  const handleLocalPhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('Pilih file gambar yang valid (JPG, PNG, WebP)', 'error');
      return;
    }

    try {
      setIsUploadingPhoto(true);
      const compressedDataUrl = await compressImageFile(file, 400, 0.85);
      setFotoUrl(compressedDataUrl);
      showToast('Foto dari penyimpanan lokal berhasil dipilih', 'success');
    } catch (err) {
      console.error('Failed to process image:', err);
      showToast('Gagal memuat foto dari perangkat', 'error');
    } finally {
      setIsUploadingPhoto(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemovePhoto = () => {
    setFotoUrl('');
    showToast('Foto profil dihapus (akan disimpan saat klik Simpan Profil)', 'info');
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const success = await updateProfile({
      nama_lengkap: namaLengkap.trim(),
      foto_url: fotoUrl,
    });
    setIsSubmitting(false);
    if (success) {
      showToast('Profil dan foto berhasil diperbarui!', 'success');
      onClose();
    } else {
      showToast('Gagal memperbarui profil.', 'error');
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      showToast('Konfirmasi password baru tidak cocok.', 'error');
      return;
    }
    if (newPassword.length < 4) {
      showToast('Password baru minimal 4 karakter.', 'error');
      return;
    }

    setIsSubmitting(true);
    const res = await changePassword(oldPassword, newPassword);
    setIsSubmitting(false);

    if (res.success) {
      showToast(res.message, 'success');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      onClose();
    } else {
      showToast(res.message, 'error');
    }
  };

  const handleAddKasirSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKasirNama.trim() || !newKasirUsername.trim() || !newKasirPassword) {
      showToast('Harap lengkapi seluruh kolom akun kasir.', 'error');
      return;
    }

    setIsSubmitting(true);
    const res = await createKasir({
      namaLengkap: newKasirNama.trim(),
      username: newKasirUsername.trim().toLowerCase(),
      password: newKasirPassword,
      cabang: newKasirCabang,
    });
    setIsSubmitting(false);

    if (res.success) {
      showToast(`Akun kasir "${newKasirNama}" berhasil dibuat!`, 'success');
      setNewKasirNama('');
      setNewKasirUsername('');
      setNewKasirPassword('');
      setShowAddKasirForm(false);
      await loadKasirList();
    } else {
      showToast(res.message || 'Gagal membuat akun kasir.', 'error');
    }
  };

  const handleDeleteKasirClick = async (kasir: UserType) => {
    if (!kasir.id) return;
    const confirmDelete = window.confirm(
      `Apakah Anda yakin ingin menghapus akun kasir "${kasir.nama_lengkap || kasir.username}"?`
    );
    if (!confirmDelete) return;

    const res = await deleteKasir(kasir.id);
    if (res.success) {
      showToast(`Akun kasir "${kasir.nama_lengkap || kasir.username}" berhasil dihapus.`, 'success');
      await loadKasirList();
    } else {
      showToast(res.message || 'Gagal menghapus kasir.', 'error');
    }
  };

  const handleStartEditKasir = (kasir: UserType) => {
    setEditingKasirId(kasir.id || null);
    setEditKasirNama(kasir.nama_lengkap || '');
    setEditKasirCabang(kasir.cabang || 'Cabang 1');
    setEditKasirNewPassword('');
  };

  const handleSaveEditKasir = async (kasirId: number) => {
    setIsSubmitting(true);
    const res = await updateKasir(kasirId, {
      namaLengkap: editKasirNama,
      cabang: editKasirCabang,
      newPassword: editKasirNewPassword.trim() ? editKasirNewPassword : undefined,
    });
    setIsSubmitting(false);

    if (res.success) {
      showToast('Data kasir berhasil diperbarui!', 'success');
      setEditingKasirId(null);
      await loadKasirList();
    } else {
      showToast(res.message || 'Gagal memperbarui kasir.', 'error');
    }
  };

  const userInitial = (user.nama_lengkap || user.username || 'U')[0].toUpperCase();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 sm:p-4">
      <div className="w-full max-w-lg max-h-[90vh] flex flex-col rounded-xl bg-white shadow-xl overflow-hidden border border-gray-200 font-sans">
        {/* Header Modal */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-200 bg-gray-50 shrink-0">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-orange-600" />
            <h3 className="font-semibold text-sm text-gray-900">Pengaturan Akun & Profil</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* User Card Preview Sederhana */}
        <div className="px-5 py-3 bg-white flex items-center gap-3 border-b border-gray-100 shrink-0">
          {fotoUrl ? (
            <img
              src={fotoUrl}
              alt={user.username}
              className="w-11 h-11 rounded-lg object-cover border border-gray-200"
            />
          ) : (
            <div className="w-11 h-11 rounded-lg bg-orange-600 text-white font-bold text-base flex items-center justify-center shrink-0">
              {userInitial}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-gray-900 truncate">
                {namaLengkap || user.username}
              </span>
              <span
                className={`text-[10px] font-medium px-2 py-0.5 rounded shrink-0 ${
                  user.role === 'owner'
                    ? 'bg-orange-100 text-orange-800 border border-orange-200'
                    : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                }`}
              >
                {user.role === 'owner' ? 'Pemilik Usaha (Owner)' : 'Staf Kasir'}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">@{user.username}</p>
          </div>
        </div>

        {/* Tab switcher rapi */}
        <div className="flex border-b border-gray-200 bg-gray-50 shrink-0 text-xs font-medium">
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex-1 py-2.5 text-center border-b-2 transition ${
              activeTab === 'profile'
                ? 'border-orange-600 text-orange-600 font-semibold bg-white'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Profil Saya
          </button>
          <button
            onClick={() => setActiveTab('password')}
            className={`flex-1 py-2.5 text-center border-b-2 transition ${
              activeTab === 'password'
                ? 'border-orange-600 text-orange-600 font-semibold bg-white'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Ganti Password
          </button>
          {isOwner && (
            <button
              onClick={() => setActiveTab('kasir')}
              className={`flex-1 py-2.5 text-center border-b-2 transition flex items-center justify-center gap-1.5 ${
                activeTab === 'kasir'
                  ? 'border-orange-600 text-orange-600 font-semibold bg-white'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Kelola Kasir</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-orange-100 text-orange-800 font-bold">
                {kasirList.length}
              </span>
            </button>
          )}
        </div>

        {/* Tab Body (Scrollable) */}
        <div className="p-5 overflow-y-auto flex-1 text-gray-800">
          {activeTab === 'profile' && (
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                  Foto Profil
                </label>
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                  {fotoUrl ? (
                    <div className="relative shrink-0">
                      <img
                        src={fotoUrl}
                        alt="Foto Profil"
                        className="w-12 h-12 rounded-lg object-cover border border-gray-300"
                      />
                    </div>
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-white border border-gray-300 flex flex-col items-center justify-center text-gray-400 shrink-0">
                      <User className="w-5 h-5 text-gray-400" />
                    </div>
                  )}

                  <div className="flex-1 min-w-0 space-y-1">
                    <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 text-xs font-medium transition cursor-pointer shadow-2xs">
                      {isUploadingPhoto ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-orange-600" />
                      ) : (
                        <Camera className="w-3.5 h-3.5 text-gray-600" />
                      )}
                      <span>{isUploadingPhoto ? 'Memproses...' : 'Pilih Foto dari Perangkat'}</span>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={isUploadingPhoto}
                        onChange={handleLocalPhotoChange}
                      />
                    </label>

                    {fotoUrl && (
                      <div>
                        <button
                          type="button"
                          onClick={handleRemovePhoto}
                          className="inline-flex items-center gap-1 text-[11px] text-red-600 hover:underline"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Hapus Foto</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Nama Lengkap
                </label>
                <input
                  type="text"
                  value={namaLengkap}
                  onChange={(e) => setNamaLengkap(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:border-orange-600 focus:ring-1 focus:ring-orange-600 outline-none"
                  placeholder="Nama Lengkap"
                />
              </div>

              <div className="pt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    logout();
                    onClose();
                  }}
                  className="flex items-center gap-1.5 text-xs font-medium text-red-600 hover:text-red-700 px-3 py-2 rounded-lg hover:bg-red-50 transition"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Keluar (Logout)</span>
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-lg text-xs font-medium text-white bg-orange-600 hover:bg-orange-700 transition disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? 'Menyimpan...' : 'Simpan Profil'}
                </button>
              </div>
            </form>
          )}

          {activeTab === 'password' && (
            <form onSubmit={handleChangePassword} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Password Lama
                </label>
                <input
                  type="password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:border-orange-600 focus:ring-1 focus:ring-orange-600 outline-none"
                  placeholder="Masukkan password saat ini"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Password Baru
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:border-orange-600 focus:ring-1 focus:ring-orange-600 outline-none"
                  placeholder="Minimal 4 karakter"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Konfirmasi Password Baru
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:border-orange-600 focus:ring-1 focus:ring-orange-600 outline-none"
                  placeholder="Ketik ulang password baru"
                  required
                />
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2.5 rounded-lg text-xs font-medium text-white bg-orange-600 hover:bg-orange-700 transition cursor-pointer"
                >
                  {isSubmitting ? 'Memproses...' : 'Perbarui Password'}
                </button>
              </div>
            </form>
          )}

          {activeTab === 'kasir' && isOwner && (
            <div className="space-y-4">
              {/* Info banner wewenang owner */}
              <div className="p-3 rounded-lg bg-orange-50 border border-orange-200 text-orange-900 text-xs">
                <p className="font-semibold text-orange-900">Hak Akses Pemilik Usaha (Owner)</p>
                <p className="text-orange-800 mt-0.5 leading-relaxed">
                  Hanya akun Owner yang memiliki wewenang untuk mendaftarkan akun kasir, mengatur penempatan cabang, dan mereset password kasir.
                </p>
              </div>

              {/* Action bar */}
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-gray-900">Daftar Akun Kasir</h4>
                  <p className="text-xs text-gray-500">Staf yang berwenang melayani transaksi kasir</p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowAddKasirForm(!showAddKasirForm)}
                  className="px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-xs font-medium transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  {showAddKasirForm ? (
                    <>
                      <X className="w-3.5 h-3.5" />
                      <span>Batal</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Tambah Kasir</span>
                    </>
                  )}
                </button>
              </div>

              {/* Form Tambah Kasir Baru */}
              {showAddKasirForm && (
                <form
                  onSubmit={handleAddKasirSubmit}
                  className="p-3.5 bg-gray-50 rounded-lg border border-gray-200 space-y-3"
                >
                  <div className="text-xs font-semibold text-gray-800">
                    Form Pendaftaran Kasir Baru
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Nama Lengkap Kasir
                    </label>
                    <input
                      type="text"
                      value={newKasirNama}
                      onChange={(e) => setNewKasirNama(e.target.value)}
                      placeholder="Contoh: Siti Rahmawati"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-gray-300 rounded-lg focus:border-orange-600 outline-none"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Username Kasir
                      </label>
                      <input
                        type="text"
                        value={newKasirUsername}
                        onChange={(e) => setNewKasirUsername(e.target.value)}
                        placeholder="Contoh: kasir_siti"
                        className="w-full px-3 py-1.5 text-xs bg-white border border-gray-300 rounded-lg focus:border-orange-600 outline-none"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Cabang Penempatan
                      </label>
                      <select
                        value={newKasirCabang}
                        onChange={(e) => setNewKasirCabang(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs bg-white border border-gray-300 rounded-lg focus:border-orange-600 outline-none"
                      >
                        {cabangList.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Password Kasir
                    </label>
                    <div className="relative">
                      <input
                        type={showNewKasirPassword ? 'text' : 'password'}
                        value={newKasirPassword}
                        onChange={(e) => setNewKasirPassword(e.target.value)}
                        placeholder="Minimal 4 karakter"
                        className="w-full pl-3 pr-8 py-1.5 text-xs bg-white border border-gray-300 rounded-lg focus:border-orange-600 outline-none"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewKasirPassword(!showNewKasirPassword)}
                        className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-gray-400 hover:text-gray-600"
                      >
                        {showNewKasirPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowAddKasirForm(false)}
                      className="px-3 py-1.5 rounded-lg border border-gray-300 text-xs font-medium text-gray-600 hover:bg-gray-100"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="px-4 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-xs font-medium disabled:opacity-50 cursor-pointer"
                    >
                      {isSubmitting ? 'Menyimpan...' : 'Simpan Kasir'}
                    </button>
                  </div>
                </form>
              )}

              {/* Kasir List */}
              {isLoadingKasir ? (
                <div className="py-6 text-center text-xs text-gray-500 flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-orange-600" />
                  <span>Memuat daftar kasir...</span>
                </div>
              ) : kasirList.length === 0 ? (
                <div className="py-6 text-center bg-gray-50 rounded-lg border border-dashed border-gray-300 p-4">
                  <p className="text-xs font-medium text-gray-700">Belum ada akun kasir terdaftar</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    Silakan klik tombol "+ Tambah Kasir" untuk mendaftarkan akun staf pertama.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {kasirList.map((kasir) => {
                    const isEditing = editingKasirId === kasir.id;
                    const initial = (kasir.nama_lengkap || kasir.username || 'K')[0].toUpperCase();

                    return (
                      <div
                        key={kasir.id}
                        className="p-3 rounded-lg bg-white border border-gray-200 hover:border-gray-300 transition"
                      >
                        {isEditing ? (
                          <div className="space-y-2.5">
                            <div className="text-xs font-semibold text-gray-800">
                              Edit Kasir: @{kasir.username}
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <div>
                                <label className="block text-[11px] font-medium text-gray-600 mb-1">
                                  Nama Lengkap
                                </label>
                                <input
                                  type="text"
                                  value={editKasirNama}
                                  onChange={(e) => setEditKasirNama(e.target.value)}
                                  className="w-full px-2.5 py-1 text-xs border border-gray-300 rounded-md outline-none focus:border-orange-600"
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-medium text-gray-600 mb-1">
                                  Cabang
                                </label>
                                <select
                                  value={editKasirCabang}
                                  onChange={(e) => setEditKasirCabang(e.target.value)}
                                  className="w-full px-2.5 py-1 text-xs border border-gray-300 rounded-md outline-none focus:border-orange-600"
                                >
                                  {cabangList.map((c) => (
                                    <option key={c} value={c}>
                                      {c}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>

                            <div>
                              <label className="block text-[11px] font-medium text-gray-600 mb-1">
                                Reset Password Baru (Kosongkan bila tidak diubah)
                              </label>
                              <div className="relative">
                                <input
                                  type={showEditKasirPassword ? 'text' : 'password'}
                                  value={editKasirNewPassword}
                                  onChange={(e) => setEditKasirNewPassword(e.target.value)}
                                  placeholder="Password baru kasir"
                                  className="w-full pl-2.5 pr-8 py-1 text-xs border border-gray-300 rounded-md outline-none focus:border-orange-600"
                                />
                                <button
                                  type="button"
                                  onClick={() => setShowEditKasirPassword(!showEditKasirPassword)}
                                  className="absolute inset-y-0 right-0 pr-2 flex items-center text-gray-400"
                                >
                                  {showEditKasirPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                </button>
                              </div>
                            </div>

                            <div className="flex justify-end gap-2 pt-1">
                              <button
                                type="button"
                                onClick={() => setEditingKasirId(null)}
                                className="px-2.5 py-1 rounded-md border border-gray-300 text-xs text-gray-600 hover:bg-gray-100"
                              >
                                Batal
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSaveEditKasir(kasir.id!)}
                                disabled={isSubmitting}
                                className="px-3 py-1 rounded-md bg-orange-600 text-white text-xs font-medium hover:bg-orange-700"
                              >
                                Simpan
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-8 h-8 rounded-md bg-gray-100 text-gray-700 font-semibold text-xs flex items-center justify-center shrink-0 border border-gray-200">
                                {initial}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-semibold text-gray-900 truncate">
                                    {kasir.nama_lengkap || kasir.username}
                                  </span>
                                  <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-gray-100 text-gray-700 border border-gray-200 shrink-0">
                                    {kasir.cabang || 'Cabang 1'}
                                  </span>
                                </div>
                                <div className="text-[11px] text-gray-500">
                                  @{kasir.username}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleStartEditKasir(kasir)}
                                title="Edit info kasir"
                                className="p-1 rounded-md text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteKasirClick(kasir)}
                                title="Hapus akun kasir"
                                className="p-1 rounded-md text-red-500 hover:text-red-700 hover:bg-red-50 transition"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};


