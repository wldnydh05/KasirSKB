/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** aktif = terisi warna utama (lihat components.css .chip.aktif) */
  aktif?: boolean;
  /** angka hitungan opsional di kanan label */
  hitung?: number;
}

export const Chip: React.FC<ChipProps> = ({ aktif = false, hitung, className = '', children, ...props }) => (
  <button type="button" className={`chip ${aktif ? 'aktif' : ''} ${className}`} aria-pressed={aktif} {...props}>
    {children}
    {hitung !== undefined && <span className="chip-n">{hitung}</span>}
  </button>
);
