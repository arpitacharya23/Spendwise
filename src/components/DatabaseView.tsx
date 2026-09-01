import React, { useState, useEffect } from 'react';
import { 
  Cloud, 
  FileSpreadsheet, 
  ExternalLink, 
  RefreshCw, 
  UploadCloud, 
  DownloadCloud, 
  AlertCircle,
  Copy,
  Check,
  Code,
  ShieldCheck,
  Sparkles,
  HelpCircle,
  Trash2
} from 'lucide-react';
import { UserProfile, Account, Transaction, Category, LoanEMI, TransactionRule } from '../types';
import { 
  DatabasePreference, 
  getStoredDatabasePreference, 
  saveStoredDatabasePreference,
  getStoredGSheetConfig,
  saveStoredGSheetConfig,
  clearStoredGSheetConfig,
  requestGoogleOAuthToken,
  getOrCreateSpendwiseSpreadsheet,
  syncAllDataToGoogleSheets,
  pullDataFromGoogleSheets,
  testWebAppConnection,
  syncAllDataViaWebApp,
  pullDataViaWebApp,
  isGoogleSheetsSynced,
  GoogleSheetsSyncConfig,
  SPENDWISE_APPS_SCRIPT_CODE
} from '../lib/googleSheetsService';

interface DatabaseViewProps {
  user: UserProfile;
  accounts: Account[];
  transactions: Transaction[];
  categories: Category[];
  loans: LoanEMI[];
  rules: TransactionRule[];
  onRefreshData?: () => void;
  onRestoreFromSheets?: (data: {
    accounts?: Account[];
    transactions?: Transaction[];
    categories?: Category[];
    loans?: LoanEMI[];
    rules?: TransactionRule[];
  }) => void;
}

