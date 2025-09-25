import React from 'react';
import { Icon } from './Icon';

interface FunctionCardProps {
  icon: string;
  name: string;
  sublabel?: string;
  isActive: boolean;
  onClick: () => void;
}

export const FunctionCard: React.FC<FunctionCardProps> = ({ icon, name, sublabel, isActive, onClick }) => {
  const baseClasses = "flex flex-col items-center justify-center p-2 border rounded-lg cursor-pointer transition-all duration-200 aspect-square transform active:scale-95";
  // Added animate-subtle-pulse and removed static shadow/ring for a more dynamic effect
  const activeClasses = "bg-gray-800/60 border-purple-500/80 text-purple-400 animate-subtle-pulse";
  const inactiveClasses = "bg-gray-900/60 border-gray-700/50 text-gray-300 hover:bg-gray-800/60 hover:border-gray-600 hover:text-gray-100 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-purple-500/10";
  
  return (
    <div
      className={`${baseClasses} ${isActive ? activeClasses : inactiveClasses}`}
      onClick={onClick}
    >
      <div className="mb-1">
        <Icon name={icon} className="w-5 h-5"/>
      </div>
      <div className="text-xs text-center font-semibold">{name}</div>
      {sublabel && (
        <div className="text-[10px] text-center text-yellow-400 font-semibold leading-tight">{sublabel}</div>
      )}
    </div>
  );
};