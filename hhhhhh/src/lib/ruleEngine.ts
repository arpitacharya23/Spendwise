import { Category, Transaction, TransactionRule, RuleMatchType } from '../types';

/**
 * Checks if a transaction title matches a keyword according to the specified match type.
 * Supports comma-separated keywords (e.g. "starbucks, cafe, coffee").
 */
export function checkKeywordMatch(
  title: string,
  keywordsString: string,
  matchType: RuleMatchType = 'contains'
): { isMatch: boolean; matchedKeyword: string | null } {
  if (!title || !keywordsString) return { isMatch: false, matchedKeyword: null };

  const normalizedTitle = title.trim().toLowerCase();
  if (!normalizedTitle) return { isMatch: false, matchedKeyword: null };

  // Split comma or semicolon separated keywords
  const keywords = keywordsString
    .split(/[,;]+/)
    .map((k) => k.trim().toLowerCase())
    .filter((k) => k.length > 0);

  for (const keyword of keywords) {
    if (matchType === 'exact') {
      if (normalizedTitle === keyword) {
        return { isMatch: true, matchedKeyword: keyword };
      }
    } else if (matchType === 'starts_with') {
      if (normalizedTitle.startsWith(keyword)) {
        return { isMatch: true, matchedKeyword: keyword };
      }
    } else {
      // Default: 'contains'
      // Substring search with case-insensitivity
      if (normalizedTitle.includes(keyword)) {
        return { isMatch: true, matchedKeyword: keyword };
      }
    }
  }

  return { isMatch: false, matchedKeyword: null };
}

export interface RuleMatchResult {
  rule: TransactionRule;
  matchedKeyword: string;
  suggestedCategoryId: string;
  suggestedAccountId?: string;
  suggestedType?: 'expense' | 'income';
}

/**
 * Finds the first enabled rule that matches the given transaction title.
 */
export function findMatchingRule(
  title: string,
  rules: TransactionRule[]
): RuleMatchResult | null {
  if (!title || !rules || rules.length === 0) return null;

  for (const rule of rules) {
    if (!rule.isEnabled) continue;

    const { isMatch, matchedKeyword } = checkKeywordMatch(title, rule.keyword, rule.matchType);
    if (isMatch && matchedKeyword) {
      return {
        rule,
        matchedKeyword,
        suggestedCategoryId: rule.categoryId,
        suggestedAccountId: rule.accountId,
        suggestedType: rule.transactionType,
      };
    }
  }

  return null;
}

/**
 * Applies active rules retroactively to a list of transactions.
 * Returns the updated transactions and the count of modified transactions.
 */
export function applyRulesToTransactionsList(
  transactions: Transaction[],
  rules: TransactionRule[]
): { updatedTransactions: Transaction[]; modifiedCount: number } {
  let modifiedCount = 0;

  const updatedTransactions = transactions.map((tx) => {
    // Only apply if there's a matching rule
    const match = findMatchingRule(tx.title, rules);
    if (!match) return tx;

    let hasChanged = false;
    const updatedTx = { ...tx };

    if (match.suggestedCategoryId && updatedTx.categoryId !== match.suggestedCategoryId) {
      updatedTx.categoryId = match.suggestedCategoryId;
      hasChanged = true;
    }

    if (match.suggestedAccountId && updatedTx.accountId !== match.suggestedAccountId) {
      updatedTx.accountId = match.suggestedAccountId;
      hasChanged = true;
    }

    if (match.suggestedType && (updatedTx.type === 'expense' || updatedTx.type === 'income') && updatedTx.type !== match.suggestedType) {
      updatedTx.type = match.suggestedType;
      hasChanged = true;
    }

    if (hasChanged) {
      modifiedCount++;
      updatedTx.updatedAt = new Date().toISOString();
      return updatedTx;
    }

    return tx;
  });

  return { updatedTransactions, modifiedCount };
}