export const DatabaseView: React.FC<DatabaseViewProps> = ({
  user,
  accounts,
  transactions,
  categories,
  loans,
  rules,
  onRestoreFromSheets
}) => {
  const [pref, setPref] = useState<DatabasePreference>(() => getStoredDatabasePreference());
  const [gsheetConfig, setGsheetConfig] = useState<GoogleSheetsSyncConfig>(() => getStoredGSheetConfig());
  
  // Connection method tab: 'manual' vs 'oauth'
  const [connectMethod, setConnectMethod] = useState<'manual' | 'oauth'>('manual');
  const [manualWebAppUrl, setManualWebAppUrl] = useState(gsheetConfig.webAppUrl || '');
  const [manualSpreadsheetUrl, setManualSpreadsheetUrl] = useState(gsheetConfig.spreadsheetUrl || '');
  const [hasCopiedScript, setHasCopiedScript] = useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);

  const [isConnectingGSheet, setIsConnectingGSheet] = useState(false);
  const [isSyncingGSheet, setIsSyncingGSheet] = useState(false);
  const [isPullingGSheet, setIsPullingGSheet] = useState(false);
  const [isAutoSyncing, setIsAutoSyncing] = useState(false);
  const [gsheetStatusMessage, setGsheetStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

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

  // 1. Manual Apps Script Web App Connection
  const handleConnectManualWebApp = async () => {
    if (!manualWebAppUrl.trim()) {
      setGsheetStatusMessage({
        type: 'error',
        text: 'Please paste your Google Apps Script Web App URL.'
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
        user
      });

      const newConfig: GoogleSheetsSyncConfig = {
        ...gsheetConfig,
        connectionType: 'webapp',
        webAppUrl: manualWebAppUrl.trim(),
        spreadsheetId: testRes.spreadsheetId || gsheetConfig.spreadsheetId,
        spreadsheetUrl: manualSpreadsheetUrl.trim() || testRes.spreadsheetUrl || gsheetConfig.spreadsheetUrl,
        lastSyncedAt: new Date().toISOString(),
        autoSync: true
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
        text: `Connected! ${syncRes.message}`
      });
    } catch (err: any) {
      console.error('Manual Web App connection error:', err);
      setGsheetStatusMessage({
        type: 'error',
        text: err?.message || 'Failed to connect to Google Apps Script Web App. Please check the URL and permissions.'
      });
    } finally {
      setIsConnectingGSheet(false);
    }
  };

  // 2. Automatic Google OAuth Connection
  const handleConnectGoogleOAuth = async (forceConsent = true) => {
    setIsConnectingGSheet(true);
    setGsheetStatusMessage(null);
    try {
      const token = await requestGoogleOAuthToken(forceConsent);
      const sheet = await getOrCreateSpendwiseSpreadsheet(token, `SpendWise Ledger - ${user.name || 'Personal'}`);

      const newConfig: GoogleSheetsSyncConfig = {
        ...gsheetConfig,
        connectionType: 'oauth',
        spreadsheetId: sheet.id,
        spreadsheetUrl: sheet.url,
        webAppUrl: undefined,
        lastSyncedAt: new Date().toISOString(),
        autoSync: true
      };
      setGsheetConfig(newConfig);
      saveStoredGSheetConfig(newConfig);

      const syncRes = await syncAllDataToGoogleSheets(token, sheet.id, {
        accounts,
        transactions,
        categories,
        loans,
        rules,
        user
      });

      if (!pref.useGoogleSheets) {
        const newPref = { ...pref, useGoogleSheets: true };
        setPref(newPref);
        saveStoredDatabasePreference(newPref);
      }

      setGsheetStatusMessage({ 
        type: 'success', 
        text: `Connected! ${syncRes.message}` 
      });
    } catch (err: any) {
      console.error('Google Sheets OAuth connection error:', err);
      setGsheetStatusMessage({ 
        type: 'error', 
        text: err?.message || 'Failed to connect Google Sheets. Consider using the Manual Web App option.' 
      });
    } finally {
      setIsConnectingGSheet(false);
    }
  };

  const handleSyncToSheets = async () => {
    setIsSyncingGSheet(true);
    setGsheetStatusMessage(null);
    try {
      if (gsheetConfig.connectionType === 'webapp' || gsheetConfig.webAppUrl) {
        const res = await syncAllDataViaWebApp(gsheetConfig.webAppUrl!, {
          accounts,
          transactions,
          categories,
          loans,
          rules,
          user
        });
        const updatedConfig = {
          ...gsheetConfig,
          lastSyncedAt: new Date().toISOString()
        };
        setGsheetConfig(updatedConfig);
        saveStoredGSheetConfig(updatedConfig);
        setGsheetStatusMessage({ type: 'success', text: res.message });
      } else {
        const token = await requestGoogleOAuthToken();
        let targetSheetId = gsheetConfig.spreadsheetId;
        if (!targetSheetId) {
          const sheet = await getOrCreateSpendwiseSpreadsheet(token, `SpendWise Ledger - ${user.name || 'Personal'}`);
          targetSheetId = sheet.id;
          const newConfig = { ...gsheetConfig, spreadsheetId: sheet.id, spreadsheetUrl: sheet.url };
          setGsheetConfig(newConfig);
          saveStoredGSheetConfig(newConfig);
        }

        const res = await syncAllDataToGoogleSheets(token, targetSheetId, {
          accounts,
          transactions,
          categories,
          loans,
          rules,
          user
        });

        const updatedConfig = {
          ...gsheetConfig,
          lastSyncedAt: new Date().toISOString()
        };
        setGsheetConfig(updatedConfig);
        saveStoredGSheetConfig(updatedConfig);
        setGsheetStatusMessage({ type: 'success', text: res.message });
      }
    } catch (err: any) {
      setGsheetStatusMessage({ type: 'error', text: err?.message || 'Sync failed.' });
    } finally {
      setIsSyncingGSheet(false);
    }
  };

  const handlePullFromSheets = async () => {
    if (!gsheetConfig.webAppUrl && !gsheetConfig.spreadsheetId) return;
    setIsPullingGSheet(true);
    setGsheetStatusMessage(null);
    try {
      let sheetData: any = {};
      if (gsheetConfig.connectionType === 'webapp' || gsheetConfig.webAppUrl) {
        sheetData = await pullDataViaWebApp(gsheetConfig.webAppUrl!);
      } else {
        const token = await requestGoogleOAuthToken();
        sheetData = await pullDataFromGoogleSheets(token, gsheetConfig.spreadsheetId!);
      }

      if (onRestoreFromSheets) {
        onRestoreFromSheets(sheetData);
      }

      const updatedConfig = {
        ...gsheetConfig,
        lastSyncedAt: new Date().toISOString()
      };
      setGsheetConfig(updatedConfig);
      saveStoredGSheetConfig(updatedConfig);

      setGsheetStatusMessage({
        type: 'success',
        text: `Restored ${sheetData.transactions?.length || 0} transactions and ${sheetData.accounts?.length || 0} accounts from Google Sheet.`
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
      text: 'Google Sheet disconnected from SpendWise.'
    });
  };

  const isConnected = Boolean(gsheetConfig.webAppUrl || gsheetConfig.spreadsheetId);

  return (
    <div className="max-w-4xl mx-auto py-2 space-y-4 text-slate-700 dark:text-slate-300">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* Cloud Storage Card */}
        <div className={`rounded-2xl border-2 transition-all p-5 bg-white dark:bg-slate-900 flex flex-col justify-between ${
          pref.useCloudStorage 
            ? 'border-blue-500 shadow-sm ring-1 ring-blue-500' 
            : 'border-slate-200 dark:border-slate-800'
        }`}>
          <div>
            <div className="flex items-center justify-between gap-3 mb-2">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
                  <Cloud className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white">Cloud Storage</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Supabase database
                  </p>
                </div>
              </div>

              {/* Toggle Switch */}
              <button
                type="button"
                onClick={() => handleTogglePreference('cloud')}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  pref.useCloudStorage ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'
                }`}
                role="switch"
                aria-checked={pref.useCloudStorage}
              >
                <span
                  aria-hidden="true"
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                    pref.useCloudStorage ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">
              Primary cloud backend for multi-device sync and fast data access.
            </p>
          </div>
        </div>

        {/* Google Sheets Card */}
        <div className={`rounded-2xl border-2 transition-all p-5 bg-white dark:bg-slate-900 flex flex-col justify-between ${
          pref.useGoogleSheets 
            ? 'border-emerald-500 shadow-sm ring-1 ring-emerald-500' 
            : 'border-slate-200 dark:border-slate-800'
        }`}>
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
                  <FileSpreadsheet className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white">Personal Google Sheet</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Your personal Google Drive spreadsheet
                  </p>
                </div>
              </div>

              {/* Toggle Switch */}
              <button
                type="button"
                onClick={() => handleTogglePreference('sheets')}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  pref.useGoogleSheets ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-700'
                }`}
                role="switch"
                aria-checked={pref.useGoogleSheets}
              >
                <span
                  aria-hidden="true"
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                    pref.useGoogleSheets ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Connected Info */}
            {isConnected ? (
              <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                <div className="text-xs flex items-center justify-between py-1.5 px-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="font-semibold text-slate-700 dark:text-slate-200">Connection:</span>
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                      {gsheetConfig.connectionType === 'webapp' ? '⚡ Apps Script Web App' : '🔑 Google OAuth'}
                    </span>
                  </div>
                  {gsheetConfig.spreadsheetUrl && (
                    <a 
                      href={gsheetConfig.spreadsheetUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-emerald-600 hover:underline inline-flex items-center gap-1 font-semibold text-xs ml-2 shrink-0"
                    >
                      Open Sheet <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>

                <div className={`text-xs flex items-center justify-between py-1.5 px-2.5 rounded-lg border ${
                  isAutoSyncing
                    ? 'bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800'
                    : isGoogleSheetsSynced()
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                    : 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
                }`}>
                  <div className="flex items-center gap-1.5">
                    {isAutoSyncing ? (
                      <>
                        <RefreshCw className="w-3 h-3 text-blue-600 animate-spin" />
                        <span className="font-semibold text-[11px] text-blue-700 dark:text-blue-300">
                          Auto-syncing changes to Google Sheet...
                        </span>
                      </>
                    ) : (
                      <>
                        <span className={`w-2 h-2 rounded-full ${isGoogleSheetsSynced() ? 'bg-emerald-500' : 'bg-amber-400'}`} />
                        <span className="font-semibold text-[11px]">
                          {isGoogleSheetsSynced() ? 'All data synced • Auto-sync active' : 'Changes pending auto-sync (Yellow circle)'}
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

                {/* Actions when connected */}
                <div className="flex items-center justify-between gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={handleSyncToSheets}
                    disabled={isSyncingGSheet || !pref.useGoogleSheets}
                    className="flex-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <UploadCloud className="w-3.5 h-3.5" />
                    {isSyncingGSheet ? 'Syncing...' : 'Sync Now'}
                  </button>

                  <button
                    type="button"
                    onClick={handlePullFromSheets}
                    disabled={isPullingGSheet || !pref.useGoogleSheets}
                    className="flex-1 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <DownloadCloud className="w-3.5 h-3.5" />
                    {isPullingGSheet ? 'Restoring...' : 'Restore'}
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowRemoveConfirm(true)}
                    className="p-2 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                    title="Disconnect Google Sheet"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              /* Connect Selector: Manual vs OAuth */
              <div className="space-y-3 pt-1 border-t border-slate-100 dark:border-slate-800">
                <div className="flex rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setConnectMethod('manual')}
                    className={`flex-1 py-1.5 px-2 rounded-md transition flex items-center justify-center gap-1 cursor-pointer ${
                      connectMethod === 'manual'
                        ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    <Sparkles className="w-3 h-3 text-emerald-500" />
                    Manual (Apps Script)
                  </button>
                  <button
                    type="button"
                    onClick={() => setConnectMethod('oauth')}
                    className={`flex-1 py-1.5 px-2 rounded-md transition flex items-center justify-center gap-1 cursor-pointer ${
                      connectMethod === 'oauth'
                        ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    <ShieldCheck className="w-3 h-3 text-blue-500" />
                    Automatic (OAuth)
                  </button>
                </div>

                {connectMethod === 'manual' && (
                  <div className="space-y-2 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200 dark:border-slate-700/60 text-xs">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">1. Copy Apps Script:</span>
                      <button
                        type="button"
                        onClick={handleCopyScript}
                        className="px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-200 transition flex items-center gap-1 cursor-pointer"
                      >
                        {hasCopiedScript ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                        {hasCopiedScript ? 'Copied!' : 'Copy Script Code'}
                      </button>
                    </div>

                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      2. In your Sheet, click <strong>Extensions → Apps Script</strong>, paste code, click <strong>Deploy → Web app</strong> (Access: Anyone).
                    </p>

                    <input
                      type="url"
                      placeholder="3. Paste Web App URL (https://script.google.com/.../exec)"
                      value={manualWebAppUrl}
                      onChange={(e) => setManualWebAppUrl(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono text-[11px]"
                    />

                    <button
                      type="button"
                      onClick={handleConnectManualWebApp}
                      disabled={isConnectingGSheet || !manualWebAppUrl.trim()}
                      className="w-full py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs mt-1"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      {isConnectingGSheet ? 'Testing Connection...' : 'Connect Personal Sheet'}
                    </button>
                  </div>
                )}

                {connectMethod === 'oauth' && (
                  <div className="space-y-2 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200 dark:border-slate-700/60 text-xs">
                    <p className="text-[11px] text-slate-600 dark:text-slate-400">
                      Connect directly using Google Sign-In to auto-create a SpendWise sheet in Google Drive.
                    </p>
                    <button
                      type="button"
                      onClick={() => handleConnectGoogleOAuth(true)}
                      disabled={isConnectingGSheet}
                      className="w-full py-2 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      {isConnectingGSheet ? 'Connecting via Google...' : 'Sign in & Connect with Google'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Remove Sheet Confirmation Dialog */}
            {showRemoveConfirm && (
              <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs space-y-2">
                <p className="text-rose-800 dark:text-rose-200 font-semibold">
                  Disconnect current Google Sheet?
                </p>
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowRemoveConfirm(false)}
                    className="px-2.5 py-1 text-[11px] rounded bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleRemoveGoogleSheet}
                    className="px-2.5 py-1 text-[11px] font-semibold rounded bg-rose-600 hover:bg-rose-700 text-white cursor-pointer"
                  >
                    Yes, Disconnect
                  </button>
                </div>
              </div>
            )}

            {gsheetStatusMessage && (
              <div className={`text-xs p-2.5 rounded-lg border flex items-start gap-1.5 ${
                gsheetStatusMessage.type === 'success' 
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800' 
                  : gsheetStatusMessage.type === 'error'
                  ? 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
                  : 'bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800'
              }`}>
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span>{gsheetStatusMessage.text}</span>
                  {gsheetStatusMessage.type === 'error' && gsheetStatusMessage.text.includes('403') && (
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setConnectMethod('manual');
                          setGsheetStatusMessage(null);
                        }}
                        className="text-emerald-700 dark:text-emerald-300 underline font-semibold text-[10px] cursor-pointer"
                      >
                        👉 Switch to Manual (Apps Script) connection option
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

