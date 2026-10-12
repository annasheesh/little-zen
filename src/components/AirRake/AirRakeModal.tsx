import React, { useEffect, useState } from 'react';
import { Camera, Check, ShieldCheck, Video, X } from 'lucide-react';
import { AirRakeSettings, TrackingStatus } from '../../types/garden';

interface AirRakeModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AirRakeSettings;
  onUpdateSettings: (newSettings: Partial<AirRakeSettings>) => void;
  status: TrackingStatus;
  errorMessage?: string;
  onToggleAirRake: (enable: boolean) => void;
  currentPinchDistance?: number;
  isCurrentlyPinching?: boolean;
}

export const AirRakeModal: React.FC<AirRakeModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  status,
  errorMessage,
  onToggleAirRake,
  currentPinchDistance = 1.0,
  isCurrentlyPinching = false
}) => {
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);

  useEffect(() => {
    if (isOpen && navigator.mediaDevices?.enumerateDevices) {
      navigator.mediaDevices.enumerateDevices().then((devices) => {
        const videoInputs = devices.filter((d) => d.kind === 'videoinput');
        setVideoDevices(videoInputs);
      }).catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
      <div className="relative w-full max-w-md zen-glass rounded-2xl p-6 shadow-2xl border border-[rgba(200,184,157,0.5)]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[rgba(200,184,157,0.3)]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#34332F] text-[#F3EDE2] flex items-center justify-center">
              <Camera size={18} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[#34332F] leading-tight">Air Rake</h2>
              <p className="text-xs text-[#777269]">Webcam hand gesture control</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#777269] hover:text-[#34332F] hover:bg-black/5 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Master Toggle */}
        <div className="my-5 p-4 rounded-xl bg-white/50 border border-[rgba(200,184,157,0.3)] flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-[#34332F]">Air Rake Tracking</div>
            <div className="text-xs text-[#777269]">
              {settings.enabled ? (
                <span className="text-[#77806A] font-medium flex items-center gap-1 mt-0.5">
                  <span className="w-2 h-2 rounded-full bg-[#77806A] inline-block animate-pulse" />
                  Active: {status}
                </span>
              ) : (
                'Disabled — use mouse or touch'
              )}
            </div>
          </div>
          <button
            onClick={() => onToggleAirRake(!settings.enabled)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
              settings.enabled
                ? 'bg-rose-800 text-white hover:bg-rose-900'
                : 'bg-[#34332F] text-[#F8F3E9] hover:bg-[#201F1D]'
            }`}
          >
            {settings.enabled ? 'Turn Off' : 'Enable Air Rake'}
          </button>
        </div>

        {/* Error notice if camera failed */}
        {errorMessage && (
          <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800">
            {errorMessage}
          </div>
        )}

        {/* Instruction Banner */}
        {settings.showInstruction && (
          <div className="mb-4 p-3.5 rounded-xl bg-[#E8DCC7]/50 border border-[#C8B89D]/60 flex items-start justify-between gap-3">
            <div className="text-xs text-[#34332F]">
              <div className="font-semibold mb-1">How to use Air Rake:</div>
              <ul className="list-disc list-inside space-y-0.5 text-[#55524B]">
                <li><strong>Point</strong> index finger to move virtual cursor.</li>
                <li><strong>Pinch</strong> thumb and index finger to rake sand.</li>
                <li><strong>Release</strong> pinch to pause raking.</li>
              </ul>
            </div>
            <button
              onClick={() => onUpdateSettings({ showInstruction: false })}
              className="text-[11px] text-[#777269] hover:text-[#34332F] underline shrink-0 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Live Calibration & Pinch Meter */}
        {settings.enabled && (
          <div className="mb-4 p-3 rounded-xl bg-white/40 border border-[rgba(200,184,157,0.3)]">
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-[#777269]">Pinch Distance Meter:</span>
              <span className={`font-semibold ${isCurrentlyPinching ? 'text-[#77806A]' : 'text-[#777269]'}`}>
                {isCurrentlyPinching ? 'PINCHING (Raking)' : 'HOVERING'}
              </span>
            </div>
            <div className="w-full h-2.5 bg-black/10 rounded-full overflow-hidden relative">
              {/* Activation line indicator */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-red-400 z-10"
                style={{ left: `${Math.min(100, (settings.pinchThreshold / 0.6) * 100)}%` }}
                title="Pinch trigger threshold"
              />
              {/* Live distance bar */}
              <div
                className={`h-full transition-all duration-75 rounded-full ${
                  isCurrentlyPinching ? 'bg-[#77806A]' : 'bg-[#C8B89D]'
                }`}
                style={{ width: `${Math.min(100, Math.max(5, (currentPinchDistance / 0.6) * 100))}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-[#777269] mt-1">
              <span>Close (Pinch)</span>
              <span>Open Hand</span>
            </div>
          </div>
        )}

        {/* Detailed Controls */}
        <div className="space-y-3.5 text-xs">
          {/* Camera Selector */}
          {videoDevices.length > 1 && (
            <div className="flex items-center justify-between">
              <span className="text-[#777269]">Camera Source</span>
              <select
                value={settings.cameraId}
                onChange={(e) => onUpdateSettings({ cameraId: e.target.value })}
                className="bg-white/70 border border-[#C8B89D] rounded-md px-2 py-1 text-xs text-[#34332F] outline-none"
              >
                <option value="">Default Camera</option>
                {videoDevices.map((dev) => (
                  <option key={dev.deviceId} value={dev.deviceId}>
                    {dev.label || `Camera ${dev.deviceId.slice(0, 4)}`}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Toggle camera preview */}
          <div className="flex items-center justify-between">
            <span className="text-[#34332F]">Show Camera Preview Window</span>
            <input
              type="checkbox"
              checked={settings.previewVisible}
              onChange={(e) => onUpdateSettings({ previewVisible: e.target.checked })}
              className="accent-[#34332F] w-4 h-4 cursor-pointer"
            />
          </div>

          {/* Mirrored control */}
          <div className="flex items-center justify-between">
            <span className="text-[#34332F]">Mirror Camera Input</span>
            <input
              type="checkbox"
              checked={settings.mirrored}
              onChange={(e) => onUpdateSettings({ mirrored: e.target.checked })}
              className="accent-[#34332F] w-4 h-4 cursor-pointer"
            />
          </div>

          {/* Cursor Sensitivity Slider */}
          <div className="space-y-1">
            <div className="flex justify-between text-[#777269]">
              <span>Cursor Sensitivity</span>
              <span>{settings.cursorSensitivity.toFixed(2)}x</span>
            </div>
            <input
              type="range"
              min="0.8"
              max="2.0"
              step="0.05"
              value={settings.cursorSensitivity}
              onChange={(e) => onUpdateSettings({ cursorSensitivity: parseFloat(e.target.value) })}
              className="w-full"
            />
          </div>

          {/* Smoothing Slider */}
          <div className="space-y-1">
            <div className="flex justify-between text-[#777269]">
              <span>Tracking Smoothing</span>
              <span>{(settings.cursorSmoothing * 100).toFixed(0)}%</span>
            </div>
            <input
              type="range"
              min="0.2"
              max="0.9"
              step="0.05"
              value={settings.cursorSmoothing}
              onChange={(e) => onUpdateSettings({ cursorSmoothing: parseFloat(e.target.value) })}
              className="w-full"
            />
          </div>

          {/* Pinch Sensitivity Slider */}
          <div className="space-y-1">
            <div className="flex justify-between text-[#777269]">
              <span>Pinch Activation Threshold</span>
              <span>{settings.pinchThreshold.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0.14"
              max="0.35"
              step="0.02"
              value={settings.pinchThreshold}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                onUpdateSettings({
                  pinchThreshold: val,
                  pinchReleaseThreshold: val * 1.5
                });
              }}
              className="w-full"
            />
          </div>
        </div>

        {/* Privacy Assurance */}
        <div className="mt-5 pt-3 border-t border-[rgba(200,184,157,0.3)] flex items-center gap-2 text-[11px] text-[#777269]">
          <ShieldCheck size={14} className="text-[#77806A] shrink-0" />
          <span>Local on-device inference. No video or images are stored or uploaded.</span>
        </div>
      </div>
    </div>
  );
};
