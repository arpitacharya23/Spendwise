// Client-side Google Sheets & Drive API helper using:
// 1. Google Apps Script Web App (Manual Personal Sheet - permanent, zero-expiry, custom sheet)
// 2. Google Identity Services (GIS) / OAuth token (Automatic One-Click)
// Uses endpoints:
// - Google Drive API v3: search/create SpendWise spreadsheet
// - Google Sheets API v4: batchUpdate, values.get, values.update, values.append
// - Apps Script Web App: doGet (ping/pull) & doPost (syncAll/appendTransaction)

import { requestGoogleWorkspaceToken } from './firebaseAuth';

declare global {
  interface Window {
    google?: any;
    gapi?: any;
  }
}

export type GSheetConnectionType = 'oauth' | 'webapp';

export interface GoogleSheetsSyncConfig {
  connectionType?: GSheetConnectionType;
  webAppUrl?: string; // Google Apps Script Web App URL (for manual method)
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

let cachedAccessToken: string | null = null;
let tokenExpiresAt: number = 0;
let tokenClientInstance: any = null;

// Local storage key for storing user's selected sheet info & database target
export const GSHEET_CONFIG_KEY = 'spendwise_gsheet_config';
export const DATABASE_SELECTION_KEY = 'spendwise_database_preference';
export const LAST_DATA_MODIFIED_KEY = 'spendwise_last_data_modified_at';

export interface DatabasePreference {
  useCloudStorage: boolean; // Supabase
  useGoogleSheets: boolean; // Google Sheets
}

export function getStoredDatabasePreference(): DatabasePreference {
  try {
    const saved = localStorage.getItem(DATABASE_SELECTION_KEY);
    if (saved) {
      return JSON.parse(saved);
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
    cachedAccessToken = null;
    tokenExpiresAt = 0;
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
 * Returns whether a Google Sheet is currently connected.
 */
export function isGoogleSheetsConnected(): boolean {
  try {
    const config = getStoredGSheetConfig();
    return Boolean(config && (config.spreadsheetId || config.webAppUrl));
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
    if ((!config.spreadsheetId && !config.webAppUrl) || !config.lastSyncedAt) {
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
    if (!config || (!config.spreadsheetId && !config.webAppUrl)) {
      return 'disconnected';
    }
    return isGoogleSheetsSynced() ? 'synced' : 'pending';
  } catch {
    return 'disconnected';
  }
}

export function getCachedGSheetToken(): string | null {
  if (cachedAccessToken && Date.now() < tokenExpiresAt - 60000) {
    return cachedAccessToken;
  }
  return null;
}

export function setManualGSheetToken(token: string) {
  cachedAccessToken = token.trim();
  tokenExpiresAt = Date.now() + 86400 * 1000;
}

export function clearCachedGSheetToken() {
  cachedAccessToken = null;
  tokenExpiresAt = 0;
}

// Ready-to-copy Google Apps Script source code
export const SPENDWISE_APPS_SCRIPT_CODE = `/**
 * SpendWise Google Sheets Personal Sync Script
 * 
 * Instructions:
 * 1. Open your personal Google Sheet (or create one at sheets.new)
 * 2. Click Extensions > Apps Script
 * 3. Replace all existing code with this script and save (Ctrl+S or Cmd+S)
 * 4. Click 'Deploy' > 'New deployment'
 *    - Select type: 'Web app' (gear icon)
 *    - Description: SpendWise Sync
 *    - Execute as: 'Me'
 *    - Who has access: 'Anyone'
 * 5. Click 'Deploy', authorize the permissions, and copy the Web App URL!
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
    var contents = e && e.postData ? e.postData.contents : '';
    var body = {};
    if (contents) {
      try {
        body = JSON.parse(contents);
      } catch (ex) {
        body = {};
      }
    }
    var action = body.action || (e && e.parameter ? e.parameter.action : 'syncAll');
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    if (action === 'syncAll') {
      var result = syncAllData(ss, body.data || body);
      return responseJSON({
        success: true,
        message: 'Successfully synchronized data with Google Sheet!',
        spreadsheetId: ss.getId(),
        spreadsheetUrl: ss.getUrl(),
        syncedCount: result
      });
    }

    if (action === 'addTransaction' || action === 'appendTransaction') {
      var tx = body.transaction || body;
      appendTransactionRow(ss, tx);
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

function responseJSON(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function getOrCreateSheet(ss, sheetName, headers) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }
  if (headers && headers.length > 0 && sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#F1F5F9');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function syncAllData(ss, payload) {
  var accounts = payload.accounts || [];
  var transactions = payload.transactions || [];
  var categories = payload.categories || [];
  var loans = payload.loans || [];
  var rules = payload.rules || [];
  var user = payload.user || {};

  // 1. Transactions
  var txSheet = getOrCreateSheet(ss, 'Transactions', ['ID', 'Date', 'Time', 'Title', 'Amount', 'Type', 'Account ID', 'Category ID', 'Notes', 'Created By', 'Updated At']);
  txSheet.clearContents();
  var txRows = [['ID', 'Date', 'Time', 'Title', 'Amount', 'Type', 'Account ID', 'Category ID', 'Notes', 'Created By', 'Updated At']];
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
      t.createdBy || (user ? user.email : ''),
      t.updatedAt || new Date().toISOString()
    ]);
  }
  txSheet.getRange(1, 1, txRows.length, txRows[0].length).setValues(txRows);
  txSheet.getRange(1, 1, 1, txRows[0].length).setFontWeight('bold').setBackground('#F1F5F9');
  txSheet.setFrozenRows(1);

  // 2. Accounts
  var accSheet = getOrCreateSheet(ss, 'Accounts', ['ID', 'Name', 'Type', 'Balance', 'Credit Limit', 'Due Amount', 'Due Date', 'Currency', 'Account Last 4', 'Owner Email']);
  accSheet.clearContents();
  var accRows = [['ID', 'Name', 'Type', 'Balance', 'Credit Limit', 'Due Amount', 'Due Date', 'Currency', 'Account Last 4', 'Owner Email']];
  for (var j = 0; j < accounts.length; j++) {
    var a = accounts[j];
    accRows.push([
      a.id || '',
      a.name || '',
      a.type || 'bank',
      Number(a.balance) || 0,
      Number(a.creditLimit) || 0,
      Number(a.dueAmount) || 0,
      a.dueDate || '',
      a.currency || (user ? user.currency : 'INR') || 'INR',
      a.accountNumberLast4 || '',
      a.ownerEmail || (user ? user.email : '')
    ]);
  }
  accSheet.getRange(1, 1, accRows.length, accRows[0].length).setValues(accRows);
  accSheet.getRange(1, 1, 1, accRows[0].length).setFontWeight('bold').setBackground('#F1F5F9');
  accSheet.setFrozenRows(1);

  // 3. Categories
  var catSheet = getOrCreateSheet(ss, 'Categories', ['ID', 'Name', 'Icon', 'Color', 'Type', 'Budget Limit', 'User Email', 'Is Global']);
  catSheet.clearContents();
  var catRows = [['ID', 'Name', 'Icon', 'Color', 'Type', 'Budget Limit', 'User Email', 'Is Global']];
  for (var k = 0; k < categories.length; k++) {
    var c = categories[k];
    catRows.push([
      c.id || '',
      c.name || '',
      c.icon || '',
      c.color || '',
      c.type || 'expense',
      Number(c.budgetLimit) || 0,
      c.userEmail || (user ? user.email : ''),
      c.isGlobal ? 'YES' : 'NO'
    ]);
  }
  catSheet.getRange(1, 1, catRows.length, catRows[0].length).setValues(catRows);
  catSheet.getRange(1, 1, 1, catRows[0].length).setFontWeight('bold').setBackground('#F1F5F9');
  catSheet.setFrozenRows(1);

  // 4. Loans & EMIs
  var loanSheet = getOrCreateSheet(ss, 'Loans & EMIs', ['ID', 'Name', 'Lender', 'Total Principal', 'Remaining Principal', 'Interest Rate %', 'Monthly EMI', 'Total Tenure (Months)', 'Paid Tenure (Months)', 'Linked Account ID', 'Next Due Date', 'Status']);
  loanSheet.clearContents();
  var loanRows = [['ID', 'Name', 'Lender', 'Total Principal', 'Remaining Principal', 'Interest Rate %', 'Monthly EMI', 'Total Tenure (Months)', 'Paid Tenure (Months)', 'Linked Account ID', 'Next Due Date', 'Status']];
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
  loanSheet.getRange(1, 1, loanRows.length, loanRows[0].length).setValues(loanRows);
  loanSheet.getRange(1, 1, 1, loanRows[0].length).setFontWeight('bold').setBackground('#F1F5F9');
  loanSheet.setFrozenRows(1);

  // 5. Rules
  var ruleSheet = getOrCreateSheet(ss, 'Rules', ['ID', 'Rule Name', 'Keyword(s)', 'Match Type', 'Category ID', 'Account ID', 'Enabled', 'Match Count']);
  ruleSheet.clearContents();
  var ruleRows = [['ID', 'Rule Name', 'Keyword(s)', 'Match Type', 'Category ID', 'Account ID', 'Enabled', 'Match Count']];
  for (var m = 0; m < rules.length; m++) {
    var r = rules[m];
    ruleRows.push([
      r.id || '',
      r.name || '',
      r.keyword || '',
      r.matchType || 'contains',
      r.categoryId || '',
      r.accountId || '',
      r.isEnabled ? 'TRUE' : 'FALSE',
      Number(r.matchCount) || 0
    ]);
  }
  ruleSheet.getRange(1, 1, ruleRows.length, ruleRows[0].length).setValues(ruleRows);
  ruleSheet.getRange(1, 1, 1, ruleRows[0].length).setFontWeight('bold').setBackground('#F1F5F9');
  ruleSheet.setFrozenRows(1);

  // 6. Overview & Metadata
  var ovSheet = getOrCreateSheet(ss, 'Overview & Sync Info', ['Metric', 'Value']);
  ovSheet.clearContents();
  var ovRows = [
    ['Metric', 'Value'],
    ['SpendWise Ledger', 'Personal Financial Records'],
    ['Last Synchronized (UTC)', new Date().toISOString()],
    ['Owner Email', user ? user.email : ''],
    ['Owner Name', user ? user.name : ''],
    ['Total Accounts', accounts.length],
    ['Total Transactions', transactions.length],
    ['Total Categories', categories.length],
    ['Total Loans & EMIs', loans.length],
    ['Total Categorization Rules', rules.length]
  ];
  ovSheet.getRange(1, 1, ovRows.length, ovRows[0].length).setValues(ovRows);
  ovSheet.getRange(1, 1, 1, 2).setFontWeight('bold').setBackground('#F1F5F9');

  return {
    accounts: accounts.length,
    transactions: transactions.length,
    categories: categories.length,
    loans: loans.length,
    rules: rules.length
  };
}

function appendTransactionRow(ss, t) {
  var txSheet = getOrCreateSheet(ss, 'Transactions', ['ID', 'Date', 'Time', 'Title', 'Amount', 'Type', 'Account ID', 'Category ID', 'Notes', 'Created By', 'Updated At']);
  txSheet.appendRow([
    t.id || '',
    t.date || '',
    t.time || '',
    t.title || '',
    Number(t.amount) || 0,
    t.type || 'expense',
    t.accountId || '',
    t.categoryId || '',
    t.notes || '',
    t.createdBy || '',
    t.updatedAt || new Date().toISOString()
  ]);
}

function pullAllData(ss) {
  var res = {};

  // 1. Transactions
  var txSheet = ss.getSheetByName('Transactions');
  if (txSheet && txSheet.getLastRow() > 1) {
    var txData = txSheet.getDataRange().getValues();
    res.transactions = [];
    for (var i = 1; i < txData.length; i++) {
      var r = txData[i];
      if (r[0] || r[3]) {
        res.transactions.push({
          id: String(r[0] || ('tx_' + new Date().getTime() + '_' + i)),
          date: String(r[1] || ''),
          time: String(r[2] || ''),
          title: String(r[3] || ''),
          amount: Number(r[4]) || 0,
          type: String(r[5] || 'expense'),
          accountId: String(r[6] || ''),
          categoryId: String(r[7] || ''),
          notes: String(r[8] || ''),
          createdBy: String(r[9] || ''),
          updatedAt: String(r[10] || new Date().toISOString())
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
      var a = accData[j];
      if (a[0] || a[1]) {
        res.accounts.push({
          id: String(a[0] || ('acc_' + new Date().getTime() + '_' + j)),
          name: String(a[1] || ''),
          type: String(a[2] || 'bank'),
          balance: Number(a[3]) || 0,
          creditLimit: a[4] ? Number(a[4]) : undefined,
          dueAmount: a[5] ? Number(a[5]) : undefined,
          dueDate: a[6] ? String(a[6]) : undefined,
          currency: String(a[7] || 'INR'),
          accountNumberLast4: String(a[8] || ''),
          ownerEmail: String(a[9] || ''),
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
      var c = catData[k];
      if (c[0] || c[1]) {
        res.categories.push({
          id: String(c[0] || ('cat_' + new Date().getTime() + '_' + k)),
          name: String(c[1] || ''),
          icon: String(c[2] || 'Tag'),
          color: String(c[3] || '#6B7280'),
          type: String(c[4] || 'expense'),
          budgetLimit: c[5] ? Number(c[5]) : undefined,
          userEmail: String(c[6] || ''),
          isGlobal: String(c[7]) === 'YES'
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
// 1. Google Apps Script Web App Integration
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

// ==========================================
// 2. Google Identity Services / OAuth Integration
// ==========================================

export async function requestGoogleOAuthToken(forceConsent = false): Promise<string> {
  // Check if we already have a valid token unless consent is forced
  if (!forceConsent) {
    const existing = getCachedGSheetToken();
    if (existing) {
      return existing;
    }
  }

  // 1. Try Google Identity Services (GIS)
  const tryGisToken = (): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (typeof window === 'undefined') {
        reject(new Error('Window is not available'));
        return;
      }

      const clientId = 
        import.meta.env.VITE_GOOGLE_CLIENT_ID || 
        '582951335862-ligh4200cq1m4l8rt7u1p4ssg0ilon27.apps.googleusercontent.com';

      const launchGis = () => {
        try {
          tokenClientInstance = window.google.accounts.oauth2.initTokenClient({
            client_id: clientId,
            scope: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file',
            callback: (tokenResponse: any) => {
              if (tokenResponse.error) {
                clearCachedGSheetToken();
                reject(new Error(tokenResponse.error_description || tokenResponse.error));
                return;
              }
              if (tokenResponse.access_token) {
                cachedAccessToken = tokenResponse.access_token;
                const expiresIn = parseInt(tokenResponse.expires_in || '3600', 10);
                tokenExpiresAt = Date.now() + expiresIn * 1000;
                resolve(tokenResponse.access_token);
              } else {
                clearCachedGSheetToken();
                reject(new Error('No access token received from Google'));
              }
            },
            error_callback: (error: any) => {
              clearCachedGSheetToken();
              reject(new Error(error.message || 'Google authorization was cancelled or closed.'));
            }
          });

          // Always prompt for consent when connecting to guarantee spreadsheets & drive.file scopes are granted
          tokenClientInstance.requestAccessToken({ prompt: forceConsent ? 'consent select_account' : 'consent' });
        } catch (err: any) {
          reject(err);
        }
      };

      if (!window.google?.accounts?.oauth2) {
        const scriptId = 'google-gsi-client-script';
        let script = document.getElementById(scriptId) as HTMLScriptElement;
        if (!script) {
          script = document.createElement('script');
          script.id = scriptId;
          script.src = 'https://accounts.google.com/gsi/client';
          script.async = true;
          script.defer = true;
          script.onload = () => launchGis();
          script.onerror = () => reject(new Error('Failed to load Google Identity Services SDK'));
          document.head.appendChild(script);
        } else {
          setTimeout(launchGis, 250);
        }
      } else {
        launchGis();
      }
    });
  };

  try {
    return await tryGisToken();
  } catch (gisError: any) {
    console.warn('GIS Token attempt failed:', gisError);

    // Fallback: Firebase Auth if GIS fails
    try {
      const token = await requestGoogleWorkspaceToken();
      if (token) {
        cachedAccessToken = token;
        tokenExpiresAt = Date.now() + 3600 * 1000;
        return token;
      }
    } catch (firebaseErr: any) {
      console.warn('Firebase Auth token flow error:', firebaseErr);
      if (firebaseErr?.code === 'auth/popup-closed-by-user' || firebaseErr?.message?.includes('popup-closed-by-user')) {
        throw new Error('Google authorization popup was closed before completing sign-in.');
      }
      if (firebaseErr?.code === 'auth/popup-blocked') {
        throw new Error('The authorization popup was blocked by your browser. Please allow popups for this site and try again.');
      }
    }

    throw new Error(gisError?.message || 'Google authorization could not be completed. Please allow popups or use the Manual Web App option.');
  }
}

/**
 * Ensures all required sheets/tabs exist in the target spreadsheet.
 * If any tab is missing, creates it using batchUpdate AddSheetRequest.
 */
export async function ensureSpreadsheetTabsExist(token: string, spreadsheetId: string, requiredTabs: string[]) {
  try {
    const metaRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!metaRes.ok) return;

    const meta = await metaRes.json();
    const existingTitles = new Set((meta.sheets || []).map((s: any) => s.properties?.title));

    const missingTabs = requiredTabs.filter(tab => !existingTitles.has(tab));
    if (missingTabs.length === 0) return;

    const requests = missingTabs.map(tab => ({
      addSheet: {
        properties: {
          title: tab,
          gridProperties: { rowCount: 500, columnCount: 15, frozenRowCount: 1 }
        }
      }
    }));

    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ requests })
    });
  } catch (e) {
    console.warn('Could not pre-create spreadsheet tabs, continuing...', e);
  }
}

// Find existing "SpendWise Financial Ledger" spreadsheet in user's Google Drive or create a new one
export async function getOrCreateSpendwiseSpreadsheet(token: string, spreadsheetTitle = 'SpendWise Financial Ledger'): Promise<{ id: string; url: string; created: boolean }> {
  // 1. Search in Drive
  try {
    const searchUrl = `https://www.googleapis.com/drive/v3/files?q=name='${encodeURIComponent(spreadsheetTitle)}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false&fields=files(id,name,webViewLink)`;
    
    const searchRes = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (searchRes.ok) {
      const searchData = await searchRes.json();
      if (searchData.files && searchData.files.length > 0) {
        const file = searchData.files[0];
        return {
          id: file.id,
          url: file.webViewLink || `https://docs.google.com/spreadsheets/d/${file.id}/edit`,
          created: false
        };
      }
    }
  } catch (e) {
    console.warn('Drive search skipped or failed, proceeding to creation', e);
  }

  // 2. If not found, create new Spreadsheet with structured sheets
  const createUrl = 'https://sheets.googleapis.com/v4/spreadsheets';
  const newSheetPayload = {
    properties: {
      title: spreadsheetTitle,
    },
    sheets: [
      {
        properties: {
          title: 'Transactions',
          gridProperties: { rowCount: 1000, columnCount: 12, frozenRowCount: 1 }
        }
      },
      {
        properties: {
          title: 'Accounts',
          gridProperties: { rowCount: 100, columnCount: 10, frozenRowCount: 1 }
        }
      },
      {
        properties: {
          title: 'Categories',
          gridProperties: { rowCount: 100, columnCount: 8, frozenRowCount: 1 }
        }
      },
      {
        properties: {
          title: 'Loans & EMIs',
          gridProperties: { rowCount: 50, columnCount: 12, frozenRowCount: 1 }
        }
      },
      {
        properties: {
          title: 'Rules',
          gridProperties: { rowCount: 100, columnCount: 8, frozenRowCount: 1 }
        }
      },
      {
        properties: {
          title: 'Overview & Sync Info',
          gridProperties: { rowCount: 50, columnCount: 6 }
        }
      }
    ]
  };

  const createRes = await fetch(createUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(newSheetPayload)
  });

  if (!createRes.ok) {
    const errText = await createRes.text();
    if (createRes.status === 403) {
      clearCachedGSheetToken();
      throw new Error('Permission Denied (403): Google Sheets permissions were not granted. Please reconnect and check the permission checkbox or use the Manual Web App option.');
    }
    throw new Error(`Failed to create Google Sheet: ${errText}`);
  }

  const createdSheet = await createRes.json();
  const sheetId = createdSheet.spreadsheetId;
  const sheetUrl = createdSheet.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${sheetId}/edit`;

  return {
    id: sheetId,
    url: sheetUrl,
    created: true
  };
}

// Sync all local SpendWise data into Google Sheets tabs with formatting & headers
export async function syncAllDataToGoogleSheets(
  token: string,
  spreadsheetId: string,
  data: {
    accounts: any[];
    transactions: any[];
    categories: any[];
    loans: any[];
    rules: any[];
    user: any;
  }
): Promise<GoogleSheetsSyncResult> {
  const { accounts, transactions, categories, loans, rules, user } = data;

  // Make sure all required tabs exist before sending batch update
  const requiredTabs = ['Transactions', 'Accounts', 'Categories', 'Loans & EMIs', 'Rules', 'Overview & Sync Info'];
  await ensureSpreadsheetTabsExist(token, spreadsheetId, requiredTabs);

  // Prepare 2D arrays for each tab
  // 1. Transactions
  const txHeader = ['ID', 'Date', 'Time', 'Title', 'Amount', 'Type', 'Account ID', 'Category ID', 'Notes', 'Created By', 'Updated At'];
  const txRows = transactions.map(t => [
    t.id || '',
    t.date || '',
    t.time || '',
    t.title || '',
    t.amount || 0,
    t.type || 'expense',
    t.accountId || '',
    t.categoryId || '',
    t.notes || '',
    t.createdBy || (user ? user.email : ''),
    t.updatedAt || new Date().toISOString()
  ]);
  const txData = [txHeader, ...txRows];

  // 2. Accounts
  const accHeader = ['ID', 'Name', 'Type', 'Balance', 'Credit Limit', 'Due Amount', 'Due Date', 'Currency', 'Account Last 4', 'Owner Email'];
  const accRows = accounts.map(a => [
    a.id || '',
    a.name || '',
    a.type || 'bank',
    a.balance || 0,
    a.creditLimit || 0,
    a.dueAmount || 0,
    a.dueDate || '',
    a.currency || (user ? user.currency : 'INR') || 'INR',
    a.accountNumberLast4 || '',
    a.ownerEmail || (user ? user.email : '')
  ]);
  const accData = [accHeader, ...accRows];

  // 3. Categories
  const catHeader = ['ID', 'Name', 'Icon', 'Color', 'Type', 'Budget Limit', 'User Email', 'Is Global'];
  const catRows = categories.map(c => [
    c.id || '',
    c.name || '',
    c.icon || '',
    c.color || '',
    c.type || 'expense',
    c.budgetLimit || 0,
    c.userEmail || (user ? user.email : ''),
    c.isGlobal ? 'YES' : 'NO'
  ]);
  const catData = [catHeader, ...catRows];

  // 4. Loans
  const loanHeader = ['ID', 'Name', 'Lender', 'Total Principal', 'Remaining Principal', 'Interest Rate %', 'Monthly EMI', 'Total Tenure (Months)', 'Paid Tenure (Months)', 'Linked Account ID', 'Next Due Date', 'Status'];
  const loanRows = loans.map(l => [
    l.id || '',
    l.name || '',
    l.lender || '',
    l.totalPrincipal || 0,
    l.remainingPrincipal || 0,
    l.interestRate || 0,
    l.monthlyEMI || 0,
    l.totalTenureMonths || 0,
    l.paidTenureMonths || 0,
    l.linkedAccountId || '',
    l.nextDueDate || '',
    l.status || 'active'
  ]);
  const loanData = [loanHeader, ...loanRows];

  // 5. Rules
  const ruleHeader = ['ID', 'Rule Name', 'Keyword(s)', 'Match Type', 'Category ID', 'Account ID', 'Enabled', 'Match Count'];
  const ruleRows = rules.map(r => [
    r.id || '',
    r.name || '',
    r.keyword || '',
    r.matchType || 'contains',
    r.categoryId || '',
    r.accountId || '',
    r.isEnabled ? 'TRUE' : 'FALSE',
    r.matchCount || 0
  ]);
  const ruleData = [ruleHeader, ...ruleRows];

  // 6. Overview & Metadata
  const overviewData = [
    ['SpendWise Google Sheets Sync Ledger', ''],
    ['Last Synchronized (UTC)', new Date().toISOString()],
    ['Owner Email', user ? user.email : ''],
    ['Owner Name', user ? user.name : ''],
    ['Total Accounts', accounts.length],
    ['Total Transactions', transactions.length],
    ['Total Categories', categories.length],
    ['Total Loans & EMIs', loans.length],
    ['Total Auto-Categorization Rules', rules.length],
    ['', ''],
    ['Notice', 'This sheet is private to your Google Account. Changes in SpendWise sync here.']
  ];

  // Batch Update Values in Sheets
  const batchValueUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`;
  const batchPayload = {
    valueInputOption: 'USER_ENTERED',
    data: [
      { range: 'Transactions!A1:K', values: txData },
      { range: 'Accounts!A1:J', values: accData },
      { range: 'Categories!A1:H', values: catData },
      { range: 'Loans & EMIs!A1:L', values: loanData },
      { range: 'Rules!A1:H', values: ruleData },
      { range: 'Overview & Sync Info!A1:B', values: overviewData }
    ]
  };

  const response = await fetch(batchValueUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(batchPayload)
  });

  if (!response.ok) {
    const errText = await response.text();
    if (response.status === 403) {
      clearCachedGSheetToken();
      throw new Error('Permission Denied (403): Your Google account token does not have permission to edit this spreadsheet. Please reconnect with full permissions or use the Manual Web App option.');
    }
    throw new Error(`Google Sheets batch update failed: ${errText}`);
  }

  const sheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

  return {
    success: true,
    message: `Successfully synchronized ${transactions.length} transactions and ${accounts.length} accounts to Google Sheets!`,
    spreadsheetId,
    spreadsheetUrl: sheetUrl,
    syncedCount: {
      accounts: accounts.length,
      transactions: transactions.length,
      categories: categories.length,
      loans: loans.length,
      rules: rules.length
    }
  };
}

// Fetch and restore data from Google Sheets into SpendWise
export async function pullDataFromGoogleSheets(
  token: string,
  spreadsheetId: string
): Promise<{
  accounts?: any[];
  transactions?: any[];
  categories?: any[];
  loans?: any[];
  rules?: any[];
}> {
  const batchGetUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchGet?ranges=Transactions!A1:K&ranges=Accounts!A1:J&ranges=Categories!A1:H&ranges=Loans%20%26%20EMIs!A1:L&ranges=Rules!A1:H`;

  const res = await fetch(batchGetUrl, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!res.ok) {
    const errText = await res.text();
    if (res.status === 403) {
      clearCachedGSheetToken();
      throw new Error('Permission Denied (403): Cannot read from this Google Sheet. Please reconnect or use the Manual Web App method.');
    }
    throw new Error(`Failed to read data from Google Sheet: ${errText}`);
  }

  const data = await res.json();
  const valueRanges = data.valueRanges || [];

  const result: any = {};

  valueRanges.forEach((rangeObj: any) => {
    const range = rangeObj.range || '';
    const rows = rangeObj.values || [];
    if (rows.length <= 1) return; // only headers or empty

    const dataRows = rows.slice(1);

    if (range.startsWith('Transactions')) {
      result.transactions = dataRows.map((r: any[]) => ({
        id: r[0] || `tx_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        date: r[1] || new Date().toISOString().split('T')[0],
        time: r[2] || '',
        title: r[3] || 'Untitled Expense',
        amount: parseFloat(r[4]) || 0,
        type: (r[5] || 'expense') as any,
        accountId: r[6] || '',
        categoryId: r[7] || '',
        notes: r[8] || '',
        createdBy: r[9] || '',
        updatedAt: r[10] || new Date().toISOString()
      }));
    } else if (range.startsWith('Accounts')) {
      result.accounts = dataRows.map((r: any[]) => ({
        id: r[0] || `acc_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        name: r[1] || 'Account',
        type: (r[2] || 'bank') as any,
        balance: parseFloat(r[3]) || 0,
        creditLimit: parseFloat(r[4]) || undefined,
        dueAmount: parseFloat(r[5]) || undefined,
        dueDate: r[6] || undefined,
        currency: r[7] || 'INR',
        accountNumberLast4: r[8] || '',
        ownerEmail: r[9] || '',
        sharedWith: [],
        color: '#3B82F6'
      }));
    } else if (range.startsWith('Categories')) {
      result.categories = dataRows.map((r: any[]) => ({
        id: r[0] || `cat_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        name: r[1] || 'Category',
        icon: r[2] || 'Tag',
        color: r[3] || '#6B7280',
        type: (r[4] || 'expense') as any,
        budgetLimit: parseFloat(r[5]) || undefined,
        userEmail: r[6] || '',
        isGlobal: r[7] === 'YES'
      }));
    } else if (range.startsWith('Loans')) {
      result.loans = dataRows.map((r: any[]) => ({
        id: r[0] || `loan_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        name: r[1] || 'Loan',
        lender: r[2] || '',
        totalPrincipal: parseFloat(r[3]) || 0,
        remainingPrincipal: parseFloat(r[4]) || 0,
        interestRate: parseFloat(r[5]) || 0,
        monthlyEMI: parseFloat(r[6]) || 0,
        totalTenureMonths: parseInt(r[7], 10) || 0,
        paidTenureMonths: parseInt(r[8], 10) || 0,
        linkedAccountId: r[9] || '',
        nextDueDate: r[10] || '',
        status: (r[11] || 'active') as any,
        userEmail: '',
        category: 'Personal'
      }));
    } else if (range.startsWith('Rules')) {
      result.rules = dataRows.map((r: any[]) => ({
        id: r[0] || `rule_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        name: r[1] || 'Rule',
        keyword: r[2] || '',
        matchType: (r[3] || 'contains') as any,
        categoryId: r[4] || '',
        accountId: r[5] || undefined,
        isEnabled: r[6] === 'TRUE',
        matchCount: parseInt(r[7], 10) || 0,
        createdAt: new Date().toISOString()
      }));
    }
  });

  return result;
}

