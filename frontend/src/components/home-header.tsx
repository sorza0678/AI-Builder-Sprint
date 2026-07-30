import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';

interface HomeHeaderProps {
  onMenuPress: () => void;
  onActionPress: () => void;
}

export function HomeHeader({ onMenuPress, onActionPress }: HomeHeaderProps) {
  return (
    <View style={styles.container}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="메뉴 열기"
        hitSlop={10}
        onPress={onMenuPress}
        style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
        <Image
          source={require('@/assets/images/home/menu.svg')}
          style={styles.menuIcon}
          contentFit="fill"
        />
      </Pressable>

      <Image
        accessibilityLabel="baton"
        source={require('@/assets/images/home/baton-logo.svg')}
        style={styles.logo}
        contentFit="fill"
      />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="연결 기능"
        hitSlop={10}
        onPress={onActionPress}
        style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
        <Image
          source={require('@/assets/images/home/header-action.svg')}
          style={styles.actionIcon}
          contentFit="fill"
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 60,
    paddingHorizontal: 16,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconButton: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuIcon: {
    width: 18,
    height: 14,
  },
  logo: {
    width: 69.433,
    height: 20.261,
  },
  actionIcon: {
    width: 21.124,
    height: 19.2,
  },
  pressed: {
    opacity: 0.65,
  },
});
