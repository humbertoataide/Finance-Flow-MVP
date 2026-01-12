
import React, { useMemo, useState } from 'react';
import { Transaction, Category } from '../types';
import { 
  Search, Filter, Plus, FileUp, Trash2, Edit3, ChevronLeft, ChevronRight, 
  ArrowUpRight, ArrowDownLeft, X, Check, Download
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
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
  const [editingId, setEditingId] = useState<string | null>(null);

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const matchesSearch = t.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = typeFilter === 'all' || t.type === typeFilter;
      return matchesSearch && matchesType;
    });
  }, [transactions, searchTerm, typeFilter]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const handleInlineCategoryChange = (id: string, categoryId: string) => {
    onUpdate(id, { categoryId });
    setEditingId(null);
  };

  const exportToCSV = () => {
    const headers = ['Data', 'Descrição', 'Categoria', 'Tipo', 'Valor'];
    const rows = filteredTransactions.map(t => {
      const cat = categories.find(c => c.id === t.categoryId)?.name || 'Sem Categoria';
      return [
        format(parseISO(t.date), 'dd/MM/yyyy'),
        t.description.replace(/,/g, ''),
        cat,
        t.type === 'income' ? 'Receita' : 'Despesa',
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
    <div className="space-y-4">
      <div className="flex flex-col lg:flex-row gap-4 lg:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Pesquisar por descrição..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex bg-white border border-slate-200 rounded-lg p-1">
            <button
              onClick={() => setTypeFilter('all')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${typeFilter === 'all' ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Todos
            </button>
            <button
              onClick={() => setTypeFilter('income')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${typeFilter === 'income' ? 'bg-emerald-50 text-emerald-600' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Receitas
            </button>
            <button
              onClick={() => setTypeFilter('expense')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${typeFilter === 'expense' ? 'bg-rose-50 text-rose-600' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Despesas
            </button>
          </div>

          <button
            onClick={exportToCSV}
            title="Exportar para CSV (Sheets)"
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-all shadow-sm"
          >
            <Download className="w-4 h-4" />
            Exportar
          </button>

          <button
            onClick={onImport}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-all shadow-sm"
          >
            <FileUp className="w-4 h-4" />
            Importar
          </button>

          <button
            onClick={onAdd}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-all shadow-sm shadow-blue-200"
          >
            <Plus className="w-4 h-4" />
            Adicionar
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Data</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Descrição</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Categoria</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Valor</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTransactions.length > 0 ? (
                filteredTransactions.map((t) => {
                  const cat = categories.find(c => c.id === t.categoryId) || categories.find(c => c.id === 'cat-unassigned');
                  return (
                    <tr key={t.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                        {format(parseISO(t.date), 'dd MMM yyyy', { locale: ptBR })}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${t.type === 'income' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                            {t.type === 'income' ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownLeft className="w-3.5 h-3.5" />}
                          </div>
                          <span className="text-sm font-medium text-slate-900">{t.description}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {editingId === t.id ? (
                          <select
                            autoFocus
                            onBlur={() => setEditingId(null)}
                            onChange={(e) => handleInlineCategoryChange(t.id, e.target.value)}
                            className="text-sm bg-white border border-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            defaultValue={t.categoryId}
                          >
                            {categories.map(c => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                        ) : (
                          <button
                            onClick={() => setEditingId(t.id)}
                            className="flex items-center gap-2 text-xs px-2.5 py-1 rounded-full font-medium transition-opacity hover:opacity-80"
                            style={{ backgroundColor: `${cat?.color}15`, color: cat?.color }}
                          >
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cat?.color }} />
                            {cat?.name}
                          </button>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm font-bold text-right">
                        <span className={t.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}>
                          {t.type === 'income' ? '+' : '-'} {formatCurrency(Math.abs(t.amount))}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => onDelete(t.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-all"
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
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500 text-sm italic">
                    Nenhuma transação encontrada. Importe seu extrato para começar!
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
