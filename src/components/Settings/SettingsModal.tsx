import React, { useState } from 'react';
import {
  X,
  Download,
  RotateCcw,
  Volume2,
  Sparkles,
  Keyboard,
  Palette,
  LayoutGrid
} from 'lucide-react';
import {
  GardenSettings,
  SandPaletteId,
  SoundscapeType
} from '../../types/garden';
import { SAND_PALETTES } from '../../engine/render/palettes';
import { GARDEN_PRESETS, GardenPreset } from '../../engine/persistence/presets';
import { ZenAudioEngine } from '../../engine/audio/ZenAudioEngine';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: GardenSettings;
  onUpdateSettings: (newSettings: Partial<GardenSettings>) => void;
  onSelectPreset: (preset: GardenPreset) => void;
  onExportPNG: () => void;
  onResetGarden: () => void;
  audioEngine: ZenAudioEngine;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  onSelectPreset,
  onExportPNG,
  onResetGarden,
  audioEngine
}) => {
  const [activeTab, setActiveTab] = useState<'garden' | 'presets' | 'shortcuts'>('garden');
  const [confirmReset, setConfirmReset] = useState(false);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
      <div className="relative w-full max-w-lg zen-glass rounded-2xl p-6 shadow-2xl border border-[rgba(200,184,157,0.5)] max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[rgba(200,184,157,0.3)]">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-[#34332F]">Garden Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#777269] hover:text-[#34332F] hover:bg-black/5 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab navigation */}
        <div className="flex items-center gap-2 my-4 border-b border-[rgba(200,184,157,0.3)] pb-2 text-xs">
          <button
            onClick={() => setActiveTab('garden')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'garden'
                ? 'bg-[#34332F] text-[#F8F3E9]'
                : 'text-[#777269] hover:bg-black/5'
            }`}
          >
            <Palette size={13} />
            <span>Appearance & Sound</span>
          </button>
          <button
            onClick={() => setActiveTab('presets')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'presets'
                ? 'bg-[#34332F] text-[#F8F3E9]'
                : 'text-[#777269] hover:bg-black/5'
            }`}
          >
            <LayoutGrid size={13} />
            <span>Presets</span>
          </button>
          <button
            onClick={() => setActiveTab('shortcuts')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'shortcuts'
                ? 'bg-[#34332F] text-[#F8F3E9]'
                : 'text-[#777269] hover:bg-black/5'
            }`}
          >
            <Keyboard size={13} />
            <span>Shortcuts</span>
          </button>
        </div>

        {/* Tab 1: Appearance & Sound */}
        {activeTab === 'garden' && (
          <div className="space-y-5 text-xs">
            {/* Sand Color Palette */}
            <div>
              <label className="block text-xs font-medium text-[#34332F] mb-2">
                Sand Palette
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {Object.values(SAND_PALETTES).map((pal) => (
                  <button
                    key={pal.id}
                    onClick={() => onUpdateSettings({ paletteId: pal.id })}
                    className={`p-2 rounded-xl text-left border transition-all cursor-pointer flex items-center gap-2.5 ${
                      settings.paletteId === pal.id
                        ? 'border-[#34332F] bg-white shadow-xs'
                        : 'border-[rgba(200,184,157,0.4)] bg-white/40 hover:bg-white/70'
                    }`}
                  >
                    <span
                      className="w-5 h-5 rounded-full border border-black/10 shrink-0 shadow-inner"
                      style={{ backgroundColor: pal.baseColor }}
                    />
                    <span className="font-medium text-[#34332F] truncate">{pal.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Ambient Sound Settings */}
            <div className="p-3.5 rounded-xl bg-white/50 border border-[rgba(200,184,157,0.3)] space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-medium text-[#34332F] flex items-center gap-1.5">
                  <Volume2 size={14} className="text-[#77806A]" />
                  Ambient Soundscape
                </span>
                <select
                  value={settings.soundscape}
                  onChange={(e) => {
                    const type = e.target.value as SoundscapeType;
                    onUpdateSettings({ soundscape: type });
                    audioEngine.setSoundscape(type);
                  }}
                  className="bg-white border border-[#C8B89D] rounded-md px-2 py-1 text-xs text-[#34332F] outline-none"
                >
                  <option value="none">Muted</option>
                  <option value="rain">Gentle Rain</option>
                  <option value="wind">Soft Wind</option>
                  <option value="birds">Distant Birds</option>
                  <option value="water">Quiet Water</option>
                </select>
              </div>

              {settings.soundscape !== 'none' && (
                <div className="space-y-1">
                  <div className="flex justify-between text-[#777269]">
                    <span>Volume</span>
                    <span>{Math.round(settings.soundVolume * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={settings.soundVolume}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      onUpdateSettings({ soundVolume: val });
                      audioEngine.setVolume(val);
                    }}
                    className="w-full"
                  />
                </div>
              )}

              <div className="flex items-center justify-between pt-1">
                <span className="text-[#34332F]">Sand Raking Friction Sound</span>
                <input
                  type="checkbox"
                  checked={settings.rakeSound}
                  onChange={(e) => onUpdateSettings({ rakeSound: e.target.checked })}
                  className="accent-[#34332F] w-4 h-4 cursor-pointer"
                />
              </div>
            </div>

            {/* Mindful Messages & Motion */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[#34332F]">Show Gentle Mindful Reflections</span>
                <input
                  type="checkbox"
                  checked={settings.messagesEnabled}
                  onChange={(e) => onUpdateSettings({ messagesEnabled: e.target.checked })}
                  className="accent-[#34332F] w-4 h-4 cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[#34332F]">Reduced Motion</span>
                <input
                  type="checkbox"
                  checked={settings.reducedMotion}
                  onChange={(e) => onUpdateSettings({ reducedMotion: e.target.checked })}
                  className="accent-[#34332F] w-4 h-4 cursor-pointer"
                />
              </div>
            </div>

            {/* Export & Reset Actions */}
            <div className="pt-3 border-t border-[rgba(200,184,157,0.3)] flex items-center justify-between">
              <button
                onClick={onExportPNG}
                className="px-3.5 py-2 rounded-xl bg-[#34332F] text-[#F8F3E9] hover:bg-[#201F1D] font-medium flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Download size={13} />
                <span>Export High-Res PNG</span>
              </button>

              {confirmReset ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-rose-700 font-medium">Reset garden?</span>
                  <button
                    onClick={() => {
                      onResetGarden();
                      setConfirmReset(false);
                      onClose();
                    }}
                    className="px-2 py-1 rounded bg-rose-800 text-white hover:bg-rose-900 cursor-pointer"
                  >
                    Yes, Reset
                  </button>
                  <button
                    onClick={() => setConfirmReset(false)}
                    className="px-2 py-1 rounded bg-black/5 hover:bg-black/10 cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmReset(true)}
                  className="px-3 py-2 rounded-xl text-rose-800 hover:bg-rose-50 flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw size={13} />
                  <span>Restore Clean Garden</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Presets */}
        {activeTab === 'presets' && (
          <div className="space-y-3">
            <p className="text-xs text-[#777269]">
              Select a Japanese garden arrangement to begin:
            </p>
            <div className="space-y-2">
              {GARDEN_PRESETS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    onSelectPreset(p);
                    onClose();
                  }}
                  className="w-full p-3 rounded-xl bg-white/50 hover:bg-white/90 border border-[rgba(200,184,157,0.35)] text-left transition-all cursor-pointer flex items-center justify-between group"
                >
                  <div>
                    <div className="font-semibold text-xs text-[#34332F] group-hover:text-black">
                      {p.name}
                    </div>
                    <div className="text-[11px] text-[#777269] mt-0.5">{p.description}</div>
                  </div>
                  <span className="text-[11px] font-medium text-[#77806A] opacity-0 group-hover:opacity-100 transition-opacity">
                    Load →
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Tab 3: Shortcuts */}
        {activeTab === 'shortcuts' && (
          <div className="space-y-2 text-xs">
            <div className="grid grid-cols-2 gap-2 text-[#34332F]">
              <div className="p-2 rounded bg-white/40 flex justify-between">
                <span>Free Rake</span> <kbd className="font-mono font-bold">R</kbd>
              </div>
              <div className="p-2 rounded bg-white/40 flex justify-between">
                <span>Circle Pattern</span> <kbd className="font-mono font-bold">C</kbd>
              </div>
              <div className="p-2 rounded bg-white/40 flex justify-between">
                <span>Straight Line</span> <kbd className="font-mono font-bold">L</kbd>
              </div>
              <div className="p-2 rounded bg-white/40 flex justify-between">
                <span>Wave Pattern</span> <kbd className="font-mono font-bold">W</kbd>
              </div>
              <div className="p-2 rounded bg-white/40 flex justify-between">
                <span>Spiral Pattern</span> <kbd className="font-mono font-bold">P</kbd>
              </div>
              <div className="p-2 rounded bg-white/40 flex justify-between">
                <span>Stones</span> <kbd className="font-mono font-bold">S</kbd>
              </div>
              <div className="p-2 rounded bg-white/40 flex justify-between">
                <span>Smooth Sand</span> <kbd className="font-mono font-bold">E</kbd>
              </div>
              <div className="p-2 rounded bg-white/40 flex justify-between">
                <span>Fullscreen</span> <kbd className="font-mono font-bold">F</kbd>
              </div>
              <div className="p-2 rounded bg-white/40 flex justify-between">
                <span>Undo</span> <kbd className="font-mono font-bold">Ctrl+Z</kbd>
              </div>
              <div className="p-2 rounded bg-white/40 flex justify-between">
                <span>Redo</span> <kbd className="font-mono font-bold">Ctrl+Shift+Z</kbd>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
