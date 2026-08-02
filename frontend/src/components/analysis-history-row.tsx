import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/src/components/pretendard-text';

export interface AnalysisHistoryItem {
  id: string;
  analysisId: string;
  location: string;
  timeLabel: string;
  title: string;
  price: string;
  thumbnail: 'macbook' | 'placeholder';
}

const assets = {
  chevron: require('@/assets/images/recent-analyses/chevron.svg'),
  macbook: require('@/assets/images/recent-analyses/macbook.png'),
  placeholderMark: require('@/assets/images/recent-analyses/placeholder-mark.svg'),
};

interface AnalysisHistoryRowProps {
  item: AnalysisHistoryItem;
}

export function AnalysisHistoryRow({ item }: AnalysisHistoryRowProps) {
  return (
    <Pressable
      accessibilityLabel={`${item.title} 분석 기록 보기`}
      accessibilityRole="button"
      onPress={() => router.push(`/analysis/${item.analysisId}`)}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <AnalysisThumbnail sourceType={item.thumbnail} />
      <View style={styles.rowBody}>
        <View style={styles.rowTextGroup}>
          <View style={styles.metaRow}>
            <Text numberOfLines={1} style={styles.locationText}>
              {item.location}
            </Text>
            <Text numberOfLines={1} style={styles.timeText}>
              {item.timeLabel}
            </Text>
          </View>
          <Text numberOfLines={1} style={styles.itemTitle}>
            {item.title}
          </Text>
          <Text numberOfLines={1} style={styles.priceText}>
            {item.price}
          </Text>
        </View>
        <View style={styles.chevronBox}>
          <Image contentFit="contain" source={assets.chevron} style={styles.chevronIcon} />
        </View>
      </View>
    </Pressable>
  );
}

function AnalysisThumbnail({ sourceType }: { sourceType: AnalysisHistoryItem['thumbnail'] }) {
  if (sourceType === 'macbook') {
    return <Image contentFit="cover" source={assets.macbook} style={styles.thumbnail} />;
  }

  return (
    <View style={[styles.thumbnail, styles.placeholderThumbnail]}>
      <View style={styles.placeholderIconBox}>
        <Image contentFit="contain" source={assets.placeholderMark} style={styles.placeholderIcon} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    columnGap: 12,
    height: 97,
    paddingVertical: 8,
    width: '100%',
  },
  thumbnail: {
    borderRadius: 10,
    height: 81,
    overflow: 'hidden',
    width: 81,
  },
  placeholderThumbnail: {
    alignItems: 'center',
    backgroundColor: '#F4F6FA',
    justifyContent: 'center',
  },
  placeholderIconBox: {
    alignItems: 'center',
    height: 58,
    justifyContent: 'center',
    width: 58,
  },
  placeholderIcon: {
    height: 33.455,
    width: 45.29,
  },
  rowBody: {
    alignItems: 'center',
    alignSelf: 'stretch',
    flex: 1,
    flexDirection: 'row',
    columnGap: 24,
    paddingVertical: 14,
  },
  rowTextGroup: {
    flex: 1,
    height: 53,
    minWidth: 0,
  },
  metaRow: {
    flexDirection: 'row',
    columnGap: 10,
    minWidth: 0,
  },
  locationText: {
    color: '#838C97',
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '400',
    includeFontPadding: false,
    letterSpacing: -0.3,
    lineHeight: 12,
  },
  timeText: {
    color: '#838C97',
    flexShrink: 0,
    fontSize: 12,
    fontWeight: '400',
    includeFontPadding: false,
    letterSpacing: -0.3,
    lineHeight: 12,
  },
  itemTitle: {
    color: '#515760',
    fontSize: 14,
    fontWeight: '400',
    includeFontPadding: false,
    letterSpacing: -0.3,
    lineHeight: 14,
    marginTop: 6,
  },
  priceText: {
    color: '#484B4D',
    fontSize: 15,
    fontWeight: '500',
    includeFontPadding: false,
    letterSpacing: -0.3,
    lineHeight: 15,
    marginTop: 6,
  },
  chevronBox: {
    alignItems: 'center',
    height: 18,
    justifyContent: 'center',
    width: 18,
  },
  chevronIcon: {
    height: 6.75,
    transform: [{ rotate: '-90deg' }],
    width: 12,
  },
  pressed: {
    opacity: 0.65,
  },
});
