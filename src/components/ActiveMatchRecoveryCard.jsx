const STATUS_COPY = {
  restoring: {
    title: 'RESTORING ACTIVE MATCH',
    tone: 'border-primary-fixed/40 bg-primary-fixed/10 text-primary-fixed',
    icon: 'sync',
    eyebrow: 'SESSION CHECK',
  },
  'retryable-error': {
    title: 'MATCH CONNECTION INTERRUPTED',
    tone: 'border-error/40 bg-error/10 text-error',
    icon: 'wifi_off',
    eyebrow: 'RECOVERY AVAILABLE',
  },
  terminal: {
    title: 'MATCH IS NO LONGER AVAILABLE',
    tone: 'border-secondary-fixed/40 bg-secondary-fixed/10 text-secondary-fixed',
    icon: 'history_toggle_off',
    eyebrow: 'ROOM CLOSED',
  },
  'identity-error': {
    title: 'PLAYER IDENTITY NEEDS ATTENTION',
    tone: 'border-secondary-fixed/40 bg-secondary-fixed/10 text-secondary-fixed',
    icon: 'person_alert',
    eyebrow: 'ACTION REQUIRED',
  },
};

export default function ActiveMatchRecoveryCard({
  recovery,
  onRetry,
  onDismiss,
}) {
  if (!recovery || !STATUS_COPY[recovery.status]) return null;

  const isRestoring = recovery.status === 'restoring';
  const isRetryable = recovery.status === 'retryable-error';
  const isExpired = recovery.code === 'room/stale';
  const statusCopy = isExpired
    ? { ...STATUS_COPY.terminal, title: 'ROOM HAS EXPIRED', eyebrow: 'ROOM EXPIRED', icon: 'event_busy' }
    : STATUS_COPY[recovery.status];
  const roomCode = recovery.session?.roomCode?.toUpperCase();
  const stageLabel = isRestoring ? 'CHECKING SESSION' : isRetryable ? 'RECONNECT OR RESET' : isExpired ? 'CREATE A NEW ROOM' : 'SESSION CLOSED';

  return (
    <section
      role={isRestoring ? 'status' : 'alert'}
      aria-live="polite"
      className={`ng-recovery-card ng-competitive-surface glass-panel-2 relative overflow-hidden rounded-2xl border p-4 shadow-[0_18px_60px_rgba(0,0,0,0.24)] transition-colors duration-200 motion-reduce:transition-none sm:p-5 ${statusCopy.tone}`}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-current to-transparent opacity-60"
      />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className="flex min-w-0 gap-3 sm:gap-4">
          <span
            aria-hidden="true"
            className="ng-recovery-icon material-symbols-outlined mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-current/25 bg-black/15 text-[20px] shadow-inner shadow-white/5"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            {statusCopy.icon}
          </span>
          <div className="ng-recovery-copy min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-label-caps text-label-caps tracking-[0.16em]">
                {statusCopy.eyebrow}
              </p>
              {roomCode && (
                <span className="rounded-full border border-white/15 bg-black/15 px-2.5 py-1 font-mono text-[11px] font-bold tracking-[0.18em] text-white/90">
                  {roomCode}
                </span>
              )}
            </div>
            <h2 className="mt-2 font-headline-md text-headline-md leading-tight text-white">
              {isRestoring ? 'Checking your saved room…' : isExpired ? 'This room is no longer available.' : 'Your match session is still on this device.'}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-on-surface-variant">
              {isRestoring
                ? 'We are reconnecting using the existing player identity. No new room or match is created.'
                : isExpired
                  ? 'This room was inactive for too long and has expired. Create a new room to continue.'
                  : recovery.message || 'You can retry without changing the current room state.'}
            </p>
          </div>
        </div>
        {!isRestoring && (
          <div className="ng-recovery-actions flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
            <span className="ng-recovery-stage font-label-caps text-[10px] tracking-[0.14em] text-on-surface-variant">{stageLabel}</span>
            <div className="ng-button-cluster flex shrink-0 flex-wrap gap-2 sm:justify-end">
            {isRetryable && (
              <button
                type="button"
                onClick={onRetry}
                className="ng-interactive touch-feedback min-h-11 rounded-lg bg-primary-fixed px-4 py-2 font-label-caps text-label-caps text-on-primary-fixed shadow-[0_8px_24px_rgba(125,244,255,0.16)] transition duration-200 hover:brightness-110 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-fixed focus-visible:ring-offset-2 focus-visible:ring-offset-surface-dim motion-reduce:transition-none motion-reduce:active:scale-100"
              >
                TRY AGAIN
              </button>
            )}
            <button
              type="button"
              onClick={onDismiss}
              className="ng-interactive touch-feedback min-h-11 rounded-lg border border-white/20 bg-white/[0.03] px-4 py-2 font-label-caps text-label-caps text-white transition duration-200 hover:border-white/35 hover:bg-white/10 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-fixed focus-visible:ring-offset-2 focus-visible:ring-offset-surface-dim motion-reduce:transition-none motion-reduce:active:scale-100"
            >
              START NEW ROOM
            </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

// The card is a projection only: it never writes room, match, round, score, or player state.
