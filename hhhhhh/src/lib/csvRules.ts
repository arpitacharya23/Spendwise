import { TransactionRule, Category, Account, RuleMatchType } from '../types';

/**
 * Robust CSV parser that handles quotes, escaped quotes, and commas
 */
export function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped double quote ("")
        current += '"';
        i++; // skip next quote
      } else {
        // Toggle quote mode
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // Column delimiter outside quotes
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

/**
 * Export rules list to CSV file download
 */
export function exportRulesToCSV(
  rules: TransactionRule[],
  categories: Category[],
  accounts: Account[]
): void {
  const headers = [
    'Name',
    'Keywords',
    'Match Type',
    'Category',
    'Account',
    'Transaction Type',
    'Status',
    'Match Count',
    'Created Date',
  ];

  const rows = rules.map((r) => {
    const cat = categories.find((c) => c.id === r.categoryId);
    const acc = accounts.find((a) => a.id === r.accountId);

    const escape = (str: string | number | undefined | null) => {
      const text = str === undefined || str === null ? '' : String(str);
      return `"${text.replace(/"/g, '""')}"`;
    };

    return [
      escape(r.name),
      escape(r.keyword),
      escape(r.matchType),
      escape(cat ? cat.name : r.categoryId),
      escape(acc ? acc.name : ''),
      escape(r.transactionType || 'any'),
      escape(r.isEnabled ? 'enabled' : 'disabled'),
      escape(r.matchCount || 0),
      escape(r.createdAt || new Date().toISOString().split('T')[0]),
    ].join(',');
  });

  // Prepend UTF-8 BOM so Excel and other spreadsheet editors display accents/characters properly
  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const today = new Date().toISOString().split('T')[0];
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `spendwise_rules_export_${today}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Generate a clean sample CSV template for user download
 */
export function downloadSampleRulesTemplate(categories: Category[], accounts: Account[]): void {
  const headers = [
    'Name',
    'Keywords',
    'Match Type',
    'Category',
    'Account',
    'Transaction Type',
    'Status',
  ];

  const cat1 = categories[0]?.name || 'Food & Dining';
  const cat2 = categories[1]?.name || 'Transportation';
  const cat3 = categories[2]?.name || 'Shopping';
  const acc1 = accounts[0]?.name || 'Main Checking';

  const sampleRows = [
    ['Starbucks & Cafe', 'starbucks, costa, cafe, barista', 'contains', cat1, acc1, 'expense', 'enabled'],
    ['Rideshare & Cabs', 'uber, lyft, ola, taxi, grab', 'contains', cat2, '', 'expense', 'enabled'],
    ['Salary Deposit', 'payroll, employer inc, direct dep, salary', 'contains', 'Salary & Income', '', 'income', 'enabled'],
    ['Amazon Online Shopping', 'amazon, amzn, prime video', 'starts_with', cat3, '', 'expense', 'enabled'],
  ];

  const escape = (str: string) => `"${str.replace(/"/g, '""')}"`;

  const rows = sampleRows.map((row) => row.map(escape).join(','));
  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', 'spendwise_rules_template.csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export interface ParsedRulesResult {
  rules: TransactionRule[];
  errors: string[];
  warnings: string[];
  totalRowsParsed: number;
}

/**
 * Parse CSV text into validated TransactionRule objects
 */
