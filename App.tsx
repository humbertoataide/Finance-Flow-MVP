
import React, { useState, useEffect } from 'react';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import TransactionGrid from './components/TransactionGrid';
import CategoryManager from './components/CategoryManager';
import PlanningView from './components/PlanningView';
import ImportWizard from './components/ImportWizard';
import TransactionForm from './components/TransactionForm';
import AuthView from './components/AuthView';
import { useFinanceData } from './hooks/useFinanceData';
import { User } from './types';

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
    addTransactions, 
    updateTransaction, 
    deleteTransaction,
    addCategory,
    deleteCategory,
    updateBudget
  } = useFinanceData(user?.id || null);

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
            onUpdateBudget={updateBudget}
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
