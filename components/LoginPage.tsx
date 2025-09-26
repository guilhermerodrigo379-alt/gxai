import React, { useState } from 'react';

interface LoginPageProps {
  onLogin: (name: string, password: string) => Promise<string | null>;
  onRegister: (name: string, password: string) => Promise<string | null>;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLogin, onRegister }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    if (!name.trim() || !password.trim()) {
      setError("Nome e senha não podem estar em branco.");
      setIsLoading(false);
      return;
    }

    try {
      let authError: string | null = null;
      if (mode === 'login') {
        authError = await onLogin(name.trim(), password.trim());
      } else {
        authError = await onRegister(name.trim(), password.trim());
      }

      if (authError) {
        setError(authError);
      }
    } catch (e) {
      setError("Ocorreu um erro inesperado. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMode = () => {
    setError(null);
    setName('');
    setPassword('');
    setMode(prev => (prev === 'login' ? 'register' : 'login'));
  };

  return (
    <div className="min-h-screen text-white flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-gray-900/60 backdrop-blur-xl border border-gray-800/50 rounded-2xl p-8 shadow-2xl shadow-fuchsia-500/10 animate-fade-in-up">
        <header className="text-center mb-8">
          <h1 className="font-extrabold text-4xl tracking-tight bg-gradient-to-br from-fuchsia-400 to-purple-500 bg-clip-text text-transparent">
            GX VERSE
          </h1>
          <p className="text-md font-semibold text-gray-400 tracking-widest mt-1">AI STUDIO</p>
        </header>

        <h2 className="text-xl font-bold text-center mb-6 text-gray-200">
          {mode === 'login' ? 'Acessar sua conta' : 'Criar nova conta'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-2">
              Nome de Usuário
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-gray-900/70 border border-gray-700/80 rounded-lg p-3 text-md placeholder-gray-500 focus:ring-2 focus:ring-fuchsia-500/50 focus:border-fuchsia-500 transition-colors"
              placeholder="Digite seu nome de usuário"
              autoFocus
            />
          </div>

           <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
              Senha
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-gray-900/70 border border-gray-700/80 rounded-lg p-3 text-md placeholder-gray-500 focus:ring-2 focus:ring-fuchsia-500/50 focus:border-fuchsia-500 transition-colors"
              placeholder="Digite sua senha"
            />
          </div>

          {error && <p className="text-sm text-red-400 text-center bg-red-900/50 p-2 rounded-md">{error}</p>}

          <button
            type="submit"
            disabled={!name.trim() || !password.trim() || isLoading}
            className="w-full bg-purple-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-purple-700 transition-colors transform active:scale-95 disabled:bg-gray-700 disabled:text-gray-400 disabled:cursor-not-allowed text-lg"
          >
            {isLoading ? 'Processando...' : (mode === 'login' ? 'Entrar' : 'Criar Conta')}
          </button>
        </form>

        <p className="text-center text-sm text-gray-400 mt-6">
          {mode === 'login' ? 'Não tem uma conta?' : 'Já tem uma conta?'}
          <button onClick={toggleMode} className="font-semibold text-fuchsia-400 hover:text-fuchsia-300 ml-2 focus:outline-none">
            {mode === 'login' ? 'Crie uma agora' : 'Faça login'}
          </button>
        </p>

      </div>
    </div>
  );
};