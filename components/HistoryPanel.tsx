import React from 'react';
import { HistoryItem } from '../types';
import { Icon } from './Icon';

interface HistoryPanelProps {
  history: HistoryItem[];
  onHistoryClick: (item: HistoryItem) => void;
  onClearHistory: () => void;
}

export const HistoryPanel: React.FC<HistoryPanelProps> = ({ history, onHistoryClick, onClearHistory }) => {
  if (history.length === 0) {
    return (
        <div className="p-4 bg-gray-900/50 rounded-lg text-center">
            <p className="text-sm text-gray-500">Seu histórico aparecerá aqui.</p>
        </div>
    );
  }

  return (
    <div className="space-y-3 p-4 bg-gray-900/50 rounded-lg">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-semibold text-gray-300">Histórico Recente</h3>
        <button 
          onClick={onClearHistory} 
          className="text-xs text-gray-400 hover:text-red-400 transition-colors flex items-center space-x-1"
          title="Limpar histórico"
        >
          <Icon name="close" className="w-3 h-3" />
          <span>Limpar</span>
        </button>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {history.map((item) => (
          <div
            key={item.id}
            className="aspect-square rounded-md overflow-hidden cursor-pointer group relative"
            onClick={() => onHistoryClick(item)}
            title={`Prompt: "${item.prompt}"`}
          >
            <img
              src={item.imageUrl}
              alt={`History item ${item.id}`}
              className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-110"
            />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
          </div>
        ))}
      </div>
    </div>
  );
};
