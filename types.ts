
export type TransactionType = 'income' | 'expense';

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
}

export interface Category {
  id: string;
  name: string;
  color: string;
}

export interface Transaction {
  id: string;
  date: string; // ISO string YYYY-MM-DD
  description: string;
  amount: number;
  categoryId: string;
  type: TransactionType;
}

export interface Budget {
  categoryId: string;
  amount: number;
}

export interface ImportMapping {
  dateCol: number;
  descriptionCol: number;
  valueCol: number;
  categoryCol: number;
}

export interface ParseResult {
  headers: string[];
  rows: string[][];
}
