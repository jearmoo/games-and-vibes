export default function ReconnectBanner({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <div className="fixed top-0 inset-x-0 z-40 bg-amber-600/90 text-white text-center py-2 text-sm font-medium animate-slide-up">
      Connection lost. Reconnecting...
    </div>
  );
}
