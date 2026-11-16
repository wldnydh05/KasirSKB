/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import bcrypt from 'bcryptjs';
import { db, seedDatabaseIfEmpty } from '../db';
import type { User, UserRole } from '../types';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; message?: string }>;
  quickLogin: (usernameOrRole: string) => Promise<boolean>;
  logout: () => void;
  updateProfile: (data: Partial<User>) => Promise<boolean>;
  changePassword: (oldPass: string, newPass: string) => Promise<{ success: boolean; message: string }>;
  registerOwner: (data: { namaLengkap: string; username: string; password: string }) => Promise<{ success: boolean; message?: string }>;
  createKasir: (data: { namaLengkap: string; username: string; password: string; cabang: string }) => Promise<{ success: boolean; message?: string }>;
  getKasirList: () => Promise<User[]>;
  deleteKasir: (id: number) => Promise<{ success: boolean; message?: string }>;
  updateKasir: (id: number, data: { namaLengkap?: string; cabang?: string; newPassword?: string }) => Promise<{ success: boolean; message?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const SESSION_KEY = 'bukupos_current_user_id';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize DB and restore session
  useEffect(() => {
    async function init() {
      try {
        await seedDatabaseIfEmpty();
        const storedUserId = localStorage.getItem(SESSION_KEY);
        if (storedUserId) {
          const found = await db.users.get(Number(storedUserId));
          if (found) {
            setUser(found);
          }
        }
      } catch (err) {
        console.error('Failed to initialize database/session:', err);
      } finally {
        setIsLoading(false);
      }
    }
    init();
  }, []);

  const login = async (username: string, password: string): Promise<{ success: boolean; message?: string }> => {
    try {
      const trimmedUser = username.trim().toLowerCase();
      const foundUser = await db.users.where('username').equalsIgnoreCase(trimmedUser).first();

      if (!foundUser) {
        return { success: false, message: 'Username tidak ditemukan.' };
      }

      const match = bcrypt.compareSync(password, foundUser.password_hash);
      if (!match) {
        return { success: false, message: 'Password salah. Silakan coba lagi.' };
      }

      setUser(foundUser);
      if (foundUser.id) {
        localStorage.setItem(SESSION_KEY, String(foundUser.id));
      }
      return { success: true };
    } catch (err) {
      console.error('Login error:', err);
      return { success: false, message: 'Terjadi kesalahan sistem saat login.' };
    }
  };

  const registerOwner = async (data: {
    namaLengkap: string;
    username: string;
    password: string;
  }): Promise<{ success: boolean; message?: string }> => {
    try {
      const cleanUsername = data.username.trim().toLowerCase();
      if (!cleanUsername || !data.password || !data.namaLengkap.trim()) {
        return { success: false, message: 'Harap lengkapi semua kolom pendaftaran.' };
      }
      if (cleanUsername.length < 3) {
        return { success: false, message: 'Username minimal 3 karakter.' };
      }
      if (data.password.length < 4) {
        return { success: false, message: 'Password minimal 4 karakter.' };
      }

      const existing = await db.users.where('username').equalsIgnoreCase(cleanUsername).first();
      if (existing) {
        return { success: false, message: `Username "${cleanUsername}" sudah digunakan. Silakan pilih username lain.` };
      }

      const passwordHash = bcrypt.hashSync(data.password, 10);
      const nowIso = new Date().toISOString();

      const newOwnerId = await db.users.add({
        username: cleanUsername,
        password_hash: passwordHash,
        role: 'owner',
        nama_lengkap: data.namaLengkap.trim(),
        cabang: 'Semua Cabang',
        foto_url: '',
        created_at: nowIso,
      });

      const newOwner = await db.users.get(newOwnerId);
      if (newOwner) {
        setUser(newOwner);
        localStorage.setItem(SESSION_KEY, String(newOwner.id));
      }

      return { success: true };
    } catch (err) {
      console.error('Register owner error:', err);
      return { success: false, message: 'Gagal mendaftarkan akun Owner.' };
    }
  };

  // Only owner has authority to create kasir account
  const createKasir = async (data: {
    namaLengkap: string;
    username: string;
    password: string;
    cabang: string;
  }): Promise<{ success: boolean; message?: string }> => {
    if (user?.role !== 'owner') {
      return { success: false, message: 'Hanya Pemilik Usaha (Owner) yang memiliki wewenang membuat akun kasir.' };
    }

    try {
      const cleanUsername = data.username.trim().toLowerCase();
      if (!cleanUsername || !data.password || !data.namaLengkap.trim()) {
        return { success: false, message: 'Harap isi nama, username, password, dan cabang kasir.' };
      }
      if (cleanUsername.length < 3) {
        return { success: false, message: 'Username kasir minimal 3 karakter.' };
      }
      if (data.password.length < 4) {
        return { success: false, message: 'Password kasir minimal 4 karakter.' };
      }

      const existing = await db.users.where('username').equalsIgnoreCase(cleanUsername).first();
      if (existing) {
        return { success: false, message: `Username "${cleanUsername}" sudah digunakan. Pilih username lain.` };
      }

      const passwordHash = bcrypt.hashSync(data.password, 10);
      const nowIso = new Date().toISOString();

      await db.users.add({
        username: cleanUsername,
        password_hash: passwordHash,
        role: 'staff',
        nama_lengkap: data.namaLengkap.trim(),
        cabang: data.cabang || 'Cabang 1',
        foto_url: '',
        created_at: nowIso,
      });

      return { success: true };
    } catch (err) {
      console.error('Create kasir error:', err);
      return { success: false, message: 'Gagal membuat akun kasir.' };
    }
  };

  const getKasirList = async (): Promise<User[]> => {
    try {
      return await db.users.where('role').equals('staff').toArray();
    } catch (err) {
      console.error('Get kasir list error:', err);
      return [];
    }
  };

  const deleteKasir = async (id: number): Promise<{ success: boolean; message?: string }> => {
    if (user?.role !== 'owner') {
      return { success: false, message: 'Hanya Owner yang berwenang menghapus akun kasir.' };
    }
    try {
      const target = await db.users.get(id);
      if (!target) {
        return { success: false, message: 'Akun kasir tidak ditemukan.' };
      }
      if (target.role !== 'staff') {
        return { success: false, message: 'Tidak dapat menghapus akun non-kasir.' };
      }
      await db.users.delete(id);
      return { success: true };
    } catch (err) {
      console.error('Delete kasir error:', err);
      return { success: false, message: 'Gagal menghapus akun kasir.' };
    }
  };

  const updateKasir = async (
    id: number,
    data: { namaLengkap?: string; cabang?: string; newPassword?: string }
  ): Promise<{ success: boolean; message?: string }> => {
    if (user?.role !== 'owner') {
      return { success: false, message: 'Hanya Owner yang berwenang mengubah akun kasir.' };
    }
    try {
      const target = await db.users.get(id);
      if (!target || target.role !== 'staff') {
        return { success: false, message: 'Akun kasir tidak valid.' };
      }

      const updateData: Partial<User> = {};
      if (data.namaLengkap) updateData.nama_lengkap = data.namaLengkap.trim();
      if (data.cabang) updateData.cabang = data.cabang;
      if (data.newPassword) {
        if (data.newPassword.length < 4) {
          return { success: false, message: 'Password baru minimal 4 karakter.' };
        }
        updateData.password_hash = bcrypt.hashSync(data.newPassword, 10);
      }

      await db.users.update(id, updateData);
      return { success: true };
    } catch (err) {
      console.error('Update kasir error:', err);
      return { success: false, message: 'Gagal memperbarui akun kasir.' };
    }
  };

  const quickLogin = async (usernameOrRole: string): Promise<boolean> => {
    try {
      let foundUser = await db.users.where('username').equalsIgnoreCase(usernameOrRole).first();
      if (!foundUser) {
        foundUser = await db.users.where('role').equals(usernameOrRole).first();
      }
      if (foundUser) {
        setUser(foundUser);
        if (foundUser.id) {
          localStorage.setItem(SESSION_KEY, String(foundUser.id));
        }
        return true;
      }
      return false;
    } catch (err) {
      console.error('Quick login error:', err);
      return false;
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(SESSION_KEY);
  };

  const updateProfile = async (data: Partial<User>): Promise<boolean> => {
    if (!user || !user.id) return false;
    try {
      await db.users.update(user.id, data);
      const updated = await db.users.get(user.id);
      if (updated) {
        setUser(updated);
      }
      return true;
    } catch (err) {
      console.error('Update profile error:', err);
      return false;
    }
  };

  const changePassword = async (
    oldPass: string,
    newPass: string
  ): Promise<{ success: boolean; message: string }> => {
    if (!user || !user.id) return { success: false, message: 'User belum login' };
    try {
      const match = bcrypt.compareSync(oldPass, user.password_hash);
      if (!match) {
        return { success: false, message: 'Password lama tidak cocok.' };
      }

      if (newPass.length < 4) {
        return { success: false, message: 'Password baru minimal 4 karakter.' };
      }

      const newHash = bcrypt.hashSync(newPass, 10);
      await db.users.update(user.id, { password_hash: newHash });
      const updated = await db.users.get(user.id);
      if (updated) {
        setUser(updated);
      }
      return { success: true, message: 'Password berhasil diubah!' };
    } catch (err) {
      console.error('Change password error:', err);
      return { success: false, message: 'Gagal mengubah password.' };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login,
        registerOwner,
        createKasir,
        getKasirList,
        deleteKasir,
        updateKasir,
        quickLogin,
        logout,
        updateProfile,
        changePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};


