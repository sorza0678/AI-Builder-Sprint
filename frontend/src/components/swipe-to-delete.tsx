import Ionicons from '@expo/vector-icons/Ionicons';
import { useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';

interface SwipeToDeleteProps {
  accessibilityLabel: string;
  children: ReactNode;
  onDelete: () => Promise<void>;
}

export function SwipeToDelete({ accessibilityLabel, children, onDelete }: SwipeToDeleteProps) {
  const swipeableRef = useRef<Swipeable>(null);
  const [deleting, setDeleting] = useState(false);

  const remove = async (): Promise<void> => {
    if (deleting) return;
    setDeleting(true);
    try {
      await onDelete();
    } catch {
      swipeableRef.current?.close();
      Alert.alert('삭제 실패', '기록을 삭제하지 못했습니다. 다시 시도해 주세요.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Swipeable
      friction={2}
      overshootRight={false}
      ref={swipeableRef}
      renderRightActions={() => (
        <Pressable
          accessibilityLabel={accessibilityLabel}
          accessibilityRole="button"
          disabled={deleting}
          onPress={() => void remove()}
          style={({ pressed }) => [styles.deleteAction, pressed && styles.pressed]}>
          {deleting
            ? <ActivityIndicator color="#FFFFFF" size="small" />
            : <Ionicons color="#FFFFFF" name="trash-outline" size={24} />}
        </Pressable>
      )}
      rightThreshold={32}>
      <View style={styles.content}>{children}</View>
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  content: { backgroundColor: '#FFFFFF' },
  deleteAction: {
    alignItems: 'center',
    backgroundColor: '#E5484D',
    justifyContent: 'center',
    width: 72,
  },
  pressed: { opacity: 0.8 },
});
