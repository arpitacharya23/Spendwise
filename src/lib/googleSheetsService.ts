// Client-side Google Sheets & Drive API helper using GIS (Google Identity Services) OAuth token
// Uses endpoints:
// - Google Drive API v3: search/create SpendWise spreadsheet
// - Google Sheets API v4: batchUpdate, values.get, values.update, values.append

import { requestGoogleWorkspaceToken } from './firebaseAuth';

declare global {
  interface Window {
    google?: any;
    gapi?: any;
  }
}

export interface GoogleSheetsSyncConfig {
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
    return Boolean(config && config.spreadsheetId);
  } catch {
    return false;
  }
}

/**
 * Checks if all current SpendWise data is synced to Google Sheets.
 * - Returns true (green circle) if connected and lastSyncedAt exists and is >= lastDataModifiedAt.
 * - Returns false (yellow circle) if there is new data to be synced or no sync has occurred.
 */
export function isGoogleSheetsSynced(latestItemTimestamp?: string | number): boolean {
  try {
    const config = getStoredGSheetConfig();
    if (!config.spreadsheetId || !config.lastSyncedAt) {
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
 * - 'disconnected': No Google Sheet is connected. No circle indicator should be shown.
 * - 'synced': Google Sheet connected and all data is up-to-date (Green circle).
 * - 'pending': Google Sheet connected and there are unsynced changes (Yellow circle).
 */
export function getGoogleSheetSyncStatus(): GoogleSheetSyncState {
  try {
    const config = getStoredGSheetConfig();
    if (!config || !config.spreadsheetId) {
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

// Request access token from user via Firebase Google Auth (preferred) or Google Identity Services
export async function requestGoogleOAuthToken(): Promise<string> {
  // Check if we already have a valid token
  const existing = getCachedGSheetToken();
  if (existing) {
    return existing;
  }

  try {
    const token = await requestGoogleWorkspaceToken();
    if (token) {
      cachedAccessToken = token;
      tokenExpiresAt = Date.now() + 3600 * 1000;
      return token;
    }
  } catch (firebaseErr: any) {
    console.warn('Firebase Auth token flow error/fallback:', firebaseErr);
    // If popup was closed intentionally by user
    if (firebaseErr?.code === 'auth/popup-closed-by-user' || firebaseErr?.message?.includes('popup-closed-by-user')) {
      throw new Error('Google authorization popup was closed before completing sign-in.');
    }
    // If popup blocked
    if (firebaseErr?.code === 'auth/popup-blocked') {
      throw new Error('The authorization popup was blocked by your browser. Please allow popups for this site and try again.');
    }
    // If Firebase succeeds or gives other error, rethrow informative message
    if (firebaseErr?.code?.startsWith('auth/')) {
      throw new Error(`Google Sheets authorization error: ${firebaseErr.message || firebaseErr.code}`);
    }
  }

  // Fallback to Google Identity Services if needed
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('Window not available'));
      return;
    }

    const checkGisReady = () => {
      if (!window.google?.accounts?.oauth2) {
        const scriptId = 'google-gsi-client-script';
        if (!document.getElementById(scriptId)) {
          const script = document.createElement('script');
          script.id = scriptId;
          script.src = 'https://accounts.google.com/gsi/client';
          script.async = true;
          script.defer = true;
          script.onload = () => initClient();
          script.onerror = () => reject(new Error('Failed to load Google Identity Services SDK'));
          document.head.appendChild(script);
        } else {
          setTimeout(checkGisReady, 200);
        }
      } else {
        initClient();
      }
    };

    const initClient = () => {
      try {
        const clientId = 
          import.meta.env.VITE_GOOGLE_CLIENT_ID || 
          '473262432159-emgnhdceo12kk1hv63ea859ekg7jtvbh.apps.googleusercontent.com';

        tokenClientInstance = window.google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file',
          callback: (tokenResponse: any) => {
            if (tokenResponse.error) {
              reject(new Error(tokenResponse.error_description || tokenResponse.error));
              return;
            }
            if (tokenResponse.access_token) {
              cachedAccessToken = tokenResponse.access_token;
              const expiresIn = parseInt(tokenResponse.expires_in || '3600', 10);
              tokenExpiresAt = Date.now() + expiresIn * 1000;
              resolve(tokenResponse.access_token);
            } else {
              reject(new Error('No access token received from Google'));
            }
          },
          error_callback: (error: any) => {
            reject(new Error(error.message || 'Google sign-in popup was closed or cancelled'));
          }
        });

        tokenClientInstance.requestAccessToken({ prompt: '' });
      } catch (err: any) {
        reject(err);
      }
    };

    checkGisReady();
  });
}

// Find existing "SpendWise Financial Ledger" spreadsheet in user's Google Drive or create a new one
export async function getOrCreateSpendwiseSpreadsheet(token: string, spreadsheetTitle = 'SpendWise Financial Ledger'): Promise<{ id: string; url: string; created: boolean }> {
  // 1. Search in Drive
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
    t.createdBy || user.email,
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
    a.currency || user.currency || 'INR',
    a.accountNumberLast4 || '',
    a.ownerEmail || user.email
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
    c.userEmail || user.email,
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
    ['Owner Email', user.email],
    ['Owner Name', user.name],
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
    // If ranges don't match or sheets don't exist yet, try creating tabs or simple write
    const errText = await response.text();
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
