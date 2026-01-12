
import { useState, useEffect, useCallback } from 'react';
import { Transaction, Category, Budget, RecurringTransaction } from '../types';
import { DEFAULT_CATEGORIES, STORAGE_KEYS } from '../constants';

export const useFinanceData = (userId: string | null) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [recurring, setRecurring] = useState<RecurringTransaction[]>([]);

  const getScopedKey = (key: string) => userId ? `${key}_${userId}` : null;

  useEffect(() => {
    if (!userId) return;

    const tKey = getScopedKey(STORAGE_KEYS.TRANSACTIONS);
    const cKey = getScopedKey(STORAGE_KEYS.CATEGORIES);
    const bKey = getScopedKey(STORAGE_KEYS.BUDGETS);
    const rKey = getScopedKey(STORAGE_KEYS.RECURRING);

    const savedTransactions = tKey ? localStorage.getItem(tKey) : null;
    const savedCategories = cKey ? localStorage.getItem(cKey) : null;
    const savedBudgets = bKey ? localStorage.getItem(bKey) : null;
    const savedRecurring = rKey ? localStorage.getItem(rKey) : null;

    if (savedTransactions) setTransactions(JSON.parse(savedTransactions));
    else setTransactions([]);

    if (savedCategories) setCategories(JSON.parse(savedCategories));
    else setCategories(DEFAULT_CATEGORIES);

    if (savedBudgets) setBudgets(JSON.parse(savedBudgets));
    else setBudgets([]);

    if (savedRecurring) setRecurring(JSON.parse(savedRecurring));
    else setRecurring([]);
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

  useEffect(() => {
    const key = getScopedKey(STORAGE_KEYS.RECURRING);
    if (key && userId) localStorage.setItem(key, JSON.stringify(recurring));
  }, [recurring, userId]);

  const addTransactions = useCallback((newItems: Transaction[]) => {
    setTransactions(prev => {
      // Usar ID único se disponível, senão fallback para chave composta
      const existingIds = new Set(prev.map(t => t.id));
      const filtered = newItems.filter(item => !existingIds.has(item.id));
      
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

  const updateCategory = useCallback((id: string, updates: Partial<Category>) => {
    setCategories(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  }, []);

  const deleteCategory = useCallback((id: string) => {
    if (id === 'cat-unassigned') return;
    setCategories(prev => prev.filter(c => c.id !== id));
    setTransactions(prev => prev.map(t => t.categoryId === id ? { ...t, categoryId: 'cat-unassigned' } : t));
    setBudgets(prev => prev.filter(b => b.categoryId !== id));
    setRecurring(prev => prev.map(r => r.categoryId === id ? { ...r, categoryId: 'cat-unassigned' } : r));
  }, []);

  const updateBudget = useCallback((categoryId: string, amount: number) => {
    setBudgets(prev => {
      const exists = prev.find(b => b.categoryId === categoryId);
      if (exists) return prev.map(b => b.categoryId === categoryId ? { ...b, amount } : b);
      return [...prev, { categoryId, amount }];
    });
  }, []);

  const addRecurring = useCallback((item: RecurringTransaction) => {
    setRecurring(prev => [...prev, item]);
  }, []);

  const removeRecurring = useCallback((id: string) => {
    setRecurring(prev => prev.filter(r => r.id !== id));
  }, []);

  const updateRecurring = useCallback((id: string, updates: Partial<RecurringTransaction>) => {
    setRecurring(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
  }, []);

  return {
    transactions,
    categories,
    budgets,
    recurring,
    addTransactions,
    updateTransaction,
    deleteTransaction,
    addCategory,
    updateCategory,
    deleteCategory,
    updateBudget,
    addRecurring,
    removeRecurring,
    updateRecurring
  };
};
