import React from 'react';
import { LayoutDashboard, ReceiptText, Tags, Target, Menu, X, User as UserIcon } from 'lucide-react';
import { User } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  activeView: 'dashboard' | 'transactions' | 'categories' | 'planning';
  setActiveView: (view: 'dashboard' | 'transactions' | 'categories' | 'planning') => void;
  user: User;
}

const Layout: React.FC<LayoutProps> = ({ children, activeView, setActiveView, user }) => {
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'transactions', label: 'Transações', icon: ReceiptText },
    { id: 'planning', label: 'Planejamento', icon: Target },
    { id: 'categories', label: 'Categorias', icon: Tags },
  ] as const;

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50 text-slate-900">
      {/* Mobile Header */}
      <header className="md:hidden flex items-center justify-between p-4 bg-white border-b border-slate-200">
        <h1 className="text-xl font-bold text-blue-600">FinanceFlow</h1>
        <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2">
          {isSidebarOpen ? <X /> : <Menu />}
        </button>
      </header>

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200 transition-transform md:relative md:translate-x-0
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-6">
          <div className="flex items-center gap-2 mb-1">
             <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white">
                <Target className="w-5 h-5" />
             </div>
             <h1 className="text-xl font-black text-slate-900 tracking-tighter">FinanceFlow</h1>
          </div>
          <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest pl-10">Personal Edition</p>
        </div>

        <nav className="mt-6 px-4 space-y-1">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setActiveView(item.id);
                setIsSidebarOpen(false);
              }}
              className={`
                w-full flex items-center gap-3 px-4 py-3 text-sm font-bold rounded-2xl transition-all
                ${activeView === item.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'text-slate-500 hover:bg-slate-50'}
              `}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="absolute bottom-6 left-4 right-4 space-y-4">
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-200 rounded-xl flex items-center justify-center text-slate-500">
              <UserIcon className="w-5 h-5" />
            </div>
            <div className="flex-1 truncate">
              <p className="text-xs font-black text-slate-900 truncate">{user.name}</p>
              <p className="text-[10px] text-slate-400 truncate">{user.email}</p>
            </div>
          </div>
          
          <div className="p-4 bg-slate-900 rounded-2xl text-white">
            <p className="text-[10px] opacity-70 uppercase font-bold tracking-widest">Acesso Privado</p>
            <p className="text-[9px] mt-1 leading-tight opacity-50">Sistema configurado para uso pessoal.</p>
          </div>
        </div>
      </aside>

      {isSidebarOpen && (
        <div className="fixed inset-0 bg-black/20 z-40 md:hidden backdrop-blur-sm" onClick={() => setIsSidebarOpen(false)} />
      )}

      <main className="flex-1 overflow-auto p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;