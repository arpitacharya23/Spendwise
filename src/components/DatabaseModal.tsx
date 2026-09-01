import React, { useState, useEffect } from 'react';
import { 
  Cloud, 
  FileSpreadsheet, 
  ExternalLink, 
  RefreshCw, 
  UploadCloud, 
  DownloadCloud, 
  AlertCircle,
  X,
  Database,
  Trash2,
  Copy,
  Check,
  Code,
  Sparkles,
  HelpCircle,
  CheckCircle2
} from 'lucide-react';
import { UserProfile, Account, Transaction, Category, LoanEMI, TransactionRule } from '../types';
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

interface DatabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile;
  accounts: Account[];
  transactions: Transaction[];
  categories: Category[];
  loans: LoanEMI[];
  rules: TransactionRule[];
  onRestoreFromSheets?: (data: {
    accounts?: Account[];
    transactions?: Transaction[];
    categories?: Category[];
    loans?: LoanEMI[];
    rules?: TransactionRule[];
  }) => void;
}

export const DatabaseModal: React.FC<DatabaseModalProps> = ({
  isOpen,
  onClose,
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

  if (!isOpen) return null;

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

  // Connect via Google Apps Script Web App
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
      // Test the Web App endpoint
      const testRes = await testWebAppConnection(manualWebAppUrl);

      // Perform initial synchronization of existing local records to user's sheet
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
        text: `Connected successfully! ${syncRes.message}`
      });
    } catch (err: any) {
      console.error('Google Apps Script connection error:', err);
      setGsheetStatusMessage({
        type: 'error',
        text: err?.message || 'Failed to connect to Google Apps Script Web App. Please check the URL and deployment settings.'
      });
    } finally {
      setIsConnectingGSheet(false);
    }
  };

  // Sync to Sheets
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
        user
      });
      const updatedConfig = {
        ...gsheetConfig,
        lastSyncedAt: new Date().toISOString()
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

  // Restore / Pull from Sheets
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

  const isConnected = Boolean(gsheetConfig.webAppUrl);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
              <Database className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Database & Storage Settings</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 space-y-4 overflow-y-auto flex-1 text-slate-700 dark:text-slate-300">
          
          {/* Cloud Storage (Supabase) - Default ON */}
          <div className={`rounded-xl border-2 transition-all p-3.5 bg-slate-50/50 dark:bg-slate-800/40 flex items-center justify-between ${
            pref.useCloudStorage 
              ? 'border-blue-500 ring-1 ring-blue-500/50' 
              : 'border-slate-200 dark:border-slate-700/60'
          }`}>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
                <Cloud className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">Cloud Storage</h4>
                  <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                    Default
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Supabase secure database (Multi-device persistent sync)
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleTogglePreference('cloud')}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                pref.useCloudStorage ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-600'
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

          {/* Google Sheets Personal Storage Card (Google Apps Script) */}
          <div className={`rounded-xl border-2 transition-all p-4 bg-slate-50/50 dark:bg-slate-800/40 space-y-3.5 ${
            pref.useGoogleSheets 
              ? 'border-emerald-500 ring-1 ring-emerald-500/50' 
              : 'border-slate-200 dark:border-slate-700/60'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">Personal Google Sheet (GAS)</h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Sync & store transactions in your personal spreadsheet
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleTogglePreference('sheets')}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  pref.useGoogleSheets ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-600'
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

            {/* If Connected: Show Active Sheet Info & Actions */}
            {isConnected ? (
              <div className="space-y-2 pt-1 border-t border-slate-200 dark:border-slate-700/60">
                <div className="flex items-center justify-between text-[11px] p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="font-semibold text-slate-700 dark:text-slate-200">Connection:</span>
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
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

                {/* Sync status badge */}
                <div className={`text-[11px] flex items-center justify-between py-1.5 px-2.5 rounded-lg border ${
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
                        <span className="font-semibold text-blue-700 dark:text-blue-300">
                          Auto-syncing changes to Google Sheet...
                        </span>
                      </>
                    ) : (
                      <>
                        <span className={`w-2 h-2 rounded-full ${isGoogleSheetsSynced() ? 'bg-emerald-500' : 'bg-amber-400'}`} />
                        <span className="font-semibold">
                          {isGoogleSheetsSynced() ? 'All data is synced • Auto-sync active' : 'Changes pending auto-sync (Yellow circle)'}
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
                    className="flex-1 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <DownloadCloud className="w-3.5 h-3.5" />
                    {isPullingGSheet ? 'Restoring...' : 'Restore'}
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowRemoveConfirm(true)}
                    className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                    title="Disconnect Google Sheet"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              /* If Not Connected: Dedicated Google Apps Script Web App setup */
              <div className="space-y-2.5 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
                <div className="space-y-2 text-[11px] text-slate-600 dark:text-slate-400">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5" /> 1-Click Apps Script Setup
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyScript}
                      className="px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 transition flex items-center gap-1 cursor-pointer"
                    >
                      {hasCopiedScript ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      {hasCopiedScript ? 'Copied to Clipboard!' : 'Copy Script Code'}
                    </button>
                  </div>

                  <ol className="list-decimal pl-4 space-y-1 text-slate-600 dark:text-slate-300">
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

                <div className="space-y-1.5 pt-1">
                  <input
                    type="url"
                    placeholder="https://script.google.com/macros/s/.../exec"
                    value={manualWebAppUrl}
                    onChange={(e) => setManualWebAppUrl(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono text-[11px]"
                  />

                  <input
                    type="url"
                    placeholder="Optional: Google Sheet link (e.g. https://docs.google.com/spreadsheets/d/...)"
                    value={manualSpreadsheetUrl}
                    onChange={(e) => setManualSpreadsheetUrl(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-[11px]"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleConnectManualWebApp}
                  disabled={isConnectingGSheet || !manualWebAppUrl.trim()}
                  className="w-full py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs mt-1"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  {isConnectingGSheet ? 'Testing & Synchronizing...' : 'Connect & Sync Google Sheet'}
                </button>
              </div>
            )}

            {/* Remove Sheet Confirmation Dialog */}
            {showRemoveConfirm && (
              <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs space-y-2">
                <p className="text-rose-800 dark:text-rose-200 font-semibold">
                  Disconnect current Google Sheet?
                </p>
                <p className="text-[11px] text-rose-700 dark:text-rose-300">
                  This will unbind the spreadsheet from SpendWise. Your sheet data in Google Drive remains 100% safe.
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
              <div className={`text-[11px] p-2.5 rounded-lg border flex items-start gap-1.5 ${
                gsheetStatusMessage.type === 'success' 
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800' 
                  : gsheetStatusMessage.type === 'error'
                  ? 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
                  : 'bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800'
              }`}>
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>{gsheetStatusMessage.text}</span>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-3 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={handleCopyScript}
            className="text-[11px] font-semibold text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 flex items-center gap-1 cursor-pointer"
          >
            <Code className="w-3.5 h-3.5" />
            {hasCopiedScript ? 'Script Copied!' : 'Copy Apps Script'}
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600 transition cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
