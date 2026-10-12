import React from 'react';
import {
  Brush,
  CircleDot,
  Minus,
  Waves,
  Disc3,
  Circle,
  Eraser,
  Undo2,
  Redo2,
  Camera,
  Settings
} from 'lucide-react';
import { ToolType } from '../../types/garden';

interface MainToolbarProps {
  currentTool: ToolType;
  onSelectTool: (tool: ToolType) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  airRakeEnabled: boolean;
  onToggleAirRake: () => void;
  onOpenSettings: () => void;
}

export const MainToolbar: React.FC<MainToolbarProps> = ({
  currentTool,
  onSelectTool,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  airRakeEnabled,
  onToggleAirRake,
  onOpenSettings
}) => {
  const tools: { id: ToolType; label: string; icon: React.FC<{ size: number }> }[] = [
    { id: 'rake', label: 'Free Rake (R)', icon: Brush },
    { id: 'circle', label: 'Circles (C)', icon: CircleDot },
    { id: 'line', label: 'Straight Lines (L)', icon: Minus },
    { id: 'wave', label: 'Waves (W)', icon: Waves },
    { id: 'spiral', label: 'Spiral (P)', icon: Disc3 },
    { id: 'stone', label: 'Stones (S)', icon: Circle },
    { id: 'smooth', label: 'Smooth / Erase (E)', icon: Eraser }
  ];

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30 pointer-events-auto">
      <div className="zen-glass rounded-2xl p-1.5 flex items-center gap-1 shadow-xl border border-[rgba(200,184,157,0.4)]">
        {/* Garden Tools */}
        {tools.map((t) => {
          const Icon = t.icon;
          const isActive = currentTool === t.id;
          return (
            <button
              key={t.id}
              onClick={() => onSelectTool(t.id)}
              className={`p-2.5 rounded-xl transition-all cursor-pointer relative group ${
                isActive
                  ? 'bg-[#34332F] text-[#F8F3E9] shadow-sm'
                  : 'text-[#777269] hover:text-[#34332F] hover:bg-black/5'
              }`}
              title={t.label}
            >
              <Icon size={18} />
              {/* Tooltip */}
              <span className="absolute bottom-12 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-[#34332F] text-[#F8F3E9] text-[10px] px-2 py-0.5 rounded shadow-md pointer-events-none whitespace-nowrap">
                {t.label}
              </span>
            </button>
          );
        })}

        {/* Separator */}
        <div className="w-[1px] h-6 bg-[#C8B89D]/40 mx-1" />

        {/* Undo / Redo */}
        <button
          onClick={onUndo}
          disabled={!canUndo}
          className={`p-2.5 rounded-xl transition-all ${
            canUndo
              ? 'text-[#777269] hover:text-[#34332F] hover:bg-black/5 cursor-pointer'
              : 'text-stone-300 cursor-not-allowed'
          }`}
          title="Undo (Ctrl+Z)"
        >
          <Undo2 size={18} />
        </button>

        <button
          onClick={onRedo}
          disabled={!canRedo}
          className={`p-2.5 rounded-xl transition-all ${
            canRedo
              ? 'text-[#777269] hover:text-[#34332F] hover:bg-black/5 cursor-pointer'
              : 'text-stone-300 cursor-not-allowed'
          }`}
          title="Redo (Ctrl+Shift+Z)"
        >
          <Redo2 size={18} />
        </button>

        {/* Separator */}
        <div className="w-[1px] h-6 bg-[#C8B89D]/40 mx-1" />

        {/* Air Rake Modal Trigger */}
        <button
          onClick={onToggleAirRake}
          className={`p-2.5 rounded-xl transition-all cursor-pointer relative group ${
            airRakeEnabled
              ? 'bg-[#77806A] text-white shadow-sm'
              : 'text-[#777269] hover:text-[#34332F] hover:bg-black/5'
          }`}
          title="Air Rake (Webcam Gestures)"
        >
          <Camera size={18} />
          <span className="absolute bottom-12 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-[#34332F] text-[#F8F3E9] text-[10px] px-2 py-0.5 rounded shadow-md pointer-events-none whitespace-nowrap">
            Air Rake {airRakeEnabled ? '(Active)' : ''}
          </span>
        </button>

        {/* Settings Trigger */}
        <button
          onClick={onOpenSettings}
          className="p-2.5 rounded-xl text-[#777269] hover:text-[#34332F] hover:bg-black/5 transition-all cursor-pointer relative group"
          title="Settings & Presets"
        >
          <Settings size={18} />
          <span className="absolute bottom-12 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-[#34332F] text-[#F8F3E9] text-[10px] px-2 py-0.5 rounded shadow-md pointer-events-none whitespace-nowrap">
            Settings & Presets
          </span>
        </button>
      </div>
    </div>
  );
};
