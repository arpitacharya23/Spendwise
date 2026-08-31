import React, { useState, useMemo } from 'react';
import { 
  Sparkles, 
  Plus, 
  Search, 
  Edit3, 
  Trash2, 
  X, 
  Check, 
  RotateCcw, 
  SlidersHorizontal,
  Layers,
  ArrowRight,
  Zap,
  Tag,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Play,
  RotateCw,
  Clock,
  Filter,
  CheckCheck,
  CreditCard,
  Wallet,
  Download,
  Upload,
  FileSpreadsheet
} from 'lucide-react';
import { Category, Account, Transaction, TransactionRule, UserProfile, RuleMatchType } from '../types';
import { CategoryIcon } from './CategoryIcon';
import { findMatchingRule, checkKeywordMatch } from '../lib/ruleEngine';
import { initialRules } from '../data/initialRules';
import { exportRulesToCSV } from '../lib/csvRules';
import { ImportRulesModal } from './ImportRulesModal';

interface RulesViewProps {
  user: UserProfile;
  rules: TransactionRule[];
  categories: Category[];
  accounts: Account[];
  transactions: Transaction[];
  onAddRule: (rule: TransactionRule) => void;
  onEditRule: (ruleId: string, updatedData: Partial<TransactionRule>) => void;
  onDeleteRule: (ruleId: string) => void;
  onToggleRule: (ruleId: string) => void;
  onImportRules?: (importedRules: TransactionRule[], mode: 'append' | 'replace') => void;
  onApplyRulesToAll: () => { modifiedCount: number } | number;
  onResetDefaultRules?: () => void;
  onResetRules?: () => void;
}

