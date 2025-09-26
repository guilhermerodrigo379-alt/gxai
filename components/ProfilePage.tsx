import React from 'react';
import { useNavigate } from 'react-router-dom';
import { HistoryItem, User } from '../types';
import { Icon } from './Icon';

interface ProfilePageProps {
  currentUser: User;
  history: HistoryItem[];
  onHistoryClick: (item: HistoryItem) => void;
  onClearHistory: () => void;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({ currentUser, history, onHistoryClick, onClearHistory }) => {
  const navigate = useNavigate();
  const registrationYear = currentUser.registrationDate 
    ? new Date(currentUser.registrationDate).getFullYear() 
    : new Date().getFullYear();

  return (
    <div className="min-h-screen text-white bg-black/50 p-4 sm:p-6 md:p-8 animate-fade-in">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header className="flex items-center justify-between pb-6 border-b border-gray-700/50">
          <div className="flex items-center space-x-4">
             <div className="w-16 h-16 bg-gradient-to-br from-fuchsia-500 to-purple-600 rounded-full flex items-center justify-center">
                 <span className="text-3xl font-bold text-white">{currentUser.name.charAt(0).toUpperCase()}</span>
             </div>
             <div>
                <h1 className="text-3xl font-bold text-white">{currentUser.name}</h1>
                <p className="text-gray-400">Seu espaço criativo</p>
             </div>
          </div>
          <button 
            onClick={() => navigate('/')} 
            className="flex items-center space-x-2 bg-gray-800/80 hover:bg-gray-700/80 transition-colors text-left font-medium p-3 rounded-lg"
          >
             <Icon name="close" className="w-5 h-5" />
             <span>Voltar ao Studio</span>
          </button>
        </header>

        {/* Stats */}
        <section className="my-8 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gray-900/70 p-6 rounded-xl border border-gray-800/50">
                <h3 className="text-gray-400 text-sm font-medium">Total de Criações</h3>
                <p className="text-4xl font-bold text-fuchsia-400 mt-2">{history.length}</p>
            </div>
             <div className="bg-gray-900/70 p-6 rounded-xl border border-gray-800/50">
                <h3 className="text-gray-400 text-sm font-medium">Membro Desde</h3>
                <p className="text-4xl font-bold text-fuchsia-400 mt-2">{registrationYear}</p>
            </div>
             <div className="bg-gray-900/70 p-6 rounded-xl border border-gray-800/50 flex flex-col justify-center items-center">
                 <button 
                    onClick={onClearHistory}
                    className="w-full h-full text-center text-red-400 hover:text-red-300 hover:bg-red-900/30 transition-colors rounded-lg flex flex-col items-center justify-center"
                 >
                    <Icon name="x-circle" className="w-8 h-8 mb-1" />
                    <span className="font-semibold">Limpar Histórico</span>
                 </button>
            </div>
        </section>

        {/* History Gallery */}
        <section>
          <h2 className="text-2xl font-bold mb-4">Sua Galeria de Criações</h2>
          {history.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {history.map((item) => (
                <div
                  key={item.id}
                  className="aspect-square rounded-lg overflow-hidden cursor-pointer group relative shadow-lg"
                  onClick={() => onHistoryClick(item)}
                  title={`Prompt: "${item.prompt}"`}
                >
                  <img
                    src={item.imageUrl}
                    alt={`History item ${item.id}`}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-3">
                     <p className="text-xs text-white/90 line-clamp-2">{item.prompt}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16 bg-gray-900/70 rounded-xl border border-dashed border-gray-700">
                <Icon name="image" className="w-20 h-20 mx-auto text-gray-700" />
                <p className="mt-4 font-semibold text-gray-400">Você ainda não criou nada.</p>
                <p className="text-sm text-gray-500">Volte ao estúdio para começar sua jornada criativa!</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};