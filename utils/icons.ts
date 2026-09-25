import { MaterialCommunityIcons } from '@expo/vector-icons';

type IconName = string;

const CATEGORY_ICON_MAP: Record<string, IconName> = {
  Food: 'shopping',
  Transportation: 'bike',
  Housing: 'home',
  Shopping: 'cart',
  Entertainment: 'gamepad-variant',
  Health: 'heart-pulse',
  Salary: 'briefcase',
  Other: 'receipt',
};

export function getCategoryIcon(category: string): IconName {
  return CATEGORY_ICON_MAP[category] || 'receipt';
}

export function getIncomeIcon(): IconName {
  return 'arrow-down-left';
}

export function getExpenseIcon(): IconName {
  return 'arrow-up-right';
}
