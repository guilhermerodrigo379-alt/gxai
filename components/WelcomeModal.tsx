import React from 'react';
import { Icon } from './Icon';

interface WelcomeModalProps {
  onClose: () => void;
}

const GuideStep: React.FC<{ icon: string; title: string; description: string }> = ({ icon, title, description }) => (
    <div className="flex items-start space-x-4">
        <div className="flex-shrink-0 bg-gray-800 p-3 rounded-lg">
            <Icon name={icon} className="w-6 h-6 text-purple-400" />
        </div>
        <div>
            <h4 className="text-lg font-bold text-white">{title}</h4>
            <p className="text-gray-400">{description}</p>
        </div>
    </div>
);

export const WelcomeModal: React.FC<WelcomeModalProps> = ({ onClose }) => {
    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
            <div 
                className="bg-gray-900/80 border border-gray-700/50 rounded-2xl w-full max-w-2xl shadow-2xl shadow-purple-500/10 p-8 transform transition-all"
                onClick={e => e.stopPropagation()}
            >
                <header className="text-center mb-6">
                    <h1 className="font-extrabold text-4xl tracking-tight bg-gradient-to-br from-fuchsia-400 to-purple-500 bg-clip-text text-transparent">
                        Bem-vindo ao GX VERSE
                    </h1>
                    <p className="text-lg font-semibold text-gray-300 tracking-wider mt-1">Seu Estúdio de Criação com IA</p>
                </header>

                <div className="space-y-6 my-8">
                    <GuideStep
                        icon="sparkles"
                        title="1. Crie com Palavras"
                        description="Use a aba 'Criar' para transformar suas ideias em imagens. Descreva o que você imagina, escolha um estilo e clique em GERAR."
                    />
                    <GuideStep
                        icon="magic"
                        title="2. Edite com Precisão"
                        description="Vá para 'Editar' para modificar qualquer imagem. Envie sua foto e use prompts para adicionar, remover ou estilizar elementos."
                    />
                    <GuideStep
                        icon="expand"
                        title="3. Explore e Exporte"
                        description="Clique em 'Visualizar Detalhes' em uma imagem para ampliar, gerar variações, fazer ajustes finos e exportar sua arte final."
                    />
                </div>
                
                <div className="mt-8 text-center">
                    <button
                        onClick={onClose}
                        className="bg-purple-500 text-white font-bold py-3 px-8 rounded-lg hover:bg-purple-600 transition-colors transform active:scale-95 text-lg"
                    >
                        Vamos Começar!
                    </button>
                </div>
            </div>
        </div>
    );
};