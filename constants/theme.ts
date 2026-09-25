export interface Colors {
  primary: string;
  primaryDark: string;
  primaryDarker: string;
  background: string;
  cardDark: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  success: string;
  danger: string;
  border: string;
  white: string;
  cardLight: string;
  surface: string;
}

export const COLORS: Colors = {
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
  surface: '#ffffff',
};

export const DARK_COLORS: Colors = {
  primary: '#fb923c',
  primaryDark: '#f97316',
  primaryDarker: '#ea580c',
  background: '#0f1114',
  cardDark: '#22262d',
  textPrimary: '#f4f4f5',
  textSecondary: '#a1a1aa',
  textMuted: '#71717a',
  success: '#4ade80',
  danger: '#f87171',
  border: '#262a30',
  white: '#ffffff',
  cardLight: '#2b2115',
  surface: '#17191d',
};

export const TAB_BAR_HEIGHT = 72;
export const TAB_BAR_BOTTOM_GAP = 12;

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
