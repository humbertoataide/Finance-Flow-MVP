
import React, { useMemo, useState } from 'react';
import { Transaction, Category, Budget, RecurringTransaction, TransactionType } from '../types';
import { Target, AlertCircle, CheckCircle2, TrendingUp, Zap, Plus, Trash2, Repeat, CalendarCheck } from 'lucide-react';
import { startOfMonth, endOfMonth, isWithinInterval, parseISO, format } from 'date-fns';

interface PlanningViewProps {
  transactions: Transaction[];
  categories: Category[];
  budgets: Budget[];
  recurring: RecurringTransaction[];
  onUpdateBudget: (categoryId: string, amount: number) => void;
  onAddRecurring: (item: RecurringTransaction) => void;
  onRemoveRecurring: (id: string) => void;
  onCommitRecurring: (item: RecurringTransaction) => void;
}

const PlanningView: React.FC<PlanningViewProps> = ({ 
  transactions, categories, budgets, recurring, 
  onUpdateBudget, onAddRecurring, onRemoveRecurring, onCommitRecurring 
}) => {
  const [showRecurringForm, setShowRecurringForm] = useState(false);
  const [newRecurring, setNewRecurring] = useState({
    description: '',
    amount: '',
    categoryId: 'cat-unassigned',
    type: 'expense' as TransactionType,
    dayOfMonth: 1
  });

  const now = new Date();
  const dayOfMonth = now.getDate();
  const lastDay = endOfMonth(now).getDate();

  const currentMonthTransactions = useMemo(() => {
    const start = startOfMonth(now);
    const end = endOfMonth(now);
    return transactions.filter(t => t.type === 'expense' && isWithinInterval(parseISO(t.date), { start, end }));
  }, [transactions]);

  const categorySpending = useMemo(() => {
    const map = new Map<string, number>();
    currentMonthTransactions.forEach(t => {
      map.set(t.categoryId, (map.get(t.categoryId) || 0) + Math.abs(t.amount));
    });
    return map;
  }, [currentMonthTransactions]);

  const committedRecurringIds = useMemo(() => {
    const start = startOfMonth(now);
    const end = endOfMonth(now);
    const thisMonth = transactions.filter(t => isWithinInterval(parseISO(t.date), { start, end }));
    return new Set(thisMonth.map(t => t.description.toLowerCase().trim()));
  }, [transactions]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const handleAddRecurring = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRecurring.description || !newRecurring.amount) return;
    onAddRecurring({
      id: `rec-${Date.now()}`,
      description: newRecurring.description,
      amount: parseFloat(newRecurring.amount),
      categoryId: newRecurring.categoryId,
      type: newRecurring.type,
      dayOfMonth: newRecurring.dayOfMonth,
      active: true
    });
    setNewRecurring({ description: '', amount: '', categoryId: 'cat-unassigned', type: 'expense', dayOfMonth: 1 });
    setShowRecurringForm(false);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Planejamento e Recorrência</h2>
          <p className="text-sm text-slate-500">Controle suas despesas fixas e metas de orçamento</p>
        </div>
        <div className="bg-blue-50 px-5 py-2.5 rounded-2xl border border-blue-100 flex items-center gap-3 shadow-sm">
          <CalendarCheck className="w-5 h-5 text-blue-600" />
          <span className="text-sm font-black text-blue-700 uppercase tracking-tighter">Hoje: {format(now, 'dd/MM/yyyy')}</span>
        </div>
      </div>

      {/* Recurring Templates Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
             <Repeat className="w-4 h-4" /> Contas Fixas & Recorrências
          </h3>
          <button 
            onClick={() => setShowRecurringForm(!showRecurringForm)}
            className="flex items-center gap-2 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-4 py-2 rounded-xl transition-all"
          >
            <Plus className="w-4 h-4" /> Nova Recorrência
          </button>
        </div>

        {showRecurringForm && (
          <div className="bg-white p-6 rounded-[2rem] border-2 border-blue-100 shadow-xl shadow-blue-50 animate-in slide-in-from-top-4">
            <form onSubmit={handleAddRecurring} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
              <div className="md:col-span-2 space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Descrição (ex: Aluguel)</label>
                <input 
                  required
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500"
                  value={newRecurring.description}
                  onChange={e => setNewRecurring({...newRecurring, description: e.target.value})}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Valor</label>
                <input 
                  required
                  type="number"
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500"
                  value={newRecurring.amount}
                  onChange={e => setNewRecurring({...newRecurring, amount: e.target.value})}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Dia</label>
                <input 
                  required
                  type="number" min="1" max="31"
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500"
                  value={newRecurring.dayOfMonth}
                  onChange={e => setNewRecurring({...newRecurring, dayOfMonth: parseInt(e.target.value)})}
                />
              </div>
              <button type="submit" className="bg-blue-600 text-white font-bold py-2.5 rounded-xl hover:bg-blue-700 transition-all text-sm">
                Salvar
              </button>
            </form>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {recurring.map(item => {
            const isCommitted = committedRecurringIds.has(item.description.toLowerCase().trim());
            return (
              <div key={item.id} className={`p-5 rounded-[1.5rem] border bg-white flex items-center justify-between group transition-all ${isCommitted ? 'opacity-50 grayscale' : 'shadow-sm hover:shadow-md'}`}>
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-xl ${item.type === 'income' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                    <Repeat className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800 text-sm">{item.description}</h4>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Dia {item.dayOfMonth} • {formatCurrency(item.amount)}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  {!isCommitted && (
                    <button 
                      onClick={() => onCommitRecurring(item)}
                      title="Lançar este mês"
                      className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-600 hover:text-white transition-all"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                    </button>
                  )}
                  <button onClick={() => onRemoveRecurring(item.id)} className="p-2 text-slate-300 hover:text-rose-500 transition-all">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
          {recurring.length === 0 && !showRecurringForm && (
            <div className="col-span-full py-10 text-center bg-slate-50 border-2 border-dashed border-slate-200 rounded-[2rem]">
               <p className="text-sm text-slate-400 font-medium">Cadastre suas contas recorrentes (Salário, Aluguel, etc) para automação.</p>
            </div>
          )}
        </div>
      </section>

      {/* Budget Goals Section */}
      <section className="space-y-4">
        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
           <Target className="w-4 h-4" /> Metas por Categoria
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {categories.filter(c => c.id !== 'cat-unassigned').map(cat => {
            const spent = categorySpending.get(cat.id) || 0;
            const budget = budgets.find(b => b.categoryId === cat.id)?.amount || 0;
            const projected = dayOfMonth > 0 ? (spent / dayOfMonth) * lastDay : 0;
            const percentage = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0;
            const projectedPercentage = budget > 0 ? (projected / budget) * 100 : 0;
            const isOver = budget > 0 && spent > budget;
            const willBeOver = budget > 0 && projected > budget;
            const remaining = budget - spent;

            return (
              <div key={cat.id} className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm hover:shadow-xl hover:border-blue-100 transition-all duration-300 group">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-sm" style={{ backgroundColor: cat.color }}>
                      <Target className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-800">{cat.name}</h3>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Orçamento</p>
                    </div>
                  </div>
                  {isOver ? (
                    <div className="p-2 bg-rose-50 rounded-xl"><AlertCircle className="w-5 h-5 text-rose-500" /></div>
                  ) : willBeOver ? (
                    <div className="p-2 bg-amber-50 rounded-xl animate-pulse"><Zap className="w-5 h-5 text-amber-500" /></div>
                  ) : budget > 0 && (
                    <div className="p-2 bg-emerald-50 rounded-xl"><CheckCircle2 className="w-5 h-5 text-emerald-500" /></div>
                  )}
                </div>

                <div className="space-y-5">
                  <div>
                    <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                      <span>Definir Meta</span>
                      <span className="text-slate-900">{formatCurrency(budget)}</span>
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">R$</span>
                      <input
                        type="number"
                        placeholder="0,00"
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl pl-10 pr-4 py-3 text-sm font-bold focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:bg-white transition-all"
                        value={budget || ''}
                        onChange={(e) => onUpdateBudget(cat.id, parseFloat(e.target.value) || 0)}
                      />
                    </div>
                  </div>

                  <div className="pt-2 space-y-4">
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500 font-bold">Consumo Atual</span>
                        <span className={`font-black ${isOver ? 'text-rose-600' : 'text-slate-900'}`}>{formatCurrency(spent)}</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full transition-all duration-1000 ${isOver ? 'bg-rose-500' : 'bg-blue-600'}`} style={{ width: `${percentage}%` }} />
                      </div>
                    </div>

                    <div className="space-y-1 opacity-80">
                      <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-slate-400">
                        <span className="flex items-center gap-1"><Zap className="w-3 h-3" /> Projeção Final</span>
                        <span className={willBeOver ? 'text-amber-600' : 'text-slate-600'}>{formatCurrency(projected)}</span>
                      </div>
                      <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full opacity-50 transition-all duration-1000 ${willBeOver ? 'bg-amber-400' : 'bg-slate-400'}`} style={{ width: `${Math.min(projectedPercentage, 100)}%` }} />
                      </div>
                    </div>

                    <div className="mt-4 p-3 bg-slate-50 rounded-2xl flex items-center justify-between">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        {budget > 0 ? (remaining >= 0 ? 'Disponível' : 'Excedido') : 'Sem Meta'}
                      </span>
                      <span className={`text-xs font-black ${remaining >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {budget > 0 ? formatCurrency(Math.abs(remaining)) : '—'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};

export default PlanningView;
