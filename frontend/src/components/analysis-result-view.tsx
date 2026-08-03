import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { Text } from '@/src/components/pretendard-text';

import { AnalysisResult } from '@/src/types/marketplace';
import { addBookmark, getBookmarks, removeBookmark } from '@/src/services/bookmark-service';
import { addComparisonItem } from '@/src/services/comparison-service';

const assets = {
  arrow: require('@/assets/images/analysis-input/arrow-left.svg'),
  averagePrice: require('@/assets/images/analysis-result/average-price.png'),
  cheap: require('@/assets/images/analysis-result/cheap.svg'),
  expensive: require('@/assets/images/analysis-result/expensive.svg'),
  check: require('@/assets/images/analysis-result/check.svg'),
  compare: require('@/assets/images/analysis-result/compare.svg'),
  heart: require('@/assets/images/analysis-result/heart.svg'),
  heartFilled: require('@/assets/images/analysis-result/heart-filled.svg'),
  notice: require('@/assets/images/analysis-result/notice.svg'),
  salePrice: require('@/assets/images/analysis-result/sale-price.png'),
  scoreFaceSafe: require('@/assets/images/analysis-result/score-face-safe-4x.png'),
  scoreFaceWarning: require('@/assets/images/analysis-result/score-face-warning-4x.png'),
  scoreFaceDanger: require('@/assets/images/analysis-result/score-face-danger-4x.png'),
  summarySearch: require('@/assets/images/analysis-result/summary-search.png'),
  unknown: require('@/assets/images/analysis-result/unknown.svg'),
};

const scoreFaceByRisk = {
  LOW: assets.scoreFaceSafe,
  MEDIUM: assets.scoreFaceWarning,
  HIGH: assets.scoreFaceDanger,
} as const;

interface AnalysisResultViewProps {
  result: AnalysisResult;
}

interface TimelineGroupProps {
  title: string;
  items: string[];
  unknown?: boolean;
  last?: boolean;
}

function formatPrice(value: number): string {
  return `${value.toLocaleString('ko-KR')}원`;
}

function TimelineGroup({ title, items, unknown = false, last = false }: TimelineGroupProps) {
  return (
    <View style={styles.timelineGroup}>
      <View style={styles.timelineHeading}>
        <View style={styles.timelineIconOuter}>
          {unknown ? (
            <Image source={assets.unknown} style={styles.timelineUnknownIcon} contentFit="contain" />
          ) : (
            <View style={styles.timelineCheckInner}>
              <Image source={assets.check} style={styles.timelineCheckIcon} contentFit="contain" />
            </View>
          )}
        </View>
        <Text style={styles.timelineTitle}>{title}</Text>
      </View>
      <View style={styles.timelineContentRow}>
        {!last ? <View style={styles.timelineLine} /> : <View style={styles.timelineLineSpacer} />}
        <View style={styles.timelineCard}>
          {items.length > 0 ? (
            items.map((item) => (
              <Text key={item} style={styles.timelineItem}>
                {item}
              </Text>
            ))
          ) : (
            <Text style={styles.timelineItem}>확인된 정보가 없어요</Text>
          )}
        </View>
      </View>
    </View>
  );
}

