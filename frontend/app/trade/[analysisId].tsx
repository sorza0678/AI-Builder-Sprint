import { useEffect, useMemo, useRef, useState } from 'react';
import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import {
  ImageStyle,
  Pressable,
  ScrollView,
  StyleSheet,
  Text as NativeText,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ErrorState, LoadingState } from '@/src/components/common';
import { Text } from '@/src/components/pretendard-text';
import {
  TRADE_QUESTIONS,
  TradeChecklistItem,
  TradeMethod,
  TradeQuestion,
} from '@/src/mocks/trade-preparation';
import { getAnalysisResult } from '@/src/services/analysis-service';
import { getChecklist, getInquiryScript, getTransactions, setTransaction } from '@/src/services/trade-service';
import type { ApiTransactionDecision, ApiTransactionStage } from '@/src/services/api-types';
import { addBookmark, getBookmarks, removeBookmark } from '@/src/services/bookmark-service';
import { AnalysisResult } from '@/src/types/marketplace';
import { markTradeSelection } from '@/src/repositories/trade-selection-repository';
import { getTradeChecklistState, saveTradeChecklistState } from '@/src/repositories/trade-checklist-state-repository';

const STEPS = ['문의', '확인', '가격', '진행'] as const;
type TradeStep = 'inquiry' | 'check' | 'price' | 'progress';
type TradeProgressStep = 'beforeContact' | 'contacting' | 'scheduled' | 'completed';
type TradeDecision = 'considering' | 'hold' | 'excluded';
type NullableTradeProgressStep = TradeProgressStep | null;
type NullableTradeDecision = TradeDecision | null;

const PROGRESS_STEPS: { value: TradeProgressStep; label: string }[] = [
  { value: 'beforeContact', label: '문의 전' },
  { value: 'contacting', label: '문의 중' },
  { value: 'scheduled', label: '거래 약속' },
  { value: 'completed', label: '거래 완료' },
];

const PROGRESS_DECISIONS: { value: TradeDecision; label: string }[] = [
  { value: 'considering', label: '구매고려' },
  { value: 'hold', label: '보류' },
  { value: 'excluded', label: '비교제외' },
];

const CHECKLIST_GROUPS: {
  key: TradeChecklistItem['group'];
  title: string;
}[] = [
  { key: 'before', title: '거래 전에 확인' },
  { key: 'onsite', title: '현장에서 확인' },
  { key: 'payment', title: '결제 전에 확인' },
];

const TRADE_METHODS: { value: TradeMethod; label: string }[] = [
  { value: 'inPerson', label: '직거래' },
  { value: 'delivery', label: '택배 거래' },
  { value: 'undecided', label: '미정' },
];

const METHOD_SAFETY_NOTES: Record<TradeMethod, string[]> = {
  delivery: [
    '사람이 있는 밝은 공공장소에서 거래하기',
    '제품 확인 전 절대 송금하지 않기',
    '단독 주택·외진 장소 거래 요청 시 거절하기',
  ],
  undecided: [
    '거래 방식과 확인 가능한 범위를 먼저 합의하기',
    '제품 확인 전 선입금 요구에 응하지 않기',
    '택배·직거래 각각의 비용과 조건을 비교하기',
  ],
  inPerson: [
    '사람이 있는 밝은 공공장소에서 만나기',
    '제품 상태와 구성품을 확인한 뒤 송금하기',
    '외진 장소로 거래 위치를 바꾸자는 요청은 거절하기',
  ],
};

function isChecklistItemDisabled(
  item: TradeChecklistItem,
  method: TradeMethod,
): boolean {
  if (method === 'delivery') {
    return item.id === 'scratch';
  }
  if (method === 'undecided') {
    return item.group === 'onsite' || item.id === 'account-name';
  }
  return false;
}

function getChecklistCopy(
  item: TradeChecklistItem,
  method: TradeMethod,
): Pick<TradeChecklistItem, 'text' | 'description'> {
  if (method === 'inPerson' && item.id === 'account-name') {
    return {
      text: '거래 장소·시간 최종 확인',
      description: '약속한 공공장소와 시간을 판매자에게 다시 확인하세요.',
    };
  }
  if (method === 'delivery' && item.id === 'crack') {
    return {
      text: '스포크·허브 크랙 사진 요청',
      description: '포장 전에 균열이나 변형 여부를 확인할 수 있는 사진을 요청하세요.',
    };
  }
  return item;
}

function QuestionCard({
  question,
  selected,
  reasonVisible,
  onSelect,
  onToggleReason,
}: {
  question: TradeQuestion;
  selected: boolean;
  reasonVisible: boolean;
  onSelect: () => void;
  onToggleReason: () => void;
}) {
  return (
    <View style={[styles.questionCard, selected && styles.questionCardSelected]}>
      <View style={styles.questionTop}>
        <Pressable
          accessibilityLabel={`${question.text} ${selected ? '선택 해제' : '선택'}`}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: selected }}
          onPress={onSelect}
          style={styles.questionSelectArea}>
          <Text style={[styles.questionText, selected && styles.questionTextSelected]}>
            {question.text}
          </Text>
        </Pressable>
        <Pressable
          accessibilityLabel={`${question.text} ${selected ? '선택 해제' : '선택'}`}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: selected }}
          hitSlop={8}
          onPress={onSelect}
          style={({ pressed }) => [styles.questionAction, pressed && styles.pressed]}>
          <Image
            contentFit="contain"
            source={
              selected
                ? require('@/assets/images/trade/question-action-active.svg')
                : require('@/assets/images/trade/check.svg')
            }
            style={styles.questionActionIcon}
          />
        </Pressable>
      </View>

      <Pressable
        accessibilityLabel={`${question.text} 확인 이유 ${reasonVisible ? '접기' : '펼치기'}`}
        accessibilityRole="button"
        onPress={onToggleReason}
        style={({ pressed }) => [styles.reasonButton, pressed && styles.pressed]}>
        <Image
          contentFit="contain"
          source={
            reasonVisible
              ? require('@/assets/images/trade/reason-active.svg')
              : require('@/assets/images/trade/reason.svg')
          }
          style={styles.reasonIcon}
        />
        <Text style={[styles.reasonLabel, reasonVisible && styles.reasonLabelActive]}>
          왜 확인해야 하나요?
        </Text>
      </Pressable>

      {reasonVisible && (
        <Text style={styles.reasonDescription}>{question.reason}</Text>
      )}
    </View>
  );
}

