
import React, { useState, useRef, useEffect } from 'react';
import { Transaction, ImportMapping, ParseResult, Category } from '../types';
import { Upload, X, ChevronRight, AlertCircle, Sparkles, Loader2 } from 'lucide-react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { GoogleGenAI } from "@google/genai";

interface ImportWizardProps {
  onClose: () => void;
  onImport: (transactions: Transaction[]) => void;
  categories: Category[];
}

const ImportWizard: React.FC<ImportWizardProps> = ({ onClose, onImport, categories }) => {
  const [step, setStep] = useState<'upload' | 'mapping' | 'preview'>('upload');
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [mapping, setMapping] = useState<ImportMapping>({ 
    dateCol: -1, 
    descriptionCol: -1, 
    valueCol: -1,
    categoryCol: -1 
  });
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sugestão automática de mapeamento quando os headers são carregados
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

  const aiCategorize = async (transactionsToProcess: Transaction[]) => {
    try {
      const unassignedItems = transactionsToProcess.filter(t => t.categoryId === 'cat-unassigned');
      if (unassignedItems.length === 0) return transactionsToProcess;

      // Limita a 100 descrições únicas para evitar timeouts e excesso de tokens
      const uniqueDescriptions = Array.from(new Set(unassignedItems.map(t => t.description))).slice(0, 100);
      
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const availableCategories = categories
        .filter(c => c.id !== 'cat-unassigned')
        .map(c => `${c.name} (id: ${c.id})`)
        .join(', ');

      const prompt = `Classifique estas transações. Use apenas os IDs fornecidos.
      Categorias: ${availableCategories}.
      Responda APENAS JSON: {"desc": "id_cat"}.
      Transações: ${uniqueDescriptions.join(', ')}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: { responseMimeType: 'application/json' }
      });

      const suggestions = JSON.parse(response.text || '{}');
      return transactionsToProcess.map(t => {
        if (t.categoryId === 'cat-unassigned' && suggestions[t.description]) {
          return { ...t, categoryId: suggestions[t.description] };
        }
        return t;
      });
    } catch (err) {
      return transactionsToProcess;
    }
  };

  const processImport = async () => {
    if (!parseResult) return;
    setIsProcessing(true);
    setProgress(0);
    
    const results: Transaction[] = [];
    const rows = parseResult.rows;
    const chunkSize = 200; // Processa em lotes para não travar a UI
    
    const processChunk = (startIndex: number): Promise<void> => {
      return new Promise((resolve) => {
        const endIndex = Math.min(startIndex + chunkSize, rows.length);
        
        for (let i = startIndex; i < endIndex; i++) {
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
            const catName = String(catRaw).trim().toLowerCase();
            const matchedCat = categories.find(c => c.name.toLowerCase() === catName);
            if (matchedCat) finalCatId = matchedCat.id;
          }

          results.push({
            id: `import-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 4)}`,
            date: finalDate,
            description: String(descRaw).trim(),
            amount: value,
            type: value >= 0 ? 'income' : 'expense',
            categoryId: finalCatId
          });
        }

        setProgress(Math.round((endIndex / rows.length) * 100));

        if (endIndex < rows.length) {
          setTimeout(() => resolve(processChunk(endIndex)), 0);
        } else {
          resolve();
        }
      });
    };

    try {
      await processChunk(0);
      const refinedResults = await aiCategorize(results);
      onImport(refinedResults);
      onClose();
    } catch (err) {
      setError('Erro ao processar arquivo. Tente um formato mais simples.');
    } finally {
      setIsProcessing(false);
    }
  };

  const isMappingValid = mapping.dateCol !== -1 && mapping.descriptionCol !== -1 && mapping.valueCol !== -1;

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
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">Módulo de Importação Inteligente</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            disabled={isProcessing} 
            className="p-2 hover:bg-slate-100 rounded-xl transition-all disabled:opacity-30"
          >
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
                  <p className="text-xl font-bold text-slate-800">Arraste seu arquivo aqui</p>
                  <p className="text-sm text-slate-500">Extratos CSV, Excel (XLSX) de qualquer banco</p>
                </div>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileUpload} 
                  accept=".csv,.xlsx,.xls" 
                  className="hidden" 
                />
              </div>

              {error && (
                <div className="p-4 bg-rose-50 text-rose-600 rounded-2xl flex gap-3 text-sm font-semibold border border-rose-100 animate-in slide-in-from-top-4">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  {error}
                </div>
              )}

              <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex gap-4 items-start">
                <div className="p-2 bg-amber-50 rounded-xl">
                  <Sparkles className="w-5 h-5 text-amber-500" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-bold text-slate-800">Mapeamento Automático</p>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Nosso sistema identifica automaticamente as colunas de data, valor e descrição. Você só precisa confirmar!
                  </p>
                </div>
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
                    <div className="relative group">
                      <select
                        className={`w-full bg-white border-2 rounded-2xl px-4 py-3.5 text-sm font-medium focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all appearance-none cursor-pointer ${
                          mapping[field.key as keyof ImportMapping] === -1 && field.required ? 'border-slate-100 text-slate-400' : 'border-blue-100 text-slate-900'
                        }`}
                        value={mapping[field.key as keyof ImportMapping]}
                        onChange={(e) => setMapping({ ...mapping, [field.key]: parseInt(e.target.value) })}
                      >
                        <option value={-1}>Ignorar esta coluna</option>
                        {parseResult.headers.map((h, i) => (
                          <option key={i} value={i}>{h || `Coluna ${i + 1}`}</option>
                        ))}
                      </select>
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-300">
                        <ChevronRight className="w-4 h-4 rotate-90" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Amostra dos Dados</h3>
                  <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">{parseResult.rows.length} linhas detectadas</span>
                </div>
                <div className="bg-white border border-slate-100 rounded-[2rem] overflow-hidden shadow-sm">
                  <div className="bg-slate-50/50 grid grid-cols-4 border-b border-slate-100 px-6 py-3 text-[9px] font-bold text-slate-400 uppercase tracking-tighter">
                    <div>Data</div>
                    <div>Descrição</div>
                    <div>Categoria</div>
                    <div className="text-right">Valor</div>
                  </div>
                  <div className="divide-y divide-slate-50 max-h-40 overflow-y-auto">
                    {parseResult.rows.slice(0, 5).map((row, i) => (
                      <div key={i} className="grid grid-cols-4 px-6 py-3 bg-white text-[11px] text-slate-600 items-center">
                        <div className="truncate font-mono font-medium">{row[mapping.dateCol] || '—'}</div>
                        <div className="truncate font-bold text-slate-800">{row[mapping.descriptionCol] || '—'}</div>
                        <div className="truncate italic text-slate-400">{mapping.categoryCol !== -1 ? (row[mapping.categoryCol] || 'Vazio') : 'N/A'}</div>
                        <div className="text-right font-black text-slate-900">{row[mapping.valueCol] || '—'}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-slate-100 flex items-center justify-between bg-white">
          <div className="flex flex-col">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
              {step === 'upload' ? 'Passo 1: Envio' : 'Passo 2: Mapeamento'}
            </p>
            {isProcessing && (
              <div className="mt-1 flex items-center gap-2">
                <div className="w-24 h-1 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-600 transition-all duration-300" style={{ width: `${progress}%` }} />
                </div>
                <span className="text-[9px] font-bold text-blue-600">{progress}%</span>
              </div>
            )}
          </div>
          <div className="flex gap-4">
            <button 
              onClick={onClose} 
              disabled={isProcessing}
              className="px-6 py-3 text-xs font-bold text-slate-400 hover:text-slate-900 transition-colors disabled:opacity-30"
            >
              Cancelar
            </button>
            {step === 'mapping' && (
              <button
                disabled={!isMappingValid || isProcessing}
                onClick={processImport}
                className={`flex items-center gap-2 px-10 py-3.5 rounded-2xl text-xs font-black text-white transition-all shadow-xl min-w-[200px] justify-center ${
                  isMappingValid && !isProcessing ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-200 hover:-translate-y-0.5' : 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none'
                }`}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    Confirmar e Importar
                    <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImportWizard;
