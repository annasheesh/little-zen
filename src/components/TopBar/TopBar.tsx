import React, { useState } from 'react';
import {
  Camera,
  Maximize,
  Minimize,
  Volume2,
  VolumeX,
  Wind,
  Sparkles
} from 'lucide-react';
import { ToolType, SoundscapeType, TrackingStatus } from '../../types/garden';
import { ZenAudioEngine } from '../../engine/audio/ZenAudioEngine';

interface TopBarProps {
  currentTool: ToolType;
  airRakeEnabled: boolean;
  airRakeStatus: TrackingStatus;
  handPresent: boolean;
  onOpenAirRake: () => void;
  onOpenBreathing: () => void;
  soundscape: SoundscapeType;
  soundVolume: number;
  onSoundscapeChange: (type: SoundscapeType) => void;
  onVolumeChange: (vol: number) => void;
  audioEngine: ZenAudioEngine;
}

export const TopBar: React.FC<TopBarProps> = ({
  currentTool,
  airRakeEnabled,
  airRakeStatus,
  handPresent,
  onOpenAirRake,
  onOpenBreathing,
  soundscape,
  soundVolume,
  onSoundscapeChange,
  onVolumeChange,
  audioEngine
}) => {
  const [showAudioPopover, setShowAudioPopover] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  const getToolHint = () => {
    if (airRakeEnabled && handPresent) {
      return 'Air Rake: pinch to rake, release to pause';
    }
    switch (currentTool) {
      case 'rake':
        return 'Free Rake: drag to comb fine sand';
      case 'circle':
        return 'Concentric Rings: drag to define ripple radius';
      case 'line':
        return 'Straight Lines: drag to draw parallel grooves';
      case 'wave':
        return 'Harmonic Waves: drag to carve rhythmic waves';
      case 'spiral':
        return 'Spiral: drag from center outward';
      case 'stone':
        return 'Stones: click to select, drag to arrange';
      case 'smooth':
        return 'Smooth Sand: drag to restore flat sand';
      default:
        return '';
    }
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-30 flex items-center justify-between px-6 py-4 pointer-events-none">
      {/* Brand & Understated Status */}
      <div className="flex items-center gap-4 pointer-events-auto">
        <h1 className="text-sm font-semibold tracking-wider text-[#34332F] font-sans lowercase">
          little zen
        </h1>
        <span className="hidden sm:inline-block text-xs text-[#777269] tracking-wide font-light border-l border-[#C8B89D]/50 pl-3">
          {getToolHint()}
        </span>
      </div>

      {/* Action Pointers */}
      <div className="flex items-center gap-2 pointer-events-auto">
        {/* Breathing Mode Button */}
        <button
          onClick={onOpenBreathing}
          className="zen-btn px-2.5 py-1.5 text-xs text-[#34332F] zen-glass hover:bg-[#E8DCC7] gap-1.5 rounded-lg transition-all"
          title="Open 'Just breathe' relaxation mode"
        >
          <Wind size={13} className="text-[#77806A]" />
          <span className="hidden md:inline">breathe</span>
        </button>

        {/* Soundscape Control Button & Popover */}
        <div className="relative">
          <button
            onClick={() => setShowAudioPopover(!showAudioPopover)}
            className={`zen-btn p-2 text-xs zen-glass rounded-lg transition-all ${
              soundscape !== 'none' ? 'text-[#34332F]' : 'text-[#777269]'
            }`}
            title="Ambient soundscapes"
          >
            {soundscape !== 'none' ? <Volume2 size={14} /> : <VolumeX size={14} />}
          </button>

          {showAudioPopover && (
            <div className="absolute right-0 top-10 z-50 w-52 zen-glass rounded-xl p-3 shadow-xl border border-[rgba(200,184,157,0.4)] text-xs space-y-3">
              <div className="font-medium text-[#34332F] flex justify-between items-center">
                <span>Ambient Sound</span>
                <span className="text-[10px] uppercase tracking-wider text-[#777269]">{soundscape}</span>
              </div>

              {/* Soundscape Options */}
              <div className="grid grid-cols-2 gap-1.5">
                {(['none', 'rain', 'wind', 'birds', 'water'] as SoundscapeType[]).map((type) => (
                  <button
                    key={type}
                    onClick={() => {
                      onSoundscapeChange(type);
                      audioEngine.setSoundscape(type);
                    }}
                    className={`px-2 py-1 rounded text-left capitalize transition-colors cursor-pointer ${
                      soundscape === type
                        ? 'bg-[#34332F] text-[#F8F3E9] font-medium'
                        : 'text-[#777269] hover:bg-black/5'
                    }`}
                  >
                    {type === 'none' ? 'Mute' : type}
                  </button>
                ))}
              </div>

              {/* Volume Slider */}
              {soundscape !== 'none' && (
                <div className="pt-2 border-t border-[rgba(200,184,157,0.3)] space-y-1">
                  <div className="flex justify-between text-[11px] text-[#777269]">
                    <span>Volume</span>
                    <span>{Math.round(soundVolume * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={soundVolume}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      onVolumeChange(val);
                      audioEngine.setVolume(val);
                    }}
                    className="w-full"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Air Rake Status Pill */}
        <button
          onClick={onOpenAirRake}
          className={`zen-btn px-2.5 py-1.5 text-xs zen-glass rounded-lg gap-1.5 transition-all ${
            airRakeEnabled ? 'border-[#77806A]/50 bg-[#E8DCC7]/40' : ''
          }`}
          title="Air Rake camera gesture settings"
        >
          <Camera size={13} className={airRakeEnabled ? 'text-[#77806A]' : 'text-[#777269]'} />
          <span className="hidden sm:inline text-xs font-medium text-[#34332F]">air rake</span>
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              !airRakeEnabled
                ? 'bg-stone-300'
                : handPresent
                ? 'bg-[#77806A] animate-pulse'
                : airRakeStatus === 'tracking'
                ? 'bg-amber-400'
                : 'bg-rose-500'
            }`}
          />
        </button>

        {/* Fullscreen Button */}
        <button
          onClick={toggleFullscreen}
          className="zen-btn p-2 text-xs zen-glass rounded-lg text-[#777269] hover:text-[#34332F]"
          title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen (F)'}
        >
          {isFullscreen ? <Minimize size={14} /> : <Maximize size={14} />}
        </button>
      </div>
    </div>
  );
};
