import React, { useState, useCallback, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { HistoryItem, User } from './types';
import { StudioPage } from './components/StudioPage';
import { LoginPage } from './components/LoginPage';
import { ProfilePage } from './components/ProfilePage';
import { Icon } from './components/Icon';

const useToasts = () => {
    const [toasts, setToasts] = useState<{id: number, message: string, type: 'success' | 'error'}[]>([]);
    
    const removeToast = (id: number) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    };

    const addToast = (message: string, type: 'success' | 'error' = 'error') => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, type }]);
        const timer = setTimeout(() => {
            removeToast(id);
        }, 5000);
        return () => clearTimeout(timer);
    };

    const setToastError = (message: string) => addToast(message, 'error');
    const setToastSuccess = (message: string) => addToast(message, 'success');

    return { toasts, setToastError, setToastSuccess, removeToast };
};

const Toast: React.FC<{ id: number; message: string; type: string; onDismiss: (id: number) => void }> = ({ id, message, type, onDismiss }) => {
    const isError = type === 'error';
    const bgColor = isError ? 'bg-red-500/90' : 'bg-fuchsia-500/90';
    const iconName = isError ? 'x-circle' : 'check-circle';

    return (
        <div className={`flex items-center w-full max-w-sm p-4 space-x-3 text-white ${bgColor} rounded-lg shadow-lg backdrop-blur-sm animate-slide-in-right`}>
            <Icon name={iconName} className="w-6 h-6 flex-shrink-0" />
            <span className="flex-grow text-sm font-medium">{message}</span>
            <button onClick={() => onDismiss(id)} className="p-1 -ml-2 rounded-full hover:bg-white/20 flex-shrink-0">
              <Icon name="close" className="w-5 h-5" />
            </button>
        </div>
    );
};

// Helper to create small thumbnails to avoid exceeding localStorage quota.
const createThumbnail = (dataUrl: string, maxSize: number = 256): Promise<string> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) return reject(new Error('Canvas context not available'));

            let { width, height } = img;
            if (width > height) {
                if (width > maxSize) {
                    height *= maxSize / width;
                    width = maxSize;
                }
            } else {
                if (height > maxSize) {
                    width *= maxSize / height;
                    height = maxSize;
                }
            }

            canvas.width = width;
            canvas.height = height;
            ctx.drawImage(img, 0, 0, width, height);
            // Use JPEG at 80% quality for a good balance of size and quality.
            resolve(canvas.toDataURL('image/jpeg', 0.8));
        };
        img.onerror = (err) => reject(err);
        img.src = dataUrl;
    });
};


