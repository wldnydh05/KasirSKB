/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { useCart } from '../context/CartContext';
import { pesananAktifService } from '../lib/supabaseService';

/**
 * Badge angka untuk navigasi — dipakai bersama oleh BottomNav (mobile)
 * dan Sidebar (desktop) supaya angkanya selalu sama:
 * - totalItemsCount : isi keranjang      → badge hijau di "Kasir"
 * - unpaidCount     : pesanan belum bayar → badge merah di "Riwayat"
 */
export function useNavBadge() {
  const { totalItemsCount } = useCart();
  const [unpaidCount, setUnpaidCount] = useState(0);

  useEffect(() => {
    let hidup = true;

    const muat = async () => {
      try {
        const orders = await pesananAktifService.getAll();
        if (hidup) setUnpaidCount(orders.length);
      } catch (e) {
        console.error('Failed to count unpaid active orders', e);
      }
    };

    muat();
    const jeda = setInterval(muat, 3000);

    return () => {
      hidup = false;
      clearInterval(jeda);
    };
  }, []);

  return { totalItemsCount, unpaidCount };
}