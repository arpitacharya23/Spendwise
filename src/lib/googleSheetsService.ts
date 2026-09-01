// Client-side Google Sheets service using Google Apps Script (GAS) Web App
// Allows users to connect their personal Google Sheet via a lightweight Apps Script Web App
// Features:
// - Zero OAuth tokens, zero expiry, zero 403 authorization popup blocks
// - Two-way sync: push (syncAll) and pull (restore)
// - Background auto-sync on local transactions/accounts modifications

// Local storage key for storing user's selected sheet info & database target
export const GSHEET_CONFIG_KEY = 'spendwise_gsheet_config';
export const DATABASE_SELECTION_KEY = 'spendwise_database_preference';
export const LAST_DATA_MODIFIED_KEY = 'spendwise_last_data_modified_at';

export interface DatabasePreference {
  useCloudStorage: boolean; // Supabase Cloud database
  useGoogleSheets: boolean; // Personal Google Sheets (via Apps Script Web App)
}

export function getStoredDatabasePreference(): DatabasePreference {
  try {
    const saved = localStorage.getItem(DATABASE_SELECTION_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        useCloudStorage: parsed.useCloudStorage !== false, // Cloud sync ON by default
        useGoogleSheets: Boolean(parsed.useGoogleSheets),
      };
    }
  } catch {
    // fallback
  }
  // Default: Cloud storage enabled, Google Sheets false unless user enables it
  return {
    useCloudStorage: true,
    useGoogleSheets: false,
  };
}

export function saveStoredDatabasePreference(pref: DatabasePreference) {
  try {
    localStorage.setItem(DATABASE_SELECTION_KEY, JSON.stringify(pref));
  } catch (e) {
    console.error('Failed to save database preference', e);
  }
}

export interface GoogleSheetsSyncConfig {
  connectionType?: 'webapp';
  webAppUrl?: string; // Google Apps Script Web App URL
  spreadsheetId?: string;
  spreadsheetUrl?: string;
  autoSync: boolean;
  lastSyncedAt?: string;
}

export interface GoogleSheetsSyncResult {
  success: boolean;
  message: string;
  spreadsheetId?: string;
  spreadsheetUrl?: string;
  syncedCount?: {
    accounts: number;
    transactions: number;
    categories: number;
    loans: number;
    rules: number;
  };
}

export function getStoredGSheetConfig(): GoogleSheetsSyncConfig {
  try {
    const saved = localStorage.getItem(GSHEET_CONFIG_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch {
    // fallback
  }
  return {
    autoSync: false,
  };
}

export function saveStoredGSheetConfig(config: GoogleSheetsSyncConfig) {
  try {
    localStorage.setItem(GSHEET_CONFIG_KEY, JSON.stringify(config));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('spendwise_gsheet_sync_updated', { detail: config }));
    }
  } catch (e) {
    console.error('Failed to save gsheet config', e);
  }
}

export function clearStoredGSheetConfig() {
  try {
    localStorage.removeItem(GSHEET_CONFIG_KEY);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('spendwise_gsheet_sync_updated', { detail: null }));
    }
  } catch (e) {
    console.error('Failed to clear gsheet config', e);
  }
}

export function getStoredLastDataModifiedAt(): string | null {
  try {
    return localStorage.getItem(LAST_DATA_MODIFIED_KEY);
  } catch {
    return null;
  }
}

/**
 * Mark that new local data has been created or modified in SpendWise.
 * This transitions Google Sheets status to "pending/unsynced" (yellow circle).
 */
export function markDataModified(timestamp?: string): string {
  const ts = timestamp || new Date().toISOString();
  try {
    localStorage.setItem(LAST_DATA_MODIFIED_KEY, ts);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('spendwise_data_modified', { detail: { timestamp: ts } }));
      window.dispatchEvent(new CustomEvent('spendwise_gsheet_sync_updated'));
    }
  } catch (e) {
    console.error('Failed to save last data modified timestamp', e);
  }
  return ts;
}

export type GoogleSheetSyncState = 'disconnected' | 'synced' | 'pending';

/**
 * Returns whether a Google Sheet is currently connected via Google Apps Script Web App.
 */
export function isGoogleSheetsConnected(): boolean {
  try {
    const config = getStoredGSheetConfig();
    return Boolean(config && config.webAppUrl);
  } catch {
    return false;
  }
}

/**
 * Checks if all current SpendWise data is synced to Google Sheets.
 */
export function isGoogleSheetsSynced(latestItemTimestamp?: string | number): boolean {
  try {
    const config = getStoredGSheetConfig();
    if (!config.webAppUrl || !config.lastSyncedAt) {
      return false;
    }

    const lastSyncedTime = new Date(config.lastSyncedAt).getTime();
    if (isNaN(lastSyncedTime) || lastSyncedTime <= 0) {
      return false;
    }

    const lastModifiedStr = getStoredLastDataModifiedAt();
    if (lastModifiedStr) {
      const lastModifiedTime = new Date(lastModifiedStr).getTime();
      if (!isNaN(lastModifiedTime) && lastModifiedTime > lastSyncedTime) {
        return false;
      }
    }

    if (latestItemTimestamp) {
      const itemTime = typeof latestItemTimestamp === 'number' ? latestItemTimestamp : new Date(latestItemTimestamp).getTime();
      if (!isNaN(itemTime) && itemTime > lastSyncedTime) {
        return false;
      }
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Gets the current Google Sheets sync status:
 * - 'disconnected': No Google Sheet is connected.
 * - 'synced': Google Sheet connected and all data is up-to-date (Green circle).
 * - 'pending': Google Sheet connected and there are unsynced changes (Yellow circle).
 */
export function getGoogleSheetSyncStatus(): GoogleSheetSyncState {
  try {
    const config = getStoredGSheetConfig();
    if (!config || !config.webAppUrl) {
      return 'disconnected';
    }
    return isGoogleSheetsSynced() ? 'synced' : 'pending';
  } catch {
    return 'disconnected';
  }
}

let isAutoSyncInProgress = false;

export function isAutoSyncRunning(): boolean {
  return isAutoSyncInProgress;
}

/**
 * Automatically synchronizes pending local SpendWise data to Google Sheets via GAS Web App
 */
export async function autoSyncToGoogleSheets(data: {
  accounts: any[];
  transactions: any[];
  categories: any[];
  loans: any[];
  rules: any[];
  user: any;
}): Promise<GoogleSheetsSyncResult | null> {
  const pref = getStoredDatabasePreference();
  if (!pref.useGoogleSheets) {
    return null;
  }

  const config = getStoredGSheetConfig();
  if (!config || !config.webAppUrl) {
    return null;
  }

  if (isAutoSyncInProgress) {
    return null;
  }

  isAutoSyncInProgress = true;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('spendwise_auto_sync_start'));
  }

  try {
    const result = await syncAllDataViaWebApp(config.webAppUrl, data);

    if (result && result.success) {
      const updatedConfig: GoogleSheetsSyncConfig = {
        ...config,
        connectionType: 'webapp',
        spreadsheetId: result.spreadsheetId || config.spreadsheetId,
        spreadsheetUrl: result.spreadsheetUrl || config.spreadsheetUrl,
        lastSyncedAt: new Date().toISOString(),
        autoSync: true
      };
      saveStoredGSheetConfig(updatedConfig);
    }
    return result;
  } catch (err: any) {
    console.warn('Auto-sync to Google Sheets encountered an issue:', err);
    return null;
  } finally {
    isAutoSyncInProgress = false;
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('spendwise_auto_sync_end'));
      window.dispatchEvent(new CustomEvent('spendwise_gsheet_sync_updated'));
    }
  }
}

