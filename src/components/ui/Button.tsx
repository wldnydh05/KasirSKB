/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** utama = hijau brand, bahaya = merah, default = netral (lihat components.css .tombol) */
  variant?: 'default' | 'utama' | 'bahaya';
  /** true = tombol lebar penuh tinggi 56px (.tombol.besar) */
  besar?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ variant = 'default', besar = false, className = '', children, ...props }) => {
  const kelas = [
    'tombol',
    variant === 'utama' && 'utama',
    variant === 'bahaya' && 'bahaya',
    besar && 'besar',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button type="button" className={kelas} {...props}>
      {children}
    </button>
  );
};