export function AnalysisResultView({ result }: AnalysisResultViewProps) {
  const insets = useSafeAreaInsets();
  const [saved, setSaved] = useState(false);
  const serverItemId = Number(result.id);
  useFocusEffect(useCallback(() => {
    let active = true;
    if (!Number.isInteger(serverItemId)) return undefined;

    void getBookmarks()
      .then(({ items }) => {
        if (active) setSaved(items.some((item) => item.item_id === serverItemId));
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, [serverItemId]));
  const priceDifference = result.marketPrice.average - result.listing.price;
  const discountRate =
    result.marketPrice.average > 0
      ? Math.round((Math.abs(priceDifference) / result.marketPrice.average) * 100)
      : 0;
  const isCheaper = priceDifference > 0;
  const isExpensive = priceDifference < 0;
  const score = useMemo(() => {
    const riskPenalty = { LOW: 0, MEDIUM: 8, HIGH: 18 };
    return result.trustScore ?? Math.max(0, 70 - riskPenalty[result.riskLevel]);
  }, [result.riskLevel, result.trustScore]);
  const ringRadius = 94;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringOffset = ringCircumference * (1 - Math.min(100, Math.max(0, score)) / 100);
  const considerationText = {
    LOW: '구매 적극 추천',
    MEDIUM: '구매 고려 가능',
    HIGH: '구매 보류 권장',
  }[result.riskLevel];
  const summaryHeadingText = {
    LOW: '구매하기 좋아요.',
    MEDIUM: '구매를 고려해볼 만해요.',
    HIGH: '구매는 신중히 결정해요.',
  }[result.riskLevel];
  const sellerItems = [
    ...result.listing.defects,
    result.listing.components.length > 0
      ? `구성품: ${result.listing.components.join(', ')}`
      : '',
    result.listing.sellerDescription,
  ].filter(Boolean);
  const defectSeverityLabel: Record<NonNullable<AnalysisResult['conditionDefects'][number]['severity']>, string> = {
    MINOR: '경미', MODERATE: '보통', MAJOR: '심각',
  };
  const photoItems = result.conditionGradeSupported === false
    ? ['이미지 상세 분석은 지원 예정인 기능입니다.']
    : result.conditionDefects.length > 0
      ? result.conditionDefects.map((defect) =>
          defect.severity ? `${defect.name} (${defectSeverityLabel[defect.severity]})` : defect.name)
      : ['확인된 하자 없음'];

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <Pressable
          accessibilityLabel="뒤로가기"
          accessibilityRole="button"
          hitSlop={10}
          onPress={() => router.back()}
          style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}>
          <Image source={assets.arrow} style={styles.arrowIcon} contentFit="contain" />
        </Pressable>
        <Pressable
          accessibilityLabel={saved ? '찜 해제' : '찜하기'}
          accessibilityRole="button"
          accessibilityState={{ selected: saved }}
          hitSlop={10}
          onPress={async () => {
            if (!Number.isInteger(serverItemId)) return;
            if (saved) await removeBookmark(serverItemId); else await addBookmark(serverItemId);
            setSaved(!saved);
          }}
          style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}>
          <Image
            source={saved ? assets.heartFilled : assets.heart}
            style={styles.heartIcon}
            contentFit="contain"
          />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 96 + insets.bottom }]}
        showsVerticalScrollIndicator={false}>
        <View style={styles.heroSection}>
          <View style={styles.heroCopy}>
            <Text style={styles.heroTitle}>검색한 상품을{'\n'}꼼꼼히 분석했어요</Text>
            <Text numberOfLines={1} style={styles.heroSubtitle}>
              {result.listing.title} <Text>의 분석 결과</Text>
            </Text>
          </View>

          <View style={styles.scoreArea}>
            <View style={styles.scoreRing}>
              <Svg height={208} style={styles.scoreRingImage} viewBox="0 0 208 208" width={208}>
                <Circle
                  cx={104}
                  cy={104}
                  fill="none"
                  r={ringRadius}
                  stroke="#EEF1F7"
                  strokeWidth={20}
                />
                <Circle
                  cx={104}
                  cy={104}
                  fill="none"
                  origin="104, 104"
                  r={ringRadius}
                  rotation={-90}
                  stroke="#B797E1"
                  strokeDasharray={`${ringCircumference} ${ringCircumference}`}
                  strokeDashoffset={ringOffset}
                  strokeLinecap="round"
                  strokeWidth={20}
                />
              </Svg>
              <View style={styles.scoreCopy}>
                <View style={styles.scoreFaceFrame}>
                <Image
                  source={scoreFaceByRisk[result.riskLevel]}
                  style={styles.scoreFace}
                  contentFit="fill"
                />
                </View>
                <Text style={styles.scoreLabel}>{considerationText}</Text>
                <Text style={styles.scoreValue}>{score}점</Text>
              </View>
            </View>
            <View style={styles.discountRow}>
              {isCheaper || isExpensive ? (
                <>
                  <Image
                    source={isExpensive ? assets.expensive : assets.cheap}
                    style={styles.cheapIcon}
                    contentFit="contain"
                  />
                  <Text style={styles.discountText}>
                    <Text style={isExpensive ? styles.discountAccentExpensive : styles.discountAccent}>
                      약 {discountRate}%
                    </Text>{' '}
                    {isExpensive ? '비싸요' : '저렴해요'}
                  </Text>
                </>
              ) : (
                <Text style={styles.discountText}>평균가와 같아요</Text>
              )}
            </View>
          </View>

          <View style={styles.summaryCard}>
            <View style={styles.summaryHeading}>
              <Image source={assets.summarySearch} style={styles.summaryIcon} contentFit="cover" />
              <Text style={styles.summaryTitle}>
                {summaryHeadingText}
              </Text>
            </View>
            <View style={styles.summaryBody}>
              <Text style={styles.summaryEyebrow}>정리해봤어요</Text>
              <Text style={styles.summaryDescription}>
                가격은 시세보다 {isCheaper ? '저렴하나' : isExpensive ? '높고' : '비슷하고'}{' '}
                <Text style={styles.emphasis}>
                  {result.missingInformation[0] ?? '추가 정보 부족'}
                </Text>
                과 <Text style={styles.emphasis}>{result.warningSignals[0] ?? '상태 확인'}</Text>이
                리스크예요. 거래 전 실물 확인을 권장해요.
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            시세대비{'\n'}
            <Text style={styles.sectionAccent}>약 {discountRate}%</Text>{' '}
            {isCheaper ? '저렴해요' : '비싸요'}
          </Text>

          <View style={styles.priceComparison}>
            <View style={styles.priceColumn}>
              <Image source={assets.salePrice} style={styles.priceIllustration} contentFit="cover" />
              <Text style={styles.priceLabel}>판매가</Text>
              <View style={styles.priceTrack}>
                <View style={[styles.priceFill, styles.saleFill]}>
                  <Text style={styles.priceFillText}>{formatPrice(result.listing.price)}</Text>
                </View>
              </View>
            </View>
            <Text style={styles.vs}>VS</Text>
            <View style={styles.priceColumn}>
              <View style={styles.priceIllustration}>
                <Image
                  source={assets.averagePrice}
                  style={styles.averagePriceImage}
                  contentFit="cover"
                />
              </View>
              <Text style={styles.priceLabel}>평균가</Text>
              <View style={styles.priceTrack}>
                <View style={[styles.priceFill, styles.averageFill]}>
                  <Text style={styles.priceFillText}>{formatPrice(result.marketPrice.average)}</Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.detailCard}>
            <Text style={styles.detailTitle}>가격 분석</Text>
            <View style={styles.detailRows}>
              <DetailRow label="판매가" value={formatPrice(result.listing.price)} />
              <DetailRow
                label="시세 대비"
                value={`약 ${discountRate}% ${isCheaper ? '저렴' : '높음'}`}
              />
              <DetailRow
                label="비슷한 매물 평균가"
                value={formatPrice(result.marketPrice.average)}
                wideLabel
              />
              <DetailRow
                label="가격 신뢰도"
                value={result.riskLevel === 'LOW' ? '높음' : result.riskLevel === 'MEDIUM' ? '보통' : '낮음'}
              />
              <DetailRow
                label="예상 적정 시세"
                value={result.marketPriceRangeSupported === false ? '미지원' : `${result.marketPrice.min.toLocaleString('ko-KR')} –\n${formatPrice(result.marketPrice.max)}`}
              />
              <DetailRow
                label="시세 표본"
                value={result.marketPriceRangeSupported === false || result.marketPrice.sampleCount === 0
                  ? '미지원'
                  : `${result.marketPrice.sampleCount}건${result.marketPrice.confidence != null ? ` (신뢰도 ${Math.round(result.marketPrice.confidence * 100)}%)` : ''}`}
              />
              <DetailRow
                label="예상 감가 요인"
                value={result.listing.defects.join(', ') || '특이사항 없음'}
              />
            </View>
          </View>

          {result.comparables.length > 0 && (
            <View style={styles.detailCard}>
              <Text style={styles.detailTitle}>시세 근거 매물</Text>
              <View style={styles.bulletList}>
                {result.comparables.slice(0, 5).map((comparable) => (
                  <Text key={`${comparable.platform}-${comparable.title}`} style={styles.bulletText}>
                    ·  {comparable.title} · {formatPrice(comparable.price)} ({comparable.platform})
                  </Text>
                ))}
              </View>
            </View>
          )}
        </View>

        <View style={styles.divider} />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            전반적인{'\n'}
            <Text style={styles.sectionAccent}>사용감</Text>이 있는 편이에요
          </Text>
          <View style={styles.timeline}>
            <TimelineGroup title="판매자 직접 고지" items={sellerItems} />
            <TimelineGroup title="사진에서 확인" items={photoItems} />
            <TimelineGroup
              title="확인 불가"
              items={result.missingInformation}
              unknown
              last
            />
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.noticeSection}>
          <View style={styles.noticeHeading}>
            <Image source={assets.notice} style={styles.noticeIcon} contentFit="contain" />
            <Text style={styles.noticeTitle}>꼭 알아두세요!</Text>
          </View>
          <View style={styles.bulletList}>
            {result.warningSignals.map((item) => (
              <Text key={item} style={styles.bulletText}>·  {item}</Text>
            ))}
            <Text style={styles.bulletText}>·  거래 전 판매자 정보와 제품 상태를 직접 확인하세요</Text>
          </View>

          <View style={styles.rationale}>
            <Text style={styles.rationaleTitle}>AI 판단 근거</Text>
            <Text style={styles.rationaleText}>
              {result.listing.platform}의 {result.listing.modelName} 매물 정보를 기준으로 분석했어요.
              판매가 {formatPrice(result.listing.price)}은 평균가{' '}
              {formatPrice(result.marketPrice.average)} 대비 {isCheaper ? '낮은' : '높은'} 수준이며,
              확인되지 않은 정보와 고지된 하자를 함께 반영했어요.
            </Text>
          </View>
        </View>
      </ScrollView>

      <LinearGradient
        colors={['rgba(255,255,255,0)', '#FFFFFF', '#FFFFFF']}
        locations={[0, 0.2, 1]}
        pointerEvents="box-none"
        style={[styles.bottomBar, { paddingBottom: 16 + insets.bottom }]}>
        <Pressable
          accessibilityLabel="매물 비교하기"
          accessibilityRole="button"
          onPress={async () => {
            if (Number.isInteger(serverItemId)) await addComparisonItem(serverItemId);
            router.push('/compare');
          }}
          style={({ pressed }) => [styles.compareButton, pressed && styles.pressed]}>
          <Image source={assets.compare} style={styles.compareIcon} contentFit="contain" />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push(`/trade/${result.id}`)}
          style={({ pressed }) => [styles.tradeButton, pressed && styles.pressed]}>
          <Text style={styles.tradeButtonText}>거래 준비하기</Text>
        </Pressable>
      </LinearGradient>
    </SafeAreaView>
  );
}

