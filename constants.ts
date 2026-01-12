
import { Category } from './types';

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'cat-compras', name: 'Compras', color: '#ec4899' },
  { id: 'cat-comida', name: 'Comida & Bebida', color: '#ef4444' },
  { id: 'cat-transporte', name: 'Transporte', color: '#f59e0b' },
  { id: 'cat-entretenimento', name: 'Entretenimento', color: '#8b5cf6' },
  { id: 'cat-viagem', name: 'Viagem', color: '#06b6d4' },
  { id: 'cat-saude', name: 'Saúde', color: '#10b981' },
  { id: 'cat-educacao', name: 'Educação', color: '#3b82f6' },
  { id: 'cat-familia', name: 'Família', color: '#6366f1' },
  { id: 'cat-investimento', name: 'Investimento', color: '#14b8a6' },
  { id: 'cat-outras-despesas', name: 'Outras Despesas', color: '#64748b' },
  { id: 'cat-outras-receitas', name: 'Outras Receitas', color: '#22c55e' },
  { id: 'cat-unassigned', name: 'Sem Categoria', color: '#94a3b8' },
];

export const STORAGE_KEYS = {
  TRANSACTIONS: 'ff_transactions',
  CATEGORIES: 'ff_categories',
  BUDGETS: 'ff_budgets',
  RECURRING: 'ff_recurring',
};