export function parseRulesFromCSV(
  csvText: string,
  categories: Category[],
  accounts: Account[]
): ParsedRulesResult {
  const result: ParsedRulesResult = {
    rules: [],
    errors: [],
    warnings: [],
    totalRowsParsed: 0,
  };

  if (!csvText || !csvText.trim()) {
    result.errors.push('The uploaded CSV file appears to be empty.');
    return result;
  }

  // Normalize line endings
  const rawLines = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const lines = rawLines.filter((l) => l.trim().length > 0);

  if (lines.length === 0) {
    result.errors.push('No data rows found in the CSV file.');
    return result;
  }

  // Parse header
  const headerLine = lines[0];
  const headers = parseCSVLine(headerLine).map((h) => h.toLowerCase().trim());

  // Helper to find column index by fuzzy header names
  const findCol = (candidates: string[]): number => {
    return headers.findIndex((h) =>
      candidates.some((c) => h === c || h.replace(/[\s_-]/g, '') === c.replace(/[\s_-]/g, ''))
    );
  };

  const nameIdx = findCol(['name', 'rule name', 'rulename', 'title', 'rule']);
  const keywordIdx = findCol(['keywords', 'keyword', 'key words', 'phrase', 'phrases', 'merchant', 'merchants']);
  const matchTypeIdx = findCol(['match type', 'matchtype', 'condition', 'matching', 'type of match']);
  const categoryIdx = findCol(['category', 'category name', 'categoryname', 'category id', 'target category', 'cat']);
  const accountIdx = findCol(['account', 'account name', 'accountname', 'account id', 'target account', 'acc']);
  const txTypeIdx = findCol(['transaction type', 'transactiontype', 'type', 'tx type', 'txtype']);
  const statusIdx = findCol(['status', 'enabled', 'is enabled', 'isenabled', 'active', 'state']);
  const matchCountIdx = findCol(['match count', 'matchcount', 'matches', 'count']);
  const createdAtIdx = findCol(['created date', 'createddate', 'created at', 'createdat', 'date']);

  if (keywordIdx === -1 && nameIdx === -1) {
    result.errors.push(
      'Could not identify columns in the CSV. Please ensure headers include "Name" and "Keywords".'
    );
    return result;
  }

  const defaultCategory = categories[0]?.id || 'cat-1';
  const timestamp = Date.now();

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    result.totalRowsParsed++;
    const cols = parseCSVLine(line);

    // Extract values
    const rawName = nameIdx !== -1 && cols[nameIdx] !== undefined ? cols[nameIdx].trim() : '';
    const rawKeyword = keywordIdx !== -1 && cols[keywordIdx] !== undefined ? cols[keywordIdx].trim() : '';
    const rawMatchType = matchTypeIdx !== -1 && cols[matchTypeIdx] !== undefined ? cols[matchTypeIdx].trim().toLowerCase() : '';
    const rawCategory = categoryIdx !== -1 && cols[categoryIdx] !== undefined ? cols[categoryIdx].trim() : '';
    const rawAccount = accountIdx !== -1 && cols[accountIdx] !== undefined ? cols[accountIdx].trim() : '';
    const rawTxType = txTypeIdx !== -1 && cols[txTypeIdx] !== undefined ? cols[txTypeIdx].trim().toLowerCase() : '';
    const rawStatus = statusIdx !== -1 && cols[statusIdx] !== undefined ? cols[statusIdx].trim().toLowerCase() : '';
    const rawMatchCount = matchCountIdx !== -1 && cols[matchCountIdx] !== undefined ? cols[matchCountIdx].trim() : '';
    const rawCreatedAt = createdAtIdx !== -1 && cols[createdAtIdx] !== undefined ? cols[createdAtIdx].trim() : '';

    // If both name and keyword are empty, skip row
    if (!rawName && !rawKeyword) {
      continue;
    }

    const keyword = rawKeyword || rawName;
    const name = rawName || `Rule for ${keyword.split(',')[0].trim()}`;

    // Normalize matchType
    let matchType: RuleMatchType = 'contains';
    if (rawMatchType.includes('start') || rawMatchType === 'starts_with') {
      matchType = 'starts_with';
    } else if (rawMatchType.includes('exact') || rawMatchType === 'equals') {
      matchType = 'exact';
    }

    // Resolve Category
    let categoryId = defaultCategory;
    if (rawCategory) {
      const matchedCat = categories.find(
        (c) =>
          c.id.toLowerCase() === rawCategory.toLowerCase() ||
          c.name.toLowerCase() === rawCategory.toLowerCase() ||
          c.name.toLowerCase().includes(rawCategory.toLowerCase())
      );
      if (matchedCat) {
        categoryId = matchedCat.id;
      } else {
        result.warnings.push(
          `Row ${i}: Category "${rawCategory}" was not found. Assigned to "${categories.find((c) => c.id === defaultCategory)?.name || 'Default'}" instead.`
        );
      }
    }

    // Resolve Account
    let accountId: string | undefined = undefined;
    if (rawAccount) {
      const matchedAcc = accounts.find(
        (a) =>
          a.id.toLowerCase() === rawAccount.toLowerCase() ||
          a.name.toLowerCase() === rawAccount.toLowerCase() ||
          (a.bankName && a.bankName.toLowerCase().includes(rawAccount.toLowerCase()))
      );
      if (matchedAcc) {
        accountId = matchedAcc.id;
      }
    }

    // Normalize Transaction Type
    let transactionType: 'expense' | 'income' | undefined = undefined;
    if (rawTxType === 'income' || rawTxType === 'inflow') {
      transactionType = 'income';
    } else if (rawTxType === 'expense' || rawTxType === 'outflow') {
      transactionType = 'expense';
    }

    // Normalize Status / isEnabled
    let isEnabled = true;
    if (
      rawStatus === 'disabled' ||
      rawStatus === 'false' ||
      rawStatus === '0' ||
      rawStatus === 'no' ||
      rawStatus === 'inactive' ||
      rawStatus === 'off'
    ) {
      isEnabled = false;
    }

    const matchCount = !isNaN(Number(rawMatchCount)) ? Math.max(0, parseInt(rawMatchCount, 10)) : 0;
    const createdAt = rawCreatedAt && /^\d{4}-\d{2}-\d{2}/.test(rawCreatedAt)
      ? rawCreatedAt.slice(0, 10)
      : new Date().toISOString().split('T')[0];

    const rule: TransactionRule = {
      id: `rule-csv-${timestamp}-${i}`,
      name,
      keyword,
      matchType,
      categoryId,
      accountId,
      transactionType,
      isEnabled,
      createdAt,
      matchCount,
    };

    result.rules.push(rule);
  }

  if (result.rules.length === 0) {
    result.errors.push('No valid rule entries could be extracted from the file.');
  }

  return result;
}
