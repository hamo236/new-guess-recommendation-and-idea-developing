import React from 'react';

/**
 * Shows both players' secret targets after round end (reveal phase only).
 */
const RoundRevealPanel = ({ players, revealedTargets, isOneVOne = false }) => {
  if (!revealedTargets || Object.keys(revealedTargets).length === 0) return null;

  return (
    <div className="ng-reveal-details w-full flex flex-col gap-3 z-10">
<div className="flex items-center justify-between gap-3 border-b border-white/10 pb-2">
        <h4 className="font-label-caps text-[10px] tracking-[0.14em] text-on-surface-variant">
          ROUND DETAILS
        </h4>
        <span className="font-label-caps text-[9px] tracking-[0.12em] text-secondary-fixed">REVEAL</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {players.map((player) => {
          const target = revealedTargets[player.id];

          if (!target) return null;
          return (
            <div
              key={player.id}
              className="ng-reveal-card glass-panel rounded-xl p-3 flex flex-col items-center gap-2 border border-white/10"
            >
              <span className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-widest">
                {player.name} TARGET
              </span>
              <div className={`w-24 h-24 rounded-lg overflow-hidden border border-primary-fixed/30 shadow-[0_0_15px_rgba(125,244,255,0.2)] ${isOneVOne ? 'ng-reveal-card__target-image' : ''}`}>
                <img src={target.image} alt={target.name} className="w-full h-full object-cover" />
              </div>
              <span className="font-headline-sm text-headline-sm text-on-surface font-semibold text-center">
                {target.name}
              </span>
              <span className="font-body-sm text-body-sm text-on-surface-variant text-center text-xs">
                Protected target revealed after the round
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RoundRevealPanel;