function CheckStepContent({ items, title, itemId }: { items: TradeChecklistItem[]; title: string; itemId: number }) {
  const [method, setMethod] = useState<TradeMethod>('inPerson');
  const [checkedIds, setCheckedIds] = useState<string[]>([]);
  const [excludedIds, setExcludedIds] = useState<string[]>([]);
  const [expandedIds, setExpandedIds] = useState<string[]>(['seller-identity']);
  const checklistStateLoaded = useRef(false);

  useEffect(() => {
    let active = true;
    checklistStateLoaded.current = false;
    getTradeChecklistState(itemId).then((stored) => {
      if (!active) return;
      if (stored) {
        setMethod(stored.tradeMethod);
        setCheckedIds(items.filter((item) => stored.checkedTexts.includes(item.text)).map((item) => item.id));
        setExcludedIds(items.filter((item) => stored.excludedTexts.includes(item.text)).map((item) => item.id));
      }
      checklistStateLoaded.current = true;
    });
    return () => { active = false; };
  }, [itemId, items]);

  useEffect(() => {
    if (!checklistStateLoaded.current) return;
    void saveTradeChecklistState(itemId, {
      tradeMethod: method,
      checkedTexts: items.filter((item) => checkedIds.includes(item.id)).map((item) => item.text),
      excludedTexts: items.filter((item) => excludedIds.includes(item.id)).map((item) => item.text),
    });
  }, [checkedIds, excludedIds, itemId, items, method]);

  const toggleChecked = (item: TradeChecklistItem): void => {
    if (isChecklistItemDisabled(item, method)) {
      return;
    }
    const checked = checkedIds.includes(item.id);
    const excluded = excludedIds.includes(item.id);

    if (!checked && !excluded) {
      setCheckedIds((current) => [...current, item.id]);
      return;
    }

    if (checked) {
      setCheckedIds((current) => current.filter((id) => id !== item.id));
      setExcludedIds((current) => [...current, item.id]);
      setExpandedIds((current) => current.filter((id) => id !== item.id));
      return;
    }

    if (excluded) {
      setExcludedIds((current) => current.filter((id) => id !== item.id));
    }
  };

  const toggleExpanded = (item: TradeChecklistItem): void => {
    if (isChecklistItemDisabled(item, method)) {
      return;
    }
    setExpandedIds((current) =>
      current.includes(item.id)
        ? current.filter((id) => id !== item.id)
        : [...current, item.id],
    );
  };

  const selectMethod = (nextMethod: TradeMethod): void => {
    setMethod(nextMethod);
    setCheckedIds((current) =>
      current.filter((id) => {
        const item = items.find((candidate) => candidate.id === id);
        return item ? !isChecklistItemDisabled(item, nextMethod) : false;
      }),
    );
    setExcludedIds((current) =>
      current.filter((id) => {
        const item = items.find((candidate) => candidate.id === id);
        return item ? !isChecklistItemDisabled(item, nextMethod) : false;
      }),
    );
    setExpandedIds((current) =>
      current.filter((id) => {
        const item = items.find((candidate) => candidate.id === id);
        return item ? !isChecklistItemDisabled(item, nextMethod) : false;
      }),
    );
  };

  return (
    <View style={styles.checkPage}>
      <View style={styles.checkMain}>
        <View style={styles.checkIntro}>
          <Text style={styles.introTitle}>
            거래하기 전, 상품 상태를{'\n'}
            <Text style={styles.introAccent}>체크리스트</Text>로 확인해보세요!
          </Text>
          <ProductCaption title={title} />
        </View>

        <View style={styles.methodRow}>
          {TRADE_METHODS.map((item) => {
            const selected = method === item.value;
            return (
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                key={item.value}
                onPress={() => selectMethod(item.value)}
                style={[
                  styles.methodChip,
                  selected && styles.methodChipSelected,
                ]}>
                <Text
                  style={[
                    styles.methodChipText,
                    selected && styles.methodChipTextSelected,
                  ]}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.checklistGroups}>
          {CHECKLIST_GROUPS.map((group) => (
            <View key={group.key}>
              <Text style={styles.checkGroupTitle}>{group.title}</Text>
              {items.every((item) => item.group !== group.key) ? (
                <Text style={styles.unsupportedChecklistText}>그룹별 체크리스트는 지원 예정인 기능입니다.</Text>
              ) : null}
              <View style={styles.checkItems}>
                {items.filter((item) => item.group === group.key).map(
                  (item, index, groupItems) => {
                    const checked = checkedIds.includes(item.id);
                    const excluded = excludedIds.includes(item.id);
                    const expanded = expandedIds.includes(item.id);
                    const disabled = isChecklistItemDisabled(item, method);
                    const muted = disabled || excluded;
                    const copy = getChecklistCopy(item, method);
                    return (
                      <View
                        key={item.id}
                        style={[
                          styles.checkItem,
                          index < groupItems.length - 1 && styles.checkItemBorder,
                        ]}>
                        <View style={styles.checkItemRow}>
                          <Pressable
                            accessibilityLabel={`${copy.text} ${checked ? '완료 해제' : '완료'}`}
                            accessibilityRole="checkbox"
                            accessibilityState={{ checked: excluded ? 'mixed' : checked, disabled }}
                            disabled={disabled}
                            onPress={() => toggleChecked(item)}
                            style={styles.checkItemLabel}>
                            <Image
                              contentFit="contain"
                              source={
                                muted
                                  ? require('@/assets/images/trade/check-disabled.svg')
                                  : checked
                                    ? require('@/assets/images/trade/check-selected.svg')
                                    : require('@/assets/images/trade/check.svg')
                              }
                              style={styles.checkStateIcon}
                            />
                            <Text
                              numberOfLines={1}
                              style={[
                                styles.checkItemText,
                                checked && styles.checkItemTextChecked,
                                muted && styles.checkItemTextDisabled,
                              ]}>
                              {copy.text}
                            </Text>
                          </Pressable>
                          <Pressable
                            accessibilityLabel={`${copy.text} 설명 ${expanded ? '접기' : '펼치기'}`}
                            accessibilityRole="button"
                            disabled={muted}
                            hitSlop={8}
                            onPress={() => toggleExpanded(item)}
                            style={({ pressed }) => [
                              styles.chevronButton,
                              pressed && styles.pressed,
                            ]}>
                            <Image
                              contentFit="contain"
                              source={require('@/assets/images/trade/chevron.svg')}
                              style={[
                                styles.chevronIcon,
                                expanded && styles.chevronIconExpanded,
                              ]}
                            />
                          </Pressable>
                        </View>
                        {expanded && (
                          <View style={styles.checkDescription}>
                            <Text style={styles.checkDescriptionText}>
                              {copy.description}
                            </Text>
                          </View>
                        )}
                      </View>
                    );
                  },
                )}
              </View>
            </View>
          ))}
        </View>

        <View style={styles.progressCard}>
          <Text style={styles.progressLabel}>완료</Text>
          <Text style={styles.progressValue}>
            {checkedIds.length}/{items.length}
          </Text>
        </View>
      </View>

      <View style={styles.safetySection}>
        <View style={styles.safetyTitleRow}>
          <Image
            contentFit="contain"
            source={require('@/assets/images/trade/safety-info.svg')}
            style={styles.safetyIcon}
          />
          <Text style={styles.safetyTitle}>안전 거래를 위한 주의사항 확인</Text>
        </View>
        <View style={styles.safetyList}>
          {METHOD_SAFETY_NOTES[method].map((note) => (
            <Text key={note} style={styles.safetyText}>· {note}</Text>
          ))}
        </View>
      </View>
    </View>
  );
}

function PriceCard({
  label,
  price,
  image,
  imageFrameStyle,
  imageStyle,
  watermark,
}: {
  label: string;
  price: string;
  image: number;
  imageFrameStyle: ViewStyle;
  imageStyle: ImageStyle;
  watermark: string;
}) {
  return (
    <View style={styles.priceCard}>
      <View style={styles.priceCardCopy}>
        <Text numberOfLines={1} style={styles.priceCardLabel}>
          {label}
        </Text>
        <Text numberOfLines={1} style={styles.priceCardValue}>
          {price}
        </Text>
      </View>
      <NativeText numberOfLines={1} style={styles.priceWatermark}>
        {watermark}
      </NativeText>
      <View style={[styles.priceCardImageFrame, imageFrameStyle]}>
        <Image contentFit="cover" source={image} style={[styles.priceCardImage, imageStyle]} />
      </View>
    </View>
  );
}

function ProductCaption({ title = '상품 정보 확인 필요' }: { title?: string }) {
  return (
    <View style={styles.productCaption}>
      <Text numberOfLines={1} style={styles.productName}>
        {title}
      </Text>
      <Text style={styles.productCaptionSuffix}> 의 거래준비</Text>
    </View>
  );
}

function PriceComparisonBubble({ difference }: { difference: string }) {
  const [multiline, setMultiline] = useState(false);

  return (
    <View style={[styles.priceBubbleWrap, multiline && styles.priceBubbleWrapMultiline]}>
      <View style={styles.priceBubbleTail} />
      <View style={[styles.priceBubble, multiline && styles.priceBubbleMultiline]}>
        <Text
          onTextLayout={({ nativeEvent }) => {
            if (nativeEvent.lines.length > 1) {
              setMultiline(true);
            }
          }}
          style={[styles.priceBubbleText, multiline && styles.priceBubbleTextMultiline]}>
          <Text style={styles.priceBubbleMuted}>판매가보다 </Text>
          {difference}
          <Text style={styles.priceBubbleMuted}> 낮아요!</Text>
        </Text>
      </View>
    </View>
  );
}

function getPriceProposal(result: AnalysisResult) {
  const target = result.marketPrice.average;
  const difference = Math.abs(result.listing.price - target);
  return {
    targetPrice: '지원 예정',
    listedPrice: result.listing.price.toLocaleString('ko-KR'),
    difference: `약 ${difference.toLocaleString('ko-KR')}원`,
    reasons: ['AI 가격 제안 근거는 지원 예정인 기능입니다.'],
    message: '가격 제안 메시지는 지원 예정인 기능입니다.',
  };
}

function PriceStepContent({ result, onCopyMessage }: { result: AnalysisResult; onCopyMessage: () => void }) {
  const proposal = getPriceProposal(result);
  return (
    <View style={styles.pricePage}>
      <View style={styles.priceMain}>
        <View style={styles.intro}>
          <Text style={styles.introTitle}>
            판매자에게 연락하기 전,{'\n'}
            <Text style={styles.introAccent}>가격과 메시지</Text>를 준비해보세요!
          </Text>
          <ProductCaption title={result.listing.title} />
        </View>

        <View style={styles.priceSummary}>
          <View style={styles.priceCardsRow}>
            <PriceCard
              image={require('@/assets/images/trade/target-price-money.png')}
              imageFrameStyle={styles.targetPriceImageFrame}
              imageStyle={styles.targetPriceImage}
              label="제안해볼 가격"
              price={proposal.targetPrice}
              watermark="TARGET"
            />
            <PriceCard
              image={require('@/assets/images/trade/listed-price-money.png')}
              imageFrameStyle={styles.listedPriceImageFrame}
              imageStyle={styles.listedPriceImage}
              label="현재 판매가"
              price={proposal.listedPrice}
              watermark="LISTED"
            />
          </View>

          <PriceComparisonBubble difference={proposal.difference} />
        </View>

        <View style={styles.priceReasonSection}>
          <Text style={styles.priceSectionTitle}>이 가격을 제안한 이유</Text>
          <View style={styles.priceReasonsCard}>
            {proposal.reasons.map((reason) => (
              <Text key={reason} style={styles.priceReasonText}>· {reason}</Text>
            ))}
          </View>
        </View>
      </View>

      <View style={styles.priceMessageSection}>
        <Text style={styles.groupTitle}>가격 제안 메시지</Text>
        <View style={styles.priceMessageCard}>
          <Text style={styles.priceMessageText}>{proposal.message}</Text>
          <Pressable
            accessibilityLabel="가격 제안 메시지 복사"
            accessibilityRole="button"
            hitSlop={8}
            onPress={onCopyMessage}
            style={({ pressed }) => [styles.copyButton, pressed && styles.pressed]}>
            <Image
              contentFit="contain"
              source={require('@/assets/images/trade/copy.svg')}
              style={styles.copyIcon}
            />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function ProgressStepContent({
  decision: apiDecision,
  itemId,
  onChange,
  stage,
  title,
}: {
  decision: ApiTransactionDecision | null;
  itemId: number;
  onChange: (stage: ApiTransactionStage, decision: ApiTransactionDecision | null) => void;
  stage: ApiTransactionStage | null;
  title: string;
}) {
  const stageFromApi: Record<ApiTransactionStage, TradeProgressStep> = {
    BEFORE_CONTACT: 'beforeContact', CONTACTING: 'contacting', SCHEDULED: 'scheduled', COMPLETED: 'completed',
  };
  const decisionFromApi: Record<ApiTransactionDecision, TradeDecision> = {
    CONSIDERING: 'considering', HOLD: 'hold', EXCLUDED: 'excluded',
  };
  const progressStep: NullableTradeProgressStep = stage ? stageFromApi[stage] : null;
  const decision: NullableTradeDecision = apiDecision ? decisionFromApi[apiDecision] : null;
  const activeIndex = progressStep
    ? PROGRESS_STEPS.findIndex((step) => step.value === progressStep)
    : -1;

  return (
    <View style={styles.progressPage}>
      <View style={styles.progressMain}>
        <View style={styles.intro}>
          <Text style={styles.introTitle}>
            지금 거래가 어느 단계인지,{'\n'}
            <Text style={styles.introAccent}>진행 상태</Text>를 남겨보세요!
          </Text>
          <ProductCaption title={title} />
        </View>

        <View style={styles.tradeStepper}>
          <View style={styles.tradeStepperLines}>
            {PROGRESS_STEPS.slice(0, -1).map((step, index) => {
              const completed = index < activeIndex;
              return (
                <View
                  key={step.value}
                  style={[
                    styles.tradeStepperLine,
                    completed && styles.tradeStepperLineCompleted,
                  ]}
                />
              );
            })}
          </View>

          <View style={styles.tradeStepperItems}>
            {PROGRESS_STEPS.map((step, index) => {
              const active = index === activeIndex;
              const completed = index < activeIndex;
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  key={step.value}
                  onPress={() => {
                    const stageMap: Record<TradeProgressStep, ApiTransactionStage> = {
                      beforeContact: 'BEFORE_CONTACT', contacting: 'CONTACTING',
                      scheduled: 'SCHEDULED', completed: 'COMPLETED',
                    };
                    const decisionMap: Record<TradeDecision, ApiTransactionDecision> = {
                      considering: 'CONSIDERING', hold: 'HOLD', excluded: 'EXCLUDED',
                    };
                    const nextStage = stageMap[step.value];
                    const nextDecision = decision ? decisionMap[decision] : null;
                    onChange(nextStage, nextDecision);
                    void Promise.all([
                      markTradeSelection(itemId),
                      setTransaction(itemId, nextStage, nextDecision),
                    ]);
                  }}
                  style={({ pressed }) => [styles.tradeStepperItem, pressed && styles.pressed]}>
                  <View
                    style={[
                      styles.tradeStepDot,
                      active && styles.tradeStepDotActive,
                      completed && styles.tradeStepDotCompleted,
                    ]}>
                    {completed ? (
                      <Text style={styles.tradeStepCheck}>✓</Text>
                    ) : (
                      <Text
                        style={[
                          styles.tradeStepNumber,
                          active && styles.tradeStepNumberActive,
                        ]}>
                        {index + 1}
                      </Text>
                    )}
                  </View>
                  <Text
                    style={[
                      styles.tradeStepLabel,
                      active && styles.tradeStepLabelActive,
                      completed && styles.tradeStepLabelCompleted,
                    ]}>
                    {step.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>

      <View style={styles.tradeDecisionSection}>
        <Text style={styles.groupTitle}>현재 판단</Text>
        <View style={styles.tradeDecisionRow}>
          {PROGRESS_DECISIONS.map((item) => {
            const selected = decision === item.value;
            return (
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                key={item.value}
                onPress={() => {
                  if (progressStep) {
                    const stageMap: Record<TradeProgressStep, ApiTransactionStage> = {
                      beforeContact: 'BEFORE_CONTACT', contacting: 'CONTACTING',
                      scheduled: 'SCHEDULED', completed: 'COMPLETED',
                    };
                    const decisionMap: Record<TradeDecision, ApiTransactionDecision> = {
                      considering: 'CONSIDERING', hold: 'HOLD', excluded: 'EXCLUDED',
                    };
                    const nextStage = stageMap[progressStep];
                    const nextDecision = decisionMap[item.value];
                    onChange(nextStage, nextDecision);
                    void Promise.all([
                      markTradeSelection(itemId),
                      setTransaction(itemId, nextStage, nextDecision),
                    ]);
                  }
                }}
                style={({ pressed }) => [
                  styles.tradeDecisionButton,
                  selected && styles.tradeDecisionButtonSelected,
                  pressed && styles.pressed,
                ]}>
                <Text
                  style={[
                    styles.tradeDecisionText,
                    selected && styles.tradeDecisionTextSelected,
                  ]}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

      </View>
    </View>
  );
}

export default function TradePreparationScreen() {
  const { analysisId } = useLocalSearchParams<{ analysisId?: string | string[] }>();
  const id = typeof analysisId === 'string' ? analysisId : undefined;
  const [result, setResult] = useState<AnalysisResult>();
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [visibleReasonIds, setVisibleReasonIds] = useState<string[]>([]);
  const [activeStep, setActiveStep] = useState<TradeStep>('inquiry');
  const [favorite, setFavorite] = useState(false);
  const [serverMessage, setServerMessage] = useState('');
  const [serverChecklist, setServerChecklist] = useState<TradeChecklistItem[]>([]);
  const [transactionStage, setTransactionStage] = useState<ApiTransactionStage | null>(null);
  const [transactionDecision, setTransactionDecision] = useState<ApiTransactionDecision | null>(null);

  useEffect(() => {
    let active = true;
    if (!id) {
      setLoading(false);
      return;
    }

    Promise.allSettled([
      getAnalysisResult(id),
      getInquiryScript(Number(id)),
      getChecklist(Number(id)),
      getBookmarks(),
      getTransactions(),
    ])
      .then(([analysisResult, inquiryResult, checklistResult, bookmarkResult, transactionResult]) => {
        if (active) {
          if (analysisResult.status === 'fulfilled') setResult(analysisResult.value);
          if (inquiryResult.status === 'fulfilled') setServerMessage(inquiryResult.value.script);
          if (checklistResult.status === 'fulfilled') {
            setServerChecklist(checklistResult.value.checklist.map((text, index) => ({
              id: `server-${index}`,
              text,
              description: '상세 설명은 지원 예정인 기능입니다.',
              group: 'before',
            })));
          }
          if (bookmarkResult.status === 'fulfilled') {
            setFavorite(bookmarkResult.value.items.some((item) => item.item_id === Number(id)));
          }
          if (transactionResult.status === 'fulfilled') {
            const transaction = transactionResult.value.items.find((item) => item.item_id === Number(id));
            setTransactionStage(transaction?.stage ?? null);
            setTransactionDecision(transaction?.decision ?? null);
          }
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [id]);

  const selectedQuestions = useMemo(
    () => TRADE_QUESTIONS.filter((question) => selectedIds.includes(question.id)),
    [selectedIds],
  );
  const displayedQuestions: typeof TRADE_QUESTIONS = [];

  const message = useMemo(() => {
    const questions = selectedQuestions
      .map((question, index) => `${index + 1}. ${question.text}`)
      .join('\n');
    if (serverMessage) {
      return serverMessage;
    }
    return [
      '안녕하세요! 제품이 마음에 들어 문의드려요 😊',
      questions,
      '확인해 주시면 감사하겠습니다!',
    ]
      .filter(Boolean)
      .join('\n');
  }, [selectedQuestions, serverMessage]);

  const toggleQuestion = (questionId: string): void => {
    setSelectedIds((current) =>
      current.includes(questionId)
        ? current.filter((idItem) => idItem !== questionId)
        : [...current, questionId],
    );
  };

  const toggleReason = (questionId: string): void => {
    setVisibleReasonIds((current) =>
      current.includes(questionId)
        ? current.filter((idItem) => idItem !== questionId)
        : [...current, questionId],
    );
  };

  const copyMessage = async (): Promise<void> => {
    try {
      await Clipboard.setStringAsync(message);
    } catch {
      // 클립보드 접근 실패 시 화면 상태는 유지합니다.
    }
  };

  const copyPriceMessage = async (): Promise<void> => {
    try {
      if (result) await Clipboard.setStringAsync(getPriceProposal(result).message);
    } catch {
      // 클립보드 접근 실패 시 화면 상태는 유지합니다.
    }
  };

  if (loading) {
    return (
      <SafeAreaView edges={['top', 'bottom']} style={styles.centeredState}>
        <LoadingState />
      </SafeAreaView>
    );
  }

  if (!id || !result) {
    return (
      <SafeAreaView edges={['top', 'bottom']} style={styles.centeredState}>
        <ErrorState message="거래 준비에 필요한 분석 결과를 찾을 수 없습니다." />
      </SafeAreaView>
    );
  }

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
            style={styles.headerIcon}
          />
        </Pressable>
        <Text style={styles.headerTitle}>거래준비</Text>
        <Pressable
          accessibilityLabel={favorite ? '찜 취소' : '찜하기'}
          accessibilityRole="button"
          accessibilityState={{ selected: favorite }}
          hitSlop={8}
          onPress={async () => {
            if (favorite) await removeBookmark(Number(result.id));
            else await addBookmark(Number(result.id));
            setFavorite((current) => !current);
          }}
          style={({ pressed }) => [styles.headerButton, styles.headerButtonRight, pressed && styles.pressed]}>
          <Image
            contentFit="contain"
            source={
              favorite
                ? require('@/assets/images/trade/header-heart.svg')
                : require('@/assets/images/trade/header-action.svg')
            }
            style={styles.headerIcon}
          />
        </Pressable>
      </View>

      <View accessibilityRole="tablist" style={styles.tabs}>
        {STEPS.map((step, index) => {
          const stepValue: TradeStep | undefined =
            index === 0
              ? 'inquiry'
              : index === 1
                ? 'check'
                : index === 2
                  ? 'price'
                  : 'progress';
          const selected = activeStep === stepValue;
          return (
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ disabled: !stepValue, selected }}
              disabled={!stepValue}
              key={step}
              onPress={() => stepValue && setActiveStep(stepValue)}
              style={styles.tab}>
              <Text style={[styles.tabText, selected && styles.tabTextSelected]}>
                {step}
              </Text>
              {selected && <View style={styles.tabIndicator} />}
            </Pressable>
          );
        })}
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          activeStep === 'check' && styles.checkScrollContent,
          activeStep === 'price' && styles.priceScrollContent,
          activeStep === 'progress' && styles.progressScrollContent,
        ]}
        showsVerticalScrollIndicator={false}>
        {activeStep === 'inquiry' ? (
          <>
        <View style={styles.intro}>
          <Text style={styles.introTitle}>
            판매자에게 연락하기 전,{'\n'}꼭{' '}
            <Text style={styles.introAccent}>물어볼 내용</Text>을 확인해보세요!
          </Text>
          <ProductCaption title={result.listing.title} />
        </View>

        <View style={styles.questionsArea}>
          <View style={styles.questionGroup}>
            <Text style={styles.groupTitle}>꼭 물어볼 질문</Text>
            <View style={styles.questionList}>
              <Text style={styles.unsupportedQuestionText}>지원 예정인 기능입니다.</Text>
              {displayedQuestions.filter((question) => question.required).map((question) => (
                <QuestionCard
                  key={question.id}
                  onSelect={() => toggleQuestion(question.id)}
                  onToggleReason={() => toggleReason(question.id)}
                  question={question}
                  reasonVisible={visibleReasonIds.includes(question.id)}
                  selected={selectedIds.includes(question.id)}
                />
              ))}
            </View>
          </View>

          <View style={styles.questionGroup}>
            <Text style={styles.groupTitle}>추가로 확인하면 좋은 질문</Text>
            <View style={styles.questionList}>
              <Text style={styles.unsupportedQuestionText}>지원 예정인 기능입니다.</Text>
              {displayedQuestions.filter((question) => !question.required).map((question) => (
                <QuestionCard
                  key={question.id}
                  onSelect={() => toggleQuestion(question.id)}
                  onToggleReason={() => toggleReason(question.id)}
                  question={question}
                  reasonVisible={visibleReasonIds.includes(question.id)}
                  selected={selectedIds.includes(question.id)}
                />
              ))}
            </View>
          </View>
        </View>

        <View style={styles.messageSection}>
          <Text style={styles.groupTitle}>보낼메세지</Text>
          <View style={styles.messageCard}>
            <Text style={styles.messageText}>{message}</Text>
            <Pressable
              accessibilityLabel="문의 메시지 복사"
              accessibilityRole="button"
              onPress={copyMessage}
              style={({ pressed }) => [styles.copyButton, pressed && styles.pressed]}>
              <Image
                contentFit="contain"
                source={require('@/assets/images/trade/copy.svg')}
                style={styles.copyIcon}
              />
            </Pressable>
          </View>
        </View>
          </>
        ) : activeStep === 'check' ? (
          <CheckStepContent itemId={Number(result.id)} items={serverChecklist} title={result.listing.title} />
        ) : activeStep === 'price' ? (
          <PriceStepContent result={result} onCopyMessage={copyPriceMessage} />
        ) : (
          <ProgressStepContent
            decision={transactionDecision}
            itemId={Number(result.id)}
            onChange={(stage, decision) => {
              setTransactionStage(stage);
              setTransactionDecision(decision);
            }}
            stage={transactionStage}
            title={result.listing.title}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  centeredState: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    height: 60,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerButton: {
    width: 40,
    height: 40,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  headerButtonRight: { alignItems: 'flex-end' },
  headerIcon: { width: 24, height: 24 },
  headerTitle: {
    color: '#111727',
    fontSize: 18,
    fontWeight: '500',
    lineHeight: 24.3,
    letterSpacing: -0.3,
  },
  tabs: {
    height: 48,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F6F5FA',
    flexDirection: 'row',
    gap: 16,
  },
  tab: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabText: {
    color: '#D2D2E2',
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 16,
    letterSpacing: -0.3,
  },
  tabTextSelected: { color: '#111727' },
  tabIndicator: {
    position: 'absolute',
    bottom: -1,
    width: 48,
    height: 2,
    backgroundColor: '#8656C2',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 32,
    paddingBottom: 30,
  },
  checkScrollContent: {
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 0,
    backgroundColor: '#F6F5FA',
  },
  priceScrollContent: {
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 0,
    backgroundColor: '#FFFFFF',
  },
  progressScrollContent: {
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 0,
    backgroundColor: '#FFFFFF',
  },
  intro: { gap: 16 },
  introTitle: {
    color: '#111727',
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 27,
    letterSpacing: -0.3,
  },
  introAccent: {
    color: '#8656C2',
    fontWeight: '600',
  },
  productCaption: {
    paddingRight: 90,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  productName: {
    flexShrink: 1,
    minWidth: 0,
    color: '#838C97',
    fontSize: 15,
    lineHeight: 20.25,
    letterSpacing: -0.3,
  },
  productCaptionSuffix: {
    flexShrink: 0,
    color: '#838C97',
    fontSize: 15,
    lineHeight: 20.25,
    letterSpacing: -0.3,
  },
  questionsArea: {
    marginTop: 40,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F6F5FA',
    gap: 20,
  },
  questionGroup: { gap: 10 },
  groupTitle: {
    color: '#838C97',
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 20.25,
    letterSpacing: -0.3,
  },
  questionList: { gap: 8 },
  unsupportedQuestionText: {
    color: '#B9BEC5',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
    paddingVertical: 12,
  },
  unsupportedChecklistText: {
    color: '#B9BEC5',
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 19,
    paddingVertical: 12,
  },
  questionCard: {
    minHeight: 81,
    padding: 20,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
  },
  questionCardSelected: { backgroundColor: '#EFF3FF' },
  questionTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  questionSelectArea: { flex: 1 },
  questionText: {
    color: '#484B4D',
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 18,
    letterSpacing: -0.3,
  },
  questionTextSelected: { color: '#5E5091' },
  questionAction: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  questionActionIcon: { width: 20, height: 20 },
  reasonButton: {
    marginTop: 10,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  reasonIcon: { width: 16, height: 16 },
  reasonLabel: {
    color: '#A597CC',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 14,
    letterSpacing: -0.3,
  },
  reasonLabelActive: { color: '#8656C2' },
  reasonDescription: {
    marginTop: 12,
    color: '#838C97',
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: -0.3,
  },
  messageSection: { marginTop: 20, gap: 10 },
  messageCard: {
    minHeight: 112,
    padding: 16,
    paddingRight: 50,
    borderRadius: 12,
    backgroundColor: '#F6F5FA',
  },
  messageText: {
    color: '#515760',
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: -0.3,
  },
  copyButton: {
    position: 'absolute',
    right: 16,
    top: 16,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copyIcon: { width: 18, height: 18 },
  checkPage: {
    gap: 10,
    backgroundColor: '#F6F5FA',
  },
  checkMain: {
    paddingHorizontal: 16,
    paddingTop: 32,
    paddingBottom: 30,
    backgroundColor: '#FFFFFF',
    gap: 28,
  },
  checkIntro: { gap: 16 },
  methodRow: {
    flexDirection: 'row',
    gap: 6,
  },
  methodChip: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#EDEDED',
    borderRadius: 40,
  },
  methodChipSelected: {
    borderColor: '#8656C2',
    backgroundColor: '#8656C2',
  },
  methodChipText: {
    color: '#838C97',
    fontSize: 14,
    lineHeight: 14,
    letterSpacing: -0.3,
  },
  methodChipTextSelected: {
    color: '#FFFFFF',
    fontWeight: '500',
  },
  checklistGroups: { gap: 20 },
  checkGroupTitle: {
    color: '#838C97',
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 21.6,
    letterSpacing: -0.3,
  },
  checkItems: {
    paddingLeft: 12,
  },
  checkItem: {
    paddingVertical: 8,
    gap: 11,
  },
  checkItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#EEF1F7',
  },
  checkItemRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  checkItemLabel: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkStateIcon: { width: 20, height: 20 },
  checkItemText: {
    flex: 1,
    color: '#515760',
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 18,
    letterSpacing: -0.3,
  },
  checkItemTextChecked: {
    textDecorationLine: 'line-through',
  },
  checkItemTextDisabled: {
    color: '#DBDBDB',
  },
  chevronButton: {
    width: 32,
    height: 52,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  chevronIcon: {
    width: 13,
    height: 13,
    transform: [{ rotate: '-90deg' }],
  },
  chevronIconExpanded: {
    transform: [{ rotate: '90deg' }],
  },
  checkDescription: {
    marginLeft: 31,
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#F4F6FA',
  },
  checkDescriptionText: {
    color: '#838C97',
    fontSize: 14,
    lineHeight: 18.2,
    letterSpacing: -0.3,
  },
  progressCard: {
    padding: 16,
    borderRadius: 8,
    backgroundColor: '#F4F6FA',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressLabel: {
    color: '#838C97',
    fontSize: 15,
    lineHeight: 20.25,
    letterSpacing: -0.3,
  },
  progressValue: {
    color: '#484B4D',
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 20.25,
    letterSpacing: -0.3,
  },
  safetySection: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    backgroundColor: '#FFFFFF',
    gap: 12,
  },
  safetyTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  safetyIcon: { width: 18, height: 18 },
  safetyTitle: {
    color: '#111727',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 13,
    letterSpacing: -0.3,
  },
  safetyList: { gap: 4 },
  safetyText: {
    color: '#838C97',
    fontSize: 13,
    lineHeight: 17.55,
    letterSpacing: -0.3,
  },
  pricePage: {
    backgroundColor: '#FFFFFF',
  },
  priceMain: {
    paddingHorizontal: 16,
    paddingTop: 32,
    paddingBottom: 30,
    borderBottomWidth: 1,
    borderBottomColor: '#F6F5FA',
    gap: 56,
  },
  priceSummary: {
    paddingHorizontal: 8,
    gap: 29,
  },
  priceCardsRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 32,
  },
  priceCard: {
    width: 140,
    height: 162,
    paddingHorizontal: 16,
    paddingVertical: 30,
    borderWidth: 1,
    borderColor: '#EDEFF8',
    borderRadius: 18,
    backgroundColor: '#EFF3FF',
    alignItems: 'center',
    overflow: 'visible',
  },
  priceCardCopy: {
    width: 120,
    alignItems: 'center',
    gap: 4,
    zIndex: 2,
  },
  priceCardLabel: {
    color: '#A3A6C3',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 14,
    letterSpacing: -0.3,
    textAlign: 'center',
    flexShrink: 0,
  },
  priceCardValue: {
    color: '#8656C2',
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 27,
    letterSpacing: -0.3,
    textAlign: 'center',
    flexShrink: 0,
  },
  priceWatermark: {
    marginTop: 12,
    width: 140,
    color: '#E5E3F9',
    fontFamily: 'Fredoka_700Bold',
    fontSize: 31.816,
    lineHeight: 31.816,
    letterSpacing: -0.4773,
    textAlign: 'center',
    flexShrink: 0,
  },
  priceCardImageFrame: {
    position: 'absolute',
    zIndex: 3,
    overflow: 'hidden',
  },
  priceCardImage: {
    position: 'absolute',
  },
  targetPriceImageFrame: {
    left: 19.9,
    top: 100.26,
    width: 94.9,
    height: 85.73,
    transform: [{ rotate: '2.26deg' }],
  },
  targetPriceImage: {
    left: -15.98,
    top: -20.57,
    width: 126.88,
    height: 126.88,
  },
  listedPriceImageFrame: {
    left: 12.35,
    top: 93.35,
    width: 108,
    height: 108,
  },
  listedPriceImage: {
    left: 0,
    top: 0,
    width: 108,
    height: 108,
  },
  priceBubbleWrap: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    minHeight: 49,
  },
  priceBubbleWrapMultiline: {
    maxWidth: '100%',
  },
  priceBubbleTail: {
    marginLeft: 49,
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderBottomWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#A3A6C3',
  },
  priceBubble: {
    alignSelf: 'flex-start',
    marginTop: -2,
    minHeight: 42,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#A3A6C3',
    borderRadius: 12,
    backgroundColor: '#EEF1F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  priceBubbleMultiline: {
    alignItems: 'flex-start',
  },
  priceBubbleText: {
    color: '#111727',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 14,
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  priceBubbleTextMultiline: {
    lineHeight: 18.2,
    textAlign: 'left',
  },
  priceBubbleMuted: {
    color: '#484B4D',
  },
  priceReasonSection: {
    gap: 10,
  },
  priceSectionTitle: {
    color: '#111727',
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 21.6,
    letterSpacing: -0.3,
  },
  priceReasonsCard: {
    paddingHorizontal: 10,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#F4F6FA',
    gap: 4,
  },
  priceReasonText: {
    color: '#838C97',
    fontSize: 14,
    lineHeight: 18.2,
    letterSpacing: -0.3,
  },
  priceMessageSection: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 30,
    gap: 10,
  },
  priceMessageCard: {
    minHeight: 112,
    padding: 16,
    paddingRight: 50,
    borderRadius: 8,
    backgroundColor: '#F4F6FA',
  },
  priceMessageText: {
    color: '#484B4D',
    fontSize: 15,
    lineHeight: 20.25,
    letterSpacing: -0.3,
  },
  progressPage: {
    backgroundColor: '#FFFFFF',
  },
  progressMain: {
    paddingHorizontal: 16,
    paddingTop: 32,
    paddingBottom: 30,
    borderBottomWidth: 1,
    borderBottomColor: '#F6F5FA',
    gap: 56,
  },
  tradeStepper: {
    width: '100%',
    height: 75,
    justifyContent: 'flex-start',
  },
  tradeStepperLines: {
    position: 'absolute',
    left: 45,
    right: 36,
    top: 15,
    height: 2,
    flexDirection: 'row',
  },
  tradeStepperLine: {
    flex: 1,
    height: 2,
    backgroundColor: '#EFF3FF',
  },
  tradeStepperLineCompleted: {
    backgroundColor: '#8656C2',
  },
  tradeStepperItems: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  tradeStepperItem: {
    width: 60,
    alignItems: 'center',
    gap: 28,
  },
  tradeStepDot: {
    width: 31,
    height: 31,
    borderRadius: 24,
    backgroundColor: '#EFF3FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tradeStepDotActive: {
    backgroundColor: '#8656C2',
  },
  tradeStepDotCompleted: {
    borderWidth: 1.38,
    borderColor: '#8656C2',
    backgroundColor: '#FFFFFF',
  },
  tradeStepNumber: {
    color: '#CAC7F0',
    fontSize: 11,
    fontWeight: '500',
    lineHeight: 11,
    letterSpacing: -0.2,
  },
  tradeStepNumberActive: {
    color: '#FFFFFF',
  },
  tradeStepCheck: {
    color: '#8656C2',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 14,
  },
  tradeStepLabel: {
    color: '#B9BEC5',
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 16,
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  tradeStepLabelActive: {
    color: '#111727',
  },
  tradeStepLabelCompleted: {
    color: '#B9BEC5',
  },
  tradeDecisionSection: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 30,
    gap: 14,
  },
  tradeDecisionRow: {
    minHeight: 45,
    flexDirection: 'row',
    gap: 12,
  },
  tradeDecisionButton: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 10,
    paddingVertical: 0,
    borderWidth: 1,
    borderColor: '#EDEDED',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tradeDecisionButtonSelected: {
    borderColor: '#8656C2',
    backgroundColor: '#EFF3FF',
  },
  tradeDecisionText: {
    color: '#999999',
    fontSize: 14,
    lineHeight: 18,
    letterSpacing: -0.3,
    textAlign: 'center',
    includeFontPadding: false,
  },
  tradeDecisionTextSelected: {
    color: '#8656C2',
    fontWeight: '500',
  },
  pressed: { opacity: 0.65 },
});
