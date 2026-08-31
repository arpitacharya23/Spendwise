import React, { useState } from 'react';
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
  Unlink
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
  isGoogleSheetsSynced,
  GoogleSheetsSyncConfig
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
  
  const [isConnectingGSheet, setIsConnectingGSheet] = useState(false);
  const [isSyncingGSheet, setIsSyncingGSheet] = useState(false);
  const [isPullingGSheet, setIsPullingGSheet] = useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [gsheetStatusMessage, setGsheetStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

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

  const handleConnectGoogleSheets = async () => {
    setIsConnectingGSheet(true);
    setGsheetStatusMessage(null);
    try {
      const token = await requestGoogleOAuthToken();
      const sheet = await getOrCreateSpendwiseSpreadsheet(token, `SpendWise Ledger - ${user.name || 'Personal'}`);

      const newConfig: GoogleSheetsSyncConfig = {
        ...gsheetConfig,
        spreadsheetId: sheet.id,
        spreadsheetUrl: sheet.url,
        lastSyncedAt: new Date().toISOString()
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
      console.error('Google Sheets connection error:', err);
      setGsheetStatusMessage({ 
        type: 'error', 
        text: err?.message || 'Failed to connect Google Sheets.' 
      });
    } finally {
      setIsConnectingGSheet(false);
    }
  };

  const handleSyncToSheets = async () => {
    setIsSyncingGSheet(true);
    setGsheetStatusMessage(null);
    try {
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
    } catch (err: any) {
      setGsheetStatusMessage({ type: 'error', text: err?.message || 'Sync failed.' });
    } finally {
      setIsSyncingGSheet(false);
    }
  };

  const handlePullFromSheets = async () => {
    if (!gsheetConfig.spreadsheetId) return;
    setIsPullingGSheet(true);
    setGsheetStatusMessage(null);
    try {
      const token = await requestGoogleOAuthToken();
      const sheetData = await pullDataFromGoogleSheets(token, gsheetConfig.spreadsheetId);

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
        text: `Restored ${sheetData.transactions?.length || 0} transactions and ${sheetData.accounts?.length || 0} accounts.`
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
    setShowRemoveConfirm(false);
    setGsheetStatusMessage({
      type: 'info',
      text: 'Google Sheet disconnected from this device.'
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
              <Database className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Database & Storage</h3>
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
        <div className="p-4 space-y-3">
          {/* Cloud Storage Option */}
          <div className={`rounded-xl border-2 transition-all p-4 bg-slate-50/50 dark:bg-slate-800/40 flex items-center justify-between ${
            pref.useCloudStorage 
              ? 'border-blue-500 ring-1 ring-blue-500/50' 
              : 'border-slate-200 dark:border-slate-700/60'
          }`}>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
                <Cloud className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-white">Cloud Storage</h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Supabase database
                </p>
              </div>
            </div>

            {/* Toggle Switch */}
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

          {/* Google Sheets Option */}
          <div className={`rounded-xl border-2 transition-all p-4 bg-slate-50/50 dark:bg-slate-800/40 space-y-3 ${
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
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">Google Sheets</h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Google Drive spreadsheet
                  </p>
                </div>
              </div>

              {/* Toggle Switch */}
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

            {/* Google Sheets Status Link & Sync State */}
            {gsheetConfig.spreadsheetUrl && (
              <div className="space-y-1.5">
                <div className="text-[11px] flex items-center justify-between py-1.5 px-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <span className="text-slate-500">Spreadsheet:</span>
                  <a 
                    href={gsheetConfig.spreadsheetUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-emerald-600 hover:underline inline-flex items-center gap-1 font-semibold"
                  >
                    Open in Google Sheets
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <div className={`text-[11px] flex items-center justify-between py-1.5 px-2.5 rounded-lg border ${
                  isGoogleSheetsSynced()
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                    : 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
                }`}>
                  <div className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${isGoogleSheetsSynced() ? 'bg-emerald-500' : 'bg-amber-400'}`} />
                    <span className="font-semibold">
                      {isGoogleSheetsSynced() ? 'All data is synced (Green circle)' : 'New data to be synced (Yellow circle)'}
                    </span>
                  </div>
                  {gsheetConfig.lastSyncedAt && (
                    <span className="text-[10px] opacity-75">
                      {new Date(gsheetConfig.lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Remove Sheet Confirmation Dialog */}
            {showRemoveConfirm && (
              <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs space-y-2">
                <p className="text-rose-800 dark:text-rose-200 font-semibold">
                  Disconnect current Google Sheet?
                </p>
                <p className="text-[11px] text-rose-700 dark:text-rose-300">
                  This will unbind the current spreadsheet from SpendWise. Your file in Google Drive will remain safe.
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
              <div className={`text-[11px] p-2 rounded-lg border flex items-start gap-1.5 ${
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

            {/* Google Sheets Action Buttons */}
            <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
              {!gsheetConfig.spreadsheetId ? (
                <button
                  type="button"
                  onClick={handleConnectGoogleSheets}
                  disabled={isConnectingGSheet}
                  className="w-full py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  {isConnectingGSheet ? 'Connecting...' : 'Connect Google Sheets'}
                </button>
              ) : (
                <div className="flex items-center justify-between w-full gap-1.5">
                  <button
                    type="button"
                    onClick={handleSyncToSheets}
                    disabled={isSyncingGSheet || !pref.useGoogleSheets}
                    className="flex-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-[11px] font-semibold transition flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <UploadCloud className="w-3 h-3" />
                    {isSyncingGSheet ? 'Syncing...' : 'Sync'}
                  </button>

                  <button
                    type="button"
                    onClick={handlePullFromSheets}
                    disabled={isPullingGSheet || !pref.useGoogleSheets}
                    className="flex-1 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 text-[11px] font-semibold transition flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <DownloadCloud className="w-3 h-3" />
                    {isPullingGSheet ? 'Pulling...' : 'Restore'}
                  </button>

                  <button
                    type="button"
                    onClick={handleConnectGoogleSheets}
                    disabled={isConnectingGSheet}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                    title="Reconnect Google account"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isConnectingGSheet ? 'animate-spin' : ''}`} />
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowRemoveConfirm(true)}
                    className="p-1 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                    title="Remove / Disconnect Google Sheet"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-3 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex justify-end">
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
