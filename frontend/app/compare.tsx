import { useEffect, useMemo, useState } from 'react';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '@/src/components/pretendard-text';

import {
  COMPARISON_GUIDES,
  COMPARISON_ITEMS,
  COMPARISON_ROWS,
  PRIORITY_CONTENT,
  ComparisonPriority,
} from '@/src/mocks/comparison';
import {
  addToComparisonCart,
  getComparisonCart,
  removeFromComparisonCart,
} from '@/src/repositories/comparison-cart-repository';
import { saveComparisonHistory } from '@/src/repositories/comparison-history-repository';

const PRIORITIES: ComparisonPriority[] = ['price', 'safety', 'condition', 'components'];

export default function CompareScreen() {
  const [priority, setPriority] = useState<ComparisonPriority>('price');
  const [visibleIds, setVisibleIds] = useState(() =>
    COMPARISON_ITEMS.slice(0, 2).map((item) => item.id),
  );

  const content = PRIORITY_CONTENT[priority];
  const visibleItems = useMemo(
    () => COMPARISON_ITEMS.filter((item) => visibleIds.includes(item.id)),
    [visibleIds],
  );
  const hiddenItem = COMPARISON_ITEMS.find((item) => !visibleIds.includes(item.id));

  useEffect(() => {
    let mounted = true;

    getComparisonCart().then((cart) => {
      if (!mounted || cart.serverItemIds.length === 0) {
        return;
      }

      const cartVisibleIds = COMPARISON_ITEMS
        .filter((item) => cart.serverItemIds.includes(item.serverItemId))
        .map((item) => item.id);

      if (cartVisibleIds.length > 0) {
        setVisibleIds(cartVisibleIds);
      }
    });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (visibleItems.length < 2) {
      return;
    }

    saveComparisonHistory({
      serverItemIds: visibleItems.map((item) => item.serverItemId),
      itemSnapshots: visibleItems.map((item) => ({
        serverItemId: item.serverItemId,
        title: item.name,
        price: Number(item.price.replace(/\D/g, '')) || 0,
        trustScore: item.totalScore,
      })),
      recommendation: content.title,
    });
  }, [content.title, visibleItems]);

  const removeItem = async (id: string): Promise<void> => {
    const item = COMPARISON_ITEMS.find((candidate) => candidate.id === id);
    if (item) {
      await removeFromComparisonCart(item.serverItemId);
    }
    setVisibleIds((current) => current.filter((itemId) => itemId !== id));
  };

  const addItem = async (): Promise<void> => {
    if (hiddenItem) {
      const result = await addToComparisonCart(hiddenItem.serverItemId);
      if (!result.ok) {
        return;
      }
      setVisibleIds((current) => [...current, hiddenItem.id].slice(0, 3));
    }
  };

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable
          accessibilityLabel="뒤로 가기"
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => router.back()}
          style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}>
          <Image
            contentFit="contain"
            source={require('@/assets/images/analysis-input/arrow-left.svg')}
            style={styles.backIcon}
          />
        </Pressable>
        <Text style={styles.headerTitle}>비교하기</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.tabs}>
        {PRIORITIES.map((item) => {
          const selected = priority === item;
          return (
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              key={item}
              onPress={() => setPriority(item)}
              style={styles.tab}>
              <Text style={[styles.tabText, selected && styles.tabTextSelected]}>
                {PRIORITY_CONTENT[item].tabLabel}
              </Text>
              {selected && <View style={styles.tabIndicator} />}
            </Pressable>
          );
        })}
      </View>

      <ScrollView
        contentContainerStyle={styles.pageContent}
        showsVerticalScrollIndicator={false}>
        <View style={styles.comparisonSection}>
          <View style={styles.summary}>
            <Image
              contentFit="contain"
              source={require('@/assets/images/compare/hero.svg')}
              style={styles.heroImage}
            />
            <Text style={styles.summaryTitle}>{content.title}</Text>
            <Text style={styles.summaryCaption}>핵심 비교 결과</Text>
            <View style={styles.bulletList}>
              {content.bullets.map((bullet) => (
                <View key={bullet} style={styles.bulletRow}>
                  <Image
                    contentFit="contain"
                    source={require('@/assets/images/compare/check.svg')}
                    style={styles.checkIcon}
                  />
                  <Text style={styles.bulletText}>{bullet}</Text>
                </View>
              ))}
            </View>
          </View>

          <ScrollView
            contentContainerStyle={styles.cardRow}
            horizontal
            showsHorizontalScrollIndicator={false}>
            {visibleItems.map((item, index) => (
              <View style={styles.productCard} key={item.id}>
                <Text style={styles.cardCriterion}>
                  {content.tabLabel} {item.scores[priority]}
                </Text>
                <View style={styles.cardMain}>
                  <Text
                    numberOfLines={2}
                    style={[styles.cardName, index === 0 && styles.cardNameRecommended]}>
                    {item.name}
                  </Text>
                  <Text style={[styles.cardPrice, index === 0 && styles.cardPriceRecommended]}>
                    {item.price}
                  </Text>
                </View>
                <View style={styles.cardFooter}>
                  <Text style={styles.cardScore}>{item.totalScore}점</Text>
                  {index === 0 && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>추천</Text>
                    </View>
                  )}
                </View>
                <Pressable
                  accessibilityLabel={`${item.name} 비교에서 제거`}
                  accessibilityRole="button"
                  onPress={() => removeItem(item.id)}
                  style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}>
                  <Image
                    contentFit="contain"
                    source={require('@/assets/images/compare/close.svg')}
                    style={styles.closeIcon}
                  />
                </Pressable>
              </View>
            ))}
            {hiddenItem && visibleItems.length < 3 && (
              <Pressable
                accessibilityLabel="비교할 상품 추가"
                accessibilityRole="button"
                onPress={addItem}
                style={({ pressed }) => [styles.addCard, pressed && styles.pressed]}>
                <Image
                  contentFit="contain"
                  source={require('@/assets/images/compare/plus.svg')}
                  style={styles.plusIcon}
                />
              </Pressable>
            )}
          </ScrollView>

          <View style={styles.table}>
            <View style={styles.labelColumn}>
              {COMPARISON_ROWS.map((row) => (
                <View key={row.key} style={styles.labelCell}>
                  <Text style={styles.labelText}>{row.label}</Text>
                </View>
              ))}
            </View>
            <ScrollView
              contentContainerStyle={styles.valueColumns}
              horizontal
              showsHorizontalScrollIndicator={false}>
              {visibleItems.map((item, itemIndex) => (
                <View key={item.id} style={styles.valueColumn}>
                  {COMPARISON_ROWS.map((row) => {
                    const value = item.values[row.key];
                    const emphasized = itemIndex === 0;
                    return (
                      <View
                        key={row.key}
                        style={[styles.valueCell, emphasized && styles.valueCellEmphasized]}>
                        <Text
                          style={[
                            styles.valueText,
                            emphasized && styles.valueTextEmphasized,
                          ]}>
                          {value.primary}
                        </Text>
                        {value.secondary && (
                          <Text
                            style={[
                              styles.valueNote,
                              emphasized && styles.valueNoteEmphasized,
                            ]}>
                            {value.secondary}
                          </Text>
                        )}
                      </View>
                    );
                  })}
                </View>
              ))}
              <View style={styles.valueColumn}>
                {COMPARISON_ROWS.map((row) => (
                  <View key={row.key} style={styles.valueCell}>
                    <Text style={styles.emptyValue}>-</Text>
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>
        </View>

        <View style={styles.guideSection}>
          <Text style={styles.guideTitle}>상황별{'\n'}선택 가이드</Text>
          <View>
            {COMPARISON_GUIDES.map((guide, index) => (
              <View key={guide.id} style={styles.guideItem}>
                <View style={styles.timeline}>
                  <View style={styles.guideIconBox}>
                    <Image contentFit="contain" source={guide.icon} style={styles.guideIcon} />
                  </View>
                  {index < COMPARISON_GUIDES.length - 1 && (
                    <View style={styles.timelineLine} />
                  )}
                </View>
                <View style={styles.guideCopy}>
                  <Text style={styles.guideDescription}>{guide.description}</Text>
                  <Text style={styles.guideProduct}>{guide.product}</Text>
                </View>
                <View style={styles.guideScore}>
                  <Text style={styles.guideScoreText}>{guide.score}점</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    height: 60,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerButton: { width: 40, height: 40, justifyContent: 'center' },
  backIcon: { width: 24, height: 24 },
  headerTitle: {
    color: '#111727',
    fontSize: 18,
    fontWeight: '500',
    lineHeight: 24.3,
    letterSpacing: -0.3,
  },
  headerSpacer: { width: 40 },
  tabs: {
    height: 48,
    borderBottomWidth: 1,
    borderBottomColor: '#F6F5FA',
    flexDirection: 'row',
    paddingHorizontal: 6,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabText: {
    color: '#D2D2E2',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.5,
  },
  tabTextSelected: { color: '#111727' },
  tabIndicator: {
    position: 'absolute',
    bottom: -1,
    width: '78%',
    height: 2,
    backgroundColor: '#8656C2',
  },
  pageContent: { backgroundColor: '#F6F5FA' },
  comparisonSection: {
    paddingTop: 32,
    paddingBottom: 28,
    backgroundColor: '#FFFFFF',
  },
  summary: {
    minHeight: 200,
    paddingHorizontal: 26,
    overflow: 'hidden',
  },
  heroImage: {
    position: 'absolute',
    width: 230,
    height: 170,
    right: -58,
    top: 15,
  },
  summaryTitle: {
    width: 250,
    color: '#111727',
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 32.4,
    letterSpacing: -0.3,
  },
  summaryCaption: {
    marginTop: 16,
    color: '#838C97',
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 20.25,
    letterSpacing: -0.3,
  },
  bulletList: { marginTop: 14, gap: 10 },
  bulletRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkIcon: { width: 16, height: 16 },
  bulletText: {
    color: '#838C97',
    fontSize: 13,
    lineHeight: 16,
    letterSpacing: -0.3,
  },
  cardRow: { paddingHorizontal: 16, paddingTop: 28, gap: 10 },
  productCard: {
    width: 165,
    height: 141,
    padding: 10,
    borderRadius: 12,
    backgroundColor: '#F4F6FA',
    justifyContent: 'space-between',
  },
  cardCriterion: {
    color: '#838C97',
    fontSize: 11,
    lineHeight: 11,
    letterSpacing: -0.3,
  },
  cardMain: { gap: 6 },
  cardName: {
    color: '#484B4D',
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 21.6,
    letterSpacing: -0.3,
  },
  cardNameRecommended: { color: '#5E5091' },
  cardPrice: { color: '#515760', fontSize: 14, lineHeight: 14 },
  cardPriceRecommended: { color: '#8656C2' },
  cardFooter: {
    height: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardScore: {
    color: '#515760',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 14,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 28,
    backgroundColor: '#E4DDF8',
  },
  badgeText: {
    color: '#8656C2',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16.2,
    letterSpacing: -0.3,
  },
  closeButton: {
    position: 'absolute',
    right: 0,
    top: 0,
    width: 31,
    height: 31,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeIcon: { width: 15, height: 15 },
  addCard: {
    width: 165,
    height: 141,
    borderRadius: 11,
    backgroundColor: '#F4F6FA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusIcon: { width: 24, height: 24 },
  table: {
    marginTop: 39,
    paddingHorizontal: 16,
    flexDirection: 'row',
    gap: 3,
  },
  labelColumn: { width: 63, gap: 3 },
  labelCell: {
    height: 68,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelText: {
    color: '#838C97',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 15.6,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  valueColumns: { gap: 3 },
  valueColumn: { width: 102, gap: 3 },
  valueCell: {
    width: 102,
    height: 68,
    paddingHorizontal: 8,
    borderRadius: 5,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  valueCellEmphasized: { backgroundColor: '#EFF3FF' },
  valueText: {
    color: '#A3A6C3',
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 15,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  valueTextEmphasized: { color: '#5E5091', fontWeight: '600' },
  valueNote: {
    color: '#A3A6C3',
    fontSize: 11,
    lineHeight: 12,
    textAlign: 'center',
  },
  valueNoteEmphasized: { color: '#A597CC' },
  emptyValue: { color: '#838C97', fontSize: 13 },
  guideSection: {
    marginTop: 10,
    paddingHorizontal: 16,
    paddingTop: 32,
    paddingBottom: 40,
    backgroundColor: '#FFFFFF',
  },
  guideTitle: {
    color: '#111727',
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 27,
    letterSpacing: -0.3,
    marginBottom: 36,
  },
  guideItem: {
    minHeight: 96,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  timeline: { width: 40, alignItems: 'center', alignSelf: 'stretch' },
  guideIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F6F5FA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  guideIcon: { width: 24, height: 24 },
  timelineLine: {
    width: 1,
    flex: 1,
    marginVertical: 7,
    backgroundColor: '#C5A8FF',
  },
  guideCopy: { flex: 1, marginLeft: 16, gap: 8 },
  guideDescription: {
    color: '#515760',
    fontSize: 13,
    lineHeight: 15,
    letterSpacing: -0.3,
  },
  guideProduct: {
    color: '#484B4D',
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 21.6,
    letterSpacing: -0.3,
  },
  guideScore: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 28,
    backgroundColor: '#E4DDF8',
  },
  guideScoreText: {
    color: '#8656C2',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16.2,
  },
  pressed: { opacity: 0.65 },
});
