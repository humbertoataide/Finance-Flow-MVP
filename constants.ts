
import { Category } from './types';

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'cat-1', name: 'Moradia', color: '#3b82f6' },
  { id: 'cat-2', name: 'Alimentação', color: '#ef4444' },
  { id: 'cat-3', name: 'Transporte', color: '#f59e0b' },
  { id: 'cat-4', name: 'Lazer', color: '#10b981' },
  { id: 'cat-5', name: 'Saúde', color: '#8b5cf6' },
  { id: 'cat-6', name: 'Renda', color: '#14b8a6' },
  { id: 'cat-unassigned', name: 'Sem Categoria', color: '#94a3b8' },
];

export const STORAGE_KEYS = {
  TRANSACTIONS: 'ff_transactions',
  CATEGORIES: 'ff_categories',
  BUDGETS: 'ff_budgets',
  RECURRING: 'ff_recurring',
};