// Ready-to-copy Google Apps Script source code
export const SPENDWISE_APPS_SCRIPT_CODE = `/**
 * SpendWise Google Sheets Personal Sync Script (GAS)
 * 
 * Setup Instructions:
 * 1. Open your personal Google Sheet (or create one at sheets.new)
 * 2. Click Extensions > Apps Script
 * 3. Replace all existing code with this script and save (Ctrl+S / Cmd+S)
 * 4. Click 'Deploy' > 'New deployment'
 *    - Click the gear icon next to "Select type" and choose 'Web app'
 *    - Description: SpendWise Sync
 *    - Execute as: 'Me' (your email)
 *    - Who has access: 'Anyone'
 * 5. Click 'Deploy', authorize permissions, and copy the Web App URL!
 */

function doGet(e) {
  try {
    var params = e && e.parameter ? e.parameter : {};
    var action = params.action || 'ping';
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    if (action === 'ping') {
      return responseJSON({ 
        success: true, 
        message: 'SpendWise Apps Script Web App connected successfully!',
        spreadsheetId: ss.getId(),
        spreadsheetUrl: ss.getUrl()
      });
    }

    if (action === 'pull' || action === 'getAll') {
      var data = pullAllData(ss);
      return responseJSON({
        success: true,
        spreadsheetId: ss.getId(),
        spreadsheetUrl: ss.getUrl(),
        data: data
      });
    }

    return responseJSON({ success: false, error: 'Unknown GET action: ' + action });
  } catch (err) {
    return responseJSON({ success: false, error: err.toString() });
  }
}

function doPost(e) {
  try {
    var contents = e && e.postData && e.postData.contents ? JSON.parse(e.postData.contents) : {};
    var action = contents.action || 'syncAll';
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    if (action === 'syncAll') {
      var syncResult = syncAllData(ss, contents.data || {});
      return responseJSON({
        success: true,
        message: 'All data synchronized successfully to Google Sheet!',
        spreadsheetId: ss.getId(),
        spreadsheetUrl: ss.getUrl(),
        syncedCount: syncResult
      });
    }

    if (action === 'appendTransaction') {
      var appendRes = appendSingleTransaction(ss, contents.transaction || {});
      return responseJSON({
        success: true,
        message: 'Transaction saved to Google Sheet!',
        spreadsheetId: ss.getId(),
        spreadsheetUrl: ss.getUrl()
      });
    }

    return responseJSON({ success: false, error: 'Unknown POST action: ' + action });
  } catch (err) {
    return responseJSON({ success: false, error: err.toString() });
  }
}

function responseJSON(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function syncAllData(ss, data) {
  var accounts = data.accounts || [];
  var transactions = data.transactions || [];
  var categories = data.categories || [];
  var loans = data.loans || [];
  var rules = data.rules || [];
  var user = data.user || {};

  // 1. Transactions Sheet
  var txSheet = getOrCreateSheet(ss, 'Transactions');
  txSheet.clear();
  var txHeaders = ['ID', 'Date', 'Time', 'Title', 'Amount', 'Type', 'Account ID', 'Category ID', 'Notes', 'Created By', 'Updated At'];
  var txRows = [txHeaders];
  for (var i = 0; i < transactions.length; i++) {
    var t = transactions[i];
    txRows.push([
      t.id || '',
      t.date || '',
      t.time || '',
      t.title || '',
      Number(t.amount) || 0,
      t.type || 'expense',
      t.accountId || '',
      t.categoryId || '',
      t.notes || '',
      t.createdBy || (user.email || ''),
      t.updatedAt || new Date().toISOString()
    ]);
  }
  txSheet.getRange(1, 1, txRows.length, txHeaders.length).setValues(txRows);
  formatHeaderRow(txSheet, txHeaders.length, '#10B981');

  // 2. Accounts Sheet
  var accSheet = getOrCreateSheet(ss, 'Accounts');
  accSheet.clear();
  var accHeaders = ['ID', 'Name', 'Type', 'Balance', 'Credit Limit', 'Due Amount', 'Due Date', 'Currency', 'Account Last 4', 'Owner Email'];
  var accRows = [accHeaders];
  for (var a = 0; a < accounts.length; a++) {
    var acc = accounts[a];
    accRows.push([
      acc.id || '',
      acc.name || '',
      acc.type || 'bank',
      Number(acc.balance) || 0,
      Number(acc.creditLimit) || 0,
      Number(acc.dueAmount) || 0,
      acc.dueDate || '',
      acc.currency || user.currency || 'INR',
      acc.accountNumberLast4 || '',
      acc.ownerEmail || (user.email || '')
    ]);
  }
  accSheet.getRange(1, 1, accRows.length, accHeaders.length).setValues(accRows);
  formatHeaderRow(accSheet, accHeaders.length, '#3B82F6');

  // 3. Categories Sheet
  var catSheet = getOrCreateSheet(ss, 'Categories');
  catSheet.clear();
  var catHeaders = ['ID', 'Name', 'Icon', 'Color', 'Type', 'Budget Limit', 'User Email', 'Is Global'];
  var catRows = [catHeaders];
  for (var c = 0; c < categories.length; c++) {
    var cat = categories[c];
    catRows.push([
      cat.id || '',
      cat.name || '',
      cat.icon || '',
      cat.color || '',
      cat.type || 'expense',
      Number(cat.budgetLimit) || 0,
      cat.userEmail || (user.email || ''),
      cat.isGlobal ? 'YES' : 'NO'
    ]);
  }
  catSheet.getRange(1, 1, catRows.length, catHeaders.length).setValues(catRows);
  formatHeaderRow(catSheet, catHeaders.length, '#8B5CF6');

  // 4. Loans & EMIs Sheet
  var loanSheet = getOrCreateSheet(ss, 'Loans & EMIs');
  loanSheet.clear();
  var loanHeaders = ['ID', 'Name', 'Lender', 'Total Principal', 'Remaining Principal', 'Interest Rate %', 'Monthly EMI', 'Total Tenure (Months)', 'Paid Tenure (Months)', 'Linked Account ID', 'Next Due Date', 'Status'];
  var loanRows = [loanHeaders];
  for (var l = 0; l < loans.length; l++) {
    var ln = loans[l];
    loanRows.push([
      ln.id || '',
      ln.name || '',
      ln.lender || '',
      Number(ln.totalPrincipal) || 0,
      Number(ln.remainingPrincipal) || 0,
      Number(ln.interestRate) || 0,
      Number(ln.monthlyEMI) || 0,
      Number(ln.totalTenureMonths) || 0,
      Number(ln.paidTenureMonths) || 0,
      ln.linkedAccountId || '',
      ln.nextDueDate || '',
      ln.status || 'active'
    ]);
  }
  loanSheet.getRange(1, 1, loanRows.length, loanHeaders.length).setValues(loanRows);
  formatHeaderRow(loanSheet, loanHeaders.length, '#F59E0B');

  // 5. Rules Sheet
  var ruleSheet = getOrCreateSheet(ss, 'Rules');
  ruleSheet.clear();
  var ruleHeaders = ['ID', 'Rule Name', 'Keyword(s)', 'Match Type', 'Category ID', 'Account ID', 'Enabled', 'Match Count'];
  var ruleRows = [ruleHeaders];
  for (var r = 0; r < rules.length; r++) {
    var rl = rules[r];
    ruleRows.push([
      rl.id || '',
      rl.name || '',
      rl.keyword || '',
      rl.matchType || 'contains',
      rl.categoryId || '',
      rl.accountId || '',
      rl.isEnabled ? 'TRUE' : 'FALSE',
      Number(rl.matchCount) || 0
    ]);
  }
  ruleSheet.getRange(1, 1, ruleRows.length, ruleHeaders.length).setValues(ruleRows);
  formatHeaderRow(ruleSheet, ruleHeaders.length, '#EC4899');

  // 6. Overview & Metadata Sheet
  var overviewSheet = getOrCreateSheet(ss, 'Overview & Sync Info');
  overviewSheet.clear();
  var overviewRows = [
    ['SpendWise Ledger Sync Overview', ''],
    ['Last Synchronized (UTC)', new Date().toISOString()],
    ['Owner Email', user.email || ''],
    ['Owner Name', user.name || ''],
    ['Total Accounts', accounts.length],
    ['Total Transactions', transactions.length],
    ['Total Categories', categories.length],
    ['Total Loans & EMIs', loans.length],
    ['Total Rules', rules.length],
    ['', ''],
    ['Notice', 'This sheet is synced with your SpendWise personal finance app.']
  ];
  overviewSheet.getRange(1, 1, overviewRows.length, 2).setValues(overviewRows);
  formatHeaderRow(overviewSheet, 2, '#475569');

  return {
    accounts: accounts.length,
    transactions: transactions.length,
    categories: categories.length,
    loans: loans.length,
    rules: rules.length
  };
}

function appendSingleTransaction(ss, tx) {
  var txSheet = getOrCreateSheet(ss, 'Transactions');
  var row = [
    tx.id || ('tx_' + new Date().getTime()),
    tx.date || new Date().toISOString().split('T')[0],
    tx.time || '',
    tx.title || 'Untitled',
    Number(tx.amount) || 0,
    tx.type || 'expense',
    tx.accountId || '',
    tx.categoryId || '',
    tx.notes || '',
    tx.createdBy || '',
    new Date().toISOString()
  ];
  txSheet.appendRow(row);
  return true;
}

function getOrCreateSheet(ss, name) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  return sheet;
}

function formatHeaderRow(sheet, colCount, colorHex) {
  try {
    var range = sheet.getRange(1, 1, 1, colCount);
    range.setFontWeight('bold');
    range.setBackground(colorHex);
    range.setFontColor('#FFFFFF');
    sheet.setFrozenRows(1);
  } catch(e) {}
}

function pullAllData(ss) {
  var res = {
    accounts: [],
    transactions: [],
    categories: [],
    loans: [],
    rules: []
  };

  // 1. Transactions
  var txSheet = ss.getSheetByName('Transactions');
  if (txSheet && txSheet.getLastRow() > 1) {
    var txData = txSheet.getDataRange().getValues();
    res.transactions = [];
    for (var i = 1; i < txData.length; i++) {
      var row = txData[i];
      if (row[0] || row[3]) {
        res.transactions.push({
          id: String(row[0] || ('tx_' + new Date().getTime() + '_' + i)),
          date: String(row[1] || new Date().toISOString().split('T')[0]),
          time: String(row[2] || ''),
          title: String(row[3] || 'Expense'),
          amount: Number(row[4]) || 0,
          type: String(row[5] || 'expense'),
          accountId: String(row[6] || ''),
          categoryId: String(row[7] || ''),
          notes: String(row[8] || ''),
          createdBy: String(row[9] || ''),
          updatedAt: String(row[10] || new Date().toISOString())
        });
      }
    }
  }

  // 2. Accounts
  var accSheet = ss.getSheetByName('Accounts');
  if (accSheet && accSheet.getLastRow() > 1) {
    var accData = accSheet.getDataRange().getValues();
    res.accounts = [];
    for (var j = 1; j < accData.length; j++) {
      var ac = accData[j];
      if (ac[0] || ac[1]) {
        res.accounts.push({
          id: String(ac[0] || ('acc_' + new Date().getTime() + '_' + j)),
          name: String(ac[1] || 'Account'),
          type: String(ac[2] || 'bank'),
          balance: Number(ac[3]) || 0,
          creditLimit: ac[4] ? Number(ac[4]) : undefined,
          dueAmount: ac[5] ? Number(ac[5]) : undefined,
          dueDate: ac[6] ? String(ac[6]) : undefined,
          currency: String(ac[7] || 'INR'),
          accountNumberLast4: ac[8] ? String(ac[8]) : '',
          ownerEmail: ac[9] ? String(ac[9]) : '',
          sharedWith: [],
          color: '#3B82F6'
        });
      }
    }
  }

  // 3. Categories
  var catSheet = ss.getSheetByName('Categories');
  if (catSheet && catSheet.getLastRow() > 1) {
    var catData = catSheet.getDataRange().getValues();
    res.categories = [];
    for (var k = 1; k < catData.length; k++) {
      var ca = catData[k];
      if (ca[0] || ca[1]) {
        res.categories.push({
          id: String(ca[0] || ('cat_' + new Date().getTime() + '_' + k)),
          name: String(ca[1] || 'Category'),
          icon: String(ca[2] || 'Tag'),
          color: String(ca[3] || '#6B7280'),
          type: String(ca[4] || 'expense'),
          budgetLimit: ca[5] ? Number(ca[5]) : undefined,
          userEmail: String(ca[6] || ''),
          isGlobal: String(ca[7]) === 'YES'
        });
      }
    }
  }

  // 4. Loans & EMIs
  var loanSheet = ss.getSheetByName('Loans & EMIs');
  if (loanSheet && loanSheet.getLastRow() > 1) {
    var loanData = loanSheet.getDataRange().getValues();
    res.loans = [];
    for (var l = 1; l < loanData.length; l++) {
      var ln = loanData[l];
      if (ln[0] || ln[1]) {
        res.loans.push({
          id: String(ln[0] || ('loan_' + new Date().getTime() + '_' + l)),
          name: String(ln[1] || ''),
          lender: String(ln[2] || ''),
          totalPrincipal: Number(ln[3]) || 0,
          remainingPrincipal: Number(ln[4]) || 0,
          interestRate: Number(ln[5]) || 0,
          monthlyEMI: Number(ln[6]) || 0,
          totalTenureMonths: Number(ln[7]) || 0,
          paidTenureMonths: Number(ln[8]) || 0,
          linkedAccountId: String(ln[9] || ''),
          nextDueDate: String(ln[10] || ''),
          status: String(ln[11] || 'active'),
          userEmail: '',
          category: 'Personal'
        });
      }
    }
  }

  // 5. Rules
  var ruleSheet = ss.getSheetByName('Rules');
  if (ruleSheet && ruleSheet.getLastRow() > 1) {
    var ruleData = ruleSheet.getDataRange().getValues();
    res.rules = [];
    for (var m = 1; m < ruleData.length; m++) {
      var r = ruleData[m];
      if (r[0] || r[1]) {
        res.rules.push({
          id: String(r[0] || ('rule_' + new Date().getTime() + '_' + m)),
          name: String(r[1] || ''),
          keyword: String(r[2] || ''),
          matchType: String(r[3] || 'contains'),
          categoryId: String(r[4] || ''),
          accountId: r[5] ? String(r[5]) : undefined,
          isEnabled: String(r[6]) === 'TRUE',
          matchCount: Number(r[7]) || 0,
          createdAt: new Date().toISOString()
        });
      }
    }
  }

  return res;
}`;

