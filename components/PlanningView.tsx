
import React, { useMemo, useState } from 'react';
import { Transaction, Category, Budget, RecurringTransaction, TransactionType } from '../types';
import { Target, AlertCircle, CheckCircle2, TrendingUp, Zap, Plus, Trash2, Repeat, CalendarCheck, Lightbulb, Calendar, Edit3, X, HelpCircle, History, Copy } from 'lucide-react';
import { startOfMonth, endOfMonth, isWithinInterval, parseISO, format, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface PlanningViewProps {
  transactions: Transaction[];
  categories: Category[];
  budgets: Budget[];
  recurring: RecurringTransaction[];
  onUpdateBudget: (categoryId: string, amount: number) => void;
  onAddRecurring: (item: RecurringTransaction) => void;
  onRemoveRecurring: (id: string) => void;
  onUpdateRecurring: (id: string, updates: Partial<RecurringTransaction>, impactPast: boolean) => void;
  onCommitRecurring: (item: RecurringTransaction) => void;
}

const PlanningView: React.FC<PlanningViewProps> = ({ 
  transactions, categories, budgets, recurring, 
  onUpdateBudget, onAddRecurring, onRemoveRecurring, onUpdateRecurring, onCommitRecurring 
}) => {
  const [showRecurringForm, setShowRecurringForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showImpactDialog, setShowImpactDialog] = useState<string | null>(null);
  const [pendingUpdates, setPendingUpdates] = useState<Partial<RecurringTransaction> | null>(null);

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
    { label: 'Salário', type: 'income', cat: 'cat-salario', desc: 'Salário Mensal' },
    { label: 'Stocks/Dividendos', type: 'income', cat: 'cat-stocks', desc: 'Rendimento Stocks' },
    { label: 'Benefícios', type: 'income', cat: 'cat-beneficios', desc: 'Vale Alimentação/Refeição' },
    { label: 'Luz', type: 'expense', cat: 'cat-outras-despesas', desc: 'Conta de Energia' },
    { label: 'Gás', type: 'expense', cat: 'cat-outras-despesas', desc: 'Conta de Gás' },
    { label: 'Condomínio', type: 'expense', cat: 'cat-outras-despesas', desc: 'Taxa de Condomínio' },
    { label: 'Financ. Imobiliário', type: 'expense', cat: 'cat-outras-despesas', desc: 'Parcela Casa' },
    { label: 'Financ. Estudantil', type: 'expense', cat: 'cat-educacao', desc: 'Parcela FIES/Curso' },
  ];

  const now = new Date();
  
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

  // Cálculo da média de gastos dos últimos 12 meses por categoria
  const category12MonthAverage = useMemo(() => {
    const twelveMonthsAgo = subMonths(now, 12);
    const startRange = startOfMonth(twelveMonthsAgo);
    const endRange = endOfMonth(subMonths(now, 1)); // Média até o mês passado para referência estável

    const relevantTransactions = transactions.filter(t => 
      t.type === 'expense' && isWithinInterval(parseISO(t.date), { start: startRange, end: endRange })
    );

    const totals = new Map<string, number>();
    relevantTransactions.forEach(t => {
      totals.set(t.categoryId, (totals.get(t.categoryId) || 0) + Math.abs(t.amount));
    });

    const averages = new Map<string, number>();
    totals.forEach((val, key) => {
      averages.set(key, val / 12);
    });

    return averages;
  }, [transactions, now]);

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

  const handleEditRecurring = (item: RecurringTransaction) => {
    setEditingId(item.id);
    setNewRecurring({
      description: item.description,
      amount: item.amount.toString(),
      categoryId: item.categoryId,
      type: item.type,
      dayOfMonth: item.dayOfMonth,
      startDate: item.startDate || '',
      endDate: item.endDate || ''
    });
    setShowRecurringForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDuplicateRecurring = (item: RecurringTransaction) => {
    setEditingId(null); // Nova transação (cópia)
    setNewRecurring({
      description: `${item.description} (Cópia)`,
      amount: item.amount.toString(),
      categoryId: item.categoryId,
      type: item.type,
      dayOfMonth: item.dayOfMonth,
      startDate: item.startDate || '',
      endDate: item.endDate || ''
    });
    setShowRecurringForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmitRecurring = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRecurring.description || !newRecurring.amount) return;
    
    const updates = {
      description: newRecurring.description,
      amount: parseFloat(newRecurring.amount),
      categoryId: newRecurring.categoryId,
      type: newRecurring.type,
      dayOfMonth: newRecurring.dayOfMonth,
      startDate: newRecurring.startDate || undefined,
      endDate: newRecurring.endDate || undefined
    };

    if (editingId) {
      setPendingUpdates(updates);
      setShowImpactDialog(editingId);
    } else {
      onAddRecurring({
        id: `rec-${Date.now()}`,
        active: true,
        ...updates
      });
      resetForm();
    }
  };

  const confirmUpdate = (impactPast: boolean) => {
    if (showImpactDialog && pendingUpdates) {
      onUpdateRecurring(showImpactDialog, pendingUpdates, impactPast);
      resetForm();
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setShowImpactDialog(null);
    setPendingUpdates(null);
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
            onClick={() => { if(showRecurringForm) resetForm(); else setShowRecurringForm(true); }}
            className={`flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-xl transition-all ${showRecurringForm ? 'bg-slate-200 text-slate-700' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}`}
          >
            {showRecurringForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {showRecurringForm ? 'Cancelar' : 'Novo Template'}
          </button>
        </div>

        {showRecurringForm && (
          <div className="bg-white p-6 rounded-[2rem] border-2 border-blue-100 shadow-xl shadow-blue-50 animate-in slide-in-from-top-4">
            <form onSubmit={handleSubmitRecurring} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <div className="md:col-span-2 space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Descrição</label>
                  <input 
                    required
                    placeholder="Ex: Salário, Aluguel..."
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5 text-sm font-bold focus:ring-4 focus:ring-blue-500/10 focus:bg-white transition-all"
                    value={newRecurring.description}
                    onChange={e => setNewRecurring({...newRecurring, description: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Valor</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">R$</span>
                    <input 
                      required
                      type="number"
                      placeholder="0,00"
                      className="w-full bg-slate-50 border border-slate-100 rounded-xl pl-10 pr-4 py-2.5 text-sm font-bold focus:ring-4 focus:ring-blue-500/10 focus:bg-white transition-all"
                      value={newRecurring.amount}
                      onChange={e => setNewRecurring({...newRecurring, amount: e.target.value})}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Dia Fixo</label>
                  <input 
                    required
                    type="number" min="1" max="31"
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5 text-sm font-bold focus:ring-4 focus:ring-blue-500/10 focus:bg-white transition-all"
                    value={newRecurring.dayOfMonth}
                    onChange={e => setNewRecurring({...newRecurring, dayOfMonth: parseInt(e.target.value)})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Categoria</label>
                  <select 
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5 text-sm font-bold focus:ring-4 focus:ring-blue-500/10 focus:bg-white transition-all"
                    value={newRecurring.categoryId}
                    onChange={e => setNewRecurring({...newRecurring, categoryId: e.target.value})}
                  >
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Tipo</label>
                  <select 
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5 text-sm font-bold focus:ring-4 focus:ring-blue-500/10 focus:bg-white transition-all"
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
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> Data Início (Opcional)
                  </label>
                  <input 
                    type="date"
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5 text-sm font-bold focus:ring-4 focus:ring-blue-500/10 focus:bg-white transition-all"
                    value={newRecurring.startDate}
                    onChange={e => setNewRecurring({...newRecurring, startDate: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> Data Fim (Opcional)
                  </label>
                  <input 
                    type="date"
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5 text-sm font-bold focus:ring-4 focus:ring-blue-500/10 focus:bg-white transition-all"
                    value={newRecurring.endDate}
                    onChange={e => setNewRecurring({...newRecurring, endDate: e.target.value})}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3">
                 <button 
                  type="submit" 
                  className="bg-blue-600 text-white font-black px-10 py-3 rounded-xl hover:bg-blue-700 transition-all text-xs uppercase tracking-widest shadow-xl shadow-blue-200"
                 >
                  {editingId ? 'Salvar Alterações' : 'Criar Regra'}
                </button>
              </div>
            </form>
          </div>
        )}

        {showImpactDialog && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
            <div className="bg-white max-w-sm w-full rounded-[2.5rem] p-8 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-300">
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="p-4 bg-blue-50 text-blue-600 rounded-full">
                  <HelpCircle className="w-10 h-10" />
                </div>
                <h3 className="text-xl font-bold text-slate-900">Aplicar Retroativamente?</h3>
                <p className="text-sm text-slate-500 leading-relaxed">
                  Deseja atualizar todas as transações passadas que já foram geradas por este template ou aplicar apenas daqui para frente?
                </p>
                <div className="grid grid-cols-1 w-full gap-3 mt-4">
                  <button 
                    onClick={() => confirmUpdate(true)}
                    className="w-full bg-blue-600 text-white font-bold py-3.5 rounded-2xl hover:bg-blue-700 transition-all text-sm shadow-lg shadow-blue-200"
                  >
                    Sim, atualizar tudo
                  </button>
                  <button 
                    onClick={() => confirmUpdate(false)}
                    className="w-full bg-slate-900 text-white font-bold py-3.5 rounded-2xl hover:bg-black transition-all text-sm shadow-lg shadow-slate-200"
                  >
                    Apenas futuras
                  </button>
                  <button 
                    onClick={() => setShowImpactDialog(null)}
                    className="w-full text-slate-400 font-bold py-2 text-xs"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
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
                <div key={item.id} className={`p-5 rounded-[1.5rem] border bg-white flex flex-col justify-between group transition-all ${isCommitted ? 'opacity-70 shadow-inner' : 'shadow-sm hover:shadow-md'}`}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-xl ${item.type === 'income' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                        <Repeat className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-800 text-sm truncate max-w-[120px]">{item.description}</h4>
                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Todo dia {item.dayOfMonth}</p>
                      </div>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => handleDuplicateRecurring(item)}
                        title="Duplicar"
                        className="p-1.5 bg-slate-50 text-slate-600 rounded-lg hover:bg-slate-200 transition-all"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        onClick={() => handleEditRecurring(item)}
                        title="Editar"
                        className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-600 hover:text-white transition-all"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => onRemoveRecurring(item.id)} className="p-1.5 text-slate-300 hover:text-rose-500 transition-all">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-auto">
                    <span className="text-sm font-black text-slate-900">{formatCurrency(item.amount)}</span>
                    <div className="flex gap-1">
                        {item.startDate && (
                           <span className="text-[8px] font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full">De {format(parseISO(item.startDate), 'MM/yy')}</span>
                        )}
                        {item.endDate && (
                           <span className="text-[8px] font-bold text-rose-400 bg-rose-50 px-2 py-0.5 rounded-full">Até {format(parseISO(item.endDate), 'MM/yy')}</span>
                        )}
                    </div>
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
            const average = category12MonthAverage.get(cat.id) || 0;
            const percentage = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0;
            const isOver = budget > 0 && spent > budget;
            const remaining = budget - spent;

            return (
              <div key={cat.id} className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm hover:shadow-xl transition-all duration-300">
                <div className="flex items-center justify-between mb-4">
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

                {/* Info de Média Histórica */}
                <div className="mb-6 flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-xl border border-slate-100">
                  <History className="w-3.5 h-3.5 text-slate-400" />
                  <p className="text-[10px] font-bold text-slate-500 truncate">
                    Média 12m: <span className="text-slate-900">{formatCurrency(average)}</span>
                  </p>
                </div>

                <div className="space-y-5">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">R$</span>
                    <input
                      type="number"
                      placeholder="Meta de gasto"
                      className="w-full bg-white border border-slate-200 rounded-2xl pl-10 pr-4 py-3 text-sm font-bold focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:bg-white transition-all shadow-inner"
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
