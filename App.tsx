
import React, { useState, useEffect, useCallback } from 'react';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import TransactionGrid from './components/TransactionGrid';
import CategoryManager from './components/CategoryManager';
import PlanningView from './components/PlanningView';
import ImportWizard from './components/ImportWizard';
import TransactionForm from './components/TransactionForm';
import AuthView from './components/AuthView';
import { useFinanceData } from './hooks/useFinanceData';
import { User, RecurringTransaction, Transaction } from './types';
import { startOfMonth, endOfMonth, isWithinInterval, parseISO } from 'date-fns';

type ViewType = 'dashboard' | 'transactions' | 'categories' | 'planning';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [activeView, setActiveView] = useState<ViewType>('dashboard');
  const [showImport, setShowImport] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => {
    const savedUser = localStorage.getItem('ff_current_user');
    if (savedUser) setUser(JSON.parse(savedUser));
  }, []);

  const { 
    transactions, 
    categories, 
    budgets,
    recurring,
    addTransactions, 
    updateTransaction, 
    deleteTransaction,
    addCategory,
    deleteCategory,
    updateBudget,
    addRecurring,
    removeRecurring
  } = useFinanceData(user?.id || null);

  const handleCommitRecurring = useCallback((item: RecurringTransaction) => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(item.dayOfMonth).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    
    const newTransaction: Transaction = {
      id: `rec-commit-${item.id}-${year}-${month}`,
      date: dateStr,
      description: item.description,
      amount: item.type === 'expense' ? -Math.abs(item.amount) : Math.abs(item.amount),
      categoryId: item.categoryId,
      type: item.type,
      isRecurring: true
    };

    addTransactions([newTransaction]);
  }, [addTransactions]);

  // Motor de Processamento Automático de Recorrência
  useEffect(() => {
    if (!user || recurring.length === 0) return;

    const today = new Date();
    const startOfCurrentMonth = startOfMonth(today);
    const endOfCurrentMonth = endOfMonth(today);

    const pendingLaunches: RecurringTransaction[] = [];

    recurring.forEach(item => {
      if (!item.active) return;

      // Verificar se a data atual está dentro do intervalo permitido
      const start = item.startDate ? parseISO(item.startDate) : new Date(2000, 0, 1);
      const end = item.endDate ? parseISO(item.endDate) : new Date(2100, 0, 1);
      
      const isPeriodActive = isWithinInterval(today, { start, end });
      if (!isPeriodActive) return;

      // Verificar se já existe lançamento para este item neste mês
      const alreadyLaunched = transactions.some(t => 
        t.isRecurring && 
        t.description === item.description && 
        isWithinInterval(parseISO(t.date), { start: startOfCurrentMonth, end: endOfCurrentMonth })
      );

      if (!alreadyLaunched) {
        pendingLaunches.push(item);
      }
    });

    if (pendingLaunches.length > 0) {
      pendingLaunches.forEach(handleCommitRecurring);
    }
  }, [user, recurring, transactions, handleCommitRecurring]);

  const handleLogin = (newUser: User) => {
    setUser(newUser);
    localStorage.setItem('ff_current_user', JSON.stringify(newUser));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('ff_current_user');
    setActiveView('dashboard');
  };

  if (!user) {
    return <AuthView onLogin={handleLogin} />;
  }

  const renderContent = () => {
    switch (activeView) {
      case 'dashboard':
        return <Dashboard transactions={transactions} categories={categories} budgets={budgets} />;
      case 'transactions':
        return (
          <TransactionGrid 
            transactions={transactions} 
            categories={categories}
            onAdd={() => setShowAdd(true)}
            onImport={() => setShowImport(true)}
            onUpdate={updateTransaction}
            onDelete={deleteTransaction}
          />
        );
      case 'categories':
        return (
          <CategoryManager 
            categories={categories} 
            onAdd={addCategory} 
            onDelete={deleteCategory} 
          />
        );
      case 'planning':
        return (
          <PlanningView 
            transactions={transactions} 
            categories={categories} 
            budgets={budgets}
            recurring={recurring}
            onUpdateBudget={updateBudget}
            onAddRecurring={addRecurring}
            onRemoveRecurring={removeRecurring}
            onCommitRecurring={handleCommitRecurring}
          />
        );
      default:
        return <Dashboard transactions={transactions} categories={categories} budgets={budgets} />;
    }
  };

  return (
    <Layout activeView={activeView} setActiveView={setActiveView} user={user} onLogout={handleLogout}>
      {renderContent()}

      {showImport && (
        <ImportWizard 
          onClose={() => setShowImport(false)} 
          onImport={(items) => addTransactions(items)}
          categories={categories}
        />
      )}

      {showAdd && (
        <TransactionForm 
          onClose={() => setShowAdd(false)}
          onAdd={(t) => addTransactions([t])}
          categories={categories}
        />
      )}
    </Layout>
  );
};

export default App;
