import { useEffect } from 'react';

export default function ErrorToast({ message, onDismiss }: { message: string | null; onDismiss: () => void }) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(onDismiss, 4000);
    return () => clearTimeout(timer);
  }, [message, onDismiss]);

  if (!message) return null;

  return (
    <div className="fixed bottom-6 inset-x-0 z-50 flex justify-center animate-slide-up">
      <div className="glass-card px-5 py-3 rounded-2xl text-red-400 text-sm font-medium max-w-sm text-center">
        {message}
      </div>
    </div>
  );
}
