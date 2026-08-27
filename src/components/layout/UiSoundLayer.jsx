import React, { useEffect, useState } from 'react';
import { isUiSoundEnabled, playUiClickSound, setUiSoundEnabled } from '../../utils/uiSound';

function UiSoundLayer() {
  const [enabled, setEnabled] = useState(() => isUiSoundEnabled());

  useEffect(() => {
    const handleClick = (event) => {
      const target = event.target instanceof Element ? event.target.closest('button, a, [role="button"]') : null;
      if (!target || target.disabled || target.getAttribute('aria-disabled') === 'true') return;
      if (target.closest('[data-ui-sound-control]') || target.dataset.uiSound === 'off') return;
      playUiClickSound(target.dataset.uiSound || 'click');
    };

    document.addEventListener('click', handleClick, true);
    return () => document.removeEventListener('click', handleClick, true);
  }, []);

  const toggleSound = () => {
    const nextEnabled = !enabled;
    setEnabled(setUiSoundEnabled(nextEnabled));
    if (nextEnabled) playUiClickSound('confirm');
  };

  return (
    <button
      type="button"
      data-ui-sound-control
      data-ui-sound="off"
      aria-label={enabled ? 'Turn interface sounds off' : 'Turn interface sounds on'}
      aria-pressed={enabled}
      title={enabled ? 'Interface sounds on' : 'Interface sounds off'}
      onClick={toggleSound}
      className={`ng-ui-sound-toggle touch-feedback fixed right-3 top-[4.5rem] z-40 inline-flex min-h-10 min-w-10 items-center justify-center rounded-full border px-2.5 transition-[background-color,border-color,color,transform] duration-150 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-fixed/80 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-dim active:scale-95 ${enabled ? 'border-primary-fixed/35 bg-primary-fixed/10 text-primary-fixed hover:border-primary-fixed/60 hover:bg-primary-fixed/15' : 'border-white/15 bg-white/[0.04] text-on-surface-variant hover:border-white/30 hover:text-white'}`}
    >
      <span className="material-symbols-outlined text-[20px]" aria-hidden="true">{enabled ? 'volume_up' : 'volume_off'}</span>
      <span className="sr-only">{enabled ? 'Sound on' : 'Sound off'}</span>
    </button>
  );
}

export default UiSoundLayer;
