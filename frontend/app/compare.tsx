import { useCallback, useEffect, useMemo, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import {
  Pressable,
  Modal,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '@/src/components/pretendard-text';

import {
  COMPARISON_ROWS,
  PRIORITY_CONTENT,
  ComparisonItem,
  ComparisonPriority,
} from '@/src/mocks/comparison';
import { addComparisonItem, compareItems, getComparisonHistoryById, getComparisonItems, removeComparisonItem } from '@/src/services/comparison-service';
import { getHistory } from '@/src/services/history-service';
import type { AnalyzeData, ApiListingTradeMethod, HistoryItem } from '@/src/services/api-types';
import { getAnalysisDetailData } from '@/src/services/analysis-service';
import { riskMap } from '@/src/utils/risk-level';

const PRIORITIES: ComparisonPriority[] = ['price', 'safety', 'condition', 'components'];

function riskLabel(item: AnalyzeData): string {
  const level = riskMap[item.risk_level];
  const count = item.risk_signals?.length ?? item.scam_warnings.length;
  if (level === 'LOW') return '위험 신호 없음';
  if (level === 'MEDIUM') return `주의 ${count}건`;
  return `위험 ${count}건`;
}

function riskDetail(item: AnalyzeData): string | undefined {
  if (item.risk_signals?.length) {
    return item.risk_signals.map((signal) => signal.reason).join('\n');
  }
  return item.scam_warnings.join(', ') || undefined;
}

const TRADE_METHOD_LABELS: Record<ApiListingTradeMethod, string> = {
  IN_PERSON: '직거래',
  DELIVERY: '택배',
  BOTH: '직거래/택배',
};

export default function CompareScreen() {
  const { historyId, reset } = useLocalSearchParams<{ historyId?: string; reset?: string }>();
  const [priority, setPriority] = useState<ComparisonPriority>('price');
  const [apiItems, setApiItems] = useState<AnalyzeData[]>([]);
  const [recentItems, setRecentItems] = useState<HistoryItem[]>([]);
  const [recommendation, setRecommendation] = useState('');
  const [visibleIds, setVisibleIds] = useState<string[]>([]);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [addingItemId, setAddingItemId] = useState<number>();
  const [expandedRiskId, setExpandedRiskId] = useState<string>();

  const loadComparison = useCallback(async () => {
    if (historyId) {
      const [historyRecord, history] = await Promise.all([
        getComparisonHistoryById(Number(historyId)),
        getHistory(1, 50),
      ]);
      const detailEntries = await Promise.all(historyRecord.items.map(async (snapshot) => {
        const detail = await getAnalysisDetailData(snapshot.item_id).catch(() => undefined);
        return [snapshot.item_id, detail] as const;
      }));
      const detailByItemId = new Map(detailEntries);
      const snapshotItems: AnalyzeData[] = historyRecord.items.map((snapshot) => {
        const detail = detailByItemId.get(snapshot.item_id);
        return {
          item_id: snapshot.item_id,
          title: snapshot.title,
          price: snapshot.price,
          market_price_avg: detail?.market_price_avg ?? 0,
          trust_score: snapshot.trust_score,
          risk_level: snapshot.risk_level,
          scam_warnings: detail?.scam_warnings ?? [],
          product_status: detail?.product_status ?? { defects_found: [], missing_components: [] },
          risk_signals: detail?.risk_signals ?? [],
          condition: detail?.condition ?? null,
          market_price: detail?.market_price,
          comparables: detail?.comparables ?? [],
          platform: detail?.platform,
          thumbnail_url: detail?.thumbnail_url,
          location: detail?.location,
          trade_method: detail?.trade_method,
          source_url: detail?.source_url,
        };
      });
      setApiItems(snapshotItems);
      setRecentItems(history.items);
      setVisibleIds(snapshotItems.map((item) => String(item.item_id)));
      setRecommendation(historyRecord.recommendation);
      return;
    }
    const [{ items }, history] = await Promise.all([
      getComparisonItems(),
      getHistory(1, 50),
    ]);
      setApiItems(items);
      setRecentItems(history.items);
      setVisibleIds(items.slice(0, 3).map((item) => String(item.item_id)));
      if (items.length >= 2) {
        const compared = await compareItems(items.slice(0, 3).map((item) => item.item_id));
        setRecommendation(compared.recommendation);
      } else {
        setRecommendation('');
      }
  }, [historyId]);

  useEffect(() => {
    const initialize = async (): Promise<void> => {
      if (reset === '1') {
        const current = await getComparisonItems();
        await Promise.all(current.items.map((item) => removeComparisonItem(item.item_id)));
      }
      await loadComparison();
    };

    initialize().catch(() => {
      setApiItems([]);
      setRecentItems([]);
      setVisibleIds([]);
    });
  }, [loadComparison, reset]);

  const comparisonItems = useMemo<ComparisonItem[]>(() => apiItems.map((item) => ({
    id: String(item.item_id),
    name: item.title,
    price: `${item.price.toLocaleString('ko-KR')}원`,
    totalScore: item.trust_score,
    scores: { price: Number.NaN, safety: item.trust_score, condition: Number.NaN, components: Number.NaN },
    values: {
      price: { primary: `${item.price.toLocaleString('ko-KR')}원`, secondary: `평균 시세 ${item.market_price_avg.toLocaleString('ko-KR')}원` },
      sellerReliability: { primary: item.market_price_avg > 0 ? `${Math.round(((item.price - item.market_price_avg) / item.market_price_avg) * 100)}%` : '미지원' },
      condition: { primary: item.condition?.grade ?? '미지원' },
      defects: { primary: item.product_status.defects_found.join(', ') || '확인된 하자 없음' },
      components: { primary: item.product_status.missing_components.length ? `누락: ${item.product_status.missing_components.join(', ')}` : '누락 정보 없음' },
      tradeMethod: { primary: item.trade_method ? TRADE_METHOD_LABELS[item.trade_method] : '미지원' },
      sellerTrust: { primary: '미지원' },
      risk: { primary: riskLabel(item), secondary: riskDetail(item) },
      needsCheck: { primary: `${item.product_status.defects_found.length + item.product_status.missing_components.length + item.scam_warnings.length}개 항목` },
    },
  })), [apiItems]);

  const priorityLabel = PRIORITY_CONTENT[priority].tabLabel;
  const content = {
    tabLabel: priorityLabel,
    title: recommendation || '비교할 상품을 2개 이상 추가해 주세요',
    bullets: priority === 'safety'
      ? (apiItems[0]?.scam_warnings.length ? apiItems[0].scam_warnings : ['확인된 위험 신호가 없습니다.'])
      : priority === 'condition'
        ? (apiItems[0]?.product_status.defects_found.length ? apiItems[0].product_status.defects_found : ['상태별 비교는 지원 예정인 기능입니다.'])
        : priority === 'components'
          ? (apiItems[0]?.product_status.missing_components.length ? apiItems[0].product_status.missing_components : ['전체 구성품 비교는 지원 예정인 기능입니다.'])
          : apiItems[0] ? [`판매가 ${apiItems[0].price.toLocaleString('ko-KR')}원`, `평균 시세 ${apiItems[0].market_price_avg.toLocaleString('ko-KR')}원`] : [],
  };
  const visibleItems = useMemo(
    () => comparisonItems.filter((item) => visibleIds.includes(item.id)),
    [comparisonItems, visibleIds],
  );
  const availableRecentItems = recentItems.filter(
    (item) => !apiItems.some((candidate) => candidate.item_id === item.item_id),
  );
  const safestItem = [...apiItems].sort((a, b) => b.trust_score - a.trust_score)[0];
  const lowestPriceItem = [...apiItems].sort((a, b) => a.price - b.price)[0];
  const comparisonGuides = [
    safestItem && { id: 'safe', description: '가장 안전하게 거래하고 싶다면', product: safestItem.title, score: safestItem.trust_score, icon: require('@/assets/images/compare/guide-safe.svg') },
    lowestPriceItem && { id: 'price', description: '판매가가 가장 낮은 상품', product: lowestPriceItem.title, score: lowestPriceItem.trust_score, icon: require('@/assets/images/compare/guide-inspect.svg') },
    safestItem && { id: 'trust', description: '현재 신뢰 점수가 가장 높은 상품', product: safestItem.title, score: safestItem.trust_score, icon: require('@/assets/images/compare/guide-best.svg') },
  ].filter((guide): guide is NonNullable<typeof guide> => Boolean(guide));

  const removeItem = (id: string): void => {
    setVisibleIds((current) => current.filter((itemId) => itemId !== id));
    void removeComparisonItem(Number(id));
  };

  const addItem = async (itemId: number): Promise<void> => {
    if (apiItems.length >= 3 || addingItemId !== undefined) return;
    setAddingItemId(itemId);
    try {
      await addComparisonItem(itemId);
      await loadComparison();
      setPickerVisible(false);
    } finally {
      setAddingItemId(undefined);
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
                  {content.tabLabel} {Number.isFinite(item.scores[priority]) ? item.scores[priority] : '미지원'}
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
                {!historyId && <Pressable
                  accessibilityLabel={`${item.name} 비교에서 제거`}
                  accessibilityRole="button"
                  onPress={() => removeItem(item.id)}
                  style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}>
                  <Image
                    contentFit="contain"
                    source={require('@/assets/images/compare/close.svg')}
                    style={styles.closeIcon}
                  />
                </Pressable>}
              </View>
            ))}
            {!historyId && visibleItems.length < 3 && (
              <Pressable
                accessibilityLabel="비교할 상품 추가"
                accessibilityRole="button"
                onPress={() => setPickerVisible(true)}
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
                    const isRisk = row.key === 'risk';
                    const riskExpanded = isRisk && expandedRiskId === item.id;
                    return (
                      <View
                        key={row.key}
                        style={[
                          styles.valueCell,
                          emphasized && styles.valueCellEmphasized,
                          riskExpanded && styles.riskCellExpanded,
                        ]}>
                        {isRisk && value.secondary ? (
                          <Pressable
                            accessibilityLabel={`${value.primary} 위험 신호 상세 ${riskExpanded ? '닫기' : '보기'}`}
                            accessibilityRole="button"
                            onPress={() => setExpandedRiskId((current) => current === item.id ? undefined : item.id)}
                            style={({ pressed }) => [styles.riskButton, pressed && styles.pressed]}>
                            <Text style={[styles.valueText, emphasized && styles.valueTextEmphasized]}>
                              {value.primary}
                            </Text>
                          </Pressable>
                        ) : (
                          <Text
                            style={[
                              styles.valueText,
                              emphasized && styles.valueTextEmphasized,
                            ]}>
                            {value.primary}
                          </Text>
                        )}
                        {!isRisk && value.secondary && (
                          <Text style={[styles.valueNote, emphasized && styles.valueNoteEmphasized]}>
                            {value.secondary}
                          </Text>
                        )}
                        {riskExpanded && value.secondary ? (
                          <Pressable
                            accessibilityRole="button"
                            onPress={() => setExpandedRiskId(undefined)}
                            style={styles.riskPopup}>
                            <Text style={styles.riskPopupText}>{value.secondary}</Text>
                          </Pressable>
                        ) : null}
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
            {comparisonGuides.map((guide, index) => (
              <View key={guide.id} style={styles.guideItem}>
                <View style={styles.timeline}>
                  <View style={styles.guideIconBox}>
                    <Image contentFit="contain" source={guide.icon} style={styles.guideIcon} />
                  </View>
                  {index < comparisonGuides.length - 1 && (
                    <View style={styles.timelineLine} />
                  )}
                </View>
                <View style={styles.guideCopy}>
                  <Text style={styles.guideDescription}>{guide.description}</Text>
                  <Text style={styles.guideProduct}>{guide.product}</Text>
                </View>
                <View style={styles.guideScore}>
                  <Text style={styles.guideScoreText}>{guide.score === null ? '미지원' : `${guide.score}점`}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      <Modal
        animationType="slide"
        onRequestClose={() => setPickerVisible(false)}
        transparent
        visible={pickerVisible}>
        <View style={styles.pickerOverlay}>
          <Pressable style={styles.pickerScrim} onPress={() => setPickerVisible(false)} />
          <SafeAreaView edges={['bottom']} style={styles.pickerSheet}>
            <View style={styles.pickerHandle} />
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>최근 본 상품에서 추가</Text>
              <Pressable hitSlop={8} onPress={() => setPickerVisible(false)}>
                <Text style={styles.pickerClose}>닫기</Text>
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.pickerList} showsVerticalScrollIndicator={false}>
              {availableRecentItems.length ? availableRecentItems.map((item) => (
                <Pressable
                  accessibilityRole="button"
                  disabled={addingItemId !== undefined}
                  key={item.item_id}
                  onPress={() => void addItem(item.item_id)}
                  style={({ pressed }) => [styles.pickerItem, pressed && styles.pressed]}>
                  <View style={styles.pickerItemCopy}>
                    <Text numberOfLines={1} style={styles.pickerItemTitle}>{item.title}</Text>
                    <Text style={styles.pickerItemPrice}>{item.price.toLocaleString('ko-KR')}원</Text>
                  </View>
                  <Text style={styles.pickerAddText}>{addingItemId === item.item_id ? '추가 중' : '추가'}</Text>
                </Pressable>
              )) : (
                <Text style={styles.pickerEmpty}>추가할 수 있는 최근 상품이 없습니다.</Text>
              )}
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>
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
    borderRadius: 12,
    backgroundColor: '#F4F6FA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusIcon: { width: 24, height: 24 },
  pickerOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  pickerScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(33, 33, 33, 0.45)',
  },
  pickerSheet: {
    maxHeight: '72%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: '#FFFFFF',
    paddingTop: 10,
  },
  pickerHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D9DDE3',
  },
  pickerHeader: {
    minHeight: 58,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pickerTitle: {
    color: '#111727',
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 24,
    letterSpacing: -0.3,
  },
  pickerClose: {
    color: '#838C97',
    fontSize: 14,
    lineHeight: 20,
  },
  pickerList: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  pickerItem: {
    minHeight: 72,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E8ED',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  pickerItemCopy: { flex: 1, gap: 6 },
  pickerItemTitle: {
    color: '#515760',
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 20,
    letterSpacing: -0.3,
  },
  pickerItemPrice: {
    color: '#838C97',
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: -0.3,
  },
  pickerAddText: {
    color: '#8656C2',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  },
  pickerEmpty: {
    paddingVertical: 36,
    color: '#838C97',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
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
  riskCellExpanded: { zIndex: 20 },
  riskButton: {
    minWidth: 72,
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  riskPopup: {
    position: 'absolute',
    top: 52,
    left: 0,
    zIndex: 30,
    width: 164,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    shadowColor: '#111727',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.14,
    shadowRadius: 8,
    elevation: 5,
  },
  riskPopupText: {
    color: '#515760',
    fontSize: 12,
    lineHeight: 17,
    letterSpacing: -0.3,
  },
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
