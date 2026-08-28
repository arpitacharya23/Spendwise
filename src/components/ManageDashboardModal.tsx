import React from 'react';
import { 
  X, 
  ArrowUp, 
  ArrowDown, 
  Eye, 
  EyeOff, 
  Plus, 
  RotateCcw, 
  Check, 
  SlidersHorizontal,
  Layers,
  LayoutDashboard,
  CheckCircle2,
  TrendingUp,
  CreditCard,
  Landmark,
  Users2,
  UserCheck,
  Receipt,
  Zap,
  PieChart
} from 'lucide-react';
import { DashboardCardConfig, DashboardCardId } from '../types';

interface ManageDashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  cardsConfig?: DashboardCardConfig[];
  cards?: DashboardCardConfig[];
  onUpdateCardsConfig?: (newConfig: DashboardCardConfig[]) => void;
  onSaveCards?: (newConfig: DashboardCardConfig[]) => void;
  onResetToDefault: () => void;
}

export const ManageDashboardModal: React.FC<ManageDashboardModalProps> = ({
  isOpen,
  onClose,
  cardsConfig: cardsConfigProp,
  cards: cardsProp,
  onUpdateCardsConfig,
  onSaveCards,
  onResetToDefault,
}) => {
  if (!isOpen) return null;

  const currentCardsConfig = Array.isArray(cardsConfigProp)
    ? cardsConfigProp
    : Array.isArray(cardsProp)
      ? cardsProp
      : [];

  const updateConfig = (updated: DashboardCardConfig[]) => {
    if (onUpdateCardsConfig) onUpdateCardsConfig(updated);
    if (onSaveCards) onSaveCards(updated);
  };

  // Split into enabled (ordered) and disabled (available to add)
  const enabledCards = [...currentCardsConfig]
    .filter(c => c.isEnabled)
    .sort((a, b) => a.order - b.order);

  const disabledCards = [...currentCardsConfig]
    .filter(c => !c.isEnabled)
    .sort((a, b) => a.order - b.order);

  // Shift card up in the enabled list
  const handleShiftUp = (cardId: DashboardCardId) => {
    const idx = enabledCards.findIndex(c => c.id === cardId);
    if (idx <= 0) return; // Already at top

    const updated = [...enabledCards];
    const temp = updated[idx - 1];
    updated[idx - 1] = updated[idx];
    updated[idx] = temp;

    // Reassign order numbers
    const newEnabled = updated.map((card, orderIdx) => ({
      ...card,
      order: orderIdx,
    }));

    const finalConfig = currentCardsConfig.map(c => {
      const match = newEnabled.find(e => e.id === c.id);
      return match || c;
    });

    updateConfig(finalConfig);
  };

  // Shift card down in the enabled list
  const handleShiftDown = (cardId: DashboardCardId) => {
    const idx = enabledCards.findIndex(c => c.id === cardId);
    if (idx < 0 || idx >= enabledCards.length - 1) return; // Already at bottom

    const updated = [...enabledCards];
    const temp = updated[idx + 1];
    updated[idx + 1] = updated[idx];
    updated[idx] = temp;

    // Reassign order numbers
    const newEnabled = updated.map((card, orderIdx) => ({
      ...card,
      order: orderIdx,
    }));

    const finalConfig = currentCardsConfig.map(c => {
      const match = newEnabled.find(e => e.id === c.id);
      return match || c;
    });

    updateConfig(finalConfig);
  };

  // Remove / Hide card from dashboard
  const handleRemoveCard = (cardId: DashboardCardId) => {
    const updated = currentCardsConfig.map(c => {
      if (c.id === cardId) {
        return { ...c, isEnabled: false };
      }
      return c;
    });

    // Re-index remaining enabled cards
    let orderCounter = 0;
    const reordered = updated.map(c => {
      if (c.isEnabled) {
        return { ...c, order: orderCounter++ };
      }
      return c;
    });

    updateConfig(reordered);
  };

  // Add / Enable card back to dashboard (placed at bottom)
  const handleAddCard = (cardId: DashboardCardId) => {
    const maxOrder = enabledCards.length > 0 ? Math.max(...enabledCards.map(c => c.order)) : -1;
    const updated = currentCardsConfig.map(c => {
      if (c.id === cardId) {
        return { ...c, isEnabled: true, order: maxOrder + 1 };
      }
      return c;
    });

    updateConfig(updated);
  };

  // Icon mapping for card preview
  const getCardIcon = (id: DashboardCardId) => {
    switch (id) {
      case 'kpi_metrics':
        return <TrendingUp className="w-4 h-4 text-blue-600" />;
      case 'account_pills':
        return <Layers className="w-4 h-4 text-emerald-600" />;
      case 'credit_card_dues':
        return <CreditCard className="w-4 h-4 text-rose-600" />;
      case 'loans_emi':
        return <Landmark className="w-4 h-4 text-indigo-600" />;
      case 'splitwise_groups':
        return <Users2 className="w-4 h-4 text-emerald-600" />;
      case 'friends_balances':
        return <UserCheck className="w-4 h-4 text-indigo-600" />;
      case 'category_breakdown':
        return <PieChart className="w-4 h-4 text-purple-600" />;
      case 'recent_transactions':
        return <Receipt className="w-4 h-4 text-blue-600" />;
      default:
        return <LayoutDashboard className="w-4 h-4 text-slate-600" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fadeIn">
      <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
              <SlidersHorizontal className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                Manage Dashboard Cards
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                  {enabledCards.length} Active
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                Add, remove, or reorder cards to customize your personal financial command center.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer transition"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="overflow-y-auto py-4 space-y-6 flex-1 pr-1">
          {/* Section 1: Active Cards (Ordered) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Active Cards ({enabledCards.length})
                </h3>
                <span className="text-[11px] text-slate-500">
                  Cards appear on your dashboard in the exact sequence shown below.
                </span>
              </div>
              <span className="text-[11px] font-semibold text-slate-500 hidden sm:inline-block">
                Use ▲ / ▼ to shift position
              </span>
            </div>

            {enabledCards.length > 0 ? (
              <div className="space-y-2">
                {enabledCards.map((card, idx) => {
                  const isFirst = idx === 0;
                  const isLast = idx === enabledCards.length - 1;

                  return (
                    <div
                      key={card.id}
                      className="group bg-slate-50/80 hover:bg-white p-3.5 rounded-2xl border border-slate-200/90 hover:border-slate-300 hover:shadow-xs transition flex items-center justify-between gap-3"
                    >
                      {/* Left: Position Number & Card Info */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-7 h-7 rounded-xl bg-white border border-slate-200 text-slate-700 font-extrabold text-xs flex items-center justify-center flex-shrink-0 shadow-2xs">
                          {idx + 1}
                        </div>
                        <div className="w-8 h-8 rounded-xl bg-white border border-slate-100 flex items-center justify-center flex-shrink-0 shadow-2xs">
                          {getCardIcon(card.id)}
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                            {card.name}
                          </h4>
                          <p className="text-[11px] text-slate-500 truncate hidden sm:block">
                            {card.description}
                          </p>
                        </div>
                      </div>

                      {/* Right: Shift Up, Shift Down & Remove Buttons */}
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {/* Shift Up */}
                        <button
                          onClick={() => handleShiftUp(card.id)}
                          disabled={isFirst}
                          id={`btn-shift-up-${card.id}`}
                          className={`p-1.5 rounded-xl border transition flex items-center justify-center ${
                            isFirst
                              ? 'bg-slate-100 text-slate-300 border-slate-200 cursor-not-allowed opacity-50'
                              : 'bg-white hover:bg-blue-50 text-slate-700 hover:text-blue-600 border-slate-200 shadow-2xs cursor-pointer active:scale-95'
                          }`}
                          title={isFirst ? 'Already at the top' : 'Shift card up'}
                        >
                          <ArrowUp className="w-4 h-4" />
                        </button>

                        {/* Shift Down */}
                        <button
                          onClick={() => handleShiftDown(card.id)}
                          disabled={isLast}
                          id={`btn-shift-down-${card.id}`}
                          className={`p-1.5 rounded-xl border transition flex items-center justify-center ${
                            isLast
                              ? 'bg-slate-100 text-slate-300 border-slate-200 cursor-not-allowed opacity-50'
                              : 'bg-white hover:bg-blue-50 text-slate-700 hover:text-blue-600 border-slate-200 shadow-2xs cursor-pointer active:scale-95'
                          }`}
                          title={isLast ? 'Already at the bottom' : 'Shift card down'}
                        >
                          <ArrowDown className="w-4 h-4" />
                        </button>

                        {/* Remove / Hide */}
                        <button
                          onClick={() => handleRemoveCard(card.id)}
                          id={`btn-remove-card-${card.id}`}
                          className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-rose-50 text-slate-500 hover:text-rose-600 border border-slate-200 hover:border-rose-200 text-xs font-semibold shadow-2xs cursor-pointer transition flex items-center gap-1 active:scale-95"
                          title="Remove card from dashboard"
                        >
                          <EyeOff className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Remove</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                <LayoutDashboard className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="text-xs text-slate-600 font-semibold">All cards are currently hidden.</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Add cards from the available section below.</p>
              </div>
            )}
          </div>

          {/* Section 2: Available / Hidden Cards */}
          <div className="space-y-3 pt-4 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5 text-blue-600" />
                  Available Cards to Add ({disabledCards.length})
                </h3>
                <span className="text-[11px] text-slate-500">
                  Click "+ Add to Dashboard" to restore any card to your view.
                </span>
              </div>
            </div>

            {disabledCards.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {disabledCards.map((card) => (
                  <div
                    key={card.id}
                    className="p-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50/40 hover:bg-white hover:border-blue-300 transition flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-7 h-7 rounded-xl bg-white border border-slate-200 flex items-center justify-center flex-shrink-0 text-slate-400">
                        {getCardIcon(card.id)}
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-slate-800 truncate">
                          {card.name}
                        </h4>
                        <p className="text-[10px] text-slate-500 truncate">
                          {card.description}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => handleAddCard(card.id)}
                      id={`btn-add-card-${card.id}`}
                      className="px-2.5 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-600 text-blue-700 hover:text-white border border-blue-200 text-xs font-bold transition flex items-center gap-1 flex-shrink-0 cursor-pointer active:scale-95 shadow-2xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add</span>
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>All available cards are currently active on your dashboard!</span>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="pt-4 border-t border-slate-100 flex items-center justify-between flex-shrink-0">
          <button
            onClick={onResetToDefault}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
            title="Reset cards to factory layout"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset to Default Layout</span>
          </button>

          <button
            onClick={onClose}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
