'use client';

import { useEffect, useRef } from 'react';

/**
 * Native <dialog> shown with showModal(): the browser handles the focus trap, makes the page
 * behind it inert, and exposes it as a modal dialog.
 */
export function Modal({
  labelledBy,
  label,
  onRequestClose,
  className = '',
  children,
}: {
  /** Id of the element that titles the dialog. Use `label` when there is no visible title. */
  labelledBy?: string;
  label?: string;
  /** Called when the user presses Escape. */
  onRequestClose: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const opener = document.activeElement;
    if (!dialog.open) dialog.showModal();
    return () => {
      dialog.close();
      // React has already removed the dialog here, so the browser can't restore focus itself.
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby={labelledBy}
      aria-label={label}
      onCancel={(e) => {
        // The parent decides whether to close, e.g. after confirming unsaved changes.
        e.preventDefault();
        onRequestClose();
      }}
      onClose={(e) => {
        // Some browsers ignore preventDefault on a repeated Escape, so stay in sync with the parent.
        const dialog = e.currentTarget;
        if (dialog.open) return;
        onRequestClose();
        dialog.showModal();
      }}
      className={`fixed inset-0 m-0 h-full w-full max-h-none max-w-none border-0 text-slate-900 backdrop:bg-transparent flex items-center justify-center ${className}`}
    >
      {children}
    </dialog>
  );
}
