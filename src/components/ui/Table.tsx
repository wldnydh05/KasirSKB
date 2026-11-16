/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

interface TableProps {
  /** Isi <thead> — opsional */
  head?: React.ReactNode;
  /** Isi <tbody> */
  children: React.ReactNode;
  className?: string;
}

/** Pembungkus tabel: .tabel-bungkus (kartu + overflow) > table.tabel */
export const Table: React.FC<TableProps> = ({ head, children, className = '' }) => (
  <div className={`tabel-bungkus ${className}`}>
    <table className="tabel">
      {head && <thead>{head}</thead>}
      <tbody>{children}</tbody>
    </table>
  </div>
);
