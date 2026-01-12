import { useState, useEffect, useCallback } from 'react';
import { Transaction, Category, Budget, RecurringTransaction } from '../types';
import { DEFAULT_CATEGORIES } from '../constants';

export const useFinanceData = (userId: string | null) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [recurring, setRecurring] = useState<RecurringTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/finance?userId=${userId}`);
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Falha ao sincronizar com a nuvem');
      }
      const data = await response.json();
      
      // Garante que amounts sejam sempre numbers (Postgres DECIMAL pode vir como string)
      const sanitizeAmount = (items: any[]) => items.map(item => ({
        ...item,
        amount: typeof item.amount === 'string' ? parseFloat(item.amount) : item.amount
      }));

      setTransactions(sanitizeAmount(data.transactions || []));
      
      const dbCategories = data.categories || [];
      const mergedCategories = [...DEFAULT_CATEGORIES];
      dbCategories.forEach((dbCat: Category) => {
        const index = mergedCategories.findIndex(c => c.id === dbCat.id);
        if (index > -1) mergedCategories[index] = dbCat;
        else mergedCategories.push(dbCat);
      });
      setCategories(mergedCategories);
      
      setBudgets(sanitizeAmount(data.budgets || []));
      setRecurring(sanitizeAmount(data.recurring || []));
      setError(null);
    } catch (err: any) {
      console.error('Fetch Error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const apiPost = async (action: string, body: any) => {
    try {
      const response = await fetch(`/api/finance?userId=${userId}&action=${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Erro ao salvar alteração');
      }
      return true;
    } catch (err: any) {
      setError(err.message);
      return false;
    }
  };

  const addTransactions = useCallback(async (newItems: Transaction[]) => {
    const success = await apiPost('addTransactions', newItems);
    if (success) {
      setTransactions(prev => {
        const existingIds = new Set(prev.map(t => t.id));
        const filtered = newItems.filter(item => !existingIds.has(item.id));
        return prev.concat(filtered).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      });
    }
  }, [userId]);

  const updateTransaction = useCallback(async (id: string, updates: Partial<Transaction>) => {
    const fullItem = transactions.find(t => t.id === id);
    if (!fullItem) return;
    const item = { ...fullItem, ...updates };
    const success = await apiPost('updateTransaction', item);
    if (success) {
      setTransactions(prev => prev.map(t => t.id === id ? item : t));
    }
  }, [transactions, userId]);

  const deleteTransaction = useCallback(async (id: string) => {
    const success = await apiPost('deleteTransaction', { id });
    if (success) {
      setTransactions(prev => prev.filter(t => t.id !== id));
    }
  }, [userId]);

  const addCategory = useCallback(async (cat: Category) => {
    const success = await apiPost('saveCategory', cat);
    if (success) setCategories(prev => [...prev, cat]);
  }, [userId]);

  const updateCategory = useCallback(async (id: string, updates: Partial<Category>) => {
    const cat = categories.find(c => c.id === id);
    if (!cat) return;
    const updated = { ...cat, ...updates };
    const success = await apiPost('saveCategory', updated);
    if (success) setCategories(prev => prev.map(c => c.id === id ? updated : c));
  }, [categories, userId]);

  const deleteCategory = useCallback(async (id: string) => {
    const success = await apiPost('deleteCategory', { id });
    if (success) {
      setCategories(prev => prev.filter(c => c.id !== id));
      setTransactions(prev => prev.map(t => t.categoryId === id ? { ...t, categoryId: 'cat-unassigned' } : t));
      setBudgets(prev => prev.filter(b => b.categoryId !== id));
    }
  }, [userId]);

  const updateBudget = useCallback(async (categoryId: string, amount: number) => {
    const success = await apiPost('updateBudget', { categoryId, amount });
    if (success) {
      setBudgets(prev => {
        const exists = prev.find(b => b.categoryId === categoryId);
        if (exists) return prev.map(b => b.categoryId === categoryId ? { ...b, amount } : b);
        return [...prev, { categoryId, amount }];
      });
    }
  }, [userId]);

  const addRecurring = useCallback(async (item: RecurringTransaction) => {
    const success = await apiPost('saveRecurring', item);
    if (success) setRecurring(prev => [...prev, item]);
  }, [userId]);

  const removeRecurring = useCallback(async (id: string) => {
    const success = await apiPost('deleteRecurring', { id });
    if (success) setRecurring(prev => prev.filter(r => r.id !== id));
  }, [userId]);

  const updateRecurring = useCallback(async (id: string, updates: Partial<RecurringTransaction>) => {
    const item = recurring.find(r => r.id === id);
    if (!item) return;
    const updated = { ...item, ...updates };
    const success = await apiPost('saveRecurring', updated);
    if (success) setRecurring(prev => prev.map(r => r.id === id ? updated : r));
  }, [recurring, userId]);

  return {
    transactions, categories, budgets, recurring, loading, error,
    addTransactions, updateTransaction, deleteTransaction,
    addCategory, updateCategory, deleteCategory, updateBudget,
    addRecurring, removeRecurring, updateRecurring
  };
};