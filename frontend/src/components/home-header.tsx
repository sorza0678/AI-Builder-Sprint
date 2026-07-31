import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';

interface HomeHeaderProps {
  scale?: number;
  onMenuPress: () => void;
  onActionPress: () => void;
}

export function HomeHeader({ scale = 1, onMenuPress, onActionPress }: HomeHeaderProps) {
  return (
    <View style={[styles.container, {
      height: 60 * scale,
      paddingHorizontal: 16 * scale,
      paddingVertical: 18 * scale,
    }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="메뉴 열기"
        hitSlop={10}
        onPress={onMenuPress}
        style={({ pressed }) => [
          styles.iconButton,
          { width: 24 * scale, height: 24 * scale },
          pressed && styles.pressed,
        ]}>
        <Image
          source={require('@/assets/images/home/menu.svg')}
          style={{ width: 18 * scale, height: 14 * scale }}
          contentFit="fill"
        />
      </Pressable>

      <Image
        accessibilityLabel="baton"
        source={require('@/assets/images/home/baton-logo.svg')}
        style={{ width: 69.433 * scale, height: 20.261 * scale }}
        contentFit="fill"
      />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="연결 기능"
        hitSlop={10}
        onPress={onActionPress}
        style={({ pressed }) => [
          styles.iconButton,
          { width: 24 * scale, height: 24 * scale },
          pressed && styles.pressed,
        ]}>
        <Image
          source={require('@/assets/images/home/header-action.svg')}
          style={{ width: 21.124 * scale, height: 19.2 * scale }}
          contentFit="fill"
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.65,
  },
});
