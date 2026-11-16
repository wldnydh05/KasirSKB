/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { useSyncExternalStore } from 'react';

export type ModeTema = 'terang' | 'gelap';

const KUNCI = 'tema-mode';
const pendengar = new Set<() => void>();

function bacaSimpanan(): ModeTema | null {
  try {
    const s = localStorage.getItem(KUNCI);
    return s === 'gelap' || s === 'terang' ? s : null;
  } catch {
    return null;
  }
}

function modeAwal(): ModeTema {
  const tersimpan = bacaSimpanan();
  if (tersimpan) return tersimpan;
  // Belum pernah dipilih manual → ikut preferensi sistem
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches
    ? 'gelap'
    : 'terang';
}

let mode: ModeTema = modeAwal();

function terapkan() {
  const el = document.documentElement;
  if (mode === 'gelap') el.setAttribute('data-mode', 'gelap');
  else el.removeAttribute('data-mode');
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', mode === 'gelap' ? '#171c19' : '#173f2b');
}

export function setModeTema(m: ModeTema) {
  mode = m;
  try {
    localStorage.setItem(KUNCI, m);
  } catch {
    /* storage tidak tersedia — mode tetap berlaku untuk sesi ini */
  }
  terapkan();
  pendengar.forEach((f) => f());
}

export function toggleModeTema() {
  setModeTema(mode === 'gelap' ? 'terang' : 'gelap');
}

/**
 * Hook mode terang/gelap — state disimpan di localStorage ('tema-mode'),
 * default mengikuti preferensi sistem, dan langsung diterapkan ke
 * <html data-mode="gelap"> (lihat juga skrip anti-flash di index.html).
 */
export function useTema() {
  const modeSekarang = useSyncExternalStore(
    (cb) => {
      pendengar.add(cb);
      return () => {
        pendengar.delete(cb);
      };
    },
    () => mode
  );
  return { mode: modeSekarang, toggle: toggleModeTema, setMode: setModeTema };
}

// Sinkronkan atribut saat modul dimuat (skrip inline di index.html sudah
// menerapkan atributnya sebelum paint; di sini kita lengkapi theme-color).
terapkan();
