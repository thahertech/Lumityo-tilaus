import { UIManager } from 'react-native';

export function scrollFocusedInputIntoView(scrollViewRef, focusedInput, viewportHeight, scrollOffset) {
  const scrollView = scrollViewRef.current;
  const target = focusedInput.current;
  const content = scrollView?.getInnerViewNode();
  if (target == null || content == null || viewportHeight.current <= 0) return;

  UIManager.measureLayout(target, content, () => {
    if (focusedInput.current === target) console.warn('Unable to measure the focused input');
  }, (_x, y, _width, height) => {
    if (focusedInput.current !== target) return;
    const top = scrollOffset.current;
    const visibleHeight = viewportHeight.current;
    if (y + height > top + visibleHeight - 12) {
      scrollView.scrollTo({ y: Math.max(0, y + height - visibleHeight + 12), animated: true });
    } else if (y < top + 12) {
      scrollView.scrollTo({ y: Math.max(0, y - 12), animated: true });
    }
  });
}
