import React from 'react';

interface AirRakeCursorProps {
  cursorPos: { x: number; y: number } | null;
  isPinching: boolean;
  handPresent: boolean;
}

export const AirRakeCursor: React.FC<AirRakeCursorProps> = ({
  cursorPos,
  isPinching,
  handPresent
}) => {
  if (!handPresent || !cursorPos) return null;

  const left = `${cursorPos.x * 100}%`;
  const top = `${cursorPos.y * 100}%`;

  return (
    <div
      className="pointer-events-none fixed z-40 transition-transform duration-75 ease-out"
      style={{
        left,
        top,
        transform: 'translate(-50%, -50%)'
      }}
    >
      {/* Outer subtle halo ring */}
      <div
        className={`rounded-full transition-all duration-150 flex items-center justify-center ${
          isPinching
            ? 'w-6 h-6 border-2 border-[#34332F] bg-[rgba(52,51,47,0.35)] shadow-md scale-95'
            : 'w-8 h-8 border border-[rgba(52,51,47,0.45)] bg-[rgba(243,237,226,0.3)] shadow-sm'
        }`}
      >
        {/* Inner center contact dot */}
        <div
          className={`rounded-full transition-all duration-100 ${
            isPinching ? 'w-2 h-2 bg-[#34332F]' : 'w-1.5 h-1.5 bg-[#77806A]'
          }`}
        />
      </div>

      {/* Understated action label */}
      {isPinching && (
        <span className="absolute top-7 left-1/2 -translate-x-1/2 text-[10px] tracking-wider uppercase font-medium text-[#34332F] bg-[rgba(243,237,226,0.85)] px-1.5 py-0.5 rounded shadow-xs backdrop-blur-xs whitespace-nowrap">
          Raking
        </span>
      )}
    </div>
  );
};
