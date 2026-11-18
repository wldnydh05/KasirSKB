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
  Sun,
  Moon,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useCabang } from '../../context/CabangContext';
import { useTema } from '../../hooks/useTema';
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
    changeUsername,
    changePassword,
    logout,
    createKasir,
    getKasirList,
    deleteKasir,
    updateKasir,
  } = useAuth();
  const { showToast } = useToast();
  const { cabangList, addCabang, renameCabang, deleteCabang } = useCabang();
  const { mode, toggle } = useTema();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isOwner = user?.role === 'owner';
  const [activeTab, setActiveTab] = useState<'profile' | 'password' | 'kasir' | 'cabang'>('profile');

  // Profile fields
  const [fotoUrl, setFotoUrl] = useState(user?.foto_url || '');
  const [editUsername, setEditUsername] = useState(user?.username || '');
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
  const [newKasirUsername, setNewKasirUsername] = useState('');
  const [newKasirPassword, setNewKasirPassword] = useState('');
  const [newKasirCabang, setNewKasirCabang] = useState(cabangList[0] || 'Cabang 1');
  const [showNewKasirPassword, setShowNewKasirPassword] = useState(false);

  // Editing Kasir
  const [editingKasirId, setEditingKasirId] = useState<number | null>(null);
  const [editKasirUsername, setEditKasirUsername] = useState('');
  const [editKasirCabang, setEditKasirCabang] = useState('');
  const [editKasirNewPassword, setEditKasirNewPassword] = useState('');
  const [showEditKasirPassword, setShowEditKasirPassword] = useState(false);

  // Cabang Management fields (Khusus Owner)
  const [newCabangName, setNewCabangName] = useState('');
  const [editingCabang, setEditingCabang] = useState<string | null>(null);
  const [editCabangName, setEditCabangName] = useState('');

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

  // Sync username field whenever modal opens (state persists while component stays mounted)
  useEffect(() => {
    if (isOpen && user) {
      setEditUsername(user.username);
    }
  }, [isOpen, user?.username]);

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

    // Update username first (with uniqueness validation) if changed
    const newUsername = editUsername.trim().toLowerCase();
    if (newUsername !== user.username) {
      const res = await changeUsername(newUsername);
      if (!res.success) {
        setIsSubmitting(false);
        showToast(res.message || 'Gagal mengubah username.', 'error');
        return;
      }
    }

    const success = await updateProfile({
      foto_url: fotoUrl,
    });
    setIsSubmitting(false);
    if (success) {
      showToast('Profil berhasil diperbarui!', 'success');
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
    if (!newKasirUsername.trim() || !newKasirPassword) {
      showToast('Harap lengkapi username dan PIN akun kasir.', 'error');
      return;
    }

    setIsSubmitting(true);
    const res = await createKasir({
      username: newKasirUsername.trim().toLowerCase(),
      password: newKasirPassword,
      cabang: newKasirCabang,
    });
    setIsSubmitting(false);

    if (res.success) {
      showToast(`Akun kasir "${newKasirUsername}" berhasil dibuat!`, 'success');
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
      `Apakah Anda yakin ingin menghapus akun kasir "${kasir.username}"?`
    );
    if (!confirmDelete) return;

    const res = await deleteKasir(kasir.id);
    if (res.success) {
      showToast(`Akun kasir "${kasir.username}" berhasil dihapus.`, 'success');
      await loadKasirList();
    } else {
      showToast(res.message || 'Gagal menghapus kasir.', 'error');
    }
  };

  const handleStartEditKasir = (kasir: UserType) => {
    setEditingKasirId(kasir.id || null);
    setEditKasirUsername(kasir.username);
    setEditKasirCabang(kasir.cabang || 'Cabang 1');
    setEditKasirNewPassword('');
  };

  const handleSaveEditKasir = async (kasirId: number) => {
    const cleanUsername = editKasirUsername.trim().toLowerCase();
    if (cleanUsername.length < 3) {
      showToast('Username kasir minimal 3 karakter.', 'error');
      return;
    }
    setIsSubmitting(true);
    const res = await updateKasir(kasirId, {
      username: cleanUsername,
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

  const userInitial = (user.username || 'U')[0].toUpperCase();

  // --- Kelola Cabang (Owner) ---
  const handleAddCabang = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await addCabang(newCabangName);
    showToast(res.message, res.success ? 'success' : 'error');
    if (res.success) setNewCabangName('');
  };

  const handleRenameCabang = async (oldName: string) => {
    const res = await renameCabang(oldName, editCabangName);
    showToast(res.message, res.success ? 'success' : 'error');
    if (res.success) {
      setEditingCabang(null);
      setEditCabangName('');
    }
  };

  const handleDeleteCabangClick = async (name: string) => {
    const confirmDelete = window.confirm(
      `Hapus cabang "${name}"? Menu tidak lagi ditampilkan di cabang ini. Data transaksi lama tetap tersimpan.`
    );
    if (!confirmDelete) return;
    const res = await deleteCabang(name);
    showToast(res.message, res.success ? 'success' : 'error');
    if (res.success && editingCabang === name) setEditingCabang(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 sm:p-4">
      <div className="w-full max-w-lg max-h-[90vh] flex flex-col rounded-xl bg-[var(--kartu)] shadow-xl overflow-hidden border border-[var(--garis)] font-sans">
        {/* Header Modal */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--garis)] bg-[var(--latar)] shrink-0">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-[var(--utama-teks)]" />
            <h3 className="font-semibold text-sm text-[var(--teks)]">Pengaturan Akun & Profil</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-[var(--redup)] hover:text-[var(--teks)] hover:bg-[var(--latar)] transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* User Card Preview Sederhana */}
        <div className="px-5 py-3 bg-[var(--kartu)] flex items-center gap-3 border-b border-[var(--garis)] shrink-0">
          {fotoUrl ? (
            <img
              src={fotoUrl}
              alt={user.username}
              className="w-11 h-11 rounded-lg object-cover border border-[var(--garis)]"
            />
          ) : (
            <div className="w-11 h-11 rounded-lg bg-[var(--utama)] text-white font-bold text-base flex items-center justify-center shrink-0">
              {userInitial}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-[var(--teks)] truncate">
                {user.username}
              </span>
              <span
                className={`text-[10px] font-medium px-2 py-0.5 rounded shrink-0 ${
                  user.role === 'owner'
                    ? 'bg-[var(--utama-muda)] text-[var(--utama-teks)] border border-[var(--garis)]'
                    : 'bg-[var(--utama-muda)] text-[var(--utama-teks)] border border-[var(--garis)]'
                }`}
              >
                {user.role === 'owner' ? 'Pemilik Usaha (Owner)' : 'Staf Kasir'}
              </span>
            </div>
          </div>
        </div>

        {/* Tab switcher rapi */}
        <div className="flex border-b border-[var(--garis)] bg-[var(--latar)] shrink-0 text-xs font-medium">
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex-1 py-2.5 text-center border-b-2 transition ${
              activeTab === 'profile'
                ? 'border-[var(--utama-teks)] text-[var(--utama-teks)] font-semibold bg-[var(--kartu)]'
                : 'border-transparent text-[var(--redup)] hover:text-[var(--teks)]'
            }`}
          >
            Profil Saya
          </button>
          <button
            onClick={() => setActiveTab('password')}
            className={`flex-1 py-2.5 text-center border-b-2 transition ${
              activeTab === 'password'
                ? 'border-[var(--utama-teks)] text-[var(--utama-teks)] font-semibold bg-[var(--kartu)]'
                : 'border-transparent text-[var(--redup)] hover:text-[var(--teks)]'
            }`}
          >
            Ganti Password
          </button>
          {isOwner && (
            <>
              <button
                onClick={() => setActiveTab('kasir')}
                className={`flex-1 py-2.5 text-center border-b-2 transition flex items-center justify-center gap-1.5 ${
                  activeTab === 'kasir'
                    ? 'border-[var(--utama-teks)] text-[var(--utama-teks)] font-semibold bg-[var(--kartu)]'
                    : 'border-transparent text-[var(--redup)] hover:text-[var(--teks)]'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Kelola Kasir</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[var(--utama-muda)] text-[var(--utama-teks)] font-bold">
                  {kasirList.length}
                </span>
              </button>
              <button
                onClick={() => setActiveTab('cabang')}
                className={`flex-1 py-2.5 text-center border-b-2 transition flex items-center justify-center gap-1.5 ${
                  activeTab === 'cabang'
                    ? 'border-[var(--utama-teks)] text-[var(--utama-teks)] font-semibold bg-[var(--kartu)]'
                    : 'border-transparent text-[var(--redup)] hover:text-[var(--teks)]'
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>Kelola Cabang</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[var(--utama-muda)] text-[var(--utama-teks)] font-bold">
                  {cabangList.length}
                </span>
              </button>
            </>
          )}
        </div>

        {/* Tab Body (Scrollable) */}
        <div className="p-5 overflow-y-auto flex-1 text-[var(--teks)]">
          {activeTab === 'profile' && (
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              {/* Theme Toggle */}
              <div className="flex items-center justify-between p-3 bg-[var(--kartu)] rounded-lg border border-[var(--garis)] shadow-xs">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-[var(--utama-muda)] text-[var(--utama-teks)] flex items-center justify-center shrink-0">
                    {mode === 'gelap' ? <Moon className="w-4.5 h-4.5" /> : <Sun className="w-4.5 h-4.5" />}
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-[var(--teks)]">Mode Tampilan</span>
                    <p className="text-[11px] text-[var(--redup)] mt-0.5">
                      {mode === 'gelap' ? 'Mode gelap aktif' : 'Mode terang aktif'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={toggle}
                  className={`relative inline-flex h-7 w-13 flex-shrink-0 cursor-pointer rounded-full transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[var(--utama-teks)] focus:ring-offset-2 focus:ring-offset-[var(--kartu)] ${
                    mode === 'gelap'
                      ? 'bg-[var(--utama)] border-2 border-[var(--utama-teks)]'
                      : 'bg-[var(--garis-kuat)] border-2 border-[var(--garis)]'
                  }`}
                  role="switch"
                  aria-checked={mode === 'gelap'}
                  aria-label={mode === 'gelap' ? 'Ganti ke mode terang' : 'Ganti ke mode gelap'}
                >
                  <span
                    aria-hidden="true"
                    className="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-200 ease-in-out"
                    style={{
                      transform: mode === 'gelap' ? 'translateX(26px)' : 'translateX(2px)',
                      boxShadow: mode === 'gelap' ? '0 2px 6px rgba(0,0,0,0.3)' : '0 2px 4px rgba(0,0,0,0.2)',
                    }}
                  />
                </button>
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--teks)] mb-1.5">
                  Username
                </label>
                <input
                  type="text"
                  value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value)}
                  placeholder="Masukkan username baru"
                  className="w-full px-3 py-2 text-sm bg-[var(--kartu)] border border-[var(--garis-kuat)] rounded-lg focus:border-[var(--utama-teks)] focus:ring-1 focus:ring-[var(--utama-teks)] outline-none"
                />
                <p className="text-[11px] text-[var(--redup)] mt-1">
                  Username harus unik dan minimal 3 karakter.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--teks)] mb-1.5">
                  Foto Profil
                </label>
                <div className="flex items-center gap-3 p-3 bg-[var(--latar)] rounded-lg border border-[var(--garis)]">
                  {fotoUrl ? (
                    <div className="relative shrink-0">
                      <img
                        src={fotoUrl}
                        alt="Foto Profil"
                        className="w-12 h-12 rounded-lg object-cover border border-[var(--garis-kuat)]"
                      />
                    </div>
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-[var(--kartu)] border border-[var(--garis-kuat)] flex flex-col items-center justify-center text-[var(--redup)] shrink-0">
                      <User className="w-5 h-5 text-[var(--redup)]" />
                    </div>
                  )}

                  <div className="flex-1 min-w-0 space-y-1">
                    <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--kartu)] hover:bg-[var(--latar)] border border-[var(--garis-kuat)] text-[var(--teks)] text-xs font-medium transition cursor-pointer shadow-2xs">
                      {isUploadingPhoto ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--utama-teks)]" />
                      ) : (
                        <Camera className="w-3.5 h-3.5 text-[var(--redup)]" />
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
                          className="inline-flex items-center gap-1 text-[11px] text-[var(--bahaya-teks)] hover:underline"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Hapus Foto</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
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
                  className="px-4 py-2 rounded-lg text-xs font-medium text-white bg-[var(--utama)] hover:bg-[var(--utama-tua)] active:bg-[var(--utama)] transition disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? 'Menyimpan...' : 'Simpan Profil'}
                </button>
              </div>
            </form>
          )}

          {activeTab === 'password' && (
            <form onSubmit={handleChangePassword} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-[var(--teks)] mb-1">
                  Password Lama
                </label>
                <input
                  type="password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-[var(--kartu)] border border-[var(--garis-kuat)] rounded-lg focus:border-[var(--utama-teks)] focus:ring-1 focus:ring-[var(--utama-teks)] outline-none"
                  placeholder="Masukkan password saat ini"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--teks)] mb-1">
                  Password Baru
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-[var(--kartu)] border border-[var(--garis-kuat)] rounded-lg focus:border-[var(--utama-teks)] focus:ring-1 focus:ring-[var(--utama-teks)] outline-none"
                  placeholder="Minimal 4 karakter"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--teks)] mb-1">
                  Konfirmasi Password Baru
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-[var(--kartu)] border border-[var(--garis-kuat)] rounded-lg focus:border-[var(--utama-teks)] focus:ring-1 focus:ring-[var(--utama-teks)] outline-none"
                  placeholder="Ketik ulang password baru"
                  required
                />
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2.5 rounded-lg text-xs font-medium text-white bg-[var(--utama)] hover:bg-[var(--utama-tua)] active:bg-[var(--utama)] transition cursor-pointer"
                >
                  {isSubmitting ? 'Memproses...' : 'Perbarui Password'}
                </button>
              </div>
            </form>
          )}

          {activeTab === 'kasir' && isOwner && (
            <div className="space-y-4">
              {/* Info banner wewenang owner */}
              <div className="p-3 rounded-lg bg-[var(--utama-muda)] border border-[var(--garis)] text-[var(--utama-teks)] text-xs">
                <p className="font-semibold text-[var(--utama-teks)]">Hak Akses Pemilik Usaha (Owner)</p>
                <p className="text-[var(--utama-teks)] mt-0.5 leading-relaxed">
                  Hanya akun Owner yang memiliki wewenang untuk mendaftarkan akun kasir, mengatur penempatan cabang, dan mereset password kasir.
                </p>
              </div>

              {/* Action bar */}
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-[var(--teks)]">Daftar Akun Kasir</h4>
                  <p className="text-xs text-[var(--redup)]">Staf yang berwenang melayani transaksi kasir</p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowAddKasirForm(!showAddKasirForm)}
                  className="px-3 py-1.5 rounded-lg bg-[var(--utama)] hover:bg-[var(--utama-tua)] active:bg-[var(--utama)] text-white text-xs font-medium transition flex items-center gap-1.5 cursor-pointer shadow-xs"
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
                  className="p-3.5 bg-[var(--latar)] rounded-lg border border-[var(--garis)] space-y-3"
                >
                  <div className="text-xs font-semibold text-[var(--teks)]">
                    Form Pendaftaran Kasir Baru
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-xs font-medium text-[var(--teks)] mb-1">
                        Username Kasir
                      </label>
                      <input
                        type="text"
                        value={newKasirUsername}
                        onChange={(e) => setNewKasirUsername(e.target.value)}
                        placeholder="Contoh: maemunah"
                        className="w-full px-3 py-1.5 text-xs bg-[var(--kartu)] border border-[var(--garis-kuat)] rounded-lg focus:border-[var(--utama-teks)] outline-none"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-[var(--teks)] mb-1">
                        Cabang Penempatan
                      </label>
                      <select
                        value={newKasirCabang}
                        onChange={(e) => setNewKasirCabang(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs bg-[var(--kartu)] border border-[var(--garis-kuat)] rounded-lg focus:border-[var(--utama-teks)] outline-none"
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
                    <label className="block text-xs font-medium text-[var(--teks)] mb-1">
                      PIN Kasir (6 digit)
                    </label>
                    <div className="relative">
                      <input
                        type={showNewKasirPassword ? 'text' : 'password'}
                        inputMode="numeric"
                        maxLength={6}
                        value={newKasirPassword}
                        onChange={(e) =>
                          setNewKasirPassword(e.target.value.replace(/\D/g, '').slice(0, 6))
                        }
                        placeholder="6 digit angka"
                        className="w-full pl-3 pr-8 py-1.5 text-xs bg-[var(--kartu)] border border-[var(--garis-kuat)] rounded-lg focus:border-[var(--utama-teks)] outline-none"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewKasirPassword(!showNewKasirPassword)}
                        className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-[var(--redup)] hover:text-[var(--redup)]"
                      >
                        {showNewKasirPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowAddKasirForm(false)}
                      className="px-3 py-1.5 rounded-lg border border-[var(--garis-kuat)] text-xs font-medium text-[var(--redup)] hover:bg-[var(--latar)]"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="px-4 py-1.5 rounded-lg bg-[var(--utama)] hover:bg-[var(--utama-tua)] active:bg-[var(--utama)] text-white text-xs font-medium disabled:opacity-50 cursor-pointer"
                    >
                      {isSubmitting ? 'Menyimpan...' : 'Simpan Kasir'}
                    </button>
                  </div>
                </form>
              )}

              {/* Kasir List */}
              {isLoadingKasir ? (
                <div className="py-6 text-center text-xs text-[var(--redup)] flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-[var(--utama-teks)]" />
                  <span>Memuat daftar kasir...</span>
                </div>
              ) : kasirList.length === 0 ? (
                <div className="py-6 text-center bg-[var(--latar)] rounded-lg border border-dashed border-[var(--garis-kuat)] p-4">
                  <p className="text-xs font-medium text-[var(--teks)]">Belum ada akun kasir terdaftar</p>
                  <p className="text-[11px] text-[var(--redup)] mt-0.5">
                    Silakan klik tombol "+ Tambah Kasir" untuk mendaftarkan akun staf pertama.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {kasirList.map((kasir) => {
                    const isEditing = editingKasirId === kasir.id;
                    const initial = (kasir.username || 'K')[0].toUpperCase();

                    return (
                      <div
                        key={kasir.id}
                        className="p-3 rounded-lg bg-[var(--kartu)] border border-[var(--garis)] hover:border-[var(--garis-kuat)] transition"
                      >
                        {isEditing ? (
                          <div className="space-y-2.5">
                            <div className="text-xs font-semibold text-[var(--teks)]">
                              Edit Kasir: @{kasir.username}
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <div>
                                <label className="block text-[11px] font-medium text-[var(--redup)] mb-1">
                                  Username
                                </label>
                                <input
                                  type="text"
                                  value={editKasirUsername}
                                  onChange={(e) => setEditKasirUsername(e.target.value)}
                                  placeholder="Username kasir"
                                  className="w-full px-2.5 py-1 text-xs border border-[var(--garis-kuat)] rounded-md outline-none focus:border-[var(--utama-teks)] bg-[var(--kartu)] text-[var(--teks)]"
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-medium text-[var(--redup)] mb-1">
                                  Cabang
                                </label>
                                <select
                                  value={editKasirCabang}
                                  onChange={(e) => setEditKasirCabang(e.target.value)}
                                  className="w-full px-2.5 py-1 text-xs border border-[var(--garis-kuat)] rounded-md outline-none focus:border-[var(--utama-teks)]"
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
                              <label className="block text-[11px] font-medium text-[var(--redup)] mb-1">
                                Reset PIN Baru (6 digit, kosongkan bila tidak diubah)
                              </label>
                              <div className="relative">
                                <input
                                  type={showEditKasirPassword ? 'text' : 'password'}
                                  inputMode="numeric"
                                  maxLength={6}
                                  value={editKasirNewPassword}
                                  onChange={(e) =>
                                    setEditKasirNewPassword(
                                      e.target.value.replace(/\D/g, '').slice(0, 6)
                                    )
                                  }
                                  placeholder="6 digit angka"
                                  className="w-full pl-2.5 pr-8 py-1 text-xs border border-[var(--garis-kuat)] rounded-md outline-none focus:border-[var(--utama-teks)]"
                                />
                                <button
                                  type="button"
                                  onClick={() => setShowEditKasirPassword(!showEditKasirPassword)}
                                  className="absolute inset-y-0 right-0 pr-2 flex items-center text-[var(--redup)]"
                                >
                                  {showEditKasirPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                </button>
                              </div>
                            </div>

                            <div className="flex justify-end gap-2 pt-1">
                              <button
                                type="button"
                                onClick={() => setEditingKasirId(null)}
                                className="px-2.5 py-1 rounded-md border border-[var(--garis-kuat)] text-xs text-[var(--redup)] hover:bg-[var(--latar)]"
                              >
                                Batal
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSaveEditKasir(kasir.id!)}
                                disabled={isSubmitting}
                                className="px-3 py-1 rounded-md bg-[var(--utama)] text-white text-xs font-medium hover:bg-[var(--utama-tua)]"
                              >
                                Simpan
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-8 h-8 rounded-md bg-[var(--latar)] text-[var(--teks)] font-semibold text-xs flex items-center justify-center shrink-0 border border-[var(--garis)]">
                                {initial}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-semibold text-[var(--teks)] truncate">
                                    {kasir.username}
                                  </span>
                                  <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-[var(--latar)] text-[var(--teks)] border border-[var(--garis)] shrink-0">
                                    {kasir.cabang || 'Cabang 1'}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleStartEditKasir(kasir)}
                                title="Edit info kasir"
                                className="p-1 rounded-md text-[var(--redup)] hover:text-[var(--teks)] hover:bg-[var(--latar)] transition"
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

          {activeTab === 'cabang' && isOwner && (
            <div className="space-y-4">
              {/* Info banner wewenang owner */}
              <div className="p-3 rounded-lg bg-[var(--utama-muda)] border border-[var(--garis)] text-[var(--utama-teks)] text-xs">
                <p className="font-semibold text-[var(--utama-teks)]">Kelola Cabang</p>
                <p className="text-[var(--utama-teks)] mt-0.5 leading-relaxed">
                  Tambah, ubah nama, atau hapus cabang. Perubahan nama otomatis diperbarui ke data
                  kasir, menu, dan transaksi terkait.
                </p>
              </div>

              {/* Form tambah cabang */}
              <form
                onSubmit={handleAddCabang}
                className="flex items-end gap-2 p-3.5 bg-[var(--latar)] rounded-lg border border-[var(--garis)]"
              >
                <div className="flex-1 min-w-0">
                  <label className="block text-xs font-medium text-[var(--teks)] mb-1">
                    Nama Cabang Baru
                  </label>
                  <input
                    type="text"
                    value={newCabangName}
                    onChange={(e) => setNewCabangName(e.target.value)}
                    placeholder="Contoh: Cabang 3"
                    className="w-full px-3 py-1.5 text-xs bg-[var(--kartu)] border border-[var(--garis-kuat)] rounded-lg focus:border-[var(--utama-teks)] outline-none"
                  />
                </div>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 rounded-lg bg-[var(--utama)] hover:bg-[var(--utama-tua)] active:bg-[var(--utama)] text-white text-xs font-medium transition flex items-center gap-1.5 cursor-pointer shadow-xs shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah</span>
                </button>
              </form>

              {/* Daftar cabang */}
              <div>
                <h4 className="text-sm font-semibold text-[var(--teks)] mb-1">Daftar Cabang</h4>
                <p className="text-xs text-[var(--redup)] mb-2.5">
                  {cabangList.length} cabang terdaftar
                </p>

                <div className="space-y-2">
                  {cabangList.map((cabang) => {
                    const isEditing = editingCabang === cabang;
                    return (
                      <div
                        key={cabang}
                        className="p-3 rounded-lg bg-[var(--kartu)] border border-[var(--garis)] hover:border-[var(--garis-kuat)] transition"
                      >
                        {isEditing ? (
                          <div className="space-y-2">
                            <div className="text-xs font-semibold text-[var(--teks)]">
                              Ubah Nama Cabang
                            </div>
                            <input
                              type="text"
                              value={editCabangName}
                              onChange={(e) => setEditCabangName(e.target.value)}
                              className="w-full px-2.5 py-1 text-xs border border-[var(--garis-kuat)] rounded-md outline-none focus:border-[var(--utama-teks)]"
                              autoFocus
                            />
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingCabang(null);
                                  setEditCabangName('');
                                }}
                                className="px-2.5 py-1 rounded-md border border-[var(--garis-kuat)] text-xs text-[var(--redup)] hover:bg-[var(--latar)]"
                              >
                                Batal
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRenameCabang(cabang)}
                                className="px-3 py-1 rounded-md bg-[var(--utama)] text-white text-xs font-medium hover:bg-[var(--utama-tua)] cursor-pointer"
                              >
                                Simpan
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-8 h-8 rounded-md bg-[var(--latar)] text-[var(--teks)] flex items-center justify-center shrink-0 border border-[var(--garis)]">
                                <Building2 className="w-4 h-4 text-[var(--utama-teks)]" />
                              </div>
                              <span className="text-xs font-semibold text-[var(--teks)] truncate">
                                {cabang}
                              </span>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingCabang(cabang);
                                  setEditCabangName(cabang);
                                }}
                                title="Ubah nama cabang"
                                className="p-1 rounded-md text-[var(--redup)] hover:text-[var(--teks)] hover:bg-[var(--latar)] transition"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteCabangClick(cabang)}
                                title="Hapus cabang"
                                disabled={cabangList.length <= 1}
                                className="p-1 rounded-md text-red-500 hover:text-red-700 hover:bg-red-50 transition disabled:opacity-30 disabled:cursor-not-allowed"
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
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};


