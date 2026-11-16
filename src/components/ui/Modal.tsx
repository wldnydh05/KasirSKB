/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef } from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  /** true = lebar 820px (untuk dialog pembayaran) */
  lebar?: boolean;
  children: React.ReactNode;
}

/** Dialog native (<dialog>) — dapat ESC & backdrop dari browser, tutup lewat onClose. */
export const Modal: React.FC<ModalProps> = ({ open, onClose, title, lebar = false, children }) => {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      style={lebar ? { width: 'min(820px, calc(100% - 24px))' } : undefined}
      onClick={(e) => {
        // klik backdrop (target = dialog sendiri, bukan isinya)
        if (e.target === ref.current) onClose();
      }}
      onClose={() => {
        if (open) onClose();
      }}
    >
      <div className="dlg-isi">
        {title && <h3>{title}</h3>}
        {children}
      </div>
    </dialog>
  );
};
