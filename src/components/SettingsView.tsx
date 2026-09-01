import React, { useState, useEffect } from 'react';
import { 
  User, 
  Mail, 
  DollarSign, 
  Check, 
  Phone, 
  SlidersHorizontal,
  ArrowUp,
  ArrowDown,
  EyeOff,
  Plus,
  RotateCcw,
  CheckCircle2,
  TrendingUp,
  CreditCard,
  Landmark,
  Users2,
  UserCheck,
  Receipt,
  PieChart,
  Layers,
  LayoutDashboard,
  Database,
  Cloud,
  FileSpreadsheet,
  ExternalLink,
  RefreshCw,
  UploadCloud,
  DownloadCloud,
  Trash2,
  Copy,
  Code,
  Sparkles,
  AlertCircle,
  LogOut
} from 'lucide-react';
import { 
  UserProfile, 
  Account, 
  Transaction, 
  Category, 
  LoanEMI, 
  TransactionRule,
  DashboardCardConfig,
  DashboardCardId
} from '../types';
import { 
  DatabasePreference, 
  getStoredDatabasePreference, 
  saveStoredDatabasePreference,
  getStoredGSheetConfig,
  saveStoredGSheetConfig,
  clearStoredGSheetConfig,
  testWebAppConnection,
  syncAllDataViaWebApp,
  pullDataViaWebApp,
  isGoogleSheetsSynced,
  GoogleSheetsSyncConfig,
  SPENDWISE_APPS_SCRIPT_CODE
} from '../lib/googleSheetsService';
import { ApiSettingsSection } from './ApiSettingsSection';

interface SettingsViewProps {
  user: UserProfile;
  onSaveProfile: (updatedUser: UserProfile) => void;
  dashboardCards: DashboardCardConfig[];
  onUpdateDashboardCards: (newConfig: DashboardCardConfig[]) => void;
  onResetDashboardCards: () => void;
  accounts: Account[];
  transactions: Transaction[];
  categories: Category[];
  loans: LoanEMI[];
  rules: TransactionRule[];
  onAddTransaction?: (tx: Transaction) => void;
  onRestoreFromSheets?: (data: {
    accounts?: Account[];
    transactions?: Transaction[];
    categories?: Category[];
    loans?: LoanEMI[];
    rules?: TransactionRule[];
  }) => void;
  onLogout: () => void;
}

const CURRENCIES = [
  { symbol: '₹', code: 'INR', label: '₹ Indian Rupee (INR)' },
  { symbol: '$', code: 'USD', label: '$ US Dollar (USD)' },
  { symbol: '€', code: 'EUR', label: '€ Euro (EUR)' },
  { symbol: '£', code: 'GBP', label: '£ British Pound (GBP)' },
  { symbol: '¥', code: 'JPY', label: '¥ Japanese Yen (JPY)' },
  { symbol: 'A$', code: 'AUD', label: 'A$ Australian Dollar (AUD)' },
  { symbol: 'C$', code: 'CAD', label: 'C$ Canadian Dollar (CAD)' },
  { symbol: 'AED', code: 'AED', label: 'AED UAE Dirham (AED)' },
  { symbol: 'S$', code: 'SGD', label: 'S$ Singapore Dollar (SGD)' },
];

const COUNTRY_CODES = [
  { code: '+1', country: 'US', flag: '🇺🇸', label: 'United States (+1)' },
  { code: '+44', country: 'GB', flag: '🇬🇧', label: 'United Kingdom (+44)' },
  { code: '+61', country: 'AU', flag: '🇦🇺', label: 'Australia (+61)' },
  { code: '+91', country: 'IN', flag: '🇮🇳', label: 'India (+91)' },
  { code: '+971', country: 'AE', flag: '🇦🇪', label: 'UAE (+971)' },
  { code: '+65', country: 'SG', flag: '🇸🇬', label: 'Singapore (+65)' },
  { code: '+852', country: 'HK', flag: '🇭🇰', label: 'Hong Kong (+852)' },
  { code: '+81', country: 'JP', flag: '🇯🇵', label: 'Japan (+81)' },
  { code: '+49', country: 'DE', flag: '🇩🇪', label: 'Germany (+49)' },
  { code: '+33', country: 'FR', flag: '🇫🇷', label: 'France (+33)' },
  { code: '+7', country: 'RU', flag: '🇷🇺', label: 'Russia (+7)' },
];

