# 바톤 (Baton)

중고 매물의 링크 또는 이미지를 입력하면 가격 적정성, 물품 상태, 위험 신호와 거래 전 확인 정보를 정리해 주는 React Native 애플리케이션입니다.

현재 프론트엔드는 Figma 디자인을 기반으로 구현 중이며, 실제 인증·크롤링·분석 API 대신 Mock 데이터와 서비스 계층을 사용합니다.

## 기술 스택

- React Native 0.81
- Expo SDK 54
- TypeScript
- Expo Router
- React 19
- `expo-image`
- `expo-image-picker`
- `expo-clipboard`
- `expo-linear-gradient`
- React Native `Animated`

HTML이나 CSS 파일을 사용하지 않으며, 화면은 React Native 컴포넌트와 `StyleSheet`로 구성합니다.

## 실행 방법

### 요구 환경

- Node.js 20.19 이상
- npm
- Android Emulator, iOS Simulator 또는 Expo Go

### 설치 및 실행

```bash
npm install
npm start
```

플랫폼을 지정해 실행할 수도 있습니다.

```bash
npm run android
npm run ios
```

## 현재 사용자 흐름

```text
온보딩
  → 로그인
  → 홈
  → 링크 입력 또는 이미지 선택
  → 분석 전 정보 확인
  → 분석 결과
  → 비교 또는 거래 준비
```

### 홈

- Figma 기반 홈 화면
- 링크 붙여넣기
- 클립보드 문자열에서 첫 번째 HTTP(S) URL 추출
- URL 주변의 문장과 공백 제거
- 이미지 선택
- 메뉴 버튼을 통한 사이드바 표시
- 앱 아이콘 및 전용 디자인 에셋 적용

### 분석 입력

- 링크 직접 입력
- 상단 체크 버튼으로 제출
- 이미지 선택 및 권한·취소·오류 처리
- URL 또는 이미지 입력 후 분석 전 확인 화면 표시

### 분석 전 정보 확인

- Figma 기반 전체 화면형 확인 UI
- 9개 매물 정보 카드 스크롤
- 연식과 구성품 등 확인 필요 항목 강조
- 각 항목별 수정 바텀시트
- 수정값을 임시 보관하고 `저장하기`를 눌렀을 때 반영
- React Native `Animated` 기반 바텀시트 상승·하강 및 오버레이 전환
- 확인 후 Mock 분석 결과 화면으로 이동

### 분석 결과

- Figma 기반 전체 스크롤 화면
- 분석 점수와 구매 고려 상태
- 판매가와 유사 매물 평균가 비교
- 가격 상세 분석
- 판매자 고지, 사진 확인, 확인 불가 정보 구분
- 위험 신호와 AI 판단 근거
- 기본 해제 상태의 찜 버튼
- 비교 및 거래 준비 화면 라우팅

## 화면 구현 상태

| 화면 | 경로 | 상태 |
| --- | --- | --- |
| 온보딩 | `/onboarding` | 기본 구조 및 Mock 흐름 |
| 로그인 | `/login` | Mock 소셜 로그인 |
| 홈 | `/home` | Figma 디자인 적용 |
| 분석 입력 | `/analysis-input` | Figma 디자인 및 입력 기능 적용 |
| 분석 전 정보 확인 | `AnalysisConfirmSheet` | Figma 디자인 및 수정 기능 적용 |
| 분석 결과 | `/analysis/[analysisId]` | Figma 디자인 적용 |
| 비교 | `/compare` | 기본 기능 UI |
| 거래 준비 | `/trade/[analysisId]` | 기본 기능 UI |
| 마이페이지 | `/mypage` | 기본 기능 UI |

Expo 초기 템플릿의 `(tabs)` 및 `modal` 라우트 파일도 남아 있지만 현재 메인 사용자 흐름에는 연결되어 있지 않습니다.

## 프로젝트 구조

