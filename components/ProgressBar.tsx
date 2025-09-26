import React from 'react';

interface ProgressBarProps {
  progress: number;
  message: string;
  etr?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ progress, message, etr }) => {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-black/20 rounded-lg p-8 text-center">
      <div className="w-full max-w-md">
        <p className="text-xl text-fuchsia-200 mb-4 h-6 animate-pulse">{message}</p>
        <div className="w-full bg-fuchsia-900/50 rounded-full h-4 overflow-hidden">
          <div
            className="bg-fuchsia-500 h-4 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
        <div className="flex justify-between items-center mt-3">
            <p className="text-sm text-gray-400">
                {etr && `Tempo restante: ~${etr}`}
            </p>
            <p className="text-2xl font-bold text-fuchsia-300">{Math.round(progress)}%</p>
        </div>
      </div>
    </div>
  );
};