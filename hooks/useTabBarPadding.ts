import { useSafeAreaInsets } from 'react-native-safe-area-context';

const TAB_BAR_HEIGHT = 72;
const TAB_BAR_BOTTOM_MARGIN = 10;
const EXTRA_PADDING = 20;

export function useTabBarPadding() {
  const insets = useSafeAreaInsets();
  const totalBottom = insets.bottom + TAB_BAR_BOTTOM_MARGIN + TAB_BAR_HEIGHT + EXTRA_PADDING;
  return totalBottom;
}
