import { RefObject, useCallback, useEffect, useRef, useState } from "react";
import { Keyboard, NativeScrollEvent, NativeSyntheticEvent, Platform, ScrollView, TextInput } from "react-native";

// Center the focused field in the actual viewport, after resize/keyboard animation.
export default function useAuthKeyboard(scrollRef: RefObject<ScrollView | null>, enabled: boolean) {
  const focused = useRef<TextInput | null>(null);
  const offset = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [viewportHeight, setViewportHeight] = useState(0);
  const schedule = useCallback(() => {
    if (!enabled || Platform.OS === "web") return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const input = focused.current;
      const scroll = scrollRef.current;
      if (!input?.isFocused() || !scroll || !Keyboard.isVisible()) return;
      scroll.getNativeScrollRef()?.measureInWindow((_x, viewportY, _width, viewportH) => {
        input.measureInWindow((_ix, inputY, _iw, inputH) => {
          if (focused.current !== input || !input.isFocused() || !Keyboard.isVisible()) return;
          const bottom = Math.min(viewportY + viewportH, Keyboard.metrics()?.screenY ?? Infinity);
          const visibleHeight = bottom - viewportY;
          if (visibleHeight <= inputH) return;
          const targetY = viewportY + (visibleHeight - inputH) / 2;
          const nextOffset = Math.max(0, offset.current + inputY - targetY);
          if (Math.abs(nextOffset - offset.current) > 2) scroll.scrollTo({ y: nextOffset, animated: true });
        });
      });
    }, 120);
  }, [enabled, scrollRef]);

  useEffect(() => {
    if (Platform.OS === "web") return;
    const show = () => { setKeyboardOpen(true); schedule(); };
    const hide = () => { setKeyboardOpen(false); if (timer.current) clearTimeout(timer.current); };
    const subscriptions = [Keyboard.addListener("keyboardDidShow", show), Keyboard.addListener("keyboardDidHide", hide)];
    if (Platform.OS === "ios") subscriptions.push(Keyboard.addListener("keyboardDidChangeFrame", schedule));
    return () => { subscriptions.forEach((subscription) => subscription.remove()); if (timer.current) clearTimeout(timer.current); };
  }, [enabled, schedule]);

  return {
    // Leave enough scrollable space below the last field to bring it to the center.
    bottomSpace: enabled && keyboardOpen ? Math.max(180, viewportHeight / 2) : 0,
    onFocus: (input: TextInput | null) => { focused.current = input; schedule(); },
    onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => { offset.current = event.nativeEvent.contentOffset.y; },
    onLayout: (height: number) => { setViewportHeight(height); schedule(); },
    onContentSizeChange: schedule,
  };
}