export const RulesView: React.FC<RulesViewProps> = ({
  user,
  rules,
  categories,
  accounts,
  transactions,
  onAddRule,
  onEditRule,
  onDeleteRule,
  onToggleRule,
  onImportRules,
  onApplyRulesToAll,
  onResetDefaultRules,
  onResetRules,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'enabled' | 'disabled'>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterMatchType, setFilterMatchType] = useState<string>('all');

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<TransactionRule | null>(null);
  const [deletingRule, setDeletingRule] = useState<TransactionRule | null>(null);

  // Form states
  const [formName, setFormName] = useState('');
  const [formKeyword, setFormKeyword] = useState('');
  const [formMatchType, setFormMatchType] = useState<RuleMatchType>('contains');
  const [formCategoryId, setFormCategoryId] = useState(categories[0]?.id || 'cat-1');
  const [formAccountId, setFormAccountId] = useState<string>('');
  const [formType, setFormType] = useState<'expense' | 'income' | ''>('expense');
  const [formIsEnabled, setFormIsEnabled] = useState(true);

  // Interactive Live Rule Tester State
  const [testInput, setTestInput] = useState('');
  const [bulkApplySuccessToast, setBulkApplySuccessToast] = useState<string | null>(null);

  // Filtered rules
  const filteredRules = useMemo(() => {
    return rules.filter(rule => {
      // Search
      const q = (searchQuery || '').toLowerCase();
      const matchesSearch = !q || (
        (rule.name || '').toLowerCase().includes(q) ||
        (rule.keyword || '').toLowerCase().includes(q)
      );
      if (!matchesSearch) return false;

      // Status
      if (filterStatus === 'enabled' && !rule.isEnabled) return false;
      if (filterStatus === 'disabled' && rule.isEnabled) return false;

      // Category
      if (filterCategory !== 'all' && rule.categoryId !== filterCategory) return false;

      // Match type
      if (filterMatchType !== 'all' && rule.matchType !== filterMatchType) return false;

      return true;
    });
  }, [rules, searchQuery, filterStatus, filterCategory, filterMatchType]);

  // Statistics
  const activeCount = rules.filter(r => r.isEnabled).length;
  const totalMatches = rules.reduce((sum, r) => sum + (r.matchCount || 0), 0);

  // Live test result for interactive tester
  const testMatchResult = useMemo(() => {
    if (!testInput.trim()) return null;
    return findMatchingRule(testInput.trim(), rules);
  }, [testInput, rules]);

  // Open Add Modal
  const handleOpenAddModal = () => {
    setFormName('');
    setFormKeyword('');
    setFormMatchType('contains');
    setFormCategoryId(categories[0]?.id || 'cat-1');
    setFormAccountId('');
    setFormType('expense');
    setFormIsEnabled(true);
    setIsAddModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (rule: TransactionRule) => {
    setEditingRule(rule);
    setFormName(rule.name);
    setFormKeyword(rule.keyword);
    setFormMatchType(rule.matchType);
    setFormCategoryId(rule.categoryId);
    setFormAccountId(rule.accountId || '');
    setFormType(rule.transactionType || '');
    setFormIsEnabled(rule.isEnabled);
  };

  // Submit Add
  const handleSubmitAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formKeyword.trim()) return;

    const newRule: TransactionRule = {
      id: `rule-${Date.now()}`,
      name: formName.trim(),
      keyword: formKeyword.trim(),
      matchType: formMatchType,
      categoryId: formCategoryId,
      accountId: formAccountId || undefined,
      transactionType: formType ? (formType as 'expense' | 'income') : undefined,
      isEnabled: formIsEnabled,
      createdAt: new Date().toISOString().split('T')[0],
      matchCount: 0,
    };

    onAddRule(newRule);
    setIsAddModalOpen(false);
  };

  // Submit Edit
  const handleSubmitEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRule || !formName.trim() || !formKeyword.trim()) return;

    onEditRule(editingRule.id, {
      name: formName.trim(),
      keyword: formKeyword.trim(),
      matchType: formMatchType,
      categoryId: formCategoryId,
      accountId: formAccountId || undefined,
      transactionType: formType ? (formType as 'expense' | 'income') : undefined,
      isEnabled: formIsEnabled,
    });

    setEditingRule(null);
  };

  // Confirm Delete
  const handleConfirmDelete = () => {
    if (!deletingRule) return;
    onDeleteRule(deletingRule.id);
    setDeletingRule(null);
  };

  // Export Rules to CSV
  const handleExportCSV = () => {
    if (rules.length === 0) {
      setBulkApplySuccessToast('There are no rules to export.');
      setTimeout(() => setBulkApplySuccessToast(null), 3000);
      return;
    }
    exportRulesToCSV(rules, categories, accounts);
    setBulkApplySuccessToast(`Exported ${rules.length} transaction rules to CSV.`);
    setTimeout(() => setBulkApplySuccessToast(null), 3500);
  };

  // Confirm Import
  const handleConfirmImport = (importedRules: TransactionRule[], mode: 'append' | 'replace') => {
    if (onImportRules) {
      onImportRules(importedRules, mode);
    } else {
      // Fallback
      if (mode === 'replace') {
        // clear and add
        importedRules.forEach(r => onAddRule(r));
      } else {
        importedRules.forEach(r => onAddRule(r));
      }
    }
    const count = importedRules.length;
    setBulkApplySuccessToast(
      mode === 'replace'
        ? `Replaced all rules with ${count} imported rule${count > 1 ? 's' : ''} from CSV.`
        : `Successfully imported ${count} new rule${count > 1 ? 's' : ''} from CSV.`
    );
    setTimeout(() => setBulkApplySuccessToast(null), 4500);
  };

  // Apply to all transactions handler
  const handleRunBulkRules = () => {
    const result = onApplyRulesToAll();
    const modifiedCount = typeof result === 'object' && result !== null ? result.modifiedCount : Number(result || 0);
    setBulkApplySuccessToast(
      modifiedCount > 0 
        ? `Applied active rules: ${modifiedCount} transaction${modifiedCount > 1 ? 's were' : ' was'} categorized automatically!`
        : `All transactions are already categorized matching your active rules.`
    );
    setTimeout(() => {
      setBulkApplySuccessToast(null);
    }, 4500);
  };

  // Human readable match type label
  const getMatchTypeLabel = (type: RuleMatchType) => {
    switch (type) {
      case 'contains':
        return 'Contains text';
      case 'starts_with':
        return 'Starts with';
      case 'exact':
        return 'Exact match';
      default:
        return type;
    }
  };

  const handleReset = onResetDefaultRules || onResetRules || (() => {});

  return (
    <div className="space-y-6 pb-12 animate-fadeIn">
      {/* Toast Notification */}
      {bulkApplySuccessToast && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-3 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-xl border border-slate-700 animate-fadeIn">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
          <span className="text-xs sm:text-sm font-semibold">{bulkApplySuccessToast}</span>
          <button 
            onClick={() => setBulkApplySuccessToast(null)}
            className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Metrics Strip & Action Buttons on the Same Line */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-2.5">
        {/* KPI Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 flex-1">
          <div className="bg-white rounded-xl px-3.5 py-2 border border-slate-200 shadow-2xs hover:shadow-xs transition flex flex-col justify-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total Rules</span>
            <div className="text-sm font-extrabold text-slate-900 mt-0.5 leading-tight">
              {rules.length}
            </div>
          </div>

          <div className="bg-white rounded-xl px-3.5 py-2 border border-slate-200 shadow-2xs hover:shadow-xs transition flex flex-col justify-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Active</span>
            <div className="text-sm font-extrabold text-emerald-700 mt-0.5 leading-tight">
              {activeCount}
            </div>
          </div>

          <div className="bg-white rounded-xl px-3.5 py-2 border border-slate-200 shadow-2xs hover:shadow-xs transition flex flex-col justify-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700">Matched</span>
            <div className="text-sm font-extrabold text-blue-700 mt-0.5 leading-tight">
              {totalMatches}
            </div>
          </div>

          <div className="bg-white rounded-xl px-3.5 py-2 border border-slate-200 shadow-2xs hover:shadow-xs transition flex flex-col justify-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700">Categories</span>
            <div className="text-sm font-extrabold text-indigo-700 mt-0.5 leading-tight">
              {new Set(rules.map(r => r.categoryId)).size}
            </div>
          </div>
        </div>

        {/* Action Toolbar */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap justify-end flex-shrink-0">
          <button
            onClick={handleExportCSV}
            id="btn-export-rules-csv"
            className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold shadow-2xs transition active:scale-95 cursor-pointer"
            title="Download rules as a CSV spreadsheet"
          >
            <Download className="w-3.5 h-3.5 text-slate-600" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => setIsImportModalOpen(true)}
            id="btn-import-rules-csv"
            className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold shadow-2xs transition active:scale-95 cursor-pointer"
            title="Import rules from a CSV file"
          >
            <Upload className="w-3.5 h-3.5 text-blue-600" />
            <span>Import CSV</span>
          </button>

          <button
            onClick={handleReset}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
            title="Restore default pre-configured rules"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Defaults</span>
          </button>

          <button
            onClick={handleRunBulkRules}
            id="btn-run-all-rules"
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold shadow-2xs transition active:scale-95 cursor-pointer"
            title="Scan and apply rules retroactively to all transactions"
          >
            <Zap className="w-3.5 h-3.5 text-emerald-600" />
            <span>Apply to All</span>
          </button>

          <button
            onClick={handleOpenAddModal}
            id="btn-add-rule-main"
            className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-2xs transition active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Rule</span>
          </button>
        </div>
      </div>

      {/* Interactive Rule Tester Playground */}
      <div className="bg-gradient-to-br from-blue-50/70 via-indigo-50/40 to-slate-50 border border-blue-200/80 rounded-3xl p-5 shadow-xs">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-2xs">
              <Play className="w-4 h-4 fill-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Live Rule Tester & Simulator</h2>
              <p className="text-[11px] text-slate-600">Type any merchant name or title to verify which rule and category will match.</p>
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-col sm:flex-row gap-3 items-stretch">
          <div className="relative flex-1">
            <input
              type="text"
              value={testInput}
              onChange={(e) => setTestInput(e.target.value)}
              placeholder="e.g. Starbucks Caramel Macchiato, Uber ride to airport, Amazon electronics order"
              className="w-full pl-3.5 pr-10 py-2.5 bg-white border border-blue-200 rounded-xl text-xs sm:text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
            />
            {testInput && (
              <button
                onClick={() => setTestInput('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Live Test Outcome */}
        {testInput.trim() && (
          <div className="mt-3 p-3.5 rounded-2xl bg-white border border-blue-200/90 shadow-xs animate-fadeIn">
            {testMatchResult ? (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0">
                    <Check className="w-4 h-4 stroke-[3]" />
                  </div>
                  <div>
                    <div className="font-bold text-slate-900 flex items-center gap-2">
                      <span>Matched Rule: <strong className="text-blue-600 font-extrabold">{testMatchResult.rule.name}</strong></span>
                      <span className="text-[10px] bg-slate-100 text-slate-700 font-mono px-1.5 py-0.5 rounded border border-slate-200">
                        Keyword: "{testMatchResult.matchedKeyword}"
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      New transactions with this title will be automatically categorized.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto">
                  {(() => {
                    const targetCat = categories.find(c => c.id === testMatchResult.suggestedCategoryId);
                    return targetCat ? (
                      <span
                        className="px-3 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs border"
                        style={{
                          backgroundColor: `${targetCat.color}15`,
                          color: targetCat.color,
                          borderColor: `${targetCat.color}35`,
                        }}
                      >
                        <CategoryIcon iconName={targetCat.icon} className="w-3.5 h-3.5" />
                        <span>{targetCat.name}</span>
                      </span>
                    ) : null;
                  })()}

                  {testMatchResult.suggestedAccountId && (() => {
                    const targetAcc = accounts.find(a => a.id === testMatchResult.suggestedAccountId);
                    return targetAcc ? (
                      <span className="px-2.5 py-1 bg-slate-100 text-slate-800 rounded-xl text-xs font-semibold border border-slate-200 flex items-center gap-1">
                        <Wallet className="w-3 h-3 text-slate-500" />
                        <span>{targetAcc.name}</span>
                      </span>
                    ) : null;
                  })()}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2.5 text-xs text-slate-600">
                <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                <span>No active rule matched <strong className="text-slate-800">"{testInput}"</strong>. You can click "+ Add Rule" above to create one.</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Status Filter */}
          <div className="flex items-center p-1 bg-slate-100/80 rounded-xl border border-slate-200/60 w-full sm:w-auto">
            <button
              onClick={() => setFilterStatus('all')}
              className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                filterStatus === 'all'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Rules ({rules.length})
            </button>
            <button
              onClick={() => setFilterStatus('enabled')}
              className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                filterStatus === 'enabled'
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/50 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Active ({activeCount})
            </button>
            <button
              onClick={() => setFilterStatus('disabled')}
              className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                filterStatus === 'disabled'
                  ? 'bg-slate-200 text-slate-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Paused ({rules.length - activeCount})
            </button>
          </div>

          {/* Category & Match Type Filter + Search */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            {/* Category Filter */}
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="bg-slate-50 text-xs font-bold text-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 focus:outline-none cursor-pointer"
            >
              <option value="all">All Categories</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>

            {/* Match Type Filter */}
            <select
              value={filterMatchType}
              onChange={(e) => setFilterMatchType(e.target.value)}
              className="bg-slate-50 text-xs font-bold text-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 focus:outline-none cursor-pointer"
            >
              <option value="all">All Match Types</option>
              <option value="contains">Contains Word</option>
              <option value="starts_with">Starts With</option>
              <option value="exact">Exact Match</option>
            </select>

            {/* Search Box */}
            <div className="relative w-full sm:w-60">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search rules or keywords..."
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Rules List Cards */}
      <div className="space-y-3">
        {filteredRules.map((rule) => {
          const targetCategory = categories.find(c => c.id === rule.categoryId);
          const targetAccount = rule.accountId ? accounts.find(a => a.id === rule.accountId) : null;
          const keywordsList = (rule.keyword || '').split(/[,;]+/).map(k => k.trim()).filter(Boolean);

          return (
            <div
              key={rule.id}
              className={`bg-white rounded-2xl border p-4.5 transition flex flex-col justify-between shadow-2xs hover:shadow-xs group ${
                rule.isEnabled ? 'border-slate-200/90 hover:border-slate-300' : 'border-slate-200/60 bg-slate-50/40 opacity-75'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                {/* Left: Rule Name, Keyword Chips, and Match Logic */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    {/* Toggle Switch */}
                    <button
                      onClick={() => onToggleRule(rule.id)}
                      id={`toggle-rule-${rule.id}`}
                      className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        rule.isEnabled ? 'bg-emerald-500' : 'bg-slate-300'
                      }`}
                      title={rule.isEnabled ? 'Click to disable rule' : 'Click to enable rule'}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          rule.isEnabled ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>

                    <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                      <span>{rule.name}</span>
                      {!rule.isEnabled && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-200 text-slate-700">
                          Paused
                        </span>
                      )}
                    </h3>

                    {/* Match Type Badge */}
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                      {getMatchTypeLabel(rule.matchType)}
                    </span>

                    {/* Match Count Badge */}
                    {rule.matchCount !== undefined && rule.matchCount > 0 && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1">
                        <Zap className="w-3 h-3 text-blue-600" />
                        <span>Matched {rule.matchCount} times</span>
                      </span>
                    )}
                  </div>

                  {/* Keywords Tag Cloud */}
                  <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1 mr-1">
                      <Tag className="w-3 h-3 text-slate-400" />
                      Keywords:
                    </span>
                    {keywordsList.map((kw, kwIdx) => (
                      <span
                        key={kwIdx}
                        className="inline-block text-[11px] font-mono font-medium px-2 py-0.5 rounded-lg bg-slate-100 text-slate-800 border border-slate-200/80 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 transition"
                      >
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Right: Target Assignment & Actions */}
                <div className="flex items-center gap-2.5 self-start sm:self-center flex-shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                  <div className="flex items-center gap-2">
                    <ArrowRight className="w-4 h-4 text-slate-400 hidden sm:inline-block" />

                    {/* Target Category Pill */}
                    {targetCategory ? (
                      <div
                        className="px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs border"
                        style={{
                          backgroundColor: `${targetCategory.color}15`,
                          color: targetCategory.color,
                          borderColor: `${targetCategory.color}35`,
                        }}
                      >
                        <CategoryIcon iconName={targetCategory.icon} className="w-3.5 h-3.5" />
                        <span>{targetCategory.name}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">No Category</span>
                    )}

                    {/* Target Account Pill if set */}
                    {targetAccount && (
                      <div className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200 flex items-center gap-1 hidden md:flex">
                        <CreditCard className="w-3.5 h-3.5 text-slate-500" />
                        <span className="truncate max-w-[100px]">{targetAccount.name}</span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 ml-2">
                    <button
                      onClick={() => handleOpenEditModal(rule)}
                      className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition cursor-pointer"
                      title="Edit rule"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDeletingRule(rule)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer"
                      title="Delete rule"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredRules.length === 0 && (
        <div className="bg-white rounded-3xl border border-dashed border-slate-300 p-12 text-center">
          <Sparkles className="w-10 h-10 text-slate-400 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">No transaction rules found</h3>
          <p className="text-xs text-slate-600 mt-1 max-w-sm mx-auto">
            {searchQuery ? `No rules match "${searchQuery}".` : 'Create rules to automatically categorize transactions like "Starbucks -> Dining" or import a rules spreadsheet.'}
          </p>
          <div className="mt-5 flex items-center justify-center gap-3 flex-wrap">
            <button
              onClick={() => setIsImportModalOpen(true)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5 text-blue-600" />
              <span>Import Rules (CSV)</span>
            </button>
            <button
              onClick={handleOpenAddModal}
              className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold shadow-xs hover:bg-blue-700 transition cursor-pointer"
            >
              + Add First Rule
            </button>
          </div>
        </div>
      )}

      {/* ADD RULE MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto animate-fadeIn">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Plus className="w-5 h-5 text-blue-600" />
                Add New Transaction Rule
              </h2>
              <button 
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitAdd} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                  Rule Name
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Coffee & Cafes, Uber & Taxis, Netflix Subscription"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                  Keywords / Words to Match (Comma-separated)
                </label>
                <input
                  type="text"
                  required
                  value={formKeyword}
                  onChange={(e) => setFormKeyword(e.target.value)}
                  placeholder="e.g. starbucks, cafe, coffee, barista, dunkin"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  If the transaction title matches any of these words, this rule triggers automatically.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                  Match Condition
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'contains', label: 'Contains Word' },
                    { id: 'starts_with', label: 'Starts With' },
                    { id: 'exact', label: 'Exact Match' },
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setFormMatchType(m.id as RuleMatchType)}
                      className={`py-2 px-2.5 rounded-xl border text-xs font-bold transition cursor-pointer ${
                        formMatchType === m.id
                          ? 'bg-blue-50 border-blue-300 text-blue-700 shadow-2xs'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                  Assign Target Category
                </label>
                <select
                  required
                  value={formCategoryId}
                  onChange={(e) => setFormCategoryId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500"
                >
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name} ({cat.type})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                    Assign Payment Account (Optional)
                  </label>
                  <select
                    value={formAccountId}
                    onChange={(e) => setFormAccountId(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">No specific account</option>
                    {accounts.map(acc => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} ({acc.type})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                    Transaction Type (Optional)
                  </label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Auto / Unchanged</option>
                    <option value="expense">Expense</option>
                    <option value="income">Income</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div>
                  <span className="text-xs font-bold text-slate-900 block">Enable Rule Immediately</span>
                  <span className="text-[11px] text-slate-500">Apply rule to incoming and edited transactions</span>
                </div>
                <input
                  type="checkbox"
                  checked={formIsEnabled}
                  onChange={(e) => setFormIsEnabled(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
                />
              </div>

              <div className="pt-3 flex items-center justify-end space-x-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition cursor-pointer"
                >
                  Save Rule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT RULE MODAL */}
      {editingRule && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto animate-fadeIn">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-blue-600" />
                Edit Transaction Rule
              </h2>
              <button 
                onClick={() => setEditingRule(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitEdit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                  Rule Name
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                  Keywords / Words to Match (Comma-separated)
                </label>
                <input
                  type="text"
                  required
                  value={formKeyword}
                  onChange={(e) => setFormKeyword(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                  Match Condition
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'contains', label: 'Contains Word' },
                    { id: 'starts_with', label: 'Starts With' },
                    { id: 'exact', label: 'Exact Match' },
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setFormMatchType(m.id as RuleMatchType)}
                      className={`py-2 px-2.5 rounded-xl border text-xs font-bold transition cursor-pointer ${
                        formMatchType === m.id
                          ? 'bg-blue-50 border-blue-300 text-blue-700 shadow-2xs'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                  Assign Target Category
                </label>
                <select
                  required
                  value={formCategoryId}
                  onChange={(e) => setFormCategoryId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500"
                >
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name} ({cat.type})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                    Assign Payment Account (Optional)
                  </label>
                  <select
                    value={formAccountId}
                    onChange={(e) => setFormAccountId(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">No specific account</option>
                    {accounts.map(acc => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} ({acc.type})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                    Transaction Type (Optional)
                  </label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Auto / Unchanged</option>
                    <option value="expense">Expense</option>
                    <option value="income">Income</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div>
                  <span className="text-xs font-bold text-slate-900 block">Rule Active</span>
                  <span className="text-[11px] text-slate-500">Enable or pause this rule</span>
                </div>
                <input
                  type="checkbox"
                  checked={formIsEnabled}
                  onChange={(e) => setFormIsEnabled(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
                />
              </div>

              <div className="pt-3 flex items-center justify-end space-x-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingRule(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deletingRule && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 animate-fadeIn">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-3">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 text-center">Delete Rule</h3>
            <p className="text-xs text-slate-500 text-center mt-1">
              Are you sure you want to delete the rule <strong className="text-slate-800">"{deletingRule.name}"</strong>?
            </p>

            <div className="mt-5 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setDeletingRule(null)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-sm transition cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* IMPORT RULES CSV MODAL */}
      <ImportRulesModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        categories={categories}
        accounts={accounts}
        existingRulesCount={rules.length}
        onConfirmImport={handleConfirmImport}
      />
    </div>
  );
};
