
import React, { useMemo, useState } from 'react';
import { Transaction, Category, Budget } from '../types';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend, LabelList
} from 'recharts';
import { TrendingUp, TrendingDown, Wallet, Calendar, Target, Zap, Repeat, Filter } from 'lucide-react';
import { format, startOfMonth, endOfMonth, isWithinInterval, parseISO, startOfYear } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface DashboardProps {
  transactions: Transaction[];
  categories: Category[];
  budgets: Budget[];
}

const Dashboard: React.FC<DashboardProps> = ({ transactions, categories, budgets }) => {
  const [filterPeriod, setFilterPeriod] = useState<'month' | 'year' | 'all' | 'custom'>('month');
  const [customRange, setCustomRange] = useState({
    start: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    end: format(new Date(), 'yyyy-MM-dd')
  });

  const filteredTransactions = useMemo(() => {
    const now = new Date();
    let start: Date;
    let end: Date;

    if (filterPeriod === 'all') return transactions;
    
    if (filterPeriod === 'month') {
      start = startOfMonth(now);
      end = endOfMonth(now);
    } else if (filterPeriod === 'year') {
      start = startOfYear(now);
      end = endOfMonth(new Date(now.getFullYear(), 11, 31));
    } else {
      start = parseISO(customRange.start);
      end = parseISO(customRange.end);
    }

    return transactions.filter(t => isWithinInterval(parseISO(t.date), { start, end }));
  }, [transactions, filterPeriod, customRange]);

  const stats = useMemo(() => {
    const income = filteredTransactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
    const expense = filteredTransactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + Math.abs(t.amount), 0);
    
    const fixedExpense = filteredTransactions.filter(t => t.type === 'expense' && t.isRecurring).reduce((acc, t) => acc + Math.abs(t.amount), 0);

    return {
      income,
      expense,
      balance: income - expense,
      fixedExpense,
    };
  }, [filteredTransactions]);

  const distributionData = useMemo(() => {
    const catMap = new Map<string, number>();
    filteredTransactions.filter(t => t.type === 'expense').forEach(t => {
      catMap.set(t.categoryId, (catMap.get(t.categoryId) || 0) + Math.abs(t.amount));
    });

    return Array.from(catMap.entries()).map(([catId, value]) => {
      const cat = categories.find(c => c.id === catId) || categories.find(c => c.id === 'cat-unassigned');
      return {
        name: cat?.name || 'Desconhecido',
        value,
        color: cat?.color || '#94a3b8'
      };
    }).sort((a, b) => b.value - a.value);
  }, [filteredTransactions, categories]);

  const budgetVsActualData = useMemo(() => {
    const now = new Date();
    const start = startOfMonth(now);
    const end = endOfMonth(now);
    
    const monthExpenses = transactions.filter(t => 
      t.type === 'expense' && isWithinInterval(parseISO(t.date), { start, end })
    );

    const spentMap = new Map<string, number>();
    monthExpenses.forEach(t => {
      spentMap.set(t.categoryId, (spentMap.get(t.categoryId) || 0) + Math.abs(t.amount));
    });

    return categories
      .filter(c => !['cat-salario', 'cat-stocks', 'cat-beneficios', 'cat-unassigned'].includes(c.id))
      .map(cat => {
        const spent = spentMap.get(cat.id) || 0;
        const budget = budgets.find(b => b.categoryId === cat.id)?.amount || 0;
        return {
          name: cat.name,
          Orçado: budget,
          Realizado: spent,
          color: cat.color
        };
      })
      .filter(d => d.Orçado > 0 || d.Realizado > 0);
  }, [transactions, categories, budgets]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { 
      style: 'currency', 
      currency: 'BRL', 
      maximumFractionDigits: 0 
    }).format(value);
  };

  const timelineData = useMemo(() => {
    const groups: Record<string, { month: string, income: number, expense: number }> = {};
    transactions.forEach(t => {
      const date = parseISO(t.date);
      const monthKey = format(date, 'MMM/yy', { locale: ptBR });
      if (!groups[monthKey]) groups[monthKey] = { month: monthKey, income: 0, expense: 0 };
      if (t.type === 'income') groups[monthKey].income += t.amount;
      else groups[monthKey].expense += Math.abs(t.amount);
    });
    return Object.values(groups).reverse().slice(-12);
  }, [transactions]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Análise Consolidada</h2>
          <p className="text-sm text-slate-500">Acompanhe seu fluxo de caixa e orçamentos</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex bg-slate-100 p-1 rounded-xl">
            {(['month', 'year', 'all', 'custom'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setFilterPeriod(p)}
                className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${
                  filterPeriod === p ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {p === 'month' ? 'Mês' : p === 'year' ? 'Ano' : p === 'all' ? 'Tudo' : 'Custom'}
              </button>
            ))}
          </div>

          {filterPeriod === 'custom' && (
            <div className="flex items-center gap-2 animate-in slide-in-from-right-2">
              <input 
                type="date" 
                value={customRange.start}
                onChange={(e) => setCustomRange({...customRange, start: e.target.value})}
                className="bg-slate-50 border-none rounded-lg px-2 py-1 text-[10px] font-bold focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-slate-400 text-[10px] font-bold">até</span>
              <input 
                type="date" 
                value={customRange.end}
                onChange={(e) => setCustomRange({...customRange, end: e.target.value})}
                className="bg-slate-50 border-none rounded-lg px-2 py-1 text-[10px] font-bold focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
              <TrendingUp className="w-6 h-6" />
            </div>
            <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full uppercase tracking-widest">Receitas</span>
          </div>
          <p className="text-2xl font-black text-slate-900">{formatCurrency(stats.income)}</p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl">
              <TrendingDown className="w-6 h-6" />
            </div>
            <span className="text-[10px] font-black text-rose-600 bg-rose-50 px-2.5 py-1 rounded-full uppercase tracking-widest">Despesas</span>
          </div>
          <p className="text-2xl font-black text-slate-900">{formatCurrency(stats.expense)}</p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
              <Repeat className="w-6 h-6" />
            </div>
            <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full uppercase tracking-widest">Custos Fixos</span>
          </div>
          <p className="text-2xl font-black text-slate-900">{formatCurrency(stats.fixedExpense)}</p>
          <p className="text-[10px] text-slate-400 font-bold mt-1">Lançamentos de Template</p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
              <Wallet className="w-6 h-6" />
            </div>
            <span className={`text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-widest ${stats.balance >= 0 ? 'text-blue-600 bg-blue-50' : 'text-rose-600 bg-rose-50'}`}>
              Saldo Líquido
            </span>
          </div>
          <p className={`text-2xl font-black ${stats.balance >= 0 ? 'text-slate-900' : 'text-rose-600'}`}>
            {formatCurrency(stats.balance)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Target className="w-5 h-5 text-blue-500" />
              Metas: Orçado vs Realizado
            </h3>
          </div>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={budgetVsActualData} layout="vertical" margin={{ left: 20, right: 90 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} width={110} />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: number) => formatCurrency(value)}
                />
                <Legend iconType="circle" verticalAlign="top" align="right" wrapperStyle={{ paddingBottom: '20px', fontSize: '10px' }} />
                <Bar dataKey="Orçado" fill="#cbd5e1" radius={[0, 4, 4, 0]} barSize={12}>
                   <LabelList dataKey="Orçado" position="right" formatter={(v: number) => v > 0 ? formatCurrency(v) : ''} style={{ fontSize: '9px', fontWeight: 'bold', fill: '#94a3b8' }} />
                </Bar>
                <Bar dataKey="Realizado" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={12}>
                   <LabelList dataKey="Realizado" position="right" formatter={(v: number) => v > 0 ? formatCurrency(v) : ''} style={{ fontSize: '9px', fontWeight: 'bold', fill: '#3b82f6' }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-slate-400" />
            Gastos por Categoria
          </h3>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={distributionData}
                  cx="50%"
                  cy="50%"
                  innerRadius={65}
                  outerRadius={95}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${formatCurrency(value)}`}
                >
                  {distributionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} strokeWidth={2} stroke="#fff" />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: number) => formatCurrency(value)}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
             <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
               <TrendingUp className="w-5 h-5 text-slate-400" />
               Evolução Histórica (Últimos 12 Meses)
             </h3>
          </div>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={timelineData} margin={{ top: 30, right: 30, left: 20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} hide />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: number) => [formatCurrency(value), '']}
                />
                <Legend iconType="circle" verticalAlign="top" wrapperStyle={{ paddingBottom: '30px', fontSize: '11px' }} />
                <Bar dataKey="income" name="Receita" fill="#10b981" radius={[6, 6, 0, 0]} barSize={40}>
                  <LabelList dataKey="income" position="top" formatter={(v: number) => v > 0 ? formatCurrency(v) : ''} style={{ fontSize: '10px', fontWeight: 'bold', fill: '#10b981' }} />
                </Bar>
                <Bar dataKey="expense" name="Despesa" fill="#ef4444" radius={[6, 6, 0, 0]} barSize={40}>
                  <LabelList dataKey="expense" position="top" formatter={(v: number) => v > 0 ? formatCurrency(v) : ''} style={{ fontSize: '10px', fontWeight: 'bold', fill: '#ef4444' }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
