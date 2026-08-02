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
- `@react-native-community/datetimepicker` (거래 준비 화면의 거래 일시 입력)
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
  → 홈 또는 로그인/회원가입
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
| 로그인 | `/login` | 실제 회원가입/로그인 API 연결 (guest 데이터 자동 이전 포함) |
| 홈 | `/home` | 입력 UI, 일부 최근 매물 Mock 유지 |
| 분석 입력 | `/analysis-input` | URL 분석 API 연결 |
| 분석 정보 확인 | `AnalysisConfirmSheet` | 분석값 표시, 사용자 수정 및 저장 |
| 분석 결과 | `/analysis/[analysisId]` | 분석 단건 조회 API 연결 (로컬 캐시는 보조 fallback), 시세 범위·구조화 위험신호 일부·상태 등급·판매자 설명 표시 |
| 최근 분석 | `/recent-analyses` | history API 연결, 스와이프로 삭제(soft delete) |
| 찜 목록 | `/saved-listings` | bookmark API 연결 |
| 비교 | `/compare` | comparison 목록, compare API, 구조화 위험신호 탭 확장, 거래 방식 표시 |
| 비교 기록 | `/comparison-history` | comparison-history API 연결, 스와이프로 삭제 |
| 거래 준비 | `/trade/[analysisId]` | checklist(구조화 groups), inquiry-script(구조화 questions), price-proposal, transaction(단계·판단·일정·장소·방식·메모·결제수단), checklist-state(체크 상태 서버 동기화) API 연결 |
| 거래 내역 | `/trade-records` | transaction API 연결 |
| 마이페이지 | `/mypage` | 계정 정보(닉네임), 실제 집계, 최근 분석 기록, 추천 매물 |

## 로그인과 사용자 ID

백엔드에 실제 회원가입/로그인, 비밀번호 해시 저장, Bearer 토큰 인증이 구현되어 있습니다.

- `POST /api/v1/auth/signup`, `POST /api/v1/auth/login`으로 계정을 만들고 로그인합니다 (`src/services/auth-service.ts`).
- 로그인 성공 시 토큰이 `AsyncStorage`에 저장되어 앱을 다시 실행해도 유지됩니다 (`src/storage/auth-session-storage.ts`).
- 로그인 상태에서는 API의 `user_id`로 로그인한 계정 id를 사용합니다.
- 비회원 상태에서는 기기에 생성한 `guest-*` ID를 사용합니다.
- **로그인/회원가입 성공 시 이전 guest ID의 분석·찜·비교·거래 기록이 자동으로 계정에 이전됩니다** (`POST /api/v1/account/migrate-guest` 호출).
- 로그아웃하면 로그인 세션만 삭제되고 기기의 guest ID는 새로 발급됩니다.
- 토큰 없이 요청하면 서버가 데모 모드로 동작(클라이언트가 보낸 `user_id`를 신뢰)하지만, 프론트는 로그인 상태에서 항상 토큰을 함께 보냅니다.

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
- Authorization 헤더 자동 첨부(로그인 상태일 때)
- JSON Content-Type 설정
- 30초 timeout
- 네트워크 오류와 timeout 구분
- `{ ok, data, error }` envelope 해석
- 서버 `error.code`를 보존하는 `ApiError`

연결된 서비스:

- `analysis-service.ts`: 분석 요청/단건 조회/삭제, API DTO → 화면 모델 변환, 상세 캐시
- `history-service.ts`: 분석 기록 및 pagination
- `bookmark-service.ts`: 찜 추가·삭제·목록
- `comparison-service.ts`: 비교함 추가·삭제·목록, compare 요청, 비교 기록 조회
- `trade-service.ts`: 체크리스트, 문의 스크립트, 가격 제안, 거래 상태(일정·장소·방식·메모·결제수단 포함) 저장·조회
- `checklist-state-service.ts`: 거래 준비 체크리스트의 체크·제외 상태 서버 동기화
- `mypage-service.ts`: 계정별 집계
- `recommendation-service.ts`: 분석·찜 기록 기반 추천 매물
- `listing-service.ts`: 확인 화면에서 수정한 매물 상세 정보 저장 및 현재 홈 매물 경계
- `auth-service.ts`: 회원가입/로그인, guest 데이터 계정 이전

백엔드 DTO는 `src/services/api-types.ts`, 화면 모델은 `src/types/marketplace.ts`에서 분리합니다. API의 snake_case 응답을 화면에서 직접 추측하지 않습니다.

## 데이터 저장 위치

### 서버 데이터

- 분석 결과와 분석 기록(soft delete 지원)
- 찜 목록
- 비교 목록과 비교 실행 기록(snapshot 보존)
- 거래 단계·판단·일정·장소·방식·메모·결제수단
- 거래 준비 체크리스트의 체크·제외 상태
- 마이페이지 집계 및 계정 정보(닉네임)
- 추천 매물 근거
- 분석 후 수정한 매물 정보 중 백엔드가 지원하는 필드
- 계정(비밀번호 해시), 로그인 토큰 발급 이력

### 기기 로컬 데이터

- guest ID
- 로그인 세션(토큰)
- 단건 조회 API를 보완하는 분석 상세 캐시(오프라인/API 실패 시 fallback)
- 사용자가 수정한 일부 표시 정보
- 거래 준비 화면에서 선택한 거래 방식(직거래/택배/미정 — 체크리스트 탭 전용, 서버 필드 아님)
- 거래 준비 대상으로 사용자가 직접 선택한 상품 ID
- 온보딩 완료 상태

## 거래 상태

프론트와 백엔드에서 사용하는 거래 상태는 다음과 같습니다.

```ts
stage: 'BEFORE_CONTACT' | 'CONTACTING' | 'SCHEDULED' | 'COMPLETED'
decision: 'CONSIDERING' | 'HOLD' | 'EXCLUDED' | null
meeting_at: string | null
meeting_place: string | null
trade_method: 'IN_PERSON' | 'DELIVERY' | null
memo: string | null
payment_method: string | null
```

사용자가 거래 상태를 선택하지 않으면 거래 내역에 자동 등록하지 않습니다. 저장은 매번 전체 필드를 함께 보내는 방식이라(생략 시 서버가 `NULL`로 리셋), 스테이지·판단 버튼만 눌러도 이전에 저장한 일정/장소/메모가 사라지지 않도록 화면이 항상 현재 상태 전체를 함께 전송합니다.

## Mock과 미지원 기능

실제 API가 연결된 화면에서는 서버 응답과 Mock 결과를 합쳐 표시하지 않습니다.

현재 남아 있는 Mock은 실행 코드가 직접 사용하는 영역에 한정합니다.

- 홈의 예시 최근 매물
- 비교 UI의 백엔드 미지원 상세 행과 안내 구조(항목별 세부 평가 점수 등)

현재 백엔드에서 제공하지 않아 프론트도 지원하지 않는 것:

- 이미지 업로드와 이미지 단독 분석
- 상품 이미지 갤러리, 카테고리 표시, 매물 등록 시각, 판매자 프로필 링크 (백엔드 응답엔 있지만 화면에 표시할 자리가 아직 없어 연결 보류 — 디자인 확정 필요)
- 문의 질문의 "꼭 물어볼 질문/추가로 확인하면 좋은 질문" 구분(백엔드에 필수 여부 필드가 없어 전부 첫 그룹으로 표시)
- 가격 제안의 협상 가능 범위(min/max) 전용 UI(현재는 "이 가격을 제안한 이유" 카드에 텍스트로만 노출)

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
  utils/            URL 검증, 분석 초안, 온보딩 저장, risk_level 매핑
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
- Figma 스펙이 없는 새 데이터(매물 이미지 갤러리 등)는 화면에 임의로 새 UI를 만들지 않고 미연결 상태로 남깁니다.

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
5. 거래 준비 체크리스트를 선택하고 앱 재실행 후 복원 확인(서버 동기화)
6. 거래 준비 "진행" 탭에서 일정·장소·방식·메모·결제수단을 저장하고, 이후 단계 버튼만 눌러도 값이 유지되는지 확인
7. 거래 상태를 선택한 경우에만 거래 내역에 표시되는지 확인
8. 회원가입 후 guest로 만들어둔 기록이 계정으로 이전되는지 확인
9. 앱 재실행 후 로그인 유지 및 로그아웃 확인
10. 분석 기록·비교 기록을 스와이프로 삭제하고 목록에서 사라지는지 확인

## 개발 원칙

- `backend/**`는 읽기 전용이며 프론트 작업에서 수정하지 않습니다.
- 프론트 변경은 `frontend/**`로 제한합니다.
- 백엔드 문서와 코드가 충돌하면 실제 구현을 기준으로 연결하고 충돌을 기록합니다.
- 구현되지 않은 API나 응답 필드를 추측하지 않습니다.
- 화면 컴포넌트에서 직접 서버 요청을 작성하지 않습니다.
- API DTO와 UI 모델을 분리합니다.
- 서버 데이터와 Mock 데이터를 혼합하지 않습니다.
- 기존 디자인과 관계없는 UI를 임의로 추가하거나 변경하지 않습니다.
