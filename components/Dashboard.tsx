
import React, { useMemo, useState } from 'react';
import { Transaction, Category, Budget } from '../types';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend, LabelList
} from 'recharts';
import { 
  TrendingUp, TrendingDown, Wallet, Calendar, Target, Repeat, 
  ArrowRightLeft, Lightbulb, ArrowDownRight, Award, AlertTriangle 
} from 'lucide-react';
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

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { 
      style: 'currency', 
      currency: 'BRL', 
      maximumFractionDigits: 0 
    }).format(value);
  };

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
    const expenses = filteredTransactions.filter(t => t.type === 'expense');
    const totalExpense = expenses.reduce((acc, t) => acc + Math.abs(t.amount), 0);
    
    const fixedExpense = expenses.filter(t => t.isRecurring).reduce((acc, t) => acc + Math.abs(t.amount), 0);
    const variableExpense = totalExpense - fixedExpense;

    return {
      income,
      expense: totalExpense,
      balance: income - totalExpense,
      fixedExpense,
      variableExpense
    };
  }, [filteredTransactions]);

  const topExpenses = useMemo(() => {
    return [...filteredTransactions]
      .filter(t => t.type === 'expense')
      .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
      .slice(0, 10);
  }, [filteredTransactions]);

  const insights = useMemo(() => {
    const list = [];
    const savingsRate = stats.income > 0 ? (stats.balance / stats.income) * 100 : 0;
    const fixedWeight = stats.expense > 0 ? (stats.fixedExpense / stats.expense) * 100 : 0;

    if (savingsRate > 20) {
      list.push({
        title: 'Excelente Poupança',
        desc: `Você poupou ${savingsRate.toFixed(1)}% da sua renda neste período.`,
        icon: Award,
        color: 'text-emerald-600',
        bg: 'bg-emerald-50'
      });
    } else if (savingsRate < 0) {
      list.push({
        title: 'Atenção ao Saldo',
        desc: 'Suas despesas superaram suas receitas no período selecionado.',
        icon: AlertTriangle,
        color: 'text-rose-600',
        bg: 'bg-rose-50'
      });
    }

    if (fixedWeight > 60) {
      list.push({
        title: 'Custos Fixos Altos',
        desc: `Seus custos fixos representam ${fixedWeight.toFixed(1)}% dos gastos totais.`,
        icon: Repeat,
        color: 'text-indigo-600',
        bg: 'bg-indigo-50'
      });
    }

    // Categoria mais cara
    const catMap = new Map<string, number>();
    filteredTransactions.filter(t => t.type === 'expense').forEach(t => {
      catMap.set(t.categoryId, (catMap.get(t.categoryId) || 0) + Math.abs(t.amount));
    });
    
    let maxCat = { id: '', val: 0 };
    catMap.forEach((v, k) => {
      if (v > maxCat.val) maxCat = { id: k, val: v };
    });

    if (maxCat.id) {
      const catName = categories.find(c => c.id === maxCat.id)?.name || 'Sem Categoria';
      list.push({
        title: 'Maior Ofensor',
        desc: `${catName} consumiu ${formatCurrency(maxCat.val)} do seu orçamento.`,
        icon: TrendingDown,
        color: 'text-amber-600',
        bg: 'bg-amber-50'
      });
    }

    return list.slice(0, 3);
  }, [stats, filteredTransactions, categories]);

  const fixedVsVariableData = useMemo(() => [
    { name: 'Gastos Fixos', value: stats.fixedExpense, color: '#6366f1' },
    { name: 'Gastos Variáveis', value: stats.variableExpense, color: '#f43f5e' }
  ], [stats]);

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
        const result = budget - spent;
        return {
          name: cat.name,
          Orçado: budget,
          Realizado: spent,
          Resultado: result,
          resColor: result >= 0 ? '#10b981' : '#ef4444',
          color: cat.color
        };
      })
      .filter(d => d.Orçado > 0 || d.Realizado > 0);
  }, [transactions, categories, budgets]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12">
      {/* Header com Filtros */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Análise Consolidada</h2>
          <p className="text-sm text-slate-500">Insights baseados em {filteredTransactions.length} transações</p>
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
                {p === 'month' ? 'Mês' : p === 'year' ? 'Ano' : p === 'all' ? 'Tudo' : 'Personalizar'}
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

      {/* Insights Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {insights.map((insight, i) => (
          <div key={i} className={`p-5 rounded-[1.8rem] ${insight.bg} border border-white flex items-start gap-4 shadow-sm`}>
            <div className={`p-3 rounded-2xl bg-white shadow-sm ${insight.color}`}>
              <insight.icon className="w-5 h-5" />
            </div>
            <div>
              <h4 className={`text-sm font-bold ${insight.color}`}>{insight.title}</h4>
              <p className="text-xs text-slate-600 mt-1 font-medium leading-relaxed">{insight.desc}</p>
            </div>
          </div>
        ))}
        {insights.length === 0 && (
          <div className="md:col-span-3 p-5 rounded-[1.8rem] bg-blue-50 border border-blue-100 flex items-center gap-4">
             <div className="p-3 rounded-2xl bg-white text-blue-600 shadow-sm">
                <Lightbulb className="w-5 h-5" />
             </div>
             <p className="text-sm font-bold text-blue-800">Tudo certo! Seus gastos estão equilibrados neste período.</p>
          </div>
        )}
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group hover:border-emerald-200 transition-colors">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl group-hover:scale-110 transition-transform">
              <TrendingUp className="w-6 h-6" />
            </div>
            <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full uppercase tracking-widest">Receitas</span>
          </div>
          <p className="text-2xl font-black text-slate-900">{formatCurrency(stats.income)}</p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group hover:border-rose-200 transition-colors">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl group-hover:scale-110 transition-transform">
              <TrendingDown className="w-6 h-6" />
            </div>
            <span className="text-[10px] font-black text-rose-600 bg-rose-50 px-2.5 py-1 rounded-full uppercase tracking-widest">Despesas</span>
          </div>
          <p className="text-2xl font-black text-slate-900">{formatCurrency(stats.expense)}</p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group hover:border-indigo-200 transition-colors">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl group-hover:scale-110 transition-transform">
              <Repeat className="w-6 h-6" />
            </div>
            <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full uppercase tracking-widest">Fixos</span>
          </div>
          <p className="text-2xl font-black text-slate-900">{formatCurrency(stats.fixedExpense)}</p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group hover:border-blue-200 transition-colors">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl group-hover:scale-110 transition-transform">
              <Wallet className="w-6 h-6" />
            </div>
            <span className={`text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-widest ${stats.balance >= 0 ? 'text-blue-600 bg-blue-50' : 'text-rose-600 bg-rose-50'}`}>
              Líquido
            </span>
          </div>
          <p className={`text-2xl font-black ${stats.balance >= 0 ? 'text-slate-900' : 'text-rose-600'}`}>
            {formatCurrency(stats.balance)}
          </p>
        </div>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-8 rounded-[2.2rem] border border-slate-200 shadow-sm">
           <h3 className="text-lg font-bold text-slate-800 mb-8 flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5 text-indigo-500" />
            Comprometimento Financeiro
          </h3>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={fixedVsVariableData}
                  cx="50%"
                  cy="50%"
                  innerRadius={65}
                  outerRadius={105}
                  paddingAngle={10}
                  dataKey="value"
                  stroke="none"
                >
                  {fixedVsVariableData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                  <LabelList 
                    dataKey="value" 
                    position="outside" 
                    formatter={(v: number) => formatCurrency(v)} 
                    style={{ fontSize: '11px', fontWeight: 'bold', fill: '#64748b' }}
                  />
                </Pie>
                <Tooltip 
                  contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.15)', padding: '12px' }}
                  formatter={(value: number) => formatCurrency(value)}
                />
                <Legend iconType="circle" verticalAlign="bottom" wrapperStyle={{ paddingTop: '30px', fontSize: '12px', fontWeight: 'bold' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-8 rounded-[2.2rem] border border-slate-200 shadow-sm">
          <h3 className="text-lg font-bold text-slate-800 mb-8 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-slate-400" />
            Distribuição por Categorias
          </h3>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={distributionData}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={100}
                  paddingAngle={4}
                  dataKey="value"
                  stroke="none"
                >
                  {distributionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.15)', padding: '12px' }}
                  formatter={(value: number) => formatCurrency(value)}
                />
                <Legend layout="vertical" align="right" verticalAlign="middle" iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', maxWidth: '140px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Top 10 Expenses Table */}
      <div className="bg-white p-8 rounded-[2.2rem] border border-slate-200 shadow-sm overflow-hidden">
         <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
            <ArrowDownRight className="w-5 h-5 text-rose-500" />
            Top 10 Maiores Despesas do Período
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Data</th>
                  <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Descrição</th>
                  <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Categoria</th>
                  <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {topExpenses.map((t, i) => {
                  const cat = categories.find(c => c.id === t.categoryId) || categories.find(c => c.id === 'cat-unassigned');
                  return (
                    <tr key={t.id} className="group hover:bg-slate-50/50 transition-colors">
                      <td className="py-4 text-xs font-bold text-slate-400">{format(parseISO(t.date), 'dd/MM/yyyy')}</td>
                      <td className="py-4">
                        <span className="text-sm font-bold text-slate-800">{t.description}</span>
                        {t.isRecurring && <span className="ml-2 text-[8px] font-black text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded uppercase tracking-tighter">Fixo</span>}
                      </td>
                      <td className="py-4">
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-tighter" style={{ color: cat?.color }}>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cat?.color }} />
                          {cat?.name}
                        </span>
                      </td>
                      <td className="py-4 text-sm font-black text-right text-rose-600">
                        {formatCurrency(Math.abs(t.amount))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
      </div>

      {/* Budget vs Actual Horizontal Bar Chart */}
      <div className="bg-white p-8 rounded-[2.2rem] border border-slate-200 shadow-sm">
        <h3 className="text-lg font-bold text-slate-800 mb-8 flex items-center gap-2">
          <Target className="w-5 h-5 text-blue-500" />
          Execução Orçamentária (Mês Atual)
        </h3>
        <div className="h-96 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={budgetVsActualData} layout="vertical" margin={{ left: 20, right: 120 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
              <XAxis type="number" hide />
              <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 'bold', fill: '#64748b' }} width={120} />
              <Tooltip 
                cursor={{ fill: '#f8fafc' }}
                contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.15)' }}
                formatter={(value: number) => formatCurrency(value)}
              />
              <Legend iconType="circle" verticalAlign="top" align="right" wrapperStyle={{ paddingBottom: '30px', fontSize: '11px', fontWeight: 'bold' }} />
              <Bar dataKey="Orçado" fill="#e2e8f0" radius={[0, 8, 8, 0]} barSize={12}>
                 <LabelList dataKey="Orçado" position="right" formatter={(v: number) => v > 0 ? formatCurrency(v) : ''} style={{ fontSize: '10px', fontWeight: 'bold', fill: '#94a3b8' }} />
              </Bar>
              <Bar dataKey="Realizado" fill="#3b82f6" radius={[0, 8, 8, 0]} barSize={12}>
                 <LabelList dataKey="Realizado" position="right" formatter={(v: number) => v > 0 ? formatCurrency(v) : ''} style={{ fontSize: '10px', fontWeight: 'bold', fill: '#3b82f6' }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
