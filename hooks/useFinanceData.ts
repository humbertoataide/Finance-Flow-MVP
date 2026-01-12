import { useState, useEffect, useCallback, useRef } from 'react';
import { Transaction, Category, Budget, RecurringTransaction } from '../types';
import { DEFAULT_CATEGORIES, STORAGE_KEYS } from '../constants';

export const useFinanceData = (userId: string | null) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [recurring, setRecurring] = useState<RecurringTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Ref para rastrear se estamos em modo Offline (LocalStorage)
  const isOfflineMode = useRef<boolean>(false);

  const loadFromLocalStorage = useCallback(() => {
    const localT = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
    const localC = localStorage.getItem(STORAGE_KEYS.CATEGORIES);
    const localB = localStorage.getItem(STORAGE_KEYS.BUDGETS);
    const localR = localStorage.getItem(STORAGE_KEYS.RECURRING);

    if (localT) setTransactions(JSON.parse(localT));
    if (localC) {
      const dbCategories = JSON.parse(localC);
      const merged = [...DEFAULT_CATEGORIES];
      dbCategories.forEach((dbCat: Category) => {
        const index = merged.findIndex(c => c.id === dbCat.id);
        if (index > -1) merged[index] = dbCat;
        else merged.push(dbCat);
      });
      setCategories(merged);
    }
    if (localB) setBudgets(JSON.parse(localB));
    if (localR) setRecurring(JSON.parse(localR));
  }, []);

  const saveToLocalStorage = useCallback((type: 'T' | 'C' | 'B' | 'R', data: any) => {
    const keys = {
      T: STORAGE_KEYS.TRANSACTIONS,
      C: STORAGE_KEYS.CATEGORIES,
      B: STORAGE_KEYS.BUDGETS,
      R: STORAGE_KEYS.RECURRING
    };
    localStorage.setItem(keys[type], JSON.stringify(data));
  }, []);

  const fetchData = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/finance?userId=${userId}`);
      
      // Se 404, entramos em modo offline silenciosamente
      if (response.status === 404) {
        console.warn('Backend não encontrado (404). Usando armazenamento local.');
        isOfflineMode.current = true;
        loadFromLocalStorage();
        setError(null);
        return;
      }

      if (!response.ok) {
        throw new Error(`Erro no servidor (Status ${response.status})`);
      }

      const data = await response.json();
      isOfflineMode.current = false;
      
      const sanitizeAmount = (items: any[]) => items.map(item => ({
        ...item,
        amount: typeof item.amount === 'string' ? parseFloat(item.amount) : item.amount
      }));

      const newTransactions = sanitizeAmount(data.transactions || []);
      const dbCategories = data.categories || [];
      const newBudgets = sanitizeAmount(data.budgets || []);
      const newRecurring = sanitizeAmount(data.recurring || []);

      setTransactions(newTransactions);
      
      const mergedCategories = [...DEFAULT_CATEGORIES];
      dbCategories.forEach((dbCat: Category) => {
        const index = mergedCategories.findIndex(c => c.id === dbCat.id);
        if (index > -1) mergedCategories[index] = dbCat;
        else mergedCategories.push(dbCat);
      });
      setCategories(mergedCategories);
      setBudgets(newBudgets);
      setRecurring(newRecurring);

      // Sincroniza localmente para backup
      saveToLocalStorage('T', newTransactions);
      saveToLocalStorage('C', dbCategories);
      saveToLocalStorage('B', newBudgets);
      saveToLocalStorage('R', newRecurring);

      setError(null);
    } catch (err: any) {
      console.error('Fetch Error:', err);
      // Fallback em caso de qualquer erro de rede
      isOfflineMode.current = true;
      loadFromLocalStorage();
      // Não mostramos erro para o usuário se o LocalStorage estiver funcionando
    } finally {
      setLoading(false);
    }
  }, [userId, loadFromLocalStorage, saveToLocalStorage]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const apiPost = async (action: string, body: any) => {
    if (isOfflineMode.current) return true; // Simula sucesso se estiver offline

    try {
      const response = await fetch(`/api/finance?userId=${userId}&action=${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        if (response.status === 404) {
          isOfflineMode.current = true;
          return true;
        }
        return false;
      }
      return true;
    } catch (err) {
      isOfflineMode.current = true;
      return true;
    }
  };

  const addTransactions = useCallback(async (newItems: Transaction[]) => {
    const success = await apiPost('addTransactions', newItems);
    if (success) {
      setTransactions(prev => {
        const existingIds = new Set(prev.map(t => t.id));
        const filtered = newItems.filter(item => !existingIds.has(item.id));
        const updated = prev.concat(filtered).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        saveToLocalStorage('T', updated);
        return updated;
      });
    }
  }, [userId, saveToLocalStorage]);

  const updateTransaction = useCallback(async (id: string, updates: Partial<Transaction>) => {
    const fullItem = transactions.find(t => t.id === id);
    if (!fullItem) return;
    const item = { ...fullItem, ...updates };
    const success = await apiPost('updateTransaction', item);
    if (success) {
      setTransactions(prev => {
        const updated = prev.map(t => t.id === id ? item : t);
        saveToLocalStorage('T', updated);
        return updated;
      });
    }
  }, [transactions, userId, saveToLocalStorage]);

  const deleteTransaction = useCallback(async (id: string) => {
    const success = await apiPost('deleteTransaction', { id });
    if (success) {
      setTransactions(prev => {
        const updated = prev.filter(t => t.id !== id);
        saveToLocalStorage('T', updated);
        return updated;
      });
    }
  }, [userId, saveToLocalStorage]);

  const addCategory = useCallback(async (cat: Category) => {
    const success = await apiPost('saveCategory', cat);
    if (success) {
      setCategories(prev => {
        const updated = [...prev, cat];
        saveToLocalStorage('C', updated.filter(c => !DEFAULT_CATEGORIES.some(dc => dc.id === c.id)));
        return updated;
      });
    }
  }, [userId, saveToLocalStorage]);

  const updateCategory = useCallback(async (id: string, updates: Partial<Category>) => {
    const cat = categories.find(c => c.id === id);
    if (!cat) return;
    const updated = { ...cat, ...updates };
    const success = await apiPost('saveCategory', updated);
    if (success) {
      setCategories(prev => {
        const newList = prev.map(c => c.id === id ? updated : c);
        saveToLocalStorage('C', newList.filter(c => !DEFAULT_CATEGORIES.some(dc => dc.id === c.id)));
        return newList;
      });
    }
  }, [categories, userId, saveToLocalStorage]);

  const deleteCategory = useCallback(async (id: string) => {
    const success = await apiPost('deleteCategory', { id });
    if (success) {
      setCategories(prev => {
        const updated = prev.filter(c => c.id !== id);
        saveToLocalStorage('C', updated.filter(c => !DEFAULT_CATEGORIES.some(dc => dc.id === c.id)));
        return updated;
      });
      setTransactions(prev => prev.map(t => t.categoryId === id ? { ...t, categoryId: 'cat-unassigned' } : t));
    }
  }, [userId, saveToLocalStorage]);

  const updateBudget = useCallback(async (categoryId: string, amount: number) => {
    const success = await apiPost('updateBudget', { categoryId, amount });
    if (success) {
      setBudgets(prev => {
        const exists = prev.find(b => b.categoryId === categoryId);
        const updated = exists 
          ? prev.map(b => b.categoryId === categoryId ? { ...b, amount } : b)
          : [...prev, { categoryId, amount }];
        saveToLocalStorage('B', updated);
        return updated;
      });
    }
  }, [userId, saveToLocalStorage]);

  const addRecurring = useCallback(async (item: RecurringTransaction) => {
    const success = await apiPost('saveRecurring', item);
    if (success) setRecurring(prev => {
      const updated = [...prev, item];
      saveToLocalStorage('R', updated);
      return updated;
    });
  }, [userId, saveToLocalStorage]);

  const removeRecurring = useCallback(async (id: string) => {
    const success = await apiPost('deleteRecurring', { id });
    if (success) setRecurring(prev => {
      const updated = prev.filter(r => r.id !== id);
      saveToLocalStorage('R', updated);
      return updated;
    });
  }, [userId, saveToLocalStorage]);

  const updateRecurring = useCallback(async (id: string, updates: Partial<RecurringTransaction>) => {
    const item = recurring.find(r => r.id === id);
    if (!item) return;
    const updated = { ...item, ...updates };
    const success = await apiPost('saveRecurring', updated);
    if (success) setRecurring(prev => {
      const newList = prev.map(r => r.id === id ? updated : r);
      saveToLocalStorage('R', newList);
      return newList;
    });
  }, [recurring, userId, saveToLocalStorage]);

  return {
    transactions, categories, budgets, recurring, loading, error,
    addTransactions, updateTransaction, deleteTransaction,
    addCategory, updateCategory, deleteCategory, updateBudget,
    addRecurring, removeRecurring, updateRecurring
  };
};