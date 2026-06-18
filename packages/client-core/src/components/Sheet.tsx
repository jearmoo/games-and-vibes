import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  maxHeight?: string;
}

export default function Sheet({ open, onClose, title, children, maxHeight = '70vh' }: SheetProps) {
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end"
      role="dialog"
      aria-modal="true"
      aria-label={title || 'Sheet'}
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" />

      {/* Sheet panel */}
      <div className="relative w-full max-w-2xl mx-auto animate-slide-up" onClick={(e) => e.stopPropagation()}>
        <div className="glass-card rounded-t-2xl border border-white/10 border-b-0 flex flex-col" style={{ maxHeight }}>
          {/* Drag handle */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 rounded-full bg-white/20" />
          </div>

          {/* Header */}
          {title && (
            <div className="px-5 pt-2 pb-3 shrink-0">
              <div
                className="font-display text-lg text-white tracking-wider"
                style={{ textShadow: '0 0 20px rgba(99,102,241,0.3)' }}
              >
                {title}
              </div>
            </div>
          )}

          {/* Content */}
          <div className="flex-1 overflow-auto px-5 pb-5 min-h-0">{children}</div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
