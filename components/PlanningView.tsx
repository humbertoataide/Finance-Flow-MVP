
import React, { useMemo, useState } from 'react';
import { Transaction, Category, Budget, RecurringTransaction, TransactionType } from '../types';
import { Target, AlertCircle, CheckCircle2, TrendingUp, Zap, Plus, Trash2, Repeat, CalendarCheck, Lightbulb, Calendar } from 'lucide-react';
import { startOfMonth, endOfMonth, isWithinInterval, parseISO, format } from 'date-fns';
// Added missing ptBR import from date-fns/locale to fix reference error on line 122
import { ptBR } from 'date-fns/locale';

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
    dayOfMonth: 1,
    startDate: '',
    endDate: ''
  });

  const quickSuggestions = [
    // Receitas
    { label: 'Salário', type: 'income', cat: 'cat-salario', desc: 'Salário Mensal' },
    { label: 'Stocks/Dividendos', type: 'income', cat: 'cat-stocks', desc: 'Rendimento Stocks' },
    { label: 'Benefícios', type: 'income', cat: 'cat-beneficios', desc: 'Vale Alimentação/Refeição' },
    // Despesas
    { label: 'Luz', type: 'expense', cat: 'cat-outras-despesas', desc: 'Conta de Energia' },
    { label: 'Gás', type: 'expense', cat: 'cat-outras-despesas', desc: 'Conta de Gás' },
    { label: 'Condomínio', type: 'expense', cat: 'cat-outras-despesas', desc: 'Taxa de Condomínio' },
    { label: 'Financ. Imobiliário', type: 'expense', cat: 'cat-outras-despesas', desc: 'Parcela Casa' },
    { label: 'Financ. Estudantil', type: 'expense', cat: 'cat-educacao', desc: 'Parcela FIES/Curso' },
  ];

  const now = new Date();
  const dayOfMonth = now.getDate();
  const lastDay = endOfMonth(now).getDate();

  const currentMonthTransactions = useMemo(() => {
    const start = startOfMonth(now);
    const end = endOfMonth(now);
    return transactions.filter(t => t.type === 'expense' && isWithinInterval(parseISO(t.date), { start, end }));
  }, [transactions, now]);

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
  }, [transactions, now]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const handleQuickAdd = (s: typeof quickSuggestions[0]) => {
    setNewRecurring({
      ...newRecurring,
      description: s.desc,
      type: s.type as TransactionType,
      categoryId: s.cat
    });
    setShowRecurringForm(true);
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
      active: true,
      startDate: newRecurring.startDate || undefined,
      endDate: newRecurring.endDate || undefined
    });

    setNewRecurring({ 
      description: '', 
      amount: '', 
      categoryId: 'cat-unassigned', 
      type: 'expense', 
      dayOfMonth: 1,
      startDate: '',
      endDate: ''
    });
    setShowRecurringForm(false);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Planejamento e Automação</h2>
          <p className="text-sm text-slate-500">Regras de lançamento automático e metas orçamentárias</p>
        </div>
        <div className="bg-blue-50 px-5 py-2.5 rounded-2xl border border-blue-100 flex items-center gap-3 shadow-sm">
          <CalendarCheck className="w-5 h-5 text-blue-600" />
          <span className="text-sm font-black text-blue-700 uppercase tracking-tighter">Status: {format(now, 'MMMM/yyyy', { locale: ptBR })}</span>
        </div>
      </div>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
             <Repeat className="w-4 h-4" /> Lançamentos Recorrentes
          </h3>
          <button 
            onClick={() => setShowRecurringForm(!showRecurringForm)}
            className="flex items-center gap-2 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-4 py-2 rounded-xl transition-all"
          >
            <Plus className="w-4 h-4" /> Novo Template
          </button>
        </div>

        {showRecurringForm && (
          <div className="bg-white p-6 rounded-[2rem] border-2 border-blue-100 shadow-xl shadow-blue-50 animate-in slide-in-from-top-4">
            <form onSubmit={handleAddRecurring} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <div className="md:col-span-2 space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Descrição</label>
                  <input 
                    required
                    placeholder="Ex: Salário, Aluguel..."
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
                    placeholder="0,00"
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500"
                    value={newRecurring.amount}
                    onChange={e => setNewRecurring({...newRecurring, amount: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Dia Fixo</label>
                  <input 
                    required
                    type="number" min="1" max="31"
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500"
                    value={newRecurring.dayOfMonth}
                    onChange={e => setNewRecurring({...newRecurring, dayOfMonth: parseInt(e.target.value)})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Categoria</label>
                  <select 
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500"
                    value={newRecurring.categoryId}
                    onChange={e => setNewRecurring({...newRecurring, categoryId: e.target.value})}
                  >
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Tipo</label>
                  <select 
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500"
                    value={newRecurring.type}
                    onChange={e => setNewRecurring({...newRecurring, type: e.target.value as TransactionType})}
                  >
                    <option value="expense">Despesa</option>
                    <option value="income">Receita</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1 flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> Data Início (Opcional)
                  </label>
                  <input 
                    type="date"
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500"
                    value={newRecurring.startDate}
                    onChange={e => setNewRecurring({...newRecurring, startDate: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1 flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> Data Fim (Opcional)
                  </label>
                  <input 
                    type="date"
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500"
                    value={newRecurring.endDate}
                    onChange={e => setNewRecurring({...newRecurring, endDate: e.target.value})}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3">
                 <button 
                  type="button"
                  onClick={() => setShowRecurringForm(false)}
                  className="px-6 py-2.5 text-xs font-bold text-slate-500 hover:text-slate-900 transition-all"
                 >
                   Cancelar
                 </button>
                 <button 
                  type="submit" 
                  className="bg-blue-600 text-white font-bold px-8 py-2.5 rounded-xl hover:bg-blue-700 transition-all text-sm shadow-lg shadow-blue-200"
                 >
                  Salvar Regra
                </button>
              </div>
            </form>
          </div>
        )}

        {!showRecurringForm && recurring.length === 0 && (
          <div className="p-8 bg-white rounded-[2rem] border border-slate-200 border-dashed text-center">
            <div className="max-w-2xl mx-auto space-y-4">
              <div className="p-4 bg-blue-50 text-blue-600 rounded-full inline-flex"><Lightbulb className="w-8 h-8" /></div>
              <h4 className="font-bold text-slate-800">Inicie sua automação</h4>
              <p className="text-sm text-slate-500">Adicione suas fontes de renda e contas fixas para que o FinanceFlow lance-as sozinho todo mês.</p>
              <div className="flex flex-wrap justify-center gap-2 mt-4">
                {quickSuggestions.map((s, i) => (
                  <button 
                    key={i} 
                    onClick={() => handleQuickAdd(s)}
                    className="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 bg-slate-100 hover:bg-blue-600 hover:text-white rounded-lg transition-all"
                  >
                    + {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {recurring.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {recurring.map(item => {
              const isCommitted = committedRecurringIds.has(item.description.toLowerCase().trim());
              return (
                <div key={item.id} className={`p-5 rounded-[1.5rem] border bg-white flex flex-col justify-between group transition-all ${isCommitted ? 'opacity-50 grayscale' : 'shadow-sm hover:shadow-md'}`}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-xl ${item.type === 'income' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                        <Repeat className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-800 text-sm">{item.description}</h4>
                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Todo dia {item.dayOfMonth}</p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      {!isCommitted && (
                        <button 
                          onClick={() => onCommitRecurring(item)}
                          title="Lançar agora"
                          className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-600 hover:text-white transition-all"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button onClick={() => onRemoveRecurring(item.id)} className="p-1.5 text-slate-300 hover:text-rose-500 transition-all">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-auto">
                    <span className="text-sm font-black text-slate-900">{formatCurrency(item.amount)}</span>
                    {item.startDate && (
                       <span className="text-[8px] font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full">Desde {format(parseISO(item.startDate), 'MM/yy')}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
           <Target className="w-4 h-4" /> Orçamento por Categoria
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {categories.filter(c => !['cat-salario', 'cat-stocks', 'cat-beneficios', 'cat-unassigned'].includes(c.id)).map(cat => {
            const spent = categorySpending.get(cat.id) || 0;
            const budget = budgets.find(b => b.categoryId === cat.id)?.amount || 0;
            const percentage = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0;
            const isOver = budget > 0 && spent > budget;
            const remaining = budget - spent;

            return (
              <div key={cat.id} className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm hover:shadow-xl transition-all duration-300">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-sm" style={{ backgroundColor: cat.color }}>
                      <Target className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-800">{cat.name}</h3>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Budget Mensal</p>
                    </div>
                  </div>
                  {isOver && <div className="p-2 bg-rose-50 rounded-xl animate-bounce"><AlertCircle className="w-5 h-5 text-rose-500" /></div>}
                </div>

                <div className="space-y-5">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">R$</span>
                    <input
                      type="number"
                      placeholder="Meta de gasto"
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl pl-10 pr-4 py-3 text-sm font-bold focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:bg-white transition-all"
                      value={budget || ''}
                      onChange={(e) => onUpdateBudget(cat.id, parseFloat(e.target.value) || 0)}
                    />
                  </div>

                  <div className="pt-2 space-y-3">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500 font-bold">Consumido</span>
                      <span className={`font-black ${isOver ? 'text-rose-600' : 'text-slate-900'}`}>{formatCurrency(spent)}</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full transition-all duration-1000 ${isOver ? 'bg-rose-500' : 'bg-blue-600'}`} style={{ width: `${percentage}%` }} />
                    </div>
                    {budget > 0 && (
                      <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
                        <span>{remaining >= 0 ? 'Saldo' : 'Excesso'}</span>
                        <span className={remaining >= 0 ? 'text-emerald-600' : 'text-rose-600'}>{formatCurrency(Math.abs(remaining))}</span>
                      </div>
                    )}
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
