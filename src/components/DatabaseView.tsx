import React, { useState } from 'react';
import { 
  Cloud, 
  FileSpreadsheet, 
  ExternalLink, 
  RefreshCw, 
  UploadCloud, 
  DownloadCloud, 
  AlertCircle
} from 'lucide-react';
import { UserProfile, Account, Transaction, Category, LoanEMI, TransactionRule } from '../types';
import { 
  DatabasePreference, 
  getStoredDatabasePreference, 
  saveStoredDatabasePreference,
  getStoredGSheetConfig,
  saveStoredGSheetConfig,
  requestGoogleOAuthToken,
  getOrCreateSpendwiseSpreadsheet,
  syncAllDataToGoogleSheets,
  pullDataFromGoogleSheets,
  GoogleSheetsSyncConfig
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
  
  const [isConnectingGSheet, setIsConnectingGSheet] = useState(false);
  const [isSyncingGSheet, setIsSyncingGSheet] = useState(false);
  const [isPullingGSheet, setIsPullingGSheet] = useState(false);
  const [gsheetStatusMessage, setGsheetStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

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

  return (
    <div className="max-w-3xl mx-auto py-2 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* Cloud Storage Card */}
        <div className={`rounded-2xl border-2 transition-all p-5 bg-white dark:bg-slate-900 flex flex-col justify-between ${
          pref.useCloudStorage 
            ? 'border-blue-500 shadow-sm ring-1 ring-blue-500' 
            : 'border-slate-200 dark:border-slate-800'
        }`}>
          <div className="flex items-center justify-between gap-3">
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
        </div>

        {/* Google Sheets Card */}
        <div className={`rounded-2xl border-2 transition-all p-5 bg-white dark:bg-slate-900 flex flex-col justify-between ${
          pref.useGoogleSheets 
            ? 'border-emerald-500 shadow-sm ring-1 ring-emerald-500' 
            : 'border-slate-200 dark:border-slate-800'
        }`}>
          <div>
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
                  <FileSpreadsheet className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white">Google Sheets</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Google Drive spreadsheet
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

            {/* Google Sheets Status Link */}
            {gsheetConfig.spreadsheetUrl && (
              <div className="text-xs flex items-center justify-between py-1.5 px-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 mb-3">
                <span className="text-slate-500 text-[11px]">Spreadsheet:</span>
                <a 
                  href={gsheetConfig.spreadsheetUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-emerald-600 hover:underline inline-flex items-center gap-1 font-semibold text-xs"
                >
                  Open in Google Sheets
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}

            {gsheetStatusMessage && (
              <div className={`text-xs p-2 rounded-lg border flex items-start gap-1.5 mb-3 ${
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

          {/* Action button */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
            {!gsheetConfig.spreadsheetId ? (
              <button
                type="button"
                onClick={handleConnectGoogleSheets}
                disabled={isConnectingGSheet}
                className="w-full py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-xs"
              >
                <FileSpreadsheet className="w-4 h-4" />
                {isConnectingGSheet ? 'Connecting...' : 'Connect Google Sheets'}
              </button>
            ) : (
              <div className="flex items-center justify-between w-full gap-2">
                <button
                  type="button"
                  onClick={handleSyncToSheets}
                  disabled={isSyncingGSheet || !pref.useGoogleSheets}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
                >
                  <UploadCloud className="w-3.5 h-3.5" />
                  {isSyncingGSheet ? 'Syncing...' : 'Sync'}
                </button>

                <button
                  type="button"
                  onClick={handlePullFromSheets}
                  disabled={isPullingGSheet || !pref.useGoogleSheets}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
                >
                  <DownloadCloud className="w-3.5 h-3.5" />
                  {isPullingGSheet ? 'Pulling...' : 'Restore'}
                </button>

                <button
                  type="button"
                  onClick={handleConnectGoogleSheets}
                  disabled={isConnectingGSheet}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                  title="Reconnect Google account"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isConnectingGSheet ? 'animate-spin' : ''}`} />
                </button>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
