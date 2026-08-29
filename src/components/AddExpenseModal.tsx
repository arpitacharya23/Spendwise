import React, { useState, useEffect } from 'react';
import { Plus, Receipt, Landmark, Users2, DollarSign, Calendar, X, AlertCircle, Sparkles, Check } from 'lucide-react';
import { Account, Category, Group, LoanEMI, Transaction, UserProfile, TransactionRule } from '../types';
import { CategoryIcon } from './CategoryIcon';
import { findMatchingRule } from '../lib/ruleEngine';

interface AddExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile;
  accounts: Account[];
  categories: Category[];
  loans: LoanEMI[];
  groups: Group[];
  rules?: TransactionRule[];
  initialDate?: string;
  onSaveExpense: (tx: Partial<Transaction>) => void;
  onIncrementRuleMatch?: (ruleId: string) => void;
}

export const AddExpenseModal: React.FC<AddExpenseModalProps> = ({
  isOpen,
  onClose,
  user,
  accounts,
  categories,
  loans,
  groups,
  rules = [],
  initialDate,
  onSaveExpense,
  onIncrementRuleMatch,
}) => {
  if (!isOpen) return null;

  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'expense' | 'income' | 'emi_payment'>('expense');
  const [accountId, setAccountId] = useState(accounts[0]?.id || 'acc-1');
  const [categoryId, setCategoryId] = useState(categories[0]?.id || 'cat-1');
  const [date, setDate] = useState(initialDate || new Date().toISOString().split('T')[0]);
  const [time, setTime] = useState(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  });
  const [notes, setNotes] = useState('');
  const [linkedEmiId, setLinkedEmiId] = useState('');
  const [linkedGroupId, setLinkedGroupId] = useState('');

  // Active matched rule state
  const [matchedRuleInfo, setMatchedRuleInfo] = useState<{
    ruleName: string;
    matchedKeyword: string;
    categoryName: string;
    ruleId: string;
  } | null>(null);
  const [hasUserManuallyChangedCategory, setHasUserManuallyChangedCategory] = useState(false);

  // Real-time title change & rule detection
  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);

    if (!newTitle.trim() || type === 'emi_payment' || rules.length === 0) {
      setMatchedRuleInfo(null);
      return;
    }

    const match = findMatchingRule(newTitle, rules);
    if (match) {
      const targetCat = categories.find(c => c.id === match.suggestedCategoryId);
      if (!hasUserManuallyChangedCategory) {
        setCategoryId(match.suggestedCategoryId);
        if (match.suggestedAccountId) {
          setAccountId(match.suggestedAccountId);
        }
        if (match.suggestedType) {
          setType(match.suggestedType);
        }
      }
      setMatchedRuleInfo({
        ruleName: match.rule.name,
        matchedKeyword: match.matchedKeyword,
        categoryName: targetCat?.name || 'Category',
        ruleId: match.rule.id,
      });
    } else {
      setMatchedRuleInfo(null);
    }
  };

  const handleCategorySelect = (newCatId: string) => {
    setCategoryId(newCatId);
    setHasUserManuallyChangedCategory(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !amount) return;

    if (matchedRuleInfo && onIncrementRuleMatch) {
      onIncrementRuleMatch(matchedRuleInfo.ruleId);
    }

    onSaveExpense({
      title,
      amount: Number(amount),
      type,
      accountId,
      categoryId: type === 'emi_payment' ? 'cat-6' : categoryId,
      date,
      time: time || undefined,
      notes,
      emiId: type === 'emi_payment' || linkedEmiId ? linkedEmiId : undefined,
      groupId: linkedGroupId || undefined,
      createdBy: user.email,
      updatedAt: new Date().toISOString(),
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-slate-900">Record New Transaction</h2>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Transaction Type Buttons */}
          <div>
            <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Transaction Type</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'expense', label: 'Expense' },
                { id: 'income', label: 'Income' },
                { id: 'emi_payment', label: 'Loan / EMI' },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setType(t.id as any)}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border text-center transition ${
                    type === t.id
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Title / Description</label>
            <input
              type="text"
              required
              placeholder="e.g. Starbucks coffee, Uber ride, Amazon order, Salary"
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            {/* Smart Rule Matched Banner */}
            {matchedRuleInfo && (
              <div className="mt-2 p-2.5 bg-blue-50/80 border border-blue-200/90 rounded-xl flex items-center justify-between text-xs animate-fadeIn">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-5 h-5 rounded-lg bg-blue-600 text-white flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-3 h-3" />
                  </div>
                  <div className="truncate">
                    <span className="font-bold text-blue-900">Rule Matched: </span>
                    <span className="text-blue-800">Auto-categorized as <strong>{matchedRuleInfo.categoryName}</strong></span>
                    <span className="text-blue-600 text-[10px] ml-1">("{matchedRuleInfo.matchedKeyword}")</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Amount ({user.currency})</label>
              <input
                type="number"
                required
                placeholder="e.g. 2500"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Time</label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Account Selection */}
          <div>
            <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Account / Credit Card</label>
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {accounts.map(a => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.type === 'credit_card' ? `Credit Card • Due ${a.currency}${a.dueAmount}` : `Balance ${a.currency}${a.balance}`})
                </option>
              ))}
            </select>
          </div>

          {/* If EMI, select linked EMI */}
          {type === 'emi_payment' ? (
            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Link to Loan / EMI Schedule</label>
              <select
                value={linkedEmiId}
                onChange={(e) => setLinkedEmiId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select active loan</option>
                {loans.map(l => (
                  <option key={l.id} value={l.id}>
                    {l.name} (Monthly: {user.currency}{l.monthlyEMI})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold uppercase text-slate-500">Category</label>
                {categories.find(c => c.id === categoryId) && (
                  <span 
                    className="text-[11px] font-bold flex items-center gap-1 px-2 py-0.5 rounded-md"
                    style={{ 
                      backgroundColor: `${categories.find(c => c.id === categoryId)?.color}20`,
                      color: categories.find(c => c.id === categoryId)?.color 
                    }}
                  >
                    <CategoryIcon iconName={categories.find(c => c.id === categoryId)?.icon || 'Tag'} className="w-3 h-3" />
                    <span>{categories.find(c => c.id === categoryId)?.name}</span>
                  </span>
                )}
              </div>
              <select
                value={categoryId}
                onChange={(e) => handleCategorySelect(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
              >
                {categories
                  .filter(c => type === 'expense' ? c.type === 'expense' : c.type === 'income')
                  .concat(categories.filter(c => type === 'expense' ? c.type === 'income' : c.type === 'expense'))
                  .map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.type})
                    </option>
                  ))}
              </select>
            </div>
          )}

          {/* Optional Group linking */}
          {type === 'expense' && (
            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Link to Splitwise Group (Optional)</label>
              <select
                value={linkedGroupId}
                onChange={(e) => setLinkedGroupId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">No group (Personal Expense)</option>
                {groups.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Notes</label>
            <input
              type="text"
              placeholder="e.g. Receipt invoice attached"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl text-sm font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold shadow-sm"
            >
              Save Transaction
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