const App: React.FC = () => {
    const [users, setUsers] = useState<User[]>([]);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [history, setHistory] = useState<HistoryItem[]>([]);
    const { toasts, setToastError, setToastSuccess, removeToast } = useToasts();
    const navigate = useNavigate();
    const location = useLocation();

    const USERS_KEY = 'gx-verse-ai-studio-users';
    const SESSION_KEY = 'gx-verse-ai-studio-session';
    const MAX_HISTORY_ITEMS = 50;
    
    // Load users and session on initial mount
    useEffect(() => {
        try {
            const storedUsers = localStorage.getItem(USERS_KEY);
            const allUsers = storedUsers ? JSON.parse(storedUsers) : [];
            setUsers(allUsers);
            
            const sessionUser = localStorage.getItem(SESSION_KEY);
            if (sessionUser) {
                const loggedInUser = allUsers.find((u: User) => u.name === sessionUser);
                if (loggedInUser) {
                    setCurrentUser(loggedInUser);
                }
            }
        } catch (error) {
            console.error("Failed to load user data from localStorage", error);
            setUsers([]);
            setCurrentUser(null);
        }
    }, []);

    // Load user-specific history when currentUser changes
    useEffect(() => {
        if (currentUser) {
            try {
                const historyKey = `gx-verse-ai-studio-history-${currentUser.name}`;
                const storedHistory = localStorage.getItem(historyKey);
                setHistory(storedHistory ? JSON.parse(storedHistory) : []);
            } catch (error) {
                console.error("Failed to load history for user", error);
                setHistory([]);
            }
        } else {
            setHistory([]);
        }
    }, [currentUser]);

    // Save user-specific history when it changes
    useEffect(() => {
        if (currentUser) {
            try {
                const historyKey = `gx-verse-ai-studio-history-${currentUser.name}`;
                localStorage.setItem(historyKey, JSON.stringify(history));
            } catch (error) {
                console.error("Failed to save history for user", error);
                if (error instanceof DOMException && (error.name === 'QuotaExceededError' || error.message.includes('exceeded the quota'))) {
                    setToastError("Não foi possível salvar o histórico. O armazenamento local está cheio.");
                } else {
                    setToastError("Ocorreu um erro ao salvar o histórico.");
                }
            }
        }
    }, [history, currentUser, setToastError]);


    const addToHistory = useCallback(async (newItemData: Omit<HistoryItem, 'id'>) => {
        try {
            // Generate thumbnails to save space in localStorage
            const thumbnailImageUrl = await createThumbnail(newItemData.imageUrl);
            const thumbnailBeforeImageUrl = newItemData.beforeImageUrl
                ? await createThumbnail(newItemData.beforeImageUrl)
                : undefined;

            const newItem: HistoryItem = {
                ...newItemData,
                id: Date.now(),
                imageUrl: thumbnailImageUrl,
                beforeImageUrl: thumbnailBeforeImageUrl,
            };
            
            setHistory(prev => [newItem, ...prev].slice(0, MAX_HISTORY_ITEMS));
        } catch (error) {
            console.error("Failed to create thumbnail for history:", error);
            setToastError("Não foi possível salvar a imagem no histórico.");
        }
    }, [setToastError]);

    const handleClearHistory = () => {
        setHistory([]);
        setToastSuccess("Seu histórico foi limpo.");
    };

    const handleLogin = async (name: string, password: string): Promise<string | null> => {
        const user = users.find(u => u.name.toLowerCase() === name.toLowerCase());
        if (user && user.password === password) {
            setCurrentUser(user);
            localStorage.setItem(SESSION_KEY, user.name);
            setToastSuccess(`Bem-vindo de volta, ${user.name}!`);
            navigate('/');
            return null;
        }
        return "Nome de usuário ou senha incorretos.";
    };
    
    const handleRegister = async (name: string, password: string): Promise<string | null> => {
        if (users.some(u => u.name.toLowerCase() === name.toLowerCase())) {
            return "Este nome de usuário já existe.";
        }
        const newUser: User = { 
            name, 
            password, // In a real app, this should be hashed.
            registrationDate: new Date().toISOString()
        };
        const updatedUsers = [...users, newUser];
        setUsers(updatedUsers);
        localStorage.setItem(USERS_KEY, JSON.stringify(updatedUsers));
        
        setCurrentUser(newUser);
        localStorage.setItem(SESSION_KEY, newUser.name);
        setToastSuccess(`Conta criada com sucesso! Bem-vindo, ${name}!`);
        navigate('/');
        return null;
    };

    const handleLogout = () => {
        setCurrentUser(null);
        localStorage.removeItem(SESSION_KEY);
        setToastSuccess("Você saiu com sucesso.");
        navigate('/');
    };
    
    const handleHistoryClick = (item: HistoryItem) => {
      // Logic to load history item into the studio
      // This might involve setting state that StudioPage consumes
      // For now, we just navigate back to the studio
      navigate('/');
      
      // We need a way to pass the selected item to StudioPage.
      // For simplicity, we'll pass it via location state.
      navigate('/', { state: { loadHistoryItem: item } });
    };

    return (
        <>
            <div className="fixed top-0 left-0 right-0 z-[100] p-4 flex justify-center md:justify-end pointer-events-none">
                <div className="flex flex-col items-end space-y-2 w-full max-w-sm">
                    {toasts.map(toast => <Toast key={toast.id} id={toast.id} message={toast.message} type={toast.type} onDismiss={removeToast} />)}
                </div>
            </div>
        
            <Routes>
                {currentUser ? (
                    <>
                        <Route
                            path="/profile"
                            element={
                                <ProfilePage
                                    currentUser={currentUser}
                                    history={history}
                                    onClearHistory={handleClearHistory}
                                    onHistoryClick={handleHistoryClick}
                                />
                            }
                        />
                        <Route
                            path="/*"
                            element={
                                <StudioPage
                                    currentUser={currentUser}
                                    history={history}
                                    addToHistory={addToHistory}
                                    onClearHistory={handleClearHistory}
                                    onLogout={handleLogout}
                                    setToastError={setToastError}
                                    setToastSuccess={setToastSuccess}
                                />
                            }
                        />
                    </>
                ) : (
                    <Route
                        path="/*"
                        element={<LoginPage onLogin={handleLogin} onRegister={handleRegister} />}
                    />
                )}
            </Routes>
        </>
    );
};

export default App;