```text
app/
  analysis/
    [analysisId].tsx
  trade/
    [analysisId].tsx
  analysis-input.tsx
  compare.tsx
  home.tsx
  login.tsx
  mypage.tsx
  onboarding.tsx

assets/
  images/
    analysis-confirm/
    analysis-input/
    analysis-result/
    home/
    sidebar/

src/
  components/
  constants/
  mocks/
  services/
  types/
  utils/

tests/
  analysis-draft.test.cjs
```

## 데이터 구조

공통 모델은 `src/types/marketplace.ts`에서 관리합니다.

- `Listing`: 상품명, 플랫폼, 가격, 모델명, 연식, 구성품, 하자 등 매물 정보
- `AnalysisResult`: 시세, 가격 등급, 상태 등급, 위험도, 주의 신호와 거래 체크리스트
- `PriceGrade`: `GOOD | FAIR | EXPENSIVE`
- `ConditionGrade`: `A | B | C | D`
- `RiskLevel`: `LOW | MEDIUM | HIGH`
- `TradeStatus`: `INTERESTED | CONTACTED | SCHEDULED | COMPLETED | CANCELED`

화면은 Mock 파일을 직접 참조하지 않습니다. `src/services`의 비동기 함수를 통해 데이터를 조회하므로 추후 실제 API로 교체할 수 있습니다.

## Mock 및 API 경계

현재 구현하지 않은 항목:

- 실제 소셜 로그인
- 실제 백엔드 API
- 매물 페이지 크롤링
- 실제 AI 분석
- 시세 데이터 수집
- 서버 기반 찜 및 분석 기록 저장
- 인증 토큰과 세션 관리

현재 분석 제출은 `createMockAnalysis()`를 사용합니다. 실제 API 연결 시 `src/services/analysis-service.ts`를 교체하고 화면에서는 동일한 `AnalysisResult` 타입을 사용할 수 있습니다.

## 입력 검증

URL 관련 로직은 화면과 분리되어 있습니다.

- `src/utils/url-validation.ts`: URL 정규화와 유효성 검사
- `src/utils/analysis-draft.ts`: URL·이미지 기반 제출 가능 상태 관리

클립보드에 설명 문장과 링크가 함께 포함된 경우 첫 번째 HTTP(S) 링크만 추출합니다.

## 디자인 및 에셋

디자인 기준:

- [바톤 공유용 Figma 프로젝트](https://www.figma.com/design/I2LnQwZJQ1VCPd3PkeM8MZ/)

Figma에서 제공된 이미지와 SVG는 만료되는 원격 URL을 직접 사용하지 않고 `assets/images`에 저장해 사용합니다. 임의의 이모지나 다른 아이콘으로 교체하지 않습니다.

## 검사

```bash
npx tsc --noEmit
npm run lint
npm test
```

현재 테스트는 URL 추출, 정규화, 유효성 검사와 분석 초안 제출 조건을 검증합니다.

Android 번들까지 확인해야 하는 변경은 다음 명령으로 검증할 수 있습니다.

```bash
npx expo export --platform android
```

## 개발 원칙

- Expo Router 외의 네비게이션 방식을 함께 도입하지 않습니다.
- 신규 라이브러리보다 기존 의존성과 React Native 기본 기능을 우선합니다.
- 실제 API가 연결되기 전까지 Mock 데이터와 서비스 계층을 유지합니다.
- 화면 컴포넌트가 Mock 파일을 직접 import하지 않도록 합니다.
- 웹 전용 HTML 태그나 CSS 파일을 생성하지 않습니다.
- 현재 화면과 관계없는 파일은 수정하지 않습니다.
- 디자인이 확정되지 않은 기능은 Mock 또는 TODO로 분리합니다.

## 다음 작업

- 온보딩 Figma 디자인 적용
- 로그인 Figma 디자인 적용
- 비교 화면 Figma 디자인 적용
- 거래 준비 화면 Figma 디자인 적용
- 마이페이지 Figma 디자인 적용
- 실제 분석 API 및 인증 연동
- 찜·분석 기록·거래 상태의 영속 저장
