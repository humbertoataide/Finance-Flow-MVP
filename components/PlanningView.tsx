
import React, { useMemo } from 'react';
import { Transaction, Category, Budget } from '../types';
import { Target, AlertCircle, CheckCircle2, TrendingUp, Zap } from 'lucide-react';
import { startOfMonth, endOfMonth, isWithinInterval, parseISO } from 'date-fns';

interface PlanningViewProps {
  transactions: Transaction[];
  categories: Category[];
  budgets: Budget[];
  onUpdateBudget: (categoryId: string, amount: number) => void;
}

const PlanningView: React.FC<PlanningViewProps> = ({ transactions, categories, budgets, onUpdateBudget }) => {
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

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Planejamento Mensal</h2>
          <p className="text-sm text-slate-500">Defina limites de gastos e veja projeções inteligentes</p>
        </div>
        <div className="bg-blue-50 px-5 py-2.5 rounded-2xl border border-blue-100 flex items-center gap-3 shadow-sm">
          <Target className="w-5 h-5 text-blue-600" />
          <span className="text-sm font-black text-blue-700 uppercase tracking-tighter">Referência: {new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</span>
        </div>
      </div>

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
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Categoria</p>
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
                      <span className={`font-black ${isOver ? 'text-rose-600' : 'text-slate-900'}`}>
                        {formatCurrency(spent)}
                      </span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-1000 ${isOver ? 'bg-rose-500' : 'bg-blue-600'}`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>

                  <div className="space-y-1 opacity-80">
                    <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-slate-400">
                      <span className="flex items-center gap-1"><Zap className="w-3 h-3" /> Projeção</span>
                      <span className={willBeOver ? 'text-amber-600' : 'text-slate-600'}>
                        {formatCurrency(projected)}
                      </span>
                    </div>
                    <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className={`h-full opacity-50 transition-all duration-1000 ${willBeOver ? 'bg-amber-400' : 'bg-slate-400'}`}
                        style={{ width: `${Math.min(projectedPercentage, 100)}%` }}
                      />
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

      {budgets.length === 0 && (
        <div className="bg-white border-2 border-dashed border-slate-200 rounded-[3rem] p-16 text-center shadow-inner">
          <div className="bg-blue-50 w-20 h-20 rounded-[2.5rem] flex items-center justify-center mx-auto mb-6 text-blue-600">
            <TrendingUp className="w-10 h-10" />
          </div>
          <h3 className="text-xl font-black text-slate-800">Ative seu Planejamento</h3>
          <p className="text-sm text-slate-500 max-w-sm mx-auto mt-3 leading-relaxed">
            Defina metas para cada categoria e nosso motor de IA projetará seus gastos até o final do mês.
          </p>
        </div>
      )}
    </div>
  );
};

export default PlanningView;
