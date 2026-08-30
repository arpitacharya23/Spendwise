/**
 * Utility functions for Indian Numbering System formatting (e.g. 1,00,000, 10,00,000, 1,00,00,000).
 */

export function formatINR(val: number | string | null | undefined, options?: Intl.NumberFormatOptions): string {
  if (val === null || val === undefined || val === '') return '0';
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(num)) return '0';
  return num.toLocaleString('en-IN', {
    maximumFractionDigits: 2,
    ...options,
  });
}

/**
 * Format currency with Indian comma separators.
 */
export function formatCurrency(amount: number | string | null | undefined, currency: string = '₹'): string {
  return `${currency}${formatINR(amount)}`;
}