function DetailRow({
  label,
  value,
  wideLabel = false,
}: {
  label: string;
  value: string;
  wideLabel?: boolean;
}) {
  return (
    <View style={[styles.detailRow, wideLabel && styles.detailRowWideLabel]}>
      <Text
        numberOfLines={1}
        style={[styles.detailLabel, wideLabel && styles.detailLabelWide]}>
        {label}
      </Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderBottomColor: '#F0F0FA',
    borderBottomWidth: StyleSheet.hairlineWidth,
    zIndex: 2,
  },
  headerButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  arrowIcon: { width: 16, height: 16 },
  heartIcon: { width: 24, height: 24 },
  scrollContent: { paddingBottom: 96 },
  heroSection: { alignItems: 'center', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 32 },
  heroCopy: { width: '100%', gap: 16, paddingLeft: 10, paddingRight: 100 },
  heroTitle: {
    color: '#111727',
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 32,
    letterSpacing: -0.3,
  },
  heroSubtitle: { color: '#838C97', fontSize: 16, fontWeight: '500', lineHeight: 22, letterSpacing: -0.3 },
  scoreArea: { alignItems: 'center', gap: 38, marginTop: 72 },
  scoreRing: { width: 188, height: 188, alignItems: 'center', justifyContent: 'center' },
  scoreRingImage: { position: 'absolute', width: 208, height: 208 },
  scoreCopy: { alignItems: 'center', gap: 4, marginTop: 25 },
  scoreFaceFrame: { width: 45.43, height: 41, overflow: 'hidden' },
  scoreFace: { width: 45.43, height: 41 },
  scoreLabel: { color: '#838C97', fontSize: 16, lineHeight: 18, letterSpacing: -0.4 },
  scoreValue: { color: '#515760', fontSize: 28, fontWeight: '700', lineHeight: 30, letterSpacing: -0.4 },
  discountRow: { flexDirection: 'row', alignItems: 'center' },
  cheapIcon: { width: 22, height: 22 },
  discountText: { color: '#838C97', fontSize: 16, lineHeight: 18, letterSpacing: -0.4 },
  discountAccent: { color: '#268AFF', fontWeight: '700' },
  discountAccentExpensive: { color: '#FF4D4D', fontWeight: '700' },
  summaryCard: { width: '100%', gap: 20, marginTop: 42, padding: 16, backgroundColor: '#F4F6FA', borderRadius: 8 },
  summaryHeading: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  summaryIcon: { width: 34, height: 34 },
  summaryTitle: { color: '#515760', fontSize: 16, fontWeight: '700', lineHeight: 22, letterSpacing: -0.3 },
  summaryBody: { gap: 10 },
  summaryEyebrow: { color: '#8656C2', fontSize: 15, fontWeight: '700', lineHeight: 20 },
  summaryDescription: { color: '#484B4D', fontSize: 14, lineHeight: 20, letterSpacing: -0.3 },
  emphasis: { fontWeight: '600' },
  divider: { height: 10, backgroundColor: '#F6F5FA' },
  section: { gap: 36, paddingHorizontal: 16, paddingVertical: 32, backgroundColor: '#FFFFFF' },
  sectionTitle: { color: '#111727', fontSize: 20, fontWeight: '600', lineHeight: 27, letterSpacing: -0.3 },
  sectionAccent: { color: '#8656C2' },
  priceComparison: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingHorizontal: 5 },
  priceColumn: { width: 129, gap: 7 },
  priceIllustration: { width: 79, height: 79, marginBottom: 5, overflow: 'hidden' },
  averagePriceImage: { position: 'absolute', left: 4.08, top: 22.74, width: 56.35, height: 56.35 },
  priceLabel: { color: '#484B4D', fontSize: 14, lineHeight: 16, letterSpacing: -0.3, paddingLeft: 3 },
  priceTrack: { width: 129, height: 24, backgroundColor: '#EEF1F7', borderRadius: 50 },
  priceFill: { height: 24, justifyContent: 'center', paddingHorizontal: 8, borderRadius: 50 },
  saleFill: { width: 107, backgroundColor: '#B797E1' },
  averageFill: { width: 123, backgroundColor: '#B5B9C4' },
  priceFillText: { color: '#FFFFFF', fontSize: 11, fontWeight: '500', letterSpacing: -0.3 },
  vs: { color: '#000000', fontSize: 14, fontWeight: '500', paddingBottom: 5 },
  detailCard: { gap: 20, padding: 16, backgroundColor: '#F4F6FA', borderRadius: 10 },
  detailTitle: { color: '#515760', fontSize: 15, fontWeight: '500', lineHeight: 20 },
  detailRows: { gap: 14 },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 24 },
  detailRowWideLabel: { gap: 9 },
  detailLabel: { width: 101, color: '#838C97', fontSize: 14, fontWeight: '500', lineHeight: 20 },
  detailLabelWide: { width: 116 },
  detailValue: { flex: 1, color: '#515760', fontSize: 15, lineHeight: 20 },
  timeline: { gap: 20 },
  timelineGroup: { gap: 10 },
  timelineHeading: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  timelineIconOuter: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: '#F6F5FA' },
  timelineCheckInner: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#B797E1' },
  timelineCheckIcon: { width: 15, height: 11 },
  timelineUnknownIcon: { width: 24, height: 24 },
  timelineTitle: { color: '#111727', fontSize: 16, fontWeight: '600', lineHeight: 22, letterSpacing: -0.3 },
  timelineContentRow: { flexDirection: 'row', alignItems: 'stretch', gap: 19 },
  timelineLine: { width: 1, marginLeft: 19, backgroundColor: '#B797E1' },
  timelineLineSpacer: { width: 1, marginLeft: 19 },
  timelineCard: { flex: 1, gap: 20, padding: 16, backgroundColor: '#F4F6FA', borderRadius: 10 },
  timelineItem: { color: '#515760', fontSize: 15, lineHeight: 18, letterSpacing: -0.3 },
  noticeSection: { gap: 20, paddingHorizontal: 16, paddingVertical: 20, backgroundColor: '#FFFFFF' },
  noticeHeading: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  noticeIcon: { width: 18, height: 18 },
  noticeTitle: { color: '#111727', fontSize: 13, fontWeight: '600', lineHeight: 18 },
  bulletList: { gap: 4 },
  bulletText: { color: '#838C97', fontSize: 13, fontWeight: '500', lineHeight: 18, letterSpacing: -0.3 },
  rationale: { gap: 8 },
  rationaleTitle: { color: '#838C97', fontSize: 13, fontWeight: '700', lineHeight: 18 },
  rationaleText: { color: '#838C97', fontSize: 13, lineHeight: 18, letterSpacing: -0.3 },
  bottomBar: { position: 'absolute', right: 0, bottom: 0, left: 0, flexDirection: 'row', gap: 10, paddingTop: 28, paddingHorizontal: 16, paddingBottom: 16 },
  compareButton: { width: 50, height: 50, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderColor: '#DBDBDB', borderRadius: 10, borderWidth: 1 },
  compareIcon: { width: 26, height: 26 },
  tradeButton: { flex: 1, height: 50, alignItems: 'center', justifyContent: 'center', backgroundColor: '#8656C2', borderColor: '#8656C2', borderRadius: 10, borderWidth: 1 },
  tradeButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '500', letterSpacing: -0.3 },
  pressed: { opacity: 0.7 },
});
