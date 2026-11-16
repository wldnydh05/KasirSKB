/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** merah = bahaya, aksen = oranye, default = hijau utama (lihat components.css .lencana) */
  variant?: 'default' | 'merah' | 'aksen';
}

export const Badge: React.FC<BadgeProps> = ({ variant = 'default', className = '', children, ...props }) => (
  <span className={`lencana ${variant !== 'default' ? variant : ''} ${className}`} {...props}>
    {children}
  </span>
);