// ==========================================
// Google Apps Script Web App Integration
// ==========================================

export async function testWebAppConnection(webAppUrl: string): Promise<{
  success: boolean;
  message: string;
  spreadsheetId?: string;
  spreadsheetUrl?: string;
}> {
  const cleanUrl = webAppUrl.trim();
  if (!cleanUrl.startsWith('https://script.google.com/macros/s/')) {
    throw new Error('Please enter a valid Google Apps Script Web App URL starting with https://script.google.com/macros/s/...');
  }

  const pingUrl = `${cleanUrl}${cleanUrl.includes('?') ? '&' : '?'}action=ping`;
  const res = await fetch(pingUrl, {
    method: 'GET',
    redirect: 'follow',
  });

  if (!res.ok) {
    throw new Error(`Apps Script responded with HTTP ${res.status}. Make sure "Who has access" is set to "Anyone" in Web App deployment.`);
  }

  const data = await res.json();
  if (!data || data.success === false) {
    throw new Error(data?.error || 'Apps Script returned an error response.');
  }

  return {
    success: true,
    message: data.message || 'Connected to personal Google Sheet successfully!',
    spreadsheetId: data.spreadsheetId,
    spreadsheetUrl: data.spreadsheetUrl,
  };
}

export async function syncAllDataViaWebApp(
  webAppUrl: string,
  data: {
    accounts: any[];
    transactions: any[];
    categories: any[];
    loans: any[];
    rules: any[];
    user: any;
  }
): Promise<GoogleSheetsSyncResult> {
  const cleanUrl = webAppUrl.trim();
  const payload = {
    action: 'syncAll',
    data,
  };

  const res = await fetch(cleanUrl, {
    method: 'POST',
    redirect: 'follow',
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Apps Script Web App sync failed (HTTP ${res.status}): ${errText.slice(0, 150)}`);
  }

  const result = await res.json();
  if (!result || result.success === false) {
    throw new Error(result?.error || 'Failed to sync with personal Google Sheet.');
  }

  return {
    success: true,
    message: result.message || `Successfully synced ${data.transactions.length} transactions and ${data.accounts.length} accounts to personal Google Sheet!`,
    spreadsheetId: result.spreadsheetId,
    spreadsheetUrl: result.spreadsheetUrl,
    syncedCount: result.syncedCount || {
      accounts: data.accounts.length,
      transactions: data.transactions.length,
      categories: data.categories.length,
      loans: data.loans.length,
      rules: data.rules.length,
    },
  };
}

export async function pullDataViaWebApp(webAppUrl: string): Promise<{
  accounts?: any[];
  transactions?: any[];
  categories?: any[];
  loans?: any[];
  rules?: any[];
}> {
  const cleanUrl = webAppUrl.trim();
  const pullUrl = `${cleanUrl}${cleanUrl.includes('?') ? '&' : '?'}action=pull`;

  const res = await fetch(pullUrl, {
    method: 'GET',
    redirect: 'follow',
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to read data from Google Apps Script (HTTP ${res.status}): ${errText.slice(0, 150)}`);
  }

  const result = await res.json();
  if (!result || result.success === false) {
    throw new Error(result?.error || 'Failed to pull data from Google Sheet.');
  }

  return result.data || {};
}
