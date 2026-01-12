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
import { startOfMonth, endOfMonth, isWithinInterval, parseISO, addMonths, isBefore, isAfter } from 'date-fns';
import { Loader2, CloudOff } from 'lucide-react';

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
    transactions, categories, budgets, recurring, loading, error,
    addTransactions, updateTransaction, deleteTransaction,
    addCategory, updateCategory, deleteCategory, updateBudget,
    addRecurring, removeRecurring, updateRecurring
  } = useFinanceData(user?.id || null);

  const generateRecurringTransaction = useCallback((item: RecurringTransaction, date: Date): Transaction => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(item.dayOfMonth).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    
    return {
      id: `rec-commit-${item.id}-${year}-${month}`,
      date: dateStr,
      description: item.description,
      amount: item.type === 'expense' ? -Math.abs(item.amount) : Math.abs(item.amount),
      categoryId: item.categoryId,
      type: item.type,
      isRecurring: true,
      recurringId: item.id
    };
  }, []);

  useEffect(() => {
    if (!user || recurring.length === 0 || loading) return;

    const today = new Date();
    const pendingLaunches: Transaction[] = [];

    recurring.forEach(item => {
      if (!item.active) return;
      let currentCheck = item.startDate ? parseISO(item.startDate) : startOfMonth(addMonths(today, -12));
      const futureLimit = addMonths(today, 13);
      currentCheck = startOfMonth(currentCheck);
      
      while (isBefore(currentCheck, futureLimit)) {
        if (item.endDate && isAfter(currentCheck, parseISO(item.endDate))) break;
        const startOfM = startOfMonth(currentCheck);
        const endOfM = endOfMonth(currentCheck);
        const alreadyLaunched = transactions.some(t => 
          t.recurringId === item.id && 
          isWithinInterval(parseISO(t.date), { start: startOfM, end: endOfM })
        );
        if (!alreadyLaunched) {
          pendingLaunches.push(generateRecurringTransaction(item, currentCheck));
        }
        currentCheck = addMonths(currentCheck, 1);
      }
    });

    if (pendingLaunches.length > 0) {
      addTransactions(pendingLaunches);
    }
  }, [user, recurring, transactions, loading, addTransactions, generateRecurringTransaction]);

  const handleUpdateRecurringWithImpact = (id: string, updates: Partial<RecurringTransaction>, impactPast: boolean) => {
    updateRecurring(id, updates);
    if (impactPast) {
      const updatedTransactions = transactions
        .filter(t => t.recurringId === id)
        .map(t => ({
          ...t,
          description: updates.description ?? t.description,
          amount: updates.amount !== undefined ? (t.type === 'expense' ? -Math.abs(updates.amount) : Math.abs(updates.amount)) : t.amount,
          categoryId: updates.categoryId ?? t.categoryId,
        }));
      updatedTransactions.forEach(t => updateTransaction(t.id, t));
    }
  };

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
    if (error) {
      return (
        <div className="flex flex-col items-center justify-center h-96 space-y-4">
          <CloudOff className="w-16 h-16 text-rose-500" />
          <h2 className="text-xl font-bold text-slate-800">Erro de Conexão</h2>
          <p className="text-slate-500 text-center max-w-sm">{error}</p>
          <button onClick={() => window.location.reload()} className="px-6 py-2 bg-blue-600 text-white rounded-xl font-bold">Tentar Novamente</button>
        </div>
      );
    }

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
            onUpdate={updateCategory}
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
            onUpdateRecurring={handleUpdateRecurringWithImpact}
            onCommitRecurring={(item) => addTransactions([generateRecurringTransaction(item, new Date())])}
          />
        );
      default:
        return <Dashboard transactions={transactions} categories={categories} budgets={budgets} />;
    }
  };

  return (
    <Layout activeView={activeView} setActiveView={setActiveView} user={user} onLogout={handleLogout}>
      {loading && (
        <div className="fixed inset-0 z-[100] bg-slate-50/60 backdrop-blur-[2px] flex items-center justify-center">
          <div className="bg-white p-6 rounded-3xl shadow-2xl flex flex-col items-center space-y-4 border border-slate-100">
             <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
             <p className="text-sm font-bold text-slate-600">Sincronizando dados remotos...</p>
          </div>
        </div>
      )}

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