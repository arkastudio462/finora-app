import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TAB_BAR_BOTTOM_GAP, TAB_BAR_HEIGHT } from '@/constants/theme';

const EXTRA_PADDING = 20;

export function useTabBarPadding() {
  const insets = useSafeAreaInsets();
  const totalBottom = insets.bottom + TAB_BAR_HEIGHT + TAB_BAR_BOTTOM_GAP + EXTRA_PADDING;
  return totalBottom;
}
