import React, { useState, useRef } from 'react';
import { 
  X, 
  Upload, 
  Download, 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertTriangle, 
  Info, 
  ArrowRight, 
  Sparkles,
  Layers,
  FileText
} from 'lucide-react';
import { TransactionRule, Category, Account } from '../types';
import { CategoryIcon } from './CategoryIcon';
import { 
  parseRulesFromCSV, 
  downloadSampleRulesTemplate, 
  ParsedRulesResult 
} from '../lib/csvRules';

interface ImportRulesModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  accounts: Account[];
  existingRulesCount: number;
  onConfirmImport: (newRules: TransactionRule[], mode: 'append' | 'replace') => void;
}

export const ImportRulesModal: React.FC<ImportRulesModalProps> = ({
  isOpen,
  onClose,
  categories,
  accounts,
  existingRulesCount,
  onConfirmImport,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [parseResult, setParseResult] = useState<ParsedRulesResult | null>(null);
  const [importMode, setImportMode] = useState<'append' | 'replace'>('append');
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleProcessFile = (selectedFile: File) => {
    if (!selectedFile.name.toLowerCase().endsWith('.csv')) {
      setParseResult({
        rules: [],
        errors: ['Please select a valid CSV (.csv) file.'],
        warnings: [],
        totalRowsParsed: 0,
      });
      setFile(selectedFile);
      return;
    }

    setFile(selectedFile);
    setIsProcessing(true);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = (e.target?.result as string) || '';
      const parsed = parseRulesFromCSV(text, categories, accounts);
      setParseResult(parsed);
      setIsProcessing(false);
    };
    reader.onerror = () => {
      setParseResult({
        rules: [],
        errors: ['Failed to read the file. Please check file permissions and try again.'],
        warnings: [],
        totalRowsParsed: 0,
      });
      setIsProcessing(false);
    };
    reader.readAsText(selectedFile, 'UTF-8');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      handleProcessFile(selected);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      handleProcessFile(droppedFile);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleReset = () => {
    setFile(null);
    setParseResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleConfirm = () => {
    if (!parseResult || parseResult.rules.length === 0) return;
    onConfirmImport(parseResult.rules, importMode);
    onClose();
    handleReset();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div 
        className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                Import Rules from CSV
              </h2>
              <p className="text-xs text-slate-500">
                Bulk upload transaction keyword rules and categorization patterns
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              onClose();
              handleReset();
            }}
            className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 custom-scrollbar">
          {/* Step 1: Upload Dropzone if no valid file yet */}
          {!parseResult || parseResult.rules.length === 0 ? (
            <div className="space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileChange}
                className="hidden"
                id="csv-rules-file-input"
              />

              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-3xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition ${
                  isDragging
                    ? 'border-blue-500 bg-blue-50/60'
                    : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50/60 bg-slate-50/30'
                }`}
              >
                <div className="w-14 h-14 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center mb-3">
                  <FileSpreadsheet className="w-7 h-7" />
                </div>
                <h3 className="text-sm font-bold text-slate-900 mb-1">
                  {file ? file.name : 'Choose a CSV file or drag & drop here'}
                </h3>
                <p className="text-xs text-slate-500 max-w-sm">
                  Upload spreadsheet containing transaction rule names, keywords, match conditions, and categories.
                </p>
                <span className="mt-4 px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 transition">
                  Browse Files
                </span>
              </div>

              {/* Error display if any */}
              {parseResult && parseResult.errors.length > 0 && (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-xs space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-rose-900">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    Could not parse CSV
                  </div>
                  {parseResult.errors.map((err, idx) => (
                    <p key={idx} className="text-rose-700">{err}</p>
                  ))}
                </div>
              )}

              {/* Template Download Help */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="text-xs font-bold text-slate-800">Need a starting template?</span>
                    <p className="text-[11px] text-slate-500">
                      Download our pre-formatted CSV template pre-populated with example rules.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    downloadSampleRulesTemplate(categories, accounts);
                  }}
                  className="px-3 py-2 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 shadow-2xs transition flex items-center gap-1.5 flex-shrink-0 cursor-pointer self-start sm:self-auto"
                >
                  <Download className="w-3.5 h-3.5 text-slate-600" />
                  <span>Download Template</span>
                </button>
              </div>
            </div>
          ) : (
            /* Step 2: Parsed File Preview & Confirmation */
            <div className="space-y-5 animate-fadeIn">
              {/* File Info Strip */}
              <div className="flex items-center justify-between p-3.5 bg-blue-50/70 border border-blue-200 rounded-2xl">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-blue-600" />
                  <div>
                    <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                      <span>{file?.name}</span>
                      <span className="px-2 py-0.5 bg-blue-600 text-white rounded-md text-[10px] font-extrabold">
                        {parseResult.rules.length} Rules Detected
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-500">
                      {parseResult.totalRowsParsed} rows parsed successfully
                    </span>
                  </div>
                </div>
                <button
                  onClick={handleReset}
                  className="text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                >
                  Change File
                </button>
              </div>

              {/* Warnings if any */}
              {parseResult.warnings.length > 0 && (
                <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-amber-800 text-xs space-y-1 max-h-24 overflow-y-auto">
                  <div className="font-bold flex items-center gap-1.5 text-amber-900">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                    Auto-mapping notices ({parseResult.warnings.length}):
                  </div>
                  {parseResult.warnings.map((warn, idx) => (
                    <p key={idx} className="text-[11px] text-amber-700">{warn}</p>
                  ))}
                </div>
              )}

              {/* Import Mode Options */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-800 block">
                  Import Action Mode
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <label
                    onClick={() => setImportMode('append')}
                    className={`flex items-start gap-3 p-3 rounded-2xl border cursor-pointer transition ${
                      importMode === 'append'
                        ? 'border-blue-600 bg-blue-50/50 shadow-xs'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="importMode"
                      checked={importMode === 'append'}
                      onChange={() => setImportMode('append')}
                      className="mt-0.5 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-900">
                        Append to Existing Rules
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Keep your {existingRulesCount} current rules and add these {parseResult.rules.length} rules.
                      </p>
                    </div>
                  </label>

                  <label
                    onClick={() => setImportMode('replace')}
                    className={`flex items-start gap-3 p-3 rounded-2xl border cursor-pointer transition ${
                      importMode === 'replace'
                        ? 'border-amber-600 bg-amber-50/50 shadow-xs'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="importMode"
                      checked={importMode === 'replace'}
                      onChange={() => setImportMode('replace')}
                      className="mt-0.5 text-amber-600 focus:ring-amber-500"
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-900">
                        Replace All Existing Rules
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Overwrite existing {existingRulesCount} rules with these {parseResult.rules.length} rules.
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Rules Preview Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800">
                    Preview Rules ({parseResult.rules.length})
                  </label>
                  <span className="text-[11px] text-slate-400">Showing first {Math.min(parseResult.rules.length, 10)} rules</span>
                </div>

                <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs max-h-56 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 sticky top-0">
                      <tr>
                        <th className="px-3 py-2">Rule Name</th>
                        <th className="px-3 py-2">Keywords</th>
                        <th className="px-3 py-2">Match</th>
                        <th className="px-3 py-2">Category</th>
                        <th className="px-3 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {parseResult.rules.slice(0, 10).map((rule, idx) => {
                        const cat = categories.find((c) => c.id === rule.categoryId);
                        return (
                          <tr key={idx} className="hover:bg-slate-50/80">
                            <td className="px-3 py-2 font-bold text-slate-900 truncate max-w-[130px]">
                              {rule.name}
                            </td>
                            <td className="px-3 py-2 text-slate-600 truncate max-w-[140px]" title={rule.keyword}>
                              <code className="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-mono">
                                {rule.keyword}
                              </code>
                            </td>
                            <td className="px-3 py-2 text-[10px] text-slate-500 capitalize">
                              {rule.matchType.replace('_', ' ')}
                            </td>
                            <td className="px-3 py-2">
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-700">
                                {cat && <CategoryIcon iconName={cat.icon} className="w-3.5 h-3.5 text-blue-600" />}
                                <span className="truncate max-w-[100px]">{cat?.name || rule.categoryId}</span>
                              </span>
                            </td>
                            <td className="px-3 py-2">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  rule.isEnabled
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-slate-100 text-slate-600'
                                }`}
                              >
                                {rule.isEnabled ? 'Enabled' : 'Disabled'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              onClose();
              handleReset();
            }}
            className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
          >
            Cancel
          </button>

          {parseResult && parseResult.rules.length > 0 && (
            <button
              type="button"
              onClick={handleConfirm}
              id="btn-confirm-import-rules"
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition active:scale-95 flex items-center gap-2 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>
                {importMode === 'replace' ? 'Replace All & Import' : 'Append & Import'}{' '}
                ({parseResult.rules.length} Rules)
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
