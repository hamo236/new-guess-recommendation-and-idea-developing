import React from 'react';

/**
 * Displays the opponent's secret target (from displayTargets — never ownTarget).
 * Display-only intelligence card; no interaction.
 */
const OpponentTargetCard = ({ target, compact = false }) => {
  if (!target) {
    return (
      <div className="w-full max-w-[280px] glass-panel rounded-xl p-stack-md border border-white/10 flex flex-col items-center gap-3">
        <span className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-widest">
          Your Opponent's Target
        </span>
        <div className="w-32 h-32 rounded-lg bg-white/5 border border-dashed border-white/20 flex items-center justify-center">
          <span className="material-symbols-outlined text-on-surface-variant text-3xl animate-pulse">hourglass_empty</span>
        </div>
        <span className="font-body-sm text-body-sm text-on-surface-variant">Assigning target…</span>
      </div>
    );
  }

  if (compact) {
    return (
      <article
        className="w-full max-w-[320px] flex flex-col items-center gap-3"
        aria-label={`Your opponent's target is ${target.name}`}
      >
        <div className="relative h-40 w-40 sm:h-44 sm:w-44 overflow-hidden rounded-2xl border-2 border-primary-fixed/40 shadow-[0_0_20px_rgba(125,244,255,0.25)]">
          <img
            src={target.image}
            alt={target.name}
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent pointer-events-none" />
        </div>
        <p className="font-headline-sm text-headline-sm text-on-surface text-center font-semibold leading-tight">
          {target.name}
        </p>
      </article>
    );
  }

  return (
    <article
      className="w-full max-w-[320px] glass-panel rounded-2xl overflow-hidden neon-border shadow-[0_0_24px_rgba(125,244,255,0.12)] bg-primary-fixed/5"
      aria-label={`Your opponent's target is ${target.name}`}
    >
      <div className="px-4 pt-4 pb-3 flex items-start justify-between gap-3 border-b border-white/10">
        <div className="flex items-center gap-2 min-w-0">
          <span className="material-symbols-outlined text-primary-fixed text-[18px]" aria-hidden="true">target</span>
          <h2 className="font-label-caps text-label-caps text-primary-fixed uppercase tracking-widest">
            Your Opponent's Target
          </h2>
        </div>
        <span className="shrink-0 rounded-full border border-primary-fixed/20 bg-primary-fixed/10 px-2 py-1 font-label-caps text-[9px] tracking-wider text-primary-fixed">
          VISIBLE
        </span>
      </div>

      <div className="p-4 sm:p-5 flex flex-col items-center gap-3">
        <div className="relative w-40 h-40 sm:w-44 sm:h-44 rounded-2xl overflow-hidden border-2 border-primary-fixed/40 shadow-[0_0_20px_rgba(125,244,255,0.25)]">
          <img
            src={target.image}
            alt={target.name}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent pointer-events-none" />
        </div>

        <p className="font-headline-sm text-headline-sm text-on-surface text-center font-semibold leading-tight">
          {target.name}
        </p>

        <p className="max-w-[260px] font-body-sm text-body-sm text-on-surface-variant text-center leading-snug">
          The character your opponent is trying to guess. Answer their Yes/No questions about this person.
        </p>
        <div className="flex items-center gap-2 text-center" aria-hidden="true">
          <span className="h-px w-8 bg-primary-fixed/20" />
          <span className="material-symbols-outlined text-[14px] text-primary-fixed/70">visibility</span>
          <span className="h-px w-8 bg-primary-fixed/20" />
        </div>
      </div>
    </article>
  );
};

export default OpponentTargetCard;
