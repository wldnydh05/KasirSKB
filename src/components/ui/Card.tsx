/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** panel = kartu + margin bawah (.panel), kartu = kartu biasa tanpa margin */
  variant?: 'kartu' | 'panel';
}

export const Card: React.FC<CardProps> = ({ variant = 'kartu', className = '', children, ...props }) => (
  <div className={`${variant} ${className}`} {...props}>
    {children}
  </div>
);
