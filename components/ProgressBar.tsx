import React from 'react';

interface ProgressBarProps {
  progress: number;
  message: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ progress, message }) => {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-black/20 rounded-lg p-8 text-center">
      <div className="w-full max-w-md">
        <p className="text-xl text-purple-200 mb-4 h-6 animate-pulse">{message}</p>
        <div className="w-full bg-purple-900/50 rounded-full h-4">
          <div
            className="bg-purple-500 h-4 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
        <p className="text-2xl font-bold text-purple-300 mt-3">{Math.round(progress)}%</p>
      </div>
    </div>
  );
};