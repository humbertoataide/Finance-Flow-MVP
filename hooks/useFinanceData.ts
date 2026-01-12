
import { useState, useEffect, useCallback } from 'react';
import { Transaction, Category, Budget } from '../types';
import { DEFAULT_CATEGORIES, STORAGE_KEYS } from '../constants';

export const useFinanceData = (userId: string | null) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);
  const [budgets, setBudgets] = useState<Budget[]>([]);

  const getScopedKey = (key: string) => userId ? `${key}_${userId}` : null;

  useEffect(() => {
    if (!userId) return;

    const tKey = getScopedKey(STORAGE_KEYS.TRANSACTIONS);
    const cKey = getScopedKey(STORAGE_KEYS.CATEGORIES);
    const bKey = getScopedKey(STORAGE_KEYS.BUDGETS);

    const savedTransactions = tKey ? localStorage.getItem(tKey) : null;
    const savedCategories = cKey ? localStorage.getItem(cKey) : null;
    const savedBudgets = bKey ? localStorage.getItem(bKey) : null;

    if (savedTransactions) setTransactions(JSON.parse(savedTransactions));
    else setTransactions([]);

    if (savedCategories) setCategories(JSON.parse(savedCategories));
    else setCategories(DEFAULT_CATEGORIES);

    if (savedBudgets) setBudgets(JSON.parse(savedBudgets));
    else setBudgets([]);
  }, [userId]);

  useEffect(() => {
    const key = getScopedKey(STORAGE_KEYS.TRANSACTIONS);
    if (key && userId) localStorage.setItem(key, JSON.stringify(transactions));
  }, [transactions, userId]);

  useEffect(() => {
    const key = getScopedKey(STORAGE_KEYS.CATEGORIES);
    if (key && userId) localStorage.setItem(key, JSON.stringify(categories));
  }, [categories, userId]);

  useEffect(() => {
    const key = getScopedKey(STORAGE_KEYS.BUDGETS);
    if (key && userId) localStorage.setItem(key, JSON.stringify(budgets));
  }, [budgets, userId]);

  const addTransactions = useCallback((newItems: Transaction[]) => {
    setTransactions(prev => {
      const existingKeys = new Set(prev.map(t => `${t.date}|${t.description}|${t.amount}`));
      const filtered = newItems.filter(item => !existingKeys.has(`${item.date}|${item.description}|${item.amount}`));
      
      if (filtered.length === 0) return prev;
      return prev.concat(filtered).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    });
  }, []);

  const updateTransaction = useCallback((id: string, updates: Partial<Transaction>) => {
    setTransactions(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  }, []);

  const deleteTransaction = useCallback((id: string) => {
    setTransactions(prev => prev.filter(t => t.id !== id));
  }, []);

  const addCategory = useCallback((cat: Category) => {
    setCategories(prev => [...prev, cat]);
  }, []);

  const deleteCategory = useCallback((id: string) => {
    if (id === 'cat-unassigned') return;
    setCategories(prev => prev.filter(c => c.id !== id));
    setTransactions(prev => prev.map(t => t.categoryId === id ? { ...t, categoryId: 'cat-unassigned' } : t));
    setBudgets(prev => prev.filter(b => b.categoryId !== id));
  }, []);

  const updateBudget = useCallback((categoryId: string, amount: number) => {
    setBudgets(prev => {
      const exists = prev.find(b => b.categoryId === categoryId);
      if (exists) return prev.map(b => b.categoryId === categoryId ? { ...b, amount } : b);
      return [...prev, { categoryId, amount }];
    });
  }, []);

  return {
    transactions,
    categories,
    budgets,
    addTransactions,
    updateTransaction,
    deleteTransaction,
    addCategory,
    deleteCategory,
    updateBudget
  };
};
