import React, { useState } from "react";
import { Modal, Pressable, ScrollView, StyleProp, StyleSheet, useWindowDimensions, View, ViewStyle } from "react-native";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "./components";
import { s } from "./styles";

type Props = {
  visible: boolean;
  onClose: () => void;
  closeLabel: string;
  maxWidth?: number;
  contentStyle?: StyleProp<ViewStyle>;
  children: React.ReactNode;
};

function DialogBody({ onClose, closeLabel, maxWidth = 460, contentStyle, children }: Omit<Props, "visible">) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [layoutHeight, setLayoutHeight] = useState(height);
  // Measure the modal's own window: Android modal and app windows can differ.
  const availableHeight = Math.max(0, layoutHeight - insets.top - insets.bottom - 32);
  return <View style={[styles.backdrop, {
    paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16,
    paddingLeft: insets.left + 18, paddingRight: insets.right + 18,
  }]} onLayout={(event) => setLayoutHeight(event.nativeEvent.layout.height)}>
    <View testID="centered-modal-card" style={[styles.card, { maxWidth, maxHeight: availableHeight }]}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel={closeLabel} onPress={onClose} style={s.close}>
          <Icon name="close" />
        </Pressable>
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={contentStyle} bounces={false}
        keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
    </View>
  </View>;
}

export default function CenteredModal({ visible, ...props }: Props) {
  return <Modal visible={visible} transparent animationType="fade" statusBarTranslucent navigationBarTranslucent
    onRequestClose={props.onClose}>
    <SafeAreaProvider>
      <DialogBody {...props} />
    </SafeAreaProvider>
  </Modal>;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(35,22,38,.72)", alignItems: "center", justifyContent: "center" },
  card: { width: "100%", flexShrink: 1, borderRadius: 28, backgroundColor: "#FFF", overflow: "hidden" },
  header: { alignItems: "flex-end", paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4 },
  scroll: { flexGrow: 0, flexShrink: 1 },
});
