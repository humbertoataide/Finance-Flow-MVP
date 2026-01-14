
import React, { useMemo, useState } from 'react';
import { Transaction, Category } from '../types';
import { 
  Search, Filter, Plus, FileUp, Trash2, Edit3, ChevronLeft, ChevronRight, 
  ArrowUpRight, ArrowDownLeft, X, Check, Download, Repeat, Calendar, ListFilter
} from 'lucide-react';
import { format, parseISO, isWithinInterval, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface TransactionGridProps {
  transactions: Transaction[];
  categories: Category[];
  onAdd: () => void;
  onImport: () => void;
  onUpdate: (id: string, updates: Partial<Transaction>) => void;
  onDelete: (id: string) => void;
}

const TransactionGrid: React.FC<TransactionGridProps> = ({ 
  transactions, categories, onAdd, onImport, onUpdate, onDelete 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [recurrenceFilter, setRecurrenceFilter] = useState<'all' | 'fixed' | 'variable'>('all');
  const [dateRange, setDateRange] = useState({
    start: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    end: format(endOfMonth(new Date()), 'yyyy-MM-dd')
  });
  const [editingId, setEditingId] = useState<string | null>(null);

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const matchesSearch = t.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = typeFilter === 'all' || t.type === typeFilter;
      const matchesCategory = categoryFilter === 'all' || t.categoryId === categoryFilter;
      const matchesRecurrence = recurrenceFilter === 'all' || 
        (recurrenceFilter === 'fixed' && t.isRecurring) || 
        (recurrenceFilter === 'variable' && !t.isRecurring);
      
      const tDate = parseISO(t.date);
      const matchesDate = isWithinInterval(tDate, { 
        start: parseISO(dateRange.start), 
        end: parseISO(dateRange.end) 
      });

      return matchesSearch && matchesType && matchesCategory && matchesRecurrence && matchesDate;
    });
  }, [transactions, searchTerm, typeFilter, categoryFilter, recurrenceFilter, dateRange]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const handleInlineCategoryChange = (id: string, categoryId: string) => {
    onUpdate(id, { categoryId });
    setEditingId(null);
  };

  const exportToCSV = () => {
    const headers = ['Data', 'Descrição', 'Categoria', 'Tipo', 'Recorrência', 'Valor'];
    const rows = filteredTransactions.map(t => {
      const cat = categories.find(c => c.id === t.categoryId)?.name || 'Sem Categoria';
      return [
        format(parseISO(t.date), 'dd/MM/yyyy'),
        t.description.replace(/,/g, ''),
        cat,
        t.type === 'income' ? 'Receita' : 'Despesa',
        t.isRecurring ? 'Fixo' : 'Variável',
        t.amount.toString().replace('.', ',')
      ];
    });

    const csvContent = [headers, ...rows].map(e => e.join(',')).join('\n');
    const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `transacoes_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header e Filtros */}
      <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm space-y-6">
        <div className="flex flex-col lg:flex-row gap-4 lg:items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Pesquisar por descrição..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-2xl text-sm font-medium focus:ring-2 focus:ring-blue-500/20 transition-all"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button onClick={onImport} className="p-3 bg-slate-50 text-slate-600 rounded-xl hover:bg-slate-100 transition-all" title="Importar">
              <FileUp className="w-5 h-5" />
            </button>
            <button onClick={exportToCSV} className="p-3 bg-slate-50 text-slate-600 rounded-xl hover:bg-slate-100 transition-all" title="Exportar">
              <Download className="w-5 h-5" />
            </button>
            <button
              onClick={onAdd}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-2xl text-sm font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
            >
              <Plus className="w-5 h-5" />
              Lançar Manual
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-slate-100">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Período</label>
            <div className="flex items-center gap-2">
              <input 
                type="date" 
                value={dateRange.start}
                onChange={(e) => setDateRange({...dateRange, start: e.target.value})}
                className="flex-1 bg-slate-50 border-none rounded-xl px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-slate-300">-</span>
              <input 
                type="date" 
                value={dateRange.end}
                onChange={(e) => setDateRange({...dateRange, end: e.target.value})}
                className="flex-1 bg-slate-50 border-none rounded-xl px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Categoria</label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full bg-slate-50 border-none rounded-xl px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Todas Categorias</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Fluxo</label>
            <div className="flex bg-slate-50 p-1 rounded-xl">
              <button onClick={() => setTypeFilter('all')} className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg transition-all ${typeFilter === 'all' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500'}`}>Tudo</button>
              <button onClick={() => setTypeFilter('income')} className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg transition-all ${typeFilter === 'income' ? 'bg-white shadow-sm text-emerald-600' : 'text-slate-500'}`}>Entradas</button>
              <button onClick={() => setTypeFilter('expense')} className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg transition-all ${typeFilter === 'expense' ? 'bg-white shadow-sm text-rose-600' : 'text-slate-500'}`}>Saídas</button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Recorrência</label>
            <div className="flex bg-slate-50 p-1 rounded-xl">
              <button onClick={() => setRecurrenceFilter('all')} className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg transition-all ${recurrenceFilter === 'all' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500'}`}>Ambos</button>
              <button onClick={() => setRecurrenceFilter('fixed')} className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg transition-all ${recurrenceFilter === 'fixed' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500'}`}>Fixos</button>
              <button onClick={() => setRecurrenceFilter('variable')} className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg transition-all ${recurrenceFilter === 'variable' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}>Variáveis</button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabela de Transações */}
      <div className="bg-white border border-slate-200 rounded-[2rem] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Data</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Descrição</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Categoria</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Tipo</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Valor</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTransactions.length > 0 ? (
                filteredTransactions.map((t) => {
                  const cat = categories.find(c => c.id === t.categoryId) || categories.find(c => c.id === 'cat-unassigned');
                  return (
                    <tr key={t.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-6 py-4 whitespace-nowrap text-xs font-bold text-slate-500">
                        {format(parseISO(t.date), 'dd MMM yyyy', { locale: ptBR })}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-xl ${t.type === 'income' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                            {t.type === 'income' ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownLeft className="w-4 h-4" />}
                          </div>
                          <div>
                            <span className="text-sm font-bold text-slate-900">{t.description}</span>
                            {t.isRecurring && (
                              <div className="flex items-center gap-1 mt-0.5">
                                <Repeat className="w-3 h-3 text-indigo-500" />
                                <span className="text-[9px] font-black text-indigo-500 uppercase tracking-tighter">Custo Fixo</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {editingId === t.id ? (
                          <select
                            autoFocus
                            onBlur={() => setEditingId(null)}
                            onChange={(e) => handleInlineCategoryChange(t.id, e.target.value)}
                            className="text-xs font-bold bg-white border border-slate-200 rounded-lg px-2 py-1 focus:ring-2 focus:ring-blue-500"
                            defaultValue={t.categoryId}
                          >
                            {categories.map(c => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                        ) : (
                          <button
                            onClick={() => setEditingId(t.id)}
                            className="flex items-center gap-2 text-[10px] px-3 py-1.5 rounded-full font-black uppercase tracking-tighter transition-all hover:scale-105"
                            style={{ backgroundColor: `${cat?.color}15`, color: cat?.color }}
                          >
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cat?.color }} />
                            {cat?.name}
                          </button>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                         {t.isRecurring ? (
                           <span className="inline-flex items-center justify-center p-1.5 bg-indigo-50 text-indigo-600 rounded-lg" title="Transação Recorrente">
                              <Repeat className="w-4 h-4" />
                           </span>
                         ) : (
                           <span className="inline-flex items-center justify-center p-1.5 bg-slate-50 text-slate-400 rounded-lg" title="Lançamento Variável">
                              <Calendar className="w-4 h-4" />
                           </span>
                         )}
                      </td>
                      <td className="px-6 py-4 text-sm font-black text-right">
                        <span className={t.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}>
                          {t.type === 'income' ? '+' : '-'} {formatCurrency(Math.abs(t.amount))}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => onDelete(t.id)}
                            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-2 opacity-30">
                       <ListFilter className="w-12 h-12" />
                       <p className="text-sm font-bold italic">Nenhum resultado para os filtros aplicados.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default TransactionGrid;
