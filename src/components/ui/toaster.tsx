'use client';

import { Toaster as Sonner } from 'sonner';

/** Toasts: white rounded cards bottom-right, matching the card style. Use `toast.success/error/message` from 'sonner'. */
export function Toaster() {
  return (
    <Sonner
      position="bottom-right"
      gap={10}
      visibleToasts={4}
      closeButton
      toastOptions={{
        duration: 4500,
        classNames: {
          toast:
            'rounded-2xl! border! border-line! bg-surface! shadow-float! text-ink-900! font-sans! gap-3! px-4! py-3.5!',
          title: 'text-sm! font-semibold!',
          description: 'text-[13px]! text-ink-500!',
          success: '[&_[data-icon]]:text-success-600!',
          error: '[&_[data-icon]]:text-danger-500!',
          warning: '[&_[data-icon]]:text-warning-500!',
          info: '[&_[data-icon]]:text-brand-500!',
          closeButton: 'border-line! bg-surface! text-ink-500! hover:bg-canvas!',
          actionButton: 'rounded-full! bg-brand-500! text-white! font-medium!',
        },
      }}
    />
  );
}
