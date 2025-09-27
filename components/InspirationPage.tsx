import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { inspirationsData, Inspiration } from '../data/inspirations';
import { Icon } from './Icon';

const categories = ['Todos', 'Personagens', 'Cenários', 'Abstrato', 'Objetos'];

export const InspirationPage: React.FC = () => {
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState('Todos');

  const filteredInspirations = useMemo(() => {
    if (activeCategory === 'Todos') {
      return inspirationsData;
    }
    return inspirationsData.filter(item => item.category === activeCategory);
  }, [activeCategory]);
  
  const handleUsePrompt = (prompt: string) => {
    navigate('/', { state: { loadInspirationPrompt: prompt } });
  };

  return (
    <div className="min-h-screen text-white bg-black/50 p-4 sm:p-6 md:p-8 animate-fade-in">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-6 border-b border-gray-700/50 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">Galeria de Inspiração</h1>
            <p className="text-gray-400">Explore ideias e comece a criar.</p>
          </div>
          <button 
            onClick={() => navigate('/')} 
            className="mt-4 sm:mt-0 flex items-center space-x-2 bg-gray-800/80 hover:bg-gray-700/80 transition-colors text-left font-medium p-3 rounded-lg"
          >
             <Icon name="close" className="w-5 h-5" />
             <span>Voltar ao Studio</span>
          </button>
        </header>

        {/* Category Filters */}
        <div className="flex flex-wrap items-center gap-2 mb-8">
          {categories.map(category => (
            <button
              key={category}
              onClick={() => setActiveCategory(category)}
              className={`px-4 py-2 text-sm font-semibold rounded-full transition-colors ${
                activeCategory === category
                  ? 'bg-fuchsia-500 text-white'
                  : 'bg-gray-800/70 text-gray-300 hover:bg-gray-700/70'
              }`}
            >
              {category}
            </button>
          ))}
        </div>

        {/* Inspirations Gallery */}
        <section className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {filteredInspirations.map((item) => (
            <div
              key={item.id}
              className="group relative aspect-[3/4] rounded-lg overflow-hidden cursor-pointer shadow-lg transform transition-transform duration-300 hover:-translate-y-1"
              onClick={() => handleUsePrompt(item.prompt)}
            >
              <img
                src={item.imageUrl}
                alt={item.prompt}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex flex-col justify-end p-4">
                <p className="text-sm text-white/90 line-clamp-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 delay-100 transform translate-y-2 group-hover:translate-y-0">
                  {item.prompt}
                </p>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleUsePrompt(item.prompt);
                  }}
                  className="mt-3 w-full bg-purple-600/90 text-white font-bold py-2 px-4 rounded-lg hover:bg-purple-700 transition-colors text-sm opacity-0 group-hover:opacity-100 transform translate-y-4 group-hover:translate-y-0 duration-300"
                >
                  Usar este Prompt
                </button>
              </div>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
};