export const SettingsView: React.FC<SettingsViewProps> = ({
  user,
  onSaveProfile,
  dashboardCards,
  onUpdateDashboardCards,
  onResetDashboardCards,
  accounts,
  transactions,
  categories,
  loans,
  rules,
  onAddTransaction,
  onRestoreFromSheets,
  onLogout,
}) => {
  // ----------------------------------------------------
  // Profile State
  // ----------------------------------------------------
  const [name, setName] = useState(user.name);
  const [email] = useState(user.email);
  const [currency, setCurrency] = useState(user.currency || '₹');
  const [phone, setPhone] = useState(user.phone || '');
  const [countryCode, setCountryCode] = useState(user.countryCode || '+91');
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl || '');
  const [profileSavedFeedback, setProfileSavedFeedback] = useState(false);

  useEffect(() => {
    setName(user.name);
    setCurrency(user.currency || '₹');
    setPhone(user.phone || '');
    setCountryCode(user.countryCode || '+91');
    setAvatarUrl(user.avatarUrl || '');
  }, [user]);

  const selectedCountry = COUNTRY_CODES.find((entry) => entry.code === countryCode) || COUNTRY_CODES[3];

  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSaveProfile({
      name: name.trim(),
      email: email.trim() || user.email,
      currency,
      avatarColor: user.avatarColor,
      avatarUrl: avatarUrl.trim() || undefined,
      phone: phone.trim() || undefined,
      countryCode,
      monthlyBudget: user.monthlyBudget,
    });
    setProfileSavedFeedback(true);
    setTimeout(() => setProfileSavedFeedback(false), 3000);
  };

  // ----------------------------------------------------
  // Dashboard Cards Management
  // ----------------------------------------------------
  const enabledCards = [...dashboardCards]
    .filter((c) => c.isEnabled)
    .sort((a, b) => a.order - b.order);

  const disabledCards = [...dashboardCards]
    .filter((c) => !c.isEnabled)
    .sort((a, b) => a.order - b.order);

  const handleShiftUp = (cardId: DashboardCardId) => {
    const idx = enabledCards.findIndex((c) => c.id === cardId);
    if (idx <= 0) return;

    const updated = [...enabledCards];
    const temp = updated[idx - 1];
    updated[idx - 1] = updated[idx];
    updated[idx] = temp;

    const newEnabled = updated.map((card, orderIdx) => ({
      ...card,
      order: orderIdx,
    }));

    const finalConfig = dashboardCards.map((c) => {
      const match = newEnabled.find((e) => e.id === c.id);
      return match || c;
    });

    onUpdateDashboardCards(finalConfig);
  };

  const handleShiftDown = (cardId: DashboardCardId) => {
    const idx = enabledCards.findIndex((c) => c.id === cardId);
    if (idx < 0 || idx >= enabledCards.length - 1) return;

    const updated = [...enabledCards];
    const temp = updated[idx + 1];
    updated[idx + 1] = updated[idx];
    updated[idx] = temp;

    const newEnabled = updated.map((card, orderIdx) => ({
      ...card,
      order: orderIdx,
    }));

    const finalConfig = dashboardCards.map((c) => {
      const match = newEnabled.find((e) => e.id === c.id);
      return match || c;
    });

    onUpdateDashboardCards(finalConfig);
  };

  const handleRemoveCard = (cardId: DashboardCardId) => {
    const updated = dashboardCards.map((c) => {
      if (c.id === cardId) {
        return { ...c, isEnabled: false };
      }
      return c;
    });

    let orderCounter = 0;
    const reordered = updated.map((c) => {
      if (c.isEnabled) {
        return { ...c, order: orderCounter++ };
      }
      return c;
    });

    onUpdateDashboardCards(reordered);
  };

  const handleAddCard = (cardId: DashboardCardId) => {
    const maxOrder = enabledCards.length > 0 ? Math.max(...enabledCards.map((c) => c.order)) : -1;
    const updated = dashboardCards.map((c) => {
      if (c.id === cardId) {
        return { ...c, isEnabled: true, order: maxOrder + 1 };
      }
      return c;
    });

    onUpdateDashboardCards(updated);
  };

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

  // ----------------------------------------------------
  // Database & Google Sheets Sync State
  // ----------------------------------------------------
  const [pref, setPref] = useState<DatabasePreference>(() => getStoredDatabasePreference());
  const [gsheetConfig, setGsheetConfig] = useState<GoogleSheetsSyncConfig>(() => getStoredGSheetConfig());

  const [manualWebAppUrl, setManualWebAppUrl] = useState(gsheetConfig.webAppUrl || '');
  const [manualSpreadsheetUrl, setManualSpreadsheetUrl] = useState(gsheetConfig.spreadsheetUrl || '');
  const [hasCopiedScript, setHasCopiedScript] = useState(false);

  const [isConnectingGSheet, setIsConnectingGSheet] = useState(false);
  const [isSyncingGSheet, setIsSyncingGSheet] = useState(false);
  const [isPullingGSheet, setIsPullingGSheet] = useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [gsheetStatusMessage, setGsheetStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [isAutoSyncing, setIsAutoSyncing] = useState(false);

  useEffect(() => {
    const handleUpdate = () => {
      setGsheetConfig(getStoredGSheetConfig());
      setPref(getStoredDatabasePreference());
    };
    const handleAutoSyncStart = () => setIsAutoSyncing(true);
    const handleAutoSyncEnd = () => setIsAutoSyncing(false);

    window.addEventListener('spendwise_gsheet_sync_updated', handleUpdate);
    window.addEventListener('spendwise_data_modified', handleUpdate);
    window.addEventListener('spendwise_auto_sync_start', handleAutoSyncStart);
    window.addEventListener('spendwise_auto_sync_end', handleAutoSyncEnd);

    return () => {
      window.removeEventListener('spendwise_gsheet_sync_updated', handleUpdate);
      window.removeEventListener('spendwise_data_modified', handleUpdate);
      window.removeEventListener('spendwise_auto_sync_start', handleAutoSyncStart);
      window.removeEventListener('spendwise_auto_sync_end', handleAutoSyncEnd);
    };
  }, []);

  const handleTogglePreference = (target: 'cloud' | 'sheets') => {
    const updated: DatabasePreference = {
      useCloudStorage: target === 'cloud' ? !pref.useCloudStorage : pref.useCloudStorage,
      useGoogleSheets: target === 'sheets' ? !pref.useGoogleSheets : pref.useGoogleSheets,
    };

    if (!updated.useCloudStorage && !updated.useGoogleSheets) {
      if (target === 'cloud') updated.useGoogleSheets = true;
      else updated.useCloudStorage = true;
    }

    setPref(updated);
    saveStoredDatabasePreference(updated);
  };

  const handleCopyScript = () => {
    navigator.clipboard.writeText(SPENDWISE_APPS_SCRIPT_CODE);
    setHasCopiedScript(true);
    setTimeout(() => setHasCopiedScript(false), 3000);
  };

  const handleConnectManualWebApp = async () => {
    if (!manualWebAppUrl.trim()) {
      setGsheetStatusMessage({
        type: 'error',
        text: 'Please paste your Google Apps Script Web App URL.',
      });
      return;
    }

    setIsConnectingGSheet(true);
    setGsheetStatusMessage(null);

    try {
      const testRes = await testWebAppConnection(manualWebAppUrl);
      const syncRes = await syncAllDataViaWebApp(manualWebAppUrl, {
        accounts,
        transactions,
        categories,
        loans,
        rules,
        user,
      });

      const newConfig: GoogleSheetsSyncConfig = {
        ...gsheetConfig,
        connectionType: 'webapp',
        webAppUrl: manualWebAppUrl.trim(),
        spreadsheetId: testRes.spreadsheetId || gsheetConfig.spreadsheetId,
        spreadsheetUrl: manualSpreadsheetUrl.trim() || testRes.spreadsheetUrl || gsheetConfig.spreadsheetUrl,
        lastSyncedAt: new Date().toISOString(),
        autoSync: true,
      };

      setGsheetConfig(newConfig);
      saveStoredGSheetConfig(newConfig);

      if (!pref.useGoogleSheets) {
        const newPref = { ...pref, useGoogleSheets: true };
        setPref(newPref);
        saveStoredDatabasePreference(newPref);
      }

      setGsheetStatusMessage({
        type: 'success',
        text: `Connected successfully! ${syncRes.message}`,
      });
    } catch (err: any) {
      console.error('Google Apps Script connection error:', err);
      setGsheetStatusMessage({
        type: 'error',
        text: err?.message || 'Failed to connect to Google Apps Script Web App. Please check the URL and deployment settings.',
      });
    } finally {
      setIsConnectingGSheet(false);
    }
  };

  const handleSyncToSheets = async () => {
    if (!gsheetConfig.webAppUrl) return;
    setIsSyncingGSheet(true);
    setGsheetStatusMessage(null);
    try {
      const res = await syncAllDataViaWebApp(gsheetConfig.webAppUrl, {
        accounts,
        transactions,
        categories,
        loans,
        rules,
        user,
      });
      const updatedConfig = {
        ...gsheetConfig,
        lastSyncedAt: new Date().toISOString(),
      };
      setGsheetConfig(updatedConfig);
      saveStoredGSheetConfig(updatedConfig);
      setGsheetStatusMessage({ type: 'success', text: res.message });
    } catch (err: any) {
      setGsheetStatusMessage({ type: 'error', text: err?.message || 'Sync failed.' });
    } finally {
      setIsSyncingGSheet(false);
    }
  };

  const handlePullFromSheets = async () => {
    if (!gsheetConfig.webAppUrl) return;
    setIsPullingGSheet(true);
    setGsheetStatusMessage(null);
    try {
      const sheetData = await pullDataViaWebApp(gsheetConfig.webAppUrl);

      if (onRestoreFromSheets) {
        onRestoreFromSheets(sheetData);
      }

      const updatedConfig = {
        ...gsheetConfig,
        lastSyncedAt: new Date().toISOString(),
      };
      setGsheetConfig(updatedConfig);
      saveStoredGSheetConfig(updatedConfig);

      setGsheetStatusMessage({
        type: 'success',
        text: `Restored ${sheetData.transactions?.length || 0} transactions and ${sheetData.accounts?.length || 0} accounts from Google Sheet.`,
      });
    } catch (err: any) {
      setGsheetStatusMessage({ type: 'error', text: err?.message || 'Failed to restore data from Google Sheets.' });
    } finally {
      setIsPullingGSheet(false);
    }
  };

  const handleRemoveGoogleSheet = () => {
    clearStoredGSheetConfig();
    setGsheetConfig({ autoSync: false });
    setManualWebAppUrl('');
    setManualSpreadsheetUrl('');
    setShowRemoveConfirm(false);
    setGsheetStatusMessage({
      type: 'info',
      text: 'Google Sheet disconnected from SpendWise.',
    });
  };

  const isConnected = Boolean(gsheetConfig.webAppUrl);

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      {/* ---------------------------------------------------- */}
      {/* SECTION 1: User Profile Settings */}
      {/* ---------------------------------------------------- */}
      <section className="bg-white rounded-3xl p-6 sm:p-7 shadow-xs border border-slate-200/80">
        <div className="flex items-center justify-between pb-5 border-b border-slate-100 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">User Profile Settings</h2>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {profileSavedFeedback && (
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
                <Check className="w-4 h-4" />
                <span>Saved</span>
              </div>
            )}
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={name || 'User'}
                className="w-12 h-12 rounded-2xl object-cover border border-slate-200 shadow-xs flex-shrink-0"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  (e.currentTarget as HTMLElement).style.display = 'none';
                }}
              />
            ) : (
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center text-white text-base font-bold shadow-xs flex-shrink-0"
                style={{ backgroundColor: user.avatarColor || '#3B82F6' }}
              >
                {(name || email || 'U')
                  .split(' ')
                  .filter(Boolean)
                  .map((n) => n[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase() || 'U'}
              </div>
            )}
          </div>
        </div>

        <form onSubmit={handleProfileSubmit} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Full Name */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Full Name
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Arpit Acharya"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-600 focus:bg-white transition"
                />
              </div>
            </div>

            {/* Email Address */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  value={email}
                  readOnly
                  disabled
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-sm font-semibold text-slate-500 cursor-not-allowed"
                />
              </div>
            </div>

            {/* Mobile Number */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Mobile Number
              </label>
              <div className="flex items-center gap-2">
                <div className="relative w-28 flex-shrink-0">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-600 text-sm">
                    <span>{selectedCountry.flag}</span>
                  </div>
                  <select
                    value={countryCode}
                    onChange={(e) => setCountryCode(e.target.value)}
                    className="w-full pl-10 pr-2 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-600 focus:bg-white transition appearance-none cursor-pointer"
                  >
                    {COUNTRY_CODES.map((country, index) => (
                      <option key={index} value={country.code}>
                        {country.flag} {country.code}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Phone className="w-4 h-4" />
                  </div>
                  <input
                    type="tel"
                    inputMode="numeric"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/[^\d+\-\s()]/g, ''))}
                    placeholder="98765 43210"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-600 focus:bg-white transition"
                  />
                </div>
              </div>
            </div>

            {/* Preferred Currency */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Default Currency
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <DollarSign className="w-4 h-4" />
                </div>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-600 focus:bg-white transition appearance-none cursor-pointer"
                >
                  {CURRENCIES.map((c) => (
                    <option key={c.symbol} value={c.symbol}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end pt-3 border-t border-slate-100">
            <button
              type="submit"
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-xs transition active:scale-95 flex items-center gap-1.5 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Save Profile Changes</span>
            </button>
          </div>
        </form>
      </section>

      {/* ---------------------------------------------------- */}
      {/* SECTION 2: Manage Dashboard Cards */}
      {/* ---------------------------------------------------- */}
      <section className="bg-white rounded-3xl p-6 sm:p-7 shadow-xs border border-slate-200/80 space-y-6">
        <div className="flex items-center justify-between pb-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
              <SlidersHorizontal className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                Manage Dashboard Cards
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                  {enabledCards.length} Active
                </span>
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onResetDashboardCards}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
            title="Reset cards to factory layout"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset to Default Layout</span>
          </button>
        </div>

        {/* Active Cards List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              Active Cards ({enabledCards.length})
            </h3>
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

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => handleShiftUp(card.id)}
                        disabled={isFirst}
                        className={`p-1.5 rounded-xl border transition flex items-center justify-center ${
                          isFirst
                            ? 'bg-slate-100 text-slate-300 border-slate-200 cursor-not-allowed opacity-50'
                            : 'bg-white hover:bg-blue-50 text-slate-700 hover:text-blue-600 border-slate-200 shadow-2xs cursor-pointer active:scale-95'
                        }`}
                        title={isFirst ? 'Already at the top' : 'Shift card up'}
                      >
                        <ArrowUp className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleShiftDown(card.id)}
                        disabled={isLast}
                        className={`p-1.5 rounded-xl border transition flex items-center justify-center ${
                          isLast
                            ? 'bg-slate-100 text-slate-300 border-slate-200 cursor-not-allowed opacity-50'
                            : 'bg-white hover:bg-blue-50 text-slate-700 hover:text-blue-600 border-slate-200 shadow-2xs cursor-pointer active:scale-95'
                        }`}
                        title={isLast ? 'Already at the bottom' : 'Shift card down'}
                      >
                        <ArrowDown className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleRemoveCard(card.id)}
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
            </div>
          )}
        </div>

        {/* Available Cards List */}
        <div className="space-y-3 pt-4 border-t border-slate-100">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5 text-blue-600" />
            Available Cards to Add ({disabledCards.length})
          </h3>

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
                    type="button"
                    onClick={() => handleAddCard(card.id)}
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
              <span>All available cards are currently active on your dashboard.</span>
            </div>
          )}
        </div>
      </section>

      {/* ---------------------------------------------------- */}
      {/* SECTION 3: Database & Storage Settings */}
      {/* ---------------------------------------------------- */}
      <section className="bg-white rounded-3xl p-6 sm:p-7 shadow-xs border border-slate-200/80 space-y-5">
        <div className="flex items-center justify-between pb-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Database & Storage Settings</h2>
            </div>
          </div>
        </div>

        {/* Cloud Storage Toggle */}
        <div className={`rounded-2xl border-2 transition-all p-4 bg-slate-50/50 flex items-center justify-between ${
          pref.useCloudStorage 
            ? 'border-blue-500 ring-1 ring-blue-500/50' 
            : 'border-slate-200'
        }`}>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h4 className="text-xs font-bold text-slate-900">Cloud Storage</h4>
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">
                  Default
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Supabase secure database (Multi-device persistent sync)
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => handleTogglePreference('cloud')}
            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              pref.useCloudStorage ? 'bg-blue-600' : 'bg-slate-300'
            }`}
            role="switch"
            aria-checked={pref.useCloudStorage}
          >
            <span
              aria-hidden="true"
              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                pref.useCloudStorage ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Google Sheets Card */}
        <div className={`rounded-2xl border-2 transition-all p-4 bg-slate-50/50 space-y-3.5 ${
          pref.useGoogleSheets 
            ? 'border-emerald-500 ring-1 ring-emerald-500/50' 
            : 'border-slate-200'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900">Personal Google Sheet (GAS)</h4>
                <p className="text-[11px] text-slate-500">
                  Sync & store transactions in your personal spreadsheet
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleTogglePreference('sheets')}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                pref.useGoogleSheets ? 'bg-emerald-600' : 'bg-slate-300'
              }`}
              role="switch"
              aria-checked={pref.useGoogleSheets}
            >
              <span
                aria-hidden="true"
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                  pref.useGoogleSheets ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {isConnected ? (
            <div className="space-y-2.5 pt-2 border-t border-slate-200">
              <div className="flex items-center justify-between text-[11px] p-2.5 rounded-xl bg-white border border-slate-200">
                <div className="flex items-center gap-1.5 truncate">
                  <span className="font-semibold text-slate-700">Connection:</span>
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                    ⚡ Google Apps Script (GAS)
                  </span>
                </div>
                {gsheetConfig.spreadsheetUrl ? (
                  <a 
                    href={gsheetConfig.spreadsheetUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-emerald-600 hover:underline inline-flex items-center gap-1 font-semibold shrink-0 ml-2"
                  >
                    Open Sheet <ExternalLink className="w-3 h-3" />
                  </a>
                ) : null}
              </div>

              {/* Sync status */}
              <div className={`text-[11px] flex items-center justify-between py-2 px-3 rounded-xl border ${
                isAutoSyncing
                  ? 'bg-blue-50 text-blue-800 border-blue-200'
                  : isGoogleSheetsSynced()
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-amber-50 text-amber-800 border-amber-200'
              }`}>
                <div className="flex items-center gap-1.5">
                  {isAutoSyncing ? (
                    <>
                      <RefreshCw className="w-3 h-3 text-blue-600 animate-spin" />
                      <span className="font-semibold text-blue-700">
                        Auto-syncing changes to Google Sheet...
                      </span>
                    </>
                  ) : (
                    <>
                      <span className={`w-2 h-2 rounded-full ${isGoogleSheetsSynced() ? 'bg-emerald-500' : 'bg-amber-400'}`} />
                      <span className="font-semibold">
                        {isGoogleSheetsSynced() ? 'All data is synced • Auto-sync active' : 'Changes pending auto-sync'}
                      </span>
                    </>
                  )}
                </div>
                {gsheetConfig.lastSyncedAt && !isAutoSyncing && (
                  <span className="text-[10px] opacity-75">
                    Last sync: {new Date(gsheetConfig.lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleSyncToSheets}
                  disabled={isSyncingGSheet || !pref.useGoogleSheets}
                  className="flex-1 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <UploadCloud className="w-3.5 h-3.5" />
                  {isSyncingGSheet ? 'Syncing...' : 'Sync Now'}
                </button>

                <button
                  type="button"
                  onClick={handlePullFromSheets}
                  disabled={isPullingGSheet || !pref.useGoogleSheets}
                  className="flex-1 px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50 text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <DownloadCloud className="w-3.5 h-3.5" />
                  {isPullingGSheet ? 'Restoring...' : 'Restore'}
                </button>

                <button
                  type="button"
                  onClick={() => setShowRemoveConfirm(true)}
                  className="p-2 rounded-xl text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition cursor-pointer border border-transparent hover:border-rose-200"
                  title="Disconnect Google Sheet"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3 bg-white p-4 rounded-2xl border border-slate-200 text-xs">
              <div className="space-y-2 text-[11px] text-slate-600">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-emerald-700 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5" /> 1-Click Apps Script Setup
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyScript}
                    className="px-2.5 py-1 text-[10px] font-bold rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition flex items-center gap-1 cursor-pointer"
                  >
                    {hasCopiedScript ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    {hasCopiedScript ? 'Copied to Clipboard!' : 'Copy Script Code'}
                  </button>
                </div>

                <ol className="list-decimal pl-4 space-y-1 text-slate-600">
                  <li>
                    Open your Google Sheet (or create one at <a href="https://sheets.new" target="_blank" rel="noopener noreferrer" className="text-emerald-600 underline font-semibold">sheets.new</a>)
                  </li>
                  <li>
                    Click <strong>Extensions → Apps Script</strong> and paste the copied code into <code>Code.gs</code>
                  </li>
                  <li>
                    Click <strong>Deploy → New deployment</strong>, select type <strong>Web app</strong>, set <em>Who has access</em> to <strong>Anyone</strong>, and deploy.
                  </li>
                  <li>
                    Paste your deployed <strong>Web App URL</strong> below:
                  </li>
                </ol>
              </div>

              <div className="space-y-2 pt-1">
                <input
                  type="url"
                  placeholder="https://script.google.com/macros/s/.../exec"
                  value={manualWebAppUrl}
                  onChange={(e) => setManualWebAppUrl(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono text-[11px]"
                />

                <input
                  type="url"
                  placeholder="Optional: Google Sheet link (e.g. https://docs.google.com/spreadsheets/d/...)"
                  value={manualSpreadsheetUrl}
                  onChange={(e) => setManualSpreadsheetUrl(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-[11px]"
                />
              </div>

              <button
                type="button"
                onClick={handleConnectManualWebApp}
                disabled={isConnectingGSheet || !manualWebAppUrl.trim()}
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs mt-1"
              >
                <Sparkles className="w-3.5 h-3.5" />
                {isConnectingGSheet ? 'Testing & Synchronizing...' : 'Connect & Sync Google Sheet'}
              </button>
            </div>
          )}

          {showRemoveConfirm && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs space-y-2">
              <p className="text-rose-800 font-semibold">
                Disconnect current Google Sheet?
              </p>
              <p className="text-[11px] text-rose-700">
                This will unbind the spreadsheet from SpendWise. Your sheet data in Google Drive remains 100% safe.
              </p>
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowRemoveConfirm(false)}
                  className="px-3 py-1 text-[11px] rounded-lg bg-white text-slate-700 border border-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleRemoveGoogleSheet}
                  className="px-3 py-1 text-[11px] font-semibold rounded-lg bg-rose-600 hover:bg-rose-700 text-white cursor-pointer"
                >
                  Yes, Disconnect
                </button>
              </div>
            </div>
          )}

          {gsheetStatusMessage && (
            <div className={`text-[11px] p-3 rounded-xl border flex items-start gap-1.5 ${
              gsheetStatusMessage.type === 'success' 
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                : gsheetStatusMessage.type === 'error'
                ? 'bg-rose-50 text-rose-800 border-rose-200'
                : 'bg-blue-50 text-blue-800 border-blue-200'
            }`}>
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{gsheetStatusMessage.text}</span>
            </div>
          )}

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
            <button
              type="button"
              onClick={handleCopyScript}
              className="text-[11px] font-semibold text-slate-500 hover:text-emerald-600 flex items-center gap-1 cursor-pointer"
            >
              <Code className="w-3.5 h-3.5" />
              {hasCopiedScript ? 'Script Copied!' : 'Copy Apps Script'}
            </button>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------- */}
      {/* SECTION 4: REST API, Webhooks & iPhone Shortcuts */}
      {/* ---------------------------------------------------- */}
      <ApiSettingsSection
        user={user}
        accounts={accounts}
        categories={categories}
        appsScriptUrl={gsheetConfig.webAppUrl}
        onAddTransaction={onAddTransaction}
      />

      {/* ---------------------------------------------------- */}
      {/* SECTION 5: Account Logout */}
      {/* ---------------------------------------------------- */}
      <section className="bg-white rounded-3xl p-6 shadow-xs border border-slate-200/80 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Session & Authentication</h3>
          <p className="text-xs text-slate-500 mt-0.5">Signed in as {user.email}</p>
        </div>
        <button
          type="button"
          onClick={onLogout}
          className="px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 hover:text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>Log out</span>
        </button>
      </section>
    </div>
  );
};
