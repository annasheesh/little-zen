import React, { useEffect, useRef } from 'react';
import { Video, X } from 'lucide-react';
import { HandTracker } from '../../engine/mediapipe/HandTracker';
import { AirRakeSettings, TrackingStatus } from '../../types/garden';

interface AirRakePreviewProps {
  tracker: HandTracker;
  settings: AirRakeSettings;
  status: TrackingStatus;
  handPresent: boolean;
  onClose: () => void;
}

export const AirRakePreview: React.FC<AirRakePreviewProps> = ({
  tracker,
  settings,
  status,
  handPresent,
  onClose
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (videoRef.current) {
      tracker.attachVideoElement(videoRef.current);
    }
  }, [tracker]);

  return (
    <div className="fixed top-14 right-5 z-30 w-48 rounded-xl overflow-hidden zen-glass shadow-lg border border-[rgba(200,184,157,0.4)] p-1.5 transition-all">
      <div className="flex items-center justify-between px-1.5 py-1 text-xs text-[#777269]">
        <div className="flex items-center gap-1.5 font-medium">
          <Video size={12} />
          <span>Air Rake</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className={`w-2 h-2 rounded-full ${
              handPresent
                ? 'bg-[#77806A]'
                : status === 'tracking'
                ? 'bg-amber-500'
                : 'bg-stone-400'
            }`}
            title={handPresent ? 'Hand detected' : status}
          />
          <button
            onClick={onClose}
            className="p-0.5 hover:text-[#34332F] rounded cursor-pointer"
            title="Hide camera preview"
          >
            <X size={12} />
          </button>
        </div>
      </div>

      <div className="relative aspect-4/3 w-full rounded-lg overflow-hidden bg-[#34332F]">
        <video
          ref={videoRef}
          playsInline
          muted
          className={`w-full h-full object-cover ${settings.mirrored ? 'scale-x-[-1]' : ''}`}
        />
        {!handPresent && status === 'tracking' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/35 text-white/80 text-[11px] text-center px-2">
            Raise hand in camera view
          </div>
        )}
      </div>

      <div className="text-[10px] text-center text-[#777269] mt-1">
        {settings.mirrored ? 'Mirrored preview' : 'Standard view'}
      </div>
    </div>
  );
};
