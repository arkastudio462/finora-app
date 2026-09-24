export const COLORS = {
  primary: '#f97316',
  primaryDark: '#ea580c',
  primaryDarker: '#c2410c',
  background: '#fafaf8',
  cardDark: '#191b1f',
  textPrimary: '#17191c',
  textSecondary: '#6b7280',
  textMuted: '#9ca3af',
  success: '#16a34a',
  danger: '#ef4444',
  border: '#f3f4f6',
  white: '#ffffff',
  cardLight: '#fff7eb',
};

export const CATEGORIES = [
  'Food',
  'Transportation',
  'Housing',
  'Shopping',
  'Entertainment',
  'Health',
  'Salary',
  'Other',
] as const;

export type Category = (typeof CATEGORIES)[number];

export const BUDGET_CATEGORIES = [
  'Food',
  'Transportation',
  'Housing',
  'Shopping',
  'Entertainment',
  'Health',
  'Other',
] as const;
