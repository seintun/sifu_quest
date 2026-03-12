export function BetaBadge({ className }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center justify-center px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-amber-500/20 text-amber-400 border border-amber-500/30 ${className}`}
      style={{
        animation: "beta-glow 2s ease-in-out infinite",
      }}
    >
      Beta
      <style>{`
        @keyframes beta-glow {
          0%, 100% {
            box-shadow: 0 0 5px rgba(251, 191, 36, 0.3), 0 0 10px rgba(251, 191, 36, 0.1);
          }
          50% {
            box-shadow: 0 0 10px rgba(251, 191, 36, 0.5), 0 0 20px rgba(251, 191, 36, 0.2), 0 0 30px rgba(251, 191, 36, 0.1);
          }
        }
      `}</style>
    </span>
  );
}
