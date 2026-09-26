import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  Dimensions,
  Keyboard,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewProps,
} from 'react-native';

const EXTRA_GAP = 28;

const RevealContext = createContext<() => void>(() => undefined);

/** Ask the nearest KeyboardSafeScrollView to bring the focused field into view. */
export function useRevealFocusedField(): () => void {
  return useContext(RevealContext);
}

/** Height of the software keyboard, or 0 when it is hidden. */
export function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, (event) => {
      setInset(event.endCoordinates?.height ?? 0);
    });
    const hide = Keyboard.addListener(hideEvent, () => setInset(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return inset;
}

type Measurable = {
  measureInWindow: (
    callback: (x: number, y: number, width: number, height: number) => void,
  ) => void;
};

function focusedField(): Measurable | null {
  const input = TextInput.State.currentlyFocusedInput() as Measurable | null;
  if (!input || typeof input.measureInWindow !== 'function') return null;
  return input;
}

/**
 * ScrollView that keeps the focused field above the keyboard.
 * Android draws the keyboard over the app, so each screen that edits text uses this
 * instead of padding one screen at a time.
 */
export const KeyboardSafeScrollView = forwardRef<ScrollView, ScrollViewProps>(
  function KeyboardSafeScrollView(
    { contentContainerStyle, onScroll, keyboardShouldPersistTaps = 'handled', children, ...rest },
    ref,
  ) {
    const innerRef = useRef<ScrollView>(null);
    const offsetY = useRef(0);
    const keyboardHeight = useRef(0);
    const [inset, setInset] = useState(0);

    const setRefs = useCallback(
      (node: ScrollView | null) => {
        innerRef.current = node;
        if (typeof ref === 'function') ref(node);
        else if (ref) ref.current = node;
      },
      [ref],
    );

    const reveal = useCallback(() => {
      const height = keyboardHeight.current;
      const input = focusedField();
      if (!input || height <= 0) return;
      input.measureInWindow((_x, y, _width, fieldHeight) => {
        const visibleBottom = Dimensions.get('window').height - height - EXTRA_GAP;
        const overflow = y + fieldHeight - visibleBottom;
        if (overflow > 8) {
          innerRef.current?.scrollTo({
            y: Math.max(0, offsetY.current + overflow),
            animated: true,
          });
        }
      });
    }, []);

    useEffect(() => {
      const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
      const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
      const show = Keyboard.addListener(showEvent, (event) => {
        const height = event.endCoordinates?.height ?? 0;
        keyboardHeight.current = height;
        setInset(height);
      });
      const hide = Keyboard.addListener(hideEvent, () => {
        keyboardHeight.current = 0;
        setInset(0);
      });
      return () => {
        show.remove();
        hide.remove();
      };
    }, []);

    useEffect(() => {
      if (inset <= 0) return;
      const frame = requestAnimationFrame(() => reveal());
      return () => cancelAnimationFrame(frame);
    }, [inset, reveal]);

    const flat = StyleSheet.flatten(contentContainerStyle) ?? {};
    const baseBottom = typeof flat.paddingBottom === 'number' ? flat.paddingBottom : 0;

    return (
      <RevealContext.Provider value={reveal}>
        <ScrollView
          ref={setRefs}
          keyboardShouldPersistTaps={keyboardShouldPersistTaps}
          onScroll={(event: NativeSyntheticEvent<NativeScrollEvent>) => {
            offsetY.current = event.nativeEvent.contentOffset.y;
            onScroll?.(event);
          }}
          scrollEventThrottle={16}
          contentContainerStyle={[
            contentContainerStyle,
            inset > 0 ? { paddingBottom: baseBottom + inset + EXTRA_GAP } : null,
          ]}
          {...rest}
        >
          {children}
        </ScrollView>
      </RevealContext.Provider>
    );
  },
);
