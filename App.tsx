
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
    updateCategory,
    deleteCategory,
    updateBudget,
    addRecurring,
    removeRecurring,
    updateRecurring
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

  // Motor de Processamento Automático de Recorrência (Refinado para 12 meses futuros)
  useEffect(() => {
    if (!user || recurring.length === 0) return;

    const today = new Date();
    const pendingLaunches: Transaction[] = [];

    recurring.forEach(item => {
      if (!item.active) return;

      // Se não tiver startDate, limita a 12 meses atrás
      let currentCheck = item.startDate ? parseISO(item.startDate) : startOfMonth(addMonths(today, -12));
      
      // Estende a verificação até 12 meses no futuro (13 meses de janela total a partir de hoje)
      const futureLimit = addMonths(today, 13);
      
      currentCheck = startOfMonth(currentCheck);
      
      while (isBefore(currentCheck, futureLimit)) {
        // Se a data de verificação passou da data final da recorrência, interrompe
        if (item.endDate && isAfter(currentCheck, parseISO(item.endDate))) break;

        const startOfM = startOfMonth(currentCheck);
        const endOfM = endOfMonth(currentCheck);

        // Verifica se já existe lançamento para este item neste mês específico
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
  }, [user, recurring, transactions, addTransactions, generateRecurringTransaction]);

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
