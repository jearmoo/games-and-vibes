import { useState } from 'react';
import { ConfirmModal, leaveRoom } from '@games/client-core';
import { socket } from '../socket';
import { useGameStore, SESSION_KEY } from '../store';

export default function LeaveRoomButton({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  const [confirming, setConfirming] = useState(false);

  const handleConfirm = () => {
    const { playerName, connected } = useGameStore.getState();
    leaveRoom({ socket, sessionKey: SESSION_KEY, resetStore: useGameStore.getState().reset });
    useGameStore.setState({ playerName, connected });
    setConfirming(false);
  };

  return (
    <>
      <button onClick={() => setConfirming(true)} className={className}>
        {children ?? 'Leave Room'}
      </button>
      {confirming && (
        <ConfirmModal
          title="Leave Room?"
          message="You'll be removed from the room. You can rejoin or create a new room."
          confirmLabel="Leave"
          cancelLabel="Stay"
          confirmClass="btn-team-b"
          onConfirm={handleConfirm}
          onCancel={() => setConfirming(false)}
        />
      )}
    </>
  );
}
