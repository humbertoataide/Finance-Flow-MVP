import React, { useState, useRef, useEffect } from 'react';
import { Transaction, ImportMapping, ParseResult, Category } from '../types';
import { Upload, X, ChevronRight, AlertCircle, Sparkles, Loader2, Check, BrainCircuit, Repeat, Calendar } from 'lucide-react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { GoogleGenAI } from "@google/genai";
import { format, parseISO, getMonth } from 'date-fns';

interface ImportWizardProps {
  onClose: () => void;
  onImport: (transactions: Transaction[]) => void;
  categories: Category[];
  existingTransactions: Transaction[];
}

const ImportWizard: React.FC<ImportWizardProps> = ({ onClose, onImport, categories, existingTransactions }) => {
  const [step, setStep] = useState<'upload' | 'mapping' | 'ai-review' | 'processing'>('upload');
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [mapping, setMapping] = useState<ImportMapping>({ 
    dateCol: -1, 
    descriptionCol: -1, 
    valueCol: -1,
    categoryCol: -1 
  });
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<Record<string, string>>({});
  const [tempTransactions, setTempTransactions] = useState<Transaction[]>([]);
  const [detectedRecurrences, setDetectedRecurrences] = useState<Set<string>>(new Set());
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (parseResult && step === 'mapping') {
      const headers = parseResult.headers.map(h => String(h).toLowerCase().trim());
      const newMapping = { ...mapping };

      const keywords = {
        date: ['data', 'date', 'vencimento', 'transação', 'dia'],
        description: ['descrição', 'descritivo', 'histórico', 'memo', 'detalhe', 'estabelecimento', 'description', 'history'],
        value: ['valor', 'quantia', 'amount', 'preço', 'total', 'lançamento', 'value'],
        category: ['categoria', 'category', 'tipo', 'classificação', 'grupo']
      };

      headers.forEach((header, index) => {
        if (keywords.date.some(k => header.includes(k)) && newMapping.dateCol === -1) newMapping.dateCol = index;
        if (keywords.description.some(k => header.includes(k)) && newMapping.descriptionCol === -1) newMapping.descriptionCol = index;
        if (keywords.value.some(k => header.includes(k)) && newMapping.valueCol === -1) newMapping.valueCol = index;
        if (keywords.category.some(k => header.includes(k)) && newMapping.categoryCol === -1) newMapping.categoryCol = index;
      });

      setMapping(newMapping);
    }
  }, [parseResult, step]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.name.endsWith('.csv')) {
      Papa.parse(file, {
        header: false,
        skipEmptyLines: true,
        complete: (results) => {
          const rows = results.data as string[][];
          if (rows.length < 2) {
            setError('Arquivo vazio ou com formato inválido.');
            return;
          }
          setParseResult({ headers: rows[0], rows: rows.slice(1) }); 
          setStep('mapping');
        },
        error: (err) => setError(err.message)
      });
    } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const bstr = evt.target?.result;
          const wb = XLSX.read(bstr, { type: 'binary' });
          const wsname = wb.SheetNames[0];
          const ws = wb.Sheets[wsname];
          const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as string[][];
          if (data.length < 2) {
            setError('Arquivo Excel vazio ou com formato inválido.');
            return;
          }
          setParseResult({ headers: data[0] as string[], rows: data.slice(1) as string[][] });
          setStep('mapping');
        } catch (err) {
          setError('Erro ao ler arquivo Excel.');
        }
      };
      reader.readAsBinaryString(file);
    } else {
      setError('Formato de arquivo não suportado. Use CSV ou XLSX.');
    }
  };

  const parseFlexibleDate = (val: any): string => {
    if (!val) return new Date().toISOString().split('T')[0];
    if (val instanceof Date) return val.toISOString().split('T')[0];
    const s = String(val).trim();
    let match = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    if (match) {
      let [_, d, m, y] = match;
      if (y.length === 2) {
        const yearInt = parseInt(y);
        const prefix = yearInt <= 40 ? '20' : '19';
        y = prefix + y;
      }
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    match = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
    if (match) {
      let [_, y, m, d] = match;
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
    return new Date().toISOString().split('T')[0];
  };

  const detectRecurrences = (imported: Transaction[]) => {
    const newDetected = new Set<string>();
    const normalizedHistory = existingTransactions.reduce((acc, t) => {
      const key = t.description.toLowerCase().trim();
      if (!acc[key]) acc[key] = new Set();
      acc[key].add(getMonth(parseISO(t.date)));
      return acc;
    }, {} as Record<string, Set<number>>);

    imported.forEach(t => {
      const key = t.description.toLowerCase().trim();
      const currentMonth = getMonth(parseISO(t.date));
      
      // Se já existe no histórico em meses diferentes
      if (normalizedHistory[key] && (normalizedHistory[key].size > 1 || !normalizedHistory[key].has(currentMonth))) {
        newDetected.add(key);
      }
      
      // Keywords comuns de custo fixo
      const fixedKeywords = ['aluguel', 'netflix', 'spotify', 'condominio', 'internet', 'claro', 'vivo', 'tim', 'academia'];
      if (fixedKeywords.some(k => key.includes(k))) {
        newDetected.add(key);
      }
    });

    setDetectedRecurrences(newDetected);
  };

  const generateAISuggestions = async (transactions: Transaction[]) => {
    detectRecurrences(transactions);
    
    const unassignedItems = transactions.filter(t => t.categoryId === 'cat-unassigned');
    if (unassignedItems.length === 0) {
      setTempTransactions(transactions.map(t => ({
        ...t,
        isRecurring: detectedRecurrences.has(t.description.toLowerCase().trim())
      })));
      setStep('ai-review');
      return;
    }

    setIsProcessing(true);
    try {
      const uniqueDescriptions = Array.from(new Set(unassignedItems.map(t => t.description))).slice(0, 50);
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const availableCategories = categories
        .filter(c => c.id !== 'cat-unassigned')
        .map(c => `${c.name} (id: ${c.id})`)
        .join(', ');

      const prompt = `Classifique estas transações bancárias. Use apenas os IDs fornecidos.
      Categorias Disponíveis: ${availableCategories}.
      Entradas: ${uniqueDescriptions.join(', ')}.
      Retorne APENAS um objeto JSON plano onde a chave é a descrição e o valor é o id da categoria: {"DESC": "ID_CAT"}. Se não souber, ignore a chave.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: { responseMimeType: 'application/json' }
      });

      // Fix: response.text is a getter property. Handle potential undefined/unknown types.
      const rawText = response.text || '{}';
      const suggestions = JSON.parse(rawText);
      setAiSuggestions(suggestions);
      setTempTransactions(transactions);
      setStep('ai-review');
    } catch (err) {
      console.error(err);
      setTempTransactions(transactions);
      setStep('ai-review');
    } finally {
      setIsProcessing(false);
    }
  };

  const processMapping = async () => {
    if (!parseResult) return;
    setIsProcessing(true);
    
    const results: Transaction[] = [];
    const rows = parseResult.rows;
    
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const dateRaw = row[mapping.dateCol];
      const descRaw = row[mapping.descriptionCol];
      const valueRaw = row[mapping.valueCol];
      const catRaw = mapping.categoryCol !== -1 ? row[mapping.categoryCol] : null;

      if (!dateRaw || !descRaw || !valueRaw) continue;

      let value = 0;
      if (typeof valueRaw === 'number') {
        value = valueRaw;
      } else {
        const cleanVal = String(valueRaw).replace(/[^\d.,-]/g, '').replace(',', '.');
        value = parseFloat(cleanVal);
        const valUpper = String(valueRaw).toUpperCase();
        if (valUpper.includes('D')) value = -Math.abs(value);
        if (valUpper.includes('C')) value = Math.abs(value);
      }

      const finalDate = parseFlexibleDate(dateRaw);
      let finalCatId = 'cat-unassigned';
      if (catRaw) {
        // Fix for Error line 356: Property 'toLowerCase' does not exist on type 'unknown'.
        // Cast catRaw to any before calling toString/toLowerCase to handle potential typing issues.
        const catName = String(catRaw || '').trim().toLowerCase();
        const matchedCat = categories.find(c => c.name.toLowerCase() === catName);
        if (matchedCat) finalCatId = matchedCat.id;
      }

      results.push({
        id: `import-${Date.now()}-${i}`,
        date: finalDate,
        description: String(descRaw).trim(),
        amount: value,
        type: value >= 0 ? 'income' : 'expense',
        categoryId: finalCatId
      });
    }

    // Fix for Error line 375: Argument of type 'unknown' is not assignable to parameter of type 'string'.
    // Ensure results is treated as Transaction[] before passing to generateAISuggestions.
    await generateAISuggestions(results);
  };

  const toggleRecurrence = (desc: string) => {
    const key = desc.toLowerCase().trim();
    const next = new Set(detectedRecurrences);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setDetectedRecurrences(next);
  };

  const applySuggestions = () => {
    const final = tempTransactions.map(t => {
      const key = t.description.toLowerCase().trim();
      let catId = t.categoryId;
      if (catId === 'cat-unassigned' && aiSuggestions[t.description]) {
        catId = aiSuggestions[t.description];
      }
      return { 
        ...t, 
        categoryId: catId,
        isRecurring: detectedRecurrences.has(key)
      };
    });
    onImport(final);
    onClose();
  };

  const isMappingValid = mapping.dateCol !== -1 && mapping.descriptionCol !== -1 && mapping.valueCol !== -1;

  const groupedByDesc = Array.from(new Set(tempTransactions.map(t => t.description)));

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl flex flex-col max-h-[90vh] border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600 rounded-2xl shadow-lg shadow-blue-200">
               <Upload className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 leading-tight">Importar Extrato</h2>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">Módulo de IA Financeira</p>
            </div>
          </div>
          <button onClick={onClose} disabled={isProcessing} className="p-2 hover:bg-slate-100 rounded-xl transition-all">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="p-8 flex-1 overflow-y-auto bg-slate-50/30">
          {step === 'upload' && (
            <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
              <div 
                onClick={() => !isProcessing && fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-200 rounded-[2rem] p-16 flex flex-col items-center justify-center gap-6 hover:border-blue-400 hover:bg-blue-50/50 transition-all cursor-pointer group bg-white shadow-sm"
              >
                <div className="p-6 bg-blue-50 text-blue-600 rounded-[2rem] group-hover:scale-110 group-hover:bg-blue-600 group-hover:text-white transition-all duration-500 shadow-inner">
                  <Upload className="w-10 h-10" />
                </div>
                <div className="text-center space-y-2">
                  <p className="text-xl font-bold text-slate-800">Selecione seu extrato</p>
                  <p className="text-sm text-slate-500">CSV ou XLSX de qualquer banco nacional</p>
                </div>
                <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".csv,.xlsx,.xls" className="hidden" />
              </div>
            </div>
          )}

          {step === 'mapping' && parseResult && (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-8 duration-500">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-6">
                {[
                  { key: 'dateCol', label: 'Coluna de Data', required: true },
                  { key: 'descriptionCol', label: 'Coluna de Descrição', required: true },
                  { key: 'valueCol', label: 'Coluna de Valor', required: true },
                  { key: 'categoryCol', label: 'Coluna de Categoria (Opcional)', required: false },
                ].map((field) => (
                  <div key={field.key} className="space-y-2.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center justify-between px-1">
                      {field.label}
                      {field.required && <span className="text-rose-500 text-[8px] font-black">Mandatório</span>}
                    </label>
                    <select
                      className="w-full bg-white border-2 rounded-2xl px-4 py-3.5 text-sm font-medium focus:outline-none focus:ring-4 focus:ring-blue-500/10 border-blue-100"
                      value={mapping[field.key as keyof ImportMapping]}
                      onChange={(e) => setMapping({ ...mapping, [field.key]: parseInt(e.target.value) })}
                    >
                      <option value={-1}>Ignorar esta coluna</option>
                      {parseResult.headers.map((h, i) => (
                        <option key={i} value={i}>{h || `Coluna ${i + 1}`}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 'ai-review' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-500">
              <div className="bg-blue-600 text-white p-6 rounded-[2rem] shadow-xl shadow-blue-200 relative overflow-hidden">
                <Sparkles className="absolute -right-4 -top-4 w-24 h-24 opacity-20 rotate-12" />
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <BrainCircuit className="w-6 h-6" />
                  Revisão de Classificação e Tipo
                </h3>
                <p className="text-sm opacity-90 mt-1">Defina o que é custo fixo e confira as categorias sugeridas.</p>
              </div>

              <div className="bg-white rounded-[2rem] border border-slate-200 overflow-hidden shadow-sm">
                <div className="max-h-[25rem] overflow-y-auto divide-y divide-slate-100">
                  {groupedByDesc.map((desc, idx) => {
                    const key = desc.toLowerCase().trim();
                    const isRec = detectedRecurrences.has(key);
                    const catId = tempTransactions.find(t => t.description === desc)?.categoryId || 'cat-unassigned';
                    const suggestedCatId = aiSuggestions[desc] || catId;
                    const cat = categories.find(c => c.id === suggestedCatId);
                    
                    return (
                      <div key={idx} className="p-4 flex items-center justify-between bg-white hover:bg-slate-50 transition-colors">
                        <div className="flex-1 min-w-0 pr-4">
                          <p className="text-xs font-bold text-slate-800 truncate">{desc}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[9px] font-black px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: cat?.color || '#94a3b8' }}>
                              {cat?.name}
                            </span>
                            {aiSuggestions[desc] && <Sparkles className="w-3 h-3 text-blue-500" />}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <button
                            onClick={() => toggleRecurrence(desc)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border-2 transition-all ${isRec ? 'bg-indigo-50 border-indigo-200 text-indigo-600 shadow-sm' : 'bg-white border-slate-100 text-slate-400'}`}
                          >
                            {isRec ? <Repeat className="w-3 h-3" /> : <Calendar className="w-3 h-3" />}
                            <span className="text-[10px] font-black uppercase tracking-tighter">
                              {isRec ? 'Fixo' : 'Variável'}
                            </span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-slate-100 flex items-center justify-between bg-white">
          <div className="flex flex-col">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
              {step === 'upload' ? 'Passo 1: Envio' : step === 'mapping' ? 'Passo 2: Configuração' : 'Passo 3: Revisão Final'}
            </p>
            {isProcessing && (
              <div className="mt-1 flex items-center gap-2">
                <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
                <span className="text-[9px] font-bold text-blue-600">Processando Inteligência...</span>
              </div>
            )}
          </div>
          <div className="flex gap-4">
            <button onClick={onClose} disabled={isProcessing} className="px-6 py-3 text-xs font-bold text-slate-400 hover:text-slate-900 transition-colors">
              Cancelar
            </button>
            {step === 'mapping' && (
              <button
                disabled={!isMappingValid || isProcessing}
                onClick={processMapping}
                className="px-10 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-black shadow-xl shadow-blue-200 transition-all disabled:opacity-50"
              >
                Analisar Padrões
              </button>
            )}
            {step === 'ai-review' && (
              <button
                onClick={applySuggestions}
                className="px-10 py-3.5 bg-slate-900 hover:bg-black text-white rounded-2xl text-xs font-black shadow-xl shadow-slate-200 transition-all"
              >
                Importar {tempTransactions.length} Lançamentos
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImportWizard;