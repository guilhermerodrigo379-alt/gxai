import React, { useState, useCallback, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { HistoryItem, User } from './types';
import { StudioPage } from './components/StudioPage';
import { LoginPage } from './components/LoginPage';
import { ProfilePage } from './components/ProfilePage';
import { InspirationPage } from './components/InspirationPage';
import { Icon } from './components/Icon';

// --- START of IndexedDB Service Logic ---

const DB_NAME = 'gx-verse-db';
const DB_VERSION = 1;
const STORE_NAME = 'history';
const MAX_HISTORY_ITEMS = 50; // Increased capacity with IndexedDB

let dbPromise: Promise<IDBDatabase> | null = null;

const openDB = (): Promise<IDBDatabase> => {
  if (dbPromise) {
    return dbPromise;
  }
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('IndexedDB error:', request.error);
      reject('Error opening IndexedDB.');
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = () => {
      const tempDb = request.result;
      if (!tempDb.objectStoreNames.contains(STORE_NAME)) {
        const store = tempDb.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('userName', 'userName', { unique: false });
      }
    };
  });
  return dbPromise;
};

const saveHistoryItem = async (item: HistoryItem, userName: string): Promise<void> => {
  const db = await openDB();
  const transaction = db.transaction(STORE_NAME, 'readwrite');
  const store = transaction.objectStore(STORE_NAME);

  // Add userName to the item before saving
  const itemToStore = { ...item, userName };
  store.put(itemToStore);
  
  // Enforce MAX_HISTORY_ITEMS limit by deleting the oldest items
  const userIndex = store.index('userName');
  const cursorRequest = userIndex.openCursor(IDBKeyRange.only(userName), 'prev'); // 'prev' sorts by key descending (newest first)
  let count = 0;
  
  cursorRequest.onsuccess = () => {
      const cursor = cursorRequest.result;
      if (cursor) {
          count++;
          if (count > MAX_HISTORY_ITEMS) {
              cursor.delete();
          }
          cursor.continue();
      }
  };

  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
};

const getHistoryForUser = async (userName: string): Promise<HistoryItem[]> => {
  const db = await openDB();
  const transaction = db.transaction(STORE_NAME, 'readonly');
  const store = transaction.objectStore(STORE_NAME);
  const index = store.index('userName');
  const request = index.getAll(IDBKeyRange.only(userName));
  
  return new Promise((resolve, reject) => {
    request.onsuccess = () => {
      // Sort by id (timestamp) descending to get newest first
      const sortedHistory = request.result.sort((a, b) => b.id - a.id);
      resolve(sortedHistory as HistoryItem[]);
    };
    request.onerror = () => {
      console.error('Error fetching history:', request.error);
      reject('Could not fetch history from IndexedDB.');
    };
  });
};

const clearHistoryForUser = async (userName: string): Promise<void> => {
  const db = await openDB();
  const transaction = db.transaction(STORE_NAME, 'readwrite');
  const store = transaction.objectStore(STORE_NAME);
  const index = store.index('userName');
  const request = index.openCursor(IDBKeyRange.only(userName));

  return new Promise<void>((resolve, reject) => {
      request.onsuccess = () => {
          const cursor = request.result;
          if (cursor) {
              cursor.delete();
              cursor.continue();
          }
      };

      transaction.oncomplete = () => {
          resolve();
      };
      transaction.onerror = () => {
          reject(transaction.error);
      };
  });
};

// --- END of IndexedDB Service Logic ---

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


const App: React.FC = () => {
    const [users, setUsers] = useState<User[]>([]);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [history, setHistory] = useState<HistoryItem[]>([]);
    const { toasts, setToastError, setToastSuccess, removeToast } = useToasts();
    const navigate = useNavigate();
    const location = useLocation();

    const USERS_KEY = 'gx-verse-ai-studio-users';
    const SESSION_KEY = 'gx-verse-ai-studio-session';
    
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

    // Load user-specific history from IndexedDB when currentUser changes
    useEffect(() => {
        if (currentUser) {
            getHistoryForUser(currentUser.name)
                .then(userHistory => {
                    setHistory(userHistory);
                })
                .catch(error => {
                    console.error("Failed to load history from IndexedDB", error);
                    setToastError("Não foi possível carregar o histórico.");
                    setHistory([]);
                });
        } else {
            setHistory([]);
        }
    }, [currentUser, setToastError]);


    const addToHistory = useCallback(async (newItemData: Omit<HistoryItem, 'id'>) => {
        if (!currentUser) return;

        const newItem: HistoryItem = {
            ...newItemData,
            id: Date.now(),
            imageUrl: newItemData.imageUrl,
            beforeImageUrl: newItemData.beforeImageUrl,
        };
        
        // Optimistic UI update
        setHistory(prev => [newItem, ...prev].slice(0, MAX_HISTORY_ITEMS));

        try {
            await saveHistoryItem(newItem, currentUser.name);
        } catch (error) {
            console.error("Failed to save history to IndexedDB", error);
            setToastError("Ocorreu um erro ao salvar o histórico.");
            // NOTE: A full rollback of the optimistic update is complex and might be jarring.
            // For now, we just inform the user of the save failure.
        }
    }, [currentUser, setToastError]);

    const handleClearHistory = useCallback(async () => {
        if (!currentUser) return;
        try {
            await clearHistoryForUser(currentUser.name);
            setHistory([]);
            setToastSuccess("Seu histórico foi limpo.");
        } catch (error) {
            console.error("Failed to clear history from IndexedDB", error);
            setToastError("Não foi possível limpar o histórico.");
        }
    }, [currentUser, setToastError, setToastSuccess]);

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
                            path="/inspiration"
                            element={<InspirationPage />}
                        />
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