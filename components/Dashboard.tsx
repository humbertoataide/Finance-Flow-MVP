
import React, { useMemo } from 'react';
import { Transaction, Category, Budget } from '../types';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend, LabelList
} from 'recharts';
import { TrendingUp, TrendingDown, Wallet, Calendar, Target, Zap, Repeat, Activity } from 'lucide-react';
import { format, startOfMonth, endOfMonth, isWithinInterval, parseISO, addMonths, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface DashboardProps {
  transactions: Transaction[];
  categories: Category[];
  budgets: Budget[];
}

const Dashboard: React.FC<DashboardProps> = ({ transactions, categories, budgets }) => {
  const [filterPeriod, setFilterPeriod] = React.useState<'month' | 'year' | 'all'>('month');

  const filteredTransactions = useMemo(() => {
    const now = new Date();
    if (filterPeriod === 'all') return transactions;
    
    const start = filterPeriod === 'month' ? startOfMonth(now) : new Date(now.getFullYear(), 0, 1);
    const end = filterPeriod === 'month' ? endOfMonth(now) : new Date(now.getFullYear(), 11, 31);

    return transactions.filter(t => isWithinInterval(parseISO(t.date), { start, end }));
  }, [transactions, filterPeriod]);

  const stats = useMemo(() => {
    const income = filteredTransactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
    const expense = filteredTransactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + Math.abs(t.amount), 0);
    
    const fixedExpense = filteredTransactions.filter(t => t.type === 'expense' && t.isRecurring).reduce((acc, t) => acc + Math.abs(t.amount), 0);
    const variableExpense = expense - fixedExpense;

    return {
      income,
      expense,
      balance: income - expense,
      fixedExpense,
      variableExpense
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
      .filter(c => c.id !== 'cat-unassigned')
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
      const monthKey = format(parseISO(t.date), 'MMM/yy', { locale: ptBR });
      if (!groups[monthKey]) groups[monthKey] = { month: monthKey, income: 0, expense: 0 };
      if (t.type === 'income') groups[monthKey].income += t.amount;
      else groups[monthKey].expense += Math.abs(t.amount);
    });
    return Object.values(groups).reverse().slice(-12);
  }, [transactions]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Resumo Financeiro</h2>
          <p className="text-sm text-slate-500">Acompanhe seu desempenho e metas</p>
        </div>
        <div className="flex gap-2 bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
          {(['month', 'year', 'all'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setFilterPeriod(p)}
              className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
                filterPeriod === p ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {p === 'month' ? 'Mensal' : p === 'year' ? 'Anual' : 'Geral'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl group-hover:scale-110 transition-transform">
              <TrendingUp className="w-6 h-6" />
            </div>
            <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full uppercase tracking-widest">Receitas</span>
          </div>
          <p className="text-2xl font-black text-slate-900">{formatCurrency(stats.income)}</p>
          <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-emerald-50/30 rounded-full blur-2xl" />
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl group-hover:scale-110 transition-transform">
              <TrendingDown className="w-6 h-6" />
            </div>
            <span className="text-[10px] font-black text-rose-600 bg-rose-50 px-2.5 py-1 rounded-full uppercase tracking-widest">Despesas</span>
          </div>
          <p className="text-2xl font-black text-slate-900">{formatCurrency(stats.expense)}</p>
          <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-rose-50/30 rounded-full blur-2xl" />
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl group-hover:scale-110 transition-transform">
              <Repeat className="w-6 h-6" />
            </div>
            <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full uppercase tracking-widest">Contas Fixas</span>
          </div>
          <p className="text-2xl font-black text-slate-900">{formatCurrency(stats.fixedExpense)}</p>
          <p className="text-[10px] text-slate-400 font-bold mt-1">Lançamentos Recorrentes</p>
          <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-indigo-50/30 rounded-full blur-2xl" />
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl group-hover:scale-110 transition-transform">
              <Wallet className="w-6 h-6" />
            </div>
            <span className={`text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-widest ${stats.balance >= 0 ? 'text-blue-600 bg-blue-50' : 'text-rose-600 bg-rose-50'}`}>
              Saldo Líquido
            </span>
          </div>
          <p className={`text-2xl font-black ${stats.balance >= 0 ? 'text-slate-900' : 'text-rose-600'}`}>
            {formatCurrency(stats.balance)}
          </p>
          <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-blue-50/30 rounded-full blur-2xl" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Target className="w-5 h-5 text-blue-500" />
              Metas: Orçado vs Realizado
            </h3>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Este Mês</span>
          </div>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={budgetVsActualData} layout="vertical" margin={{ left: 20, right: 80 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} width={100} />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: number) => formatCurrency(value)}
                />
                <Legend iconType="circle" verticalAlign="top" wrapperStyle={{ paddingBottom: '20px', fontSize: '10px' }} />
                <Bar dataKey="Orçado" fill="#cbd5e1" radius={[0, 4, 4, 0]} barSize={10}>
                   <LabelList dataKey="Orçado" position="right" formatter={(v: number) => v > 0 ? formatCurrency(v) : ''} style={{ fontSize: '9px', fontWeight: 'bold', fill: '#94a3b8' }} />
                </Bar>
                <Bar dataKey="Realizado" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={10}>
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
          <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-slate-400" />
            Evolução Mensal (Últimos 12 Meses)
          </h3>
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
