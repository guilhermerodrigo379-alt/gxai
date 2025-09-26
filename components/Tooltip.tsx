import React, { useState } from 'react';

interface TooltipProps {
  children: React.ReactNode;
  title: string;
  description: string;
  example?: string;
  position?: 'right' | 'top' | 'bottom' | 'left';
}

export const Tooltip: React.FC<TooltipProps> = ({ children, title, description, example, position = 'right' }) => {
  const [isVisible, setIsVisible] = useState(false);

  const positionClasses = {
    right: 'left-full top-1/2 -translate-y-1/2 ml-3',
    left: 'right-full top-1/2 -translate-y-1/2 mr-3',
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
  };

  const arrowClasses = {
    right: 'top-1/2 -left-1 -translate-y-1/2 rotate-45',
    left: 'top-1/2 -right-1 -translate-y-1/2 -rotate-[135deg]',
    top: 'left-1/2 -bottom-1 -translate-x-1/2 rotate-[135deg]',
    bottom: 'left-1/2 -top-1 -translate-x-1/2 -rotate-45',
  };

  return (
    <div 
      className="relative"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      onFocus={() => setIsVisible(true)}
      onBlur={() => setIsVisible(false)}
    >
      {children}
      {isVisible && (
        <div 
          role="tooltip"
          className={`absolute w-64 z-[60] p-3 bg-gray-800 border border-gray-700/80 rounded-lg shadow-xl animate-fade-in ${positionClasses[position]}`}
        >
          <h4 className="font-bold text-sm text-fuchsia-300 mb-1">{title}</h4>
          <p className="text-xs text-gray-300 leading-snug">{description}</p>
          {example && (
            <p className="text-xs text-gray-400 mt-2 pt-2 border-t border-gray-700/50">
              <span className="font-semibold text-gray-300">Ex:</span> {example}
            </p>
          )}
          <div className={`absolute w-2 h-2 bg-gray-800 border-b border-l border-gray-700/80 ${arrowClasses[position]}`} />
        </div>
      )}
    </div>
  );
};