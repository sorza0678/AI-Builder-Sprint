# 바톤 프론트엔드

중고 거래 링크를 분석하고 가격, 위험 신호, 비교 결과와 거래 준비 정보를 보여주는 Expo 기반 React Native 애플리케이션입니다.

현재 프론트엔드는 저장소의 FastAPI 백엔드와 연결되어 있습니다. 백엔드가 제공하지 않는 데이터는 임의의 값으로 채우지 않고 미지원 또는 지원 예정 상태로 표시합니다.

## 기술 스택

- React Native 0.81
- Expo SDK 54
- React 19
- TypeScript
- Expo Router
- AsyncStorage
- `expo-image`, `expo-image-picker`, `expo-clipboard`
- `expo-linear-gradient`
- React Native `Animated`

화면은 React Native 컴포넌트와 `StyleSheet`로 구성하며 웹 전용 HTML/CSS를 사용하지 않습니다.

## 실행 방법

### 요구 환경

- Node.js 20.19 이상
- npm
- Android Emulator, iOS Simulator, Expo Go 또는 웹 브라우저
- 별도로 실행 중인 백엔드 서버

### 설치

```bash
cd frontend
npm install
```

### 환경변수

프론트에서 필요한 환경변수는 API 서버 주소 하나입니다.

```env
EXPO_PUBLIC_API_BASE_URL=http://localhost:8000
```

플랫폼에 따라 접근 가능한 주소가 다릅니다.

| 실행 환경 | 예시 |
| --- | --- |
| Web / iOS Simulator | `http://localhost:8000` |
| Android Emulator | `http://10.0.2.2:8000` |
| Expo Go 실기기 | `http://개발-PC의-LAN-IP:8000` |

실기기와 개발 PC는 같은 네트워크에 연결되어 있어야 합니다. `.env.example`의 주소는 개발 환경에 맞게 변경합니다.

`UPSTAGE_API_KEY`는 백엔드 전용입니다. 프론트 환경변수나 앱 번들에 넣지 않습니다.

### Expo 실행

```bash
npm start
```

```bash
npm run android
npm run ios
npm run web
```

환경변수를 변경했다면 Metro를 다시 시작해야 합니다.

## 사용자 흐름

```text
온보딩
  → 홈 또는 Mock 로그인
  → 중고 거래 URL 입력
  → 1차 분석 요청
  → 분석된 정보 확인 및 수정
  → 수정 정보 저장
  → 분석 결과
  → 찜 / 비교 / 거래 준비
  → 분석·비교·거래 기록 및 마이페이지
```

이미지는 로컬 미리보기 보조 정보로만 사용할 수 있습니다. 백엔드에 이미지 업로드 API가 없으므로 이미지 단독 분석은 지원하지 않습니다.

## 화면과 연결 상태

| 화면 | 경로 | 데이터 상태 |
| --- | --- | --- |
| 온보딩 | `/onboarding` | 로컬 최초 실행 상태 |
| 로그인 | `/login` | 기기 내 Mock 인증 |
| 홈 | `/home` | 입력 UI, 일부 최근 매물 Mock 유지 |
| 분석 입력 | `/analysis-input` | URL 분석 API 연결 |
| 분석 정보 확인 | `AnalysisConfirmSheet` | 분석값 표시, 사용자 수정 및 저장 |
| 분석 결과 | `/analysis/[analysisId]` | 분석 API 응답 및 로컬 상세 캐시 |
| 최근 분석 | `/recent-analyses` | history API 연결 |
| 찜 목록 | `/saved-listings` | bookmark API 연결 |
| 비교 | `/compare` | comparison 목록 및 compare API 연결 |
| 비교 기록 | `/comparison-history` | 비교 결과 기반 기록 UI |
| 거래 준비 | `/trade/[analysisId]` | checklist, inquiry-script, transaction API 연결 |
| 거래 내역 | `/trade-records` | transaction API 연결 |
| 마이페이지 | `/mypage` | 로그인 ID, 실제 집계 및 최근 분석 기록 |

## 로그인과 사용자 ID

백엔드에는 실제 인증·인가 또는 토큰 기능이 없습니다. 현재 로그인은 마이페이지와 계정별 데이터 흐름을 확인하기 위한 프론트 Mock입니다.

테스트 계정:

```text
아이디: baton001
비밀번호: 1234
```

- Mock 로그인 세션은 AsyncStorage에 저장되어 앱을 다시 실행해도 유지됩니다.
- 로그인 상태에서는 API의 `user_id`로 `baton001`을 사용합니다.
- 비회원 상태에서는 기기에 생성한 `guest-*` ID를 사용합니다.
- 로그아웃하면 Mock 로그인 세션만 삭제되고 기기의 guest ID는 유지됩니다.
- 로그인 전 guest 데이터는 현재 계정으로 이전되지 않습니다.

비회원 데이터를 계정으로 이전하려면 인증된 사용자만 호출할 수 있는 서버 측 이전 API가 필요합니다. 프론트는 향후 이전 요청에 사용할 수 있도록 로그인 직전 guest ID를 세션 정보에 보존하지만, 현재 임의로 소유권을 변경하지 않습니다.

> 이 Mock 계정은 개발용이며 실제 보안 인증으로 사용할 수 없습니다. 비밀번호와 사용자 ID가 앱 코드에 포함되어 있습니다.

## API 연결 구조

모든 서버 요청은 `src/services`를 통합니다.

```text
화면
  → service
  → 공통 api-client
  → FastAPI /api/v1
```

`api-client.ts`는 다음을 공통 처리합니다.

- `EXPO_PUBLIC_API_BASE_URL` 적용
- JSON Content-Type 설정
- 30초 timeout
- 네트워크 오류와 timeout 구분
- `{ ok, data, error }` envelope 해석
- 서버 `error.code`를 보존하는 `ApiError`

연결된 서비스:

- `analysis-service.ts`: 분석 요청, API DTO 변환, 상세 캐시
- `history-service.ts`: 분석 기록 및 pagination
- `bookmark-service.ts`: 찜 추가·삭제·목록
- `comparison-service.ts`: 비교함 추가·삭제·목록 및 비교 요청
- `trade-service.ts`: 체크리스트, 문의 스크립트, 거래 상태 저장·조회
- `mypage-service.ts`: 계정별 집계
- `listing-service.ts`: 확인 화면에서 수정한 매물 상세 정보 저장 및 현재 홈 매물 경계

백엔드 DTO는 `src/services/api-types.ts`, 화면 모델은 `src/types/marketplace.ts`에서 분리합니다. API의 snake_case 응답을 화면에서 직접 추측하지 않습니다.

## 데이터 저장 위치

### 서버 데이터

- 분석 결과와 분석 기록
- 찜 목록
- 비교 목록과 비교 결과
- 거래 단계와 결정 상태
- 마이페이지 집계
- 분석 후 수정한 매물 정보 중 백엔드가 지원하는 필드

### 기기 로컬 데이터

- guest ID
- Mock 로그인 세션
- 단건 조회 API를 보완하는 분석 상세 캐시
- 사용자가 수정한 일부 표시 정보
- 거래 준비 체크리스트의 체크·제외 상태와 거래 방식
- 거래 준비 대상으로 사용자가 직접 선택한 상품 ID
- 온보딩 완료 상태

분석 단건 조회 API가 없으므로 분석 상세 화면은 분석 성공 시 저장한 로컬 캐시를 사용합니다. 서버 기록만 있고 로컬 캐시가 없는 항목은 상세 정보를 완전히 복원할 수 없습니다.

## 거래 상태

프론트와 백엔드에서 사용하는 거래 상태는 다음과 같습니다.

```ts
stage: 'BEFORE_CONTACT' | 'CONTACTING' | 'SCHEDULED' | 'COMPLETED'
decision: 'CONSIDERING' | 'HOLD' | 'EXCLUDED' | null
```

사용자가 거래 상태를 선택하지 않으면 거래 내역에 자동 등록하지 않습니다. 거래 준비 체크리스트 상태는 현재 기기에만 저장됩니다.

## Mock과 미지원 기능

실제 API가 연결된 화면에서는 서버 응답과 Mock 결과를 합쳐 표시하지 않습니다.

현재 남아 있는 Mock은 실행 코드가 직접 사용하는 영역에 한정합니다.

- 홈의 예시 최근 매물
- 비교 UI의 백엔드 미지원 상세 행과 안내 구조
- 거래 준비 화면의 백엔드 미지원 표시 데이터
- `baton001` 개발용 로그인

현재 백엔드에서 제공하지 않는 주요 기능:

- 실제 로그인, 토큰, 세션 및 사용자 인증
- guest 데이터의 계정 이전
- 이미지 업로드와 이미지 단독 분석
- 분석 결과 단건 조회
- 추천 매물
- 위치, 상품 이미지 및 일부 매물 상세 필드
- 시세 최솟값·최댓값과 상태 등급
- 거래 일정, 장소, 결제 정보의 서버 저장
- 비교 화면의 항목별 세부 평가 점수
- 분석·비교 기록 삭제

지원되지 않는 데이터는 임의 생성하지 않고 기존 디자인 영역에 `현재는 미지원하는 기능입니다.` 또는 `지원 예정`으로 표시합니다.

## 프로젝트 구조

```text
app/
  analysis/[analysisId].tsx
  trade/[analysisId].tsx
  analysis-input.tsx
  compare.tsx
  comparison-history.tsx
  home.tsx
  login.tsx
  mypage.tsx
  onboarding.tsx
  recent-analyses.tsx
  saved-listings.tsx
  trade-records.tsx

src/
  components/       화면 공통 컴포넌트
  constants/        테마 상수
  mocks/            현재 UI가 직접 사용하는 제한적 Mock
  repositories/     AsyncStorage 기반 로컬 상태와 캐시
  services/         API client, DTO 및 도메인별 서버 요청
  storage/          로그인 세션과 guest ID
  types/            프론트 화면 모델
  utils/            URL 검증, 분석 초안, 온보딩 저장
```

## 주요 입력 및 예외 처리

- 클립보드 문자열에서 첫 번째 HTTP(S) URL을 추출합니다.
- 클립보드에 유효한 URL이 없어도 빈 링크 입력 화면으로 이동할 수 있습니다.
- 이미지 단독 제출은 서버 미지원 안내를 표시합니다.
- 분석 중에는 중복 제출을 차단합니다.
- 네트워크 오류, timeout, 서버 validation 오류를 구분합니다.
- 기기 safe area를 적용해 하단 버튼이 시스템 내비게이션 영역 아래로 내려가지 않게 합니다.
- 로그인 키보드가 열리면 소개 영역을 접고 로그인 폼을 위로 이동하며 스크롤을 허용합니다.

## 디자인 원칙

- [바톤 공유용 Figma](https://www.figma.com/design/I2LnQwZJQ1VCPd3PkeM8MZ/)를 기준으로 구현합니다.
- 백엔드 연결을 이유로 기존 Figma 레이아웃을 임의로 변경하지 않습니다.
- 데이터가 부족하면 화면 전체를 임시 페이지로 교체하지 않고 해당 영역만 미지원 처리합니다.
- Figma 에셋은 `assets/images`에 저장해 사용하며 만료되는 원격 URL에 의존하지 않습니다.
- 임의의 이모지나 다른 아이콘으로 디자인 에셋을 대체하지 않습니다.

## 검사

```bash
npx tsc --noEmit
npm run lint
npm test
```

Android 번들을 확인하려면 다음 명령을 사용할 수 있습니다.

```bash
npx expo export --platform android
```

수동 통합 테스트 권장 순서:

1. 비회원으로 URL 분석
2. 분석 정보 수정 후 결과 화면 진입
3. 찜 추가·취소 및 목록 갱신 확인
4. 비교함에 2~3개 상품을 추가하고 비교 실행
5. 거래 준비 체크리스트를 선택하고 앱 재실행 후 복원 확인
6. 거래 상태를 선택한 경우에만 거래 내역에 표시되는지 확인
7. `baton001 / 1234` 로그인 후 신규 데이터가 계정 집계에 반영되는지 확인
8. 앱 재실행 후 로그인 유지 및 로그아웃 확인

## 개발 원칙

- `backend/**`는 읽기 전용이며 프론트 작업에서 수정하지 않습니다.
- 프론트 변경은 `frontend/**`로 제한합니다.
- 백엔드 문서와 코드가 충돌하면 실제 구현을 기준으로 연결하고 충돌을 기록합니다.
- 구현되지 않은 API나 응답 필드를 추측하지 않습니다.
- 화면 컴포넌트에서 직접 서버 요청을 작성하지 않습니다.
- API DTO와 UI 모델을 분리합니다.
- 서버 데이터와 Mock 데이터를 혼합하지 않습니다.
- 기존 디자인과 관계없는 UI를 임의로 추가하거나 변경하지 않습니다.
