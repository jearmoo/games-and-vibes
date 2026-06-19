import { useState, type ReactNode } from 'react';
import { ConfirmModal } from '@games/client-core';
import { useGameStore } from '../store';

export default function LeaveRoomButton({
  className,
  children,
  title,
  ariaLabel,
}: {
  className?: string;
  children?: ReactNode;
  title?: string;
  ariaLabel?: string;
}) {
  const [confirming, setConfirming] = useState(false);

  const handleConfirm = () => {
    useGameStore.getState().leaveRoom();
    setConfirming(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className={className}
        title={title}
        aria-label={ariaLabel}
      >
        {children ?? 'Leave Room'}
      </button>
      {confirming && (
        <ConfirmModal
          title="Leave Room?"
          message="You'll be removed from the room. You can rejoin with the same name or create a new room."
          confirmLabel="Leave"
          cancelLabel="Stay"
          confirmClass="btn-decrypto"
          onConfirm={handleConfirm}
          onCancel={() => setConfirming(false)}
        />
      )}
    </>
  );
}
