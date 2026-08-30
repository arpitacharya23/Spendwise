import React from 'react';
import { Check, Users2, DollarSign, Percent, Sparkles, AlertCircle, CheckCircle2, RotateCcw } from 'lucide-react';
import { GroupMember } from '../types';

export type SplitMode = 'equal' | 'exact' | 'percentage';

export interface SplitEditorProps {
  currency: string;
  totalAmount: number;
  members: GroupMember[];
  selectedMemberIds: string[];
  onToggleMember: (memberId: string) => void;
  onSelectAll?: () => void;
  onDeselectAll?: () => void;
  onSelectAllMembers?: () => void;
  onDeselectAllMembers?: () => void;
  splitMode: SplitMode;
  onChangeSplitMode?: (mode: SplitMode) => void;
  onSplitModeChange?: (mode: SplitMode) => void;
  exactShares?: Record<string, number>;
  onChangeExactShares?: (shares: Record<string, number>) => void;
  onExactShareChange?: (memberId: string, val: number) => void;
  percentageShares?: Record<string, number>;
  onChangePercentageShares?: (shares: Record<string, number>) => void;
  onPercentageShareChange?: (memberId: string, val: number) => void;
  payerMemberId?: string;
}

export const SplitEditor: React.FC<SplitEditorProps> = ({
  currency,
  totalAmount,
  members,
  selectedMemberIds = [],
  onToggleMember,
  onSelectAll,
  onDeselectAll,
  onSelectAllMembers,
  onDeselectAllMembers,
  splitMode = 'equal',
  onChangeSplitMode,
  onSplitModeChange,
  exactShares = {},
  onChangeExactShares,
  onExactShareChange,
  percentageShares = {},
  onChangePercentageShares,
  onPercentageShareChange,
  payerMemberId,
}) => {
  const triggerSplitModeChange = (mode: SplitMode) => {
    if (typeof onChangeSplitMode === 'function') {
      onChangeSplitMode(mode);
    }
    if (typeof onSplitModeChange === 'function') {
      onSplitModeChange(mode);
    }
  };

  const triggerExactSharesChange = (shares: Record<string, number>) => {
    if (typeof onChangeExactShares === 'function') {
      onChangeExactShares(shares);
    }
    if (typeof onExactShareChange === 'function') {
      Object.entries(shares).forEach(([id, val]) => {
        onExactShareChange(id, val);
      });
    }
  };

  const triggerSingleExactShareChange = (memberId: string, val: number) => {
    if (typeof onExactShareChange === 'function') {
      onExactShareChange(memberId, val);
    }
    if (typeof onChangeExactShares === 'function') {
      onChangeExactShares({
        ...exactShares,
        [memberId]: val,
      });
    }
  };

  const triggerPercentageSharesChange = (shares: Record<string, number>) => {
    if (typeof onChangePercentageShares === 'function') {
      onChangePercentageShares(shares);
    }
    if (typeof onPercentageShareChange === 'function') {
      Object.entries(shares).forEach(([id, val]) => {
        onPercentageShareChange(id, val);
      });
    }
  };

  const triggerSinglePercentageShareChange = (memberId: string, val: number) => {
    if (typeof onPercentageShareChange === 'function') {
      onPercentageShareChange(memberId, val);
    }
    if (typeof onChangePercentageShares === 'function') {
      onChangePercentageShares({
        ...percentageShares,
        [memberId]: val,
      });
    }
  };

  const handleSelectAll = () => {
    if (typeof onSelectAll === 'function') onSelectAll();
    if (typeof onSelectAllMembers === 'function') onSelectAllMembers();
  };

  const handleDeselectAll = () => {
    if (typeof onDeselectAll === 'function') onDeselectAll();
    if (typeof onDeselectAllMembers === 'function') onDeselectAllMembers();
  };

  const activeCount = selectedMemberIds.length;
  const equalPerPerson = activeCount > 0 ? Math.round((totalAmount / activeCount) * 100) / 100 : 0;

  // Calculate sum of exact shares
  const exactSum = members.reduce((sum, m) => {
    if (selectedMemberIds.includes(m.id)) {
      return sum + (exactShares[m.id] || 0);
    }
    return sum;
  }, 0);
  const exactDiff = Math.round((totalAmount - exactSum) * 100) / 100;

  // Calculate sum of percentage shares
  const percentageSum = members.reduce((sum, m) => {
    if (selectedMemberIds.includes(m.id)) {
      return sum + (percentageShares[m.id] || 0);
    }
    return sum;
  }, 0);
  const percentageDiff = Math.round((100 - percentageSum) * 10) / 10;

  // Helpers for distributing remaining
  const handleDistributeRemainingExact = () => {
    if (activeCount === 0 || exactDiff === 0) return;
    const perPersonExtra = Math.round((exactDiff / activeCount) * 100) / 100;
    const updated = { ...exactShares };
    selectedMemberIds.forEach((id, idx) => {
      const current = updated[id] || 0;
      if (idx === selectedMemberIds.length - 1) {
        // assign exact remainder to last to avoid rounding quirks
        const othersAssigned = perPersonExtra * (activeCount - 1);
        updated[id] = Math.max(0, Math.round((current + (exactDiff - othersAssigned)) * 100) / 100);
      } else {
        updated[id] = Math.max(0, Math.round((current + perPersonExtra) * 100) / 100);
      }
    });
    triggerExactSharesChange(updated);
  };

  const handleResetToEqualExact = () => {
    if (activeCount === 0) return;
    const updated: Record<string, number> = {};
    selectedMemberIds.forEach((id) => {
      updated[id] = equalPerPerson;
    });
    triggerExactSharesChange(updated);
  };

  const handleDistributeRemainingPercentage = () => {
    if (activeCount === 0 || percentageDiff === 0) return;
    const perPersonExtra = Math.round((percentageDiff / activeCount) * 10) / 10;
    const updated = { ...percentageShares };
    selectedMemberIds.forEach((id, idx) => {
      const current = updated[id] || 0;
      if (idx === selectedMemberIds.length - 1) {
        const othersAssigned = perPersonExtra * (activeCount - 1);
        updated[id] = Math.max(0, Math.round((current + (percentageDiff - othersAssigned)) * 10) / 10);
      } else {
        updated[id] = Math.max(0, Math.round((current + perPersonExtra) * 10) / 10);
      }
    });
    triggerPercentageSharesChange(updated);
  };

  const handleResetToEqualPercentage = () => {
    if (activeCount === 0) return;
    const equalPercent = Math.round((100 / activeCount) * 10) / 10;
    const updated: Record<string, number> = {};
    selectedMemberIds.forEach((id, idx) => {
      if (idx === selectedMemberIds.length - 1) {
        updated[id] = Math.round((100 - (equalPercent * (activeCount - 1))) * 10) / 10;
      } else {
        updated[id] = equalPercent;
      }
    });
    triggerPercentageSharesChange(updated);
  };

  const handleExactInputChange = (memberId: string, valStr: string) => {
    const val = parseFloat(valStr) || 0;
    triggerSingleExactShareChange(memberId, val);
  };

  const handlePercentageInputChange = (memberId: string, valStr: string) => {
    const val = parseFloat(valStr) || 0;
    triggerSinglePercentageShareChange(memberId, val);
  };

  return (
    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3.5">
      {/* Header with Split Mode Switcher */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <span>Split Method</span>
              <span className="text-slate-400 font-normal">({activeCount} of {members.length} included)</span>
            </span>
          </div>

          {/* Mode Tabs */}
          <div className="inline-flex bg-slate-200/70 p-0.5 rounded-xl text-xs font-bold">
            <button
              type="button"
              onClick={() => triggerSplitModeChange('equal')}
              className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1 cursor-pointer ${
                splitMode === 'equal'
                  ? 'bg-white text-blue-600 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users2 className="w-3.5 h-3.5" />
              <span>= Equal</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (Object.keys(exactShares).length === 0) {
                  handleResetToEqualExact();
                }
                triggerSplitModeChange('exact');
              }}
              className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1 cursor-pointer ${
                splitMode === 'exact'
                  ? 'bg-white text-blue-600 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <DollarSign className="w-3.5 h-3.5" />
              <span>Exact ({currency})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (Object.keys(percentageShares).length === 0) {
                  handleResetToEqualPercentage();
                }
                triggerSplitModeChange('percentage');
              }}
              className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1 cursor-pointer ${
                splitMode === 'percentage'
                  ? 'bg-white text-blue-600 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Percent className="w-3.5 h-3.5" />
              <span>Percent (%)</span>
            </button>
          </div>
        </div>

        <p className="text-[11px] text-slate-500">
          {splitMode === 'equal' && 'Splits the total bill equally among selected participants. Tap any member to unselect/exclude.'}
          {splitMode === 'exact' && `Specify exact ${currency} amounts for each person. Checkbox includes or excludes someone from the split.`}
          {splitMode === 'percentage' && 'Enter percentage share for each person summing to 100%. Checkbox includes or excludes someone.'}
        </p>
      </div>

      {/* Validation / Helper Banners */}
      {splitMode === 'exact' && (
        <div className={`p-2.5 rounded-xl text-xs flex items-center justify-between gap-2 border ${
          Math.abs(exactDiff) < 0.05
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
            : exactDiff > 0
            ? 'bg-amber-50 text-amber-800 border-amber-200'
            : 'bg-rose-50 text-rose-800 border-rose-200'
        }`}>
          <div className="flex items-center gap-1.5">
            {Math.abs(exactDiff) < 0.05 ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span className="font-bold">Exact Match: {currency}{exactSum.toLocaleString('en-IN')} allocated</span>
              </>
            ) : exactDiff > 0 ? (
              <>
                <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <span>
                  Allocated: <strong>{currency}{exactSum.toLocaleString('en-IN')}</strong> • <strong>{currency}{exactDiff.toLocaleString('en-IN')}</strong> remaining
                </span>
              </>
            ) : (
              <>
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                <span>
                  Allocated: <strong>{currency}{exactSum.toLocaleString('en-IN')}</strong> • <strong>{currency}{Math.abs(exactDiff).toLocaleString('en-IN')}</strong> over total
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            {exactDiff !== 0 && activeCount > 0 && (
              <button
                type="button"
                onClick={handleDistributeRemainingExact}
                className="px-2 py-1 bg-amber-200/80 hover:bg-amber-300 text-amber-900 font-bold rounded-lg text-[11px] cursor-pointer transition"
              >
                Split remaining
              </button>
            )}
            <button
              type="button"
              onClick={handleResetToEqualExact}
              className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 rounded-md cursor-pointer transition"
              title="Reset to equal amounts"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {splitMode === 'percentage' && (
        <div className={`p-2.5 rounded-xl text-xs flex items-center justify-between gap-2 border ${
          Math.abs(percentageDiff) < 0.1
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
            : percentageDiff > 0
            ? 'bg-amber-50 text-amber-800 border-amber-200'
            : 'bg-rose-50 text-rose-800 border-rose-200'
        }`}>
          <div className="flex items-center gap-1.5">
            {Math.abs(percentageDiff) < 0.1 ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span className="font-bold">Total: 100.0% ({currency}{totalAmount.toLocaleString('en-IN')})</span>
              </>
            ) : percentageDiff > 0 ? (
              <>
                <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <span>
                  Total: <strong>{percentageSum.toFixed(1)}%</strong> • <strong>{percentageDiff.toFixed(1)}%</strong> remaining
                </span>
              </>
            ) : (
              <>
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                <span>
                  Total: <strong>{percentageSum.toFixed(1)}%</strong> • <strong>{Math.abs(percentageDiff).toFixed(1)}%</strong> over 100%
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            {percentageDiff !== 0 && activeCount > 0 && (
              <button
                type="button"
                onClick={handleDistributeRemainingPercentage}
                className="px-2 py-1 bg-amber-200/80 hover:bg-amber-300 text-amber-900 font-bold rounded-lg text-[11px] cursor-pointer transition"
              >
                Split remaining %
              </button>
            )}
            <button
              type="button"
              onClick={handleResetToEqualPercentage}
              className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 rounded-md cursor-pointer transition"
              title="Reset to equal percentages"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Member Split Rows List */}
      <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
        {members.map((m, mIdx) => {
          const isSelected = selectedMemberIds.includes(m.id);
          const isPayer = m.id === payerMemberId;
          const exactVal = exactShares[m.id] !== undefined ? exactShares[m.id] : equalPerPerson;
          const percentVal = percentageShares[m.id] !== undefined ? percentageShares[m.id] : (activeCount > 0 ? Math.round((100 / activeCount) * 10) / 10 : 0);
          const calculatedFromPercent = Math.round(((percentVal / 100) * totalAmount) * 100) / 100;

          return (
            <div
              key={`split-mem-${m.id || mIdx}-${mIdx}`}
              className={`p-2.5 rounded-xl border flex items-center justify-between gap-3 transition ${
                isSelected
                  ? 'bg-white border-blue-400/80 shadow-2xs'
                  : 'bg-slate-100/70 border-slate-200 opacity-60'
              }`}
            >
              {/* Checkbox + Member Identity */}
              <div 
                onClick={() => onToggleMember(m.id)}
                className="flex items-center space-x-2.5 cursor-pointer flex-grow min-w-0"
              >
                <div
                  className={`w-5 h-5 rounded-md flex items-center justify-center text-xs text-white transition-colors ${
                    isSelected ? 'bg-blue-600' : 'bg-slate-300'
                  }`}
                >
                  {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                </div>

                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold text-[10px] flex-shrink-0"
                  style={{ backgroundColor: m.avatarColor || '#3B82F6' }}
                >
                  {m.name.substring(0, 2).toUpperCase()}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-xs font-bold truncate ${isSelected ? 'text-slate-900' : 'text-slate-500'}`}>
                      {m.name}
                    </span>
                    {isPayer && (
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.2 rounded-md flex-shrink-0">
                        Payer
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-600 truncate">{m.email}</p>
                </div>
              </div>

              {/* Share Controls / Value based on Mode */}
              <div className="flex-shrink-0 text-right">
                {splitMode === 'equal' && (
                  <div>
                    {isSelected ? (
                      <span className="text-xs font-bold text-blue-700">
                        {currency}{equalPerPerson.toLocaleString('en-IN')}
                      </span>
                    ) : (
                      <span className="text-xs font-medium text-slate-400">
                        Excluded ({currency}0)
                      </span>
                    )}
                  </div>
                )}

                {splitMode === 'exact' && (
                  <div>
                    {isSelected ? (
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-bold text-slate-500">{currency}</span>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={exactShares[m.id] !== undefined ? exactShares[m.id] : ''}
                          placeholder="0"
                          onChange={(e) => handleExactInputChange(m.id, e.target.value)}
                          className="w-24 px-2 py-1 text-right text-xs font-bold rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white text-slate-900"
                        />
                      </div>
                    ) : (
                      <span className="text-xs font-medium text-slate-400">
                        Excluded ({currency}0)
                      </span>
                    )}
                  </div>
                )}

                {splitMode === 'percentage' && (
                  <div>
                    {isSelected ? (
                      <div className="flex flex-col items-end">
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            max="100"
                            value={percentageShares[m.id] !== undefined ? percentageShares[m.id] : ''}
                            placeholder="0"
                            onChange={(e) => handlePercentageInputChange(m.id, e.target.value)}
                            className="w-16 px-2 py-1 text-right text-xs font-bold rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white text-slate-900"
                          />
                          <span className="text-xs font-bold text-slate-500">%</span>
                        </div>
                        <span className="text-[10px] text-blue-600 font-semibold mt-0.5">
                          ≈ {currency}{calculatedFromPercent.toLocaleString('en-IN')}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs font-medium text-slate-400">
                        Excluded (0%)
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
