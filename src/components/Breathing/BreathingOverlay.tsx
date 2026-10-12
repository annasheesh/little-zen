import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';

interface BreathingOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  reducedMotion?: boolean;
}

export const BreathingOverlay: React.FC<BreathingOverlayProps> = ({
  isOpen,
  onClose,
  reducedMotion = false
}) => {
  const [phase, setPhase] = useState<'inhale' | 'exhale'>('inhale');
  const [durationMin, setDurationMin] = useState<number | 'endless'>(5);
  const [timeLeftSec, setTimeLeftSec] = useState<number>(300);

  // 4s inhale, 6s exhale cycle = 10s total
  useEffect(() => {
    if (!isOpen) return;

    let isSubscribed = true;
    const runCycle = () => {
      if (!isSubscribed) return;
      setPhase('inhale');
      setTimeout(() => {
        if (!isSubscribed) return;
        setPhase('exhale');
      }, 4000);
    };

    runCycle();
    const cycleInterval = setInterval(runCycle, 10000);

    return () => {
      isSubscribed = false;
      clearInterval(cycleInterval);
    };
  }, [isOpen]);

  // Session countdown timer
  useEffect(() => {
    if (!isOpen || durationMin === 'endless') return;

    setTimeLeftSec(durationMin * 60);
    const timer = setInterval(() => {
      setTimeLeftSec((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onClose();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, durationMin, onClose]);

  if (!isOpen) return null;

  const minutes = Math.floor(timeLeftSec / 60);
  const seconds = timeLeftSec % 60;
  const timerDisplay = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

  return (
    <div className="fixed inset-0 z-40 flex flex-col items-center justify-between p-8 bg-[rgba(243,237,226,0.85)] backdrop-blur-md transition-opacity duration-700 select-none">
      {/* Top Header */}
      <div className="w-full max-w-lg flex items-center justify-between">
        <div className="text-xs tracking-widest uppercase font-medium text-[#777269]">
          Just Breathe
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-full hover:bg-black/5 text-[#777269] hover:text-[#34332F] transition-colors cursor-pointer"
          title="Exit breathing mode"
        >
          <X size={20} />
        </button>
      </div>

      {/* Center Breathing Visual */}
      <div className="relative flex flex-col items-center justify-center my-auto">
        <div className="relative w-64 h-64 flex items-center justify-center">
          {/* Subtle outer ripples */}
          <div
            className={`absolute inset-0 rounded-full border border-[#C8B89D]/40 transition-transform ${
              reducedMotion ? '' : 'duration-[4000ms] ease-in-out'
            }`}
            style={{
              transform: phase === 'inhale' ? 'scale(1.3)' : 'scale(0.85)',
              opacity: phase === 'inhale' ? 0.6 : 0.25
            }}
          />

          {/* Core breathing circle */}
          <div
            className={`rounded-full bg-[#E8DCC7] border border-[#C8B89D] shadow-inner flex items-center justify-center transition-all ${
              reducedMotion
                ? 'w-40 h-40'
                : phase === 'inhale'
                ? 'w-52 h-52 duration-[4000ms] ease-out shadow-lg'
                : 'w-32 h-32 duration-[6000ms] ease-in-out'
            }`}
          >
            <div className="text-center">
              <span
                className="font-serif italic text-2xl text-[#34332F] transition-opacity duration-1000"
                style={{ opacity: phase === 'inhale' ? 0.9 : 0.65 }}
              >
                {phase === 'inhale' ? 'breathe in' : 'breathe out'}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-8 text-xs text-[#777269] tracking-wider font-light">
          {phase === 'inhale' ? '4 seconds in' : '6 seconds out'}
        </div>
      </div>

      {/* Bottom Duration Selectors */}
      <div className="flex flex-col items-center gap-3">
        {durationMin !== 'endless' && (
          <div className="text-sm font-medium text-[#777269]">{timerDisplay}</div>
        )}
        <div className="flex items-center gap-2 bg-white/50 p-1 rounded-xl border border-[rgba(200,184,157,0.3)] text-xs">
          {[2, 5, 10].map((mins) => (
            <button
              key={mins}
              onClick={() => setDurationMin(mins)}
              className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                durationMin === mins
                  ? 'bg-[#34332F] text-[#F8F3E9]'
                  : 'text-[#777269] hover:text-[#34332F]'
              }`}
            >
              {mins} min
            </button>
          ))}
          <button
            onClick={() => setDurationMin('endless')}
            className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
              durationMin === 'endless'
                ? 'bg-[#34332F] text-[#F8F3E9]'
                : 'text-[#777269] hover:text-[#34332F]'
            }`}
          >
            Infinite
          </button>
        </div>
      </div>
    </div>
  );
};
