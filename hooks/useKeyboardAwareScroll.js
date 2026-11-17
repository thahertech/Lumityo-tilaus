import { useEffect, useRef, useState } from 'react';
import { Keyboard } from 'react-native';
import { scrollFocusedInputIntoView } from '../utils/keyboardScroll';

export default function useKeyboardAwareScroll() {
  const scrollViewRef = useRef(null);
  const focusedInput = useRef(null);
  const viewportHeight = useRef(0);
  const scrollOffset = useRef(0);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  const scrollFocused = () => scrollFocusedInputIntoView(scrollViewRef, focusedInput, viewportHeight, scrollOffset);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => {
      setKeyboardVisible(true);
      scrollFocused();
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => {
      focusedInput.current = null;
      setKeyboardVisible(false);
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return {
    scrollViewRef,
    keyboardVisible,
    onFocusInput: (event) => {
      focusedInput.current = event.nativeEvent.target;
      scrollFocused();
    },
    onBlurInput: (event) => {
      if (focusedInput.current === event.nativeEvent.target) focusedInput.current = null;
    },
    onLayout: (event) => {
      viewportHeight.current = event.nativeEvent.layout.height;
      scrollFocused();
    },
    onScroll: (event) => { scrollOffset.current = event.nativeEvent.contentOffset.y; },
  };
}
