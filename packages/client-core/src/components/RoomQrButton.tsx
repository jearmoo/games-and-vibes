import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import QRCode from 'react-qr-code';

export interface RoomQrButtonProps {
  roomCode: string | null | undefined;
  shareUrl?: string;
  buttonLabel?: string;
  className?: string;
}

export default function RoomQrButton({
  roomCode,
  shareUrl,
  buttonLabel = 'QR code',
  className = 'text-gray-400 hover:text-white text-xs tracking-wider transition-colors px-3 py-1.5 border border-white/5 rounded-lg bg-surface-raised hover:bg-surface-hover active:scale-[0.97]',
}: RoomQrButtonProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const joinUrl = useMemo(() => {
    if (shareUrl) return shareUrl;
    if (!roomCode || typeof window === 'undefined') return '';
    return `${window.location.origin}/${roomCode}`;
  }, [roomCode, shareUrl]);

  const normalizedRoomCode = roomCode?.trim().toUpperCase() ?? '';

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handleKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  function copyLink(): void {
    if (!joinUrl) return;
    navigator.clipboard?.writeText(joinUrl).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      },
      () => {},
    );
  }

  return (
    <>
      <button
        type="button"
        disabled={!joinUrl}
        onClick={() => setOpen(true)}
        className={`${className} disabled:cursor-not-allowed disabled:opacity-40`}
      >
        {buttonLabel}
      </button>
      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-label="Room QR code"
            onClick={() => setOpen(false)}
          >
            <div className="absolute inset-0 bg-black/65 backdrop-blur-md" />
            <div
              className="relative w-full max-w-sm rounded-2xl border border-white/10 bg-slate-950/95 p-5 shadow-2xl shadow-black/50 animate-fade-in"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                aria-label="Close QR code"
                onClick={() => setOpen(false)}
                className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-xl leading-none text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
              >
                &times;
              </button>

              <div className="pr-10">
                <div className="text-gray-500 text-[10px] tracking-[0.3em] uppercase">Room code</div>
                <div className="mt-1 font-display text-4xl tracking-[0.28em] text-white">{normalizedRoomCode}</div>
              </div>

              <div className="mt-5 rounded-2xl bg-white p-4 shadow-inner shadow-black/10">
                <QRCode
                  value={joinUrl}
                  size={256}
                  bgColor="#ffffff"
                  fgColor="#050816"
                  level="M"
                  className="h-auto w-full"
                />
              </div>

              <div className="mt-4 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-gray-300 break-all">
                {joinUrl}
              </div>

              <button
                type="button"
                onClick={copyLink}
                className="mt-3 w-full rounded-xl border border-white/10 bg-surface-raised px-4 py-3 font-display text-sm tracking-wider text-white transition-all hover:bg-surface-hover active:scale-[0.98]"
              >
                {copied ? 'Copied' : 'Copy link'}
              </button>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
