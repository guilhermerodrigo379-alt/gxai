import React from 'react';

interface EffectSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit: string;
  onChange: (value: number) => void;
  onCommit?: () => void;
}

export const EffectSlider: React.FC<EffectSliderProps> = ({ label, value, min, max, step = 1, unit, onChange, onCommit }) => {
  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <label className="text-sm font-medium text-gray-300">
          {label}
        </label>
        <span className="bg-gray-800/80 text-fuchsia-300 text-xs font-mono py-0.5 px-1.5 rounded">{value}{unit}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        onMouseUp={onCommit}
        onTouchEnd={onCommit}
        className="w-full"
      />
    </div>
  );
};