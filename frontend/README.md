# 바톤 프론트엔드

중고 거래 상품 링크를 분석하고 가격, 상태, 위험 신호를 확인한 뒤 상품 비교와 거래 준비까지 이어갈 수 있는 Expo 기반 React Native 애플리케이션입니다. Android, iOS, Web을 하나의 코드베이스로 지원합니다.

프론트엔드는 FastAPI 백엔드의 실제 API를 사용합니다. 서버가 제공하지 않는 값은 임의로 생성하지 않으며, 누락되었거나 아직 지원되지 않는 정보는 화면에서 별도로 안내합니다.

## 기술 스택

- React Native 0.81
- React 19
- Expo SDK 54
- Expo Router 6
- TypeScript 5.9
- React Native Web
- AsyncStorage
- `expo-image`, `expo-image-picker`, `expo-clipboard`
- `expo-linear-gradient`, `expo-linking`
- `@react-native-community/datetimepicker`

화면은 React Native 컴포넌트와 `StyleSheet`로 구성하며 웹 전용 HTML/CSS 화면을 별도로 두지 않습니다. 플랫폼별 입력 방식이 필요한 부분만 `Platform.OS`로 분기합니다.

## 실행 방법

### 요구 환경

- Node.js 20.19 이상
- npm
- Android Emulator, iOS Simulator, Expo Go 또는 웹 브라우저
- 접근 가능한 FastAPI 백엔드

### 설치

```bash
cd frontend
npm install
```

### 환경 변수

`.env.example`을 참고해 API 서버 주소를 설정합니다.

```env
EXPO_PUBLIC_API_BASE_URL=https://baton-exc8.onrender.com/
```

로컬 백엔드를 사용할 때의 예시는 다음과 같습니다.

| 실행 환경 | API 주소 예시 |
| --- | --- |
| Web / iOS Simulator | `http://localhost:8000` |
| Android Emulator | `http://10.0.2.2:8000` |
| Expo Go 실기기 | `http://<개발-PC의-LAN-IP>:8000` |

실기기와 개발 PC는 같은 네트워크에 연결되어 있어야 합니다. `UPSTAGE_API_KEY`, `AUTH_SECRET` 등 서버 비밀값은 백엔드에서만 관리하며 `EXPO_PUBLIC_*` 변수에 넣으면 안 됩니다.

환경 변수를 변경한 뒤에는 Metro를 다시 시작해야 합니다.

### 개발 서버

```bash
npm start
```

플랫폼별 실행 명령은 다음과 같습니다.

```bash
npm run android
npm run ios
npm run web
```

## 주요 사용자 흐름

```text
온보딩
  -> 로그인/회원가입 또는 게스트로 계속
  -> 상품 URL 입력
  -> 분석 요청
  -> 추출된 상품 정보 확인 및 수정
  -> 분석 결과 확인
  -> 찜 / 비교 / 거래 준비
  -> 분석·비교·거래 기록 및 마이페이지 확인
```

상품 이미지는 현재 링크 분석 결과의 미리보기 용도로 사용합니다. 프론트엔드에서 이미지를 업로드하거나 이미지 자체를 분석하는 기능은 제공하지 않습니다.

## 화면과 데이터 연결

| 화면 | 경로 | 현재 동작 |
| --- | --- | --- |
| 초기 진입 | `/` | 온보딩 완료 여부에 따라 진입 화면 결정 |
| 온보딩 | `/onboarding` | 최초 실행 안내와 완료 상태 저장 |
| 로그인 | `/login` | 아이디 회원가입·로그인, 인증 세션 저장 |
| 홈 | `/home` | URL 입력, 클립보드 링크 감지, 최근 항목 진입 |
| 분석 입력 | `/analysis-input` | URL 분석 요청 및 상품 정보 확인·수정 |
| 분석 결과 | `/analysis/[analysisId]` | 가격·상태·위험·추천 결과 표시, 찜·비교·거래 준비, 원본 상품 링크 열기 |
| 최근 분석 | `/recent-analyses` | 분석 기록 조회, 거래 준비 상품 선택, 삭제 |
| 찜한 상품 | `/saved-listings` | 찜 목록 조회 및 해제 |
| 비교하기 | `/compare` | 비교 후보 관리, 우선순위별 비교 실행 및 결과 표시 |
| 비교 기록 | `/comparison-history` | 저장된 비교 결과 조회 및 삭제 |
| 거래 준비 | `/trade/[analysisId]` | 체크리스트, 문의 문구, 가격 제안, 진행 상태와 거래 정보 관리 |
| 거래 내역 | `/trade-records` | 서버에 저장된 거래 내역 조회 |
| 마이페이지 | `/mypage` | 계정 정보, 집계, 최근 기록, 추천 상품, 로그아웃 |

### 플랫폼별 동작

- 거래 일시는 Android와 iOS에서 네이티브 날짜/시간 선택기를 사용합니다.
- Web에서는 브라우저에서 동작하는 날짜와 시간 입력을 사용하고 ISO 형식으로 서버에 저장합니다.
- 비교하기의 빈 상태 안내는 Web의 넓은 화면에서 문장이 어색하게 끊기지 않도록 웹 전용 줄바꿈을 적용합니다.
- 분석 결과의 원본 링크 버튼은 `Linking.openURL`을 사용해 입력했던 상품 URL을 엽니다.

## 인증과 사용자 ID

백엔드는 비밀번호 해시와 Bearer 토큰을 사용하는 아이디 인증을 제공합니다.

- 회원가입: `POST /api/v1/auth/signup`
- 로그인: `POST /api/v1/auth/login`
- 게스트 기록 이전: `POST /api/v1/account/migrate-guest`
- 세션 저장: `src/storage/auth-session-storage.ts`
- 게스트 ID 저장: `src/storage/guest-id-storage.ts`

로그인 세션과 게스트 ID는 AsyncStorage에 별도로 저장됩니다. 비회원 상태에서는 기기별 `guest-*` ID를 사용하고, 로그인 또는 회원가입에 성공하면 이전 게스트 기록을 계정으로 이전하도록 요청합니다.

로그아웃은 현재 인증 세션을 삭제합니다. 과거 API 사용으로 생성된 비밀번호 없는 사용자 행은 일반 로그인 계정이 아니므로 로그인할 수 없습니다. 또한 서버는 보안을 위해 계정 없음, 비밀번호 불일치, 비밀번호 해시 없음 등의 경우를 모두 `LOGIN_FAILED`로 반환할 수 있습니다.

개발 편의를 위한 `baton001` / `1234` 로그인은 프론트엔드의 제한된 호환 경로이며 실제 배포 계정 인증을 대신하지 않습니다.

## API 연결 구조

모든 서버 요청은 `src/services`를 통합니다.

```text
화면 또는 컴포넌트
  -> 도메인 service
  -> 공통 api-client
  -> FastAPI /api/v1
```

`src/services/api-client.ts`의 공통 처리 항목은 다음과 같습니다.

- `EXPO_PUBLIC_API_BASE_URL` 적용
- 로그인 세션이 있으면 Authorization 헤더 첨부
- JSON 요청 헤더 설정
- 30초 요청 timeout
- 네트워크 오류와 timeout 구분
- `{ ok, data, error }` 응답 envelope 해석
- 서버 오류 코드와 메시지를 보존하는 `ApiError`

서비스별 역할은 다음과 같습니다.

| 서비스 | 역할 |
| --- | --- |
| `analysis-service.ts` | 분석 요청, 단건 조회·삭제, API DTO 변환, 상세 캐시 |
| `history-service.ts` | 분석 기록 및 pagination |
| `bookmark-service.ts` | 찜 추가·해제·목록 |
| `comparison-service.ts` | 비교 후보 관리, 비교 실행, 비교 기록 조회 |
| `trade-service.ts` | 체크리스트, 문의 문구, 가격 제안, 거래 상태와 상세 정보 |
| `checklist-state-service.ts` | 체크리스트 체크·제외 상태 동기화 |
| `mypage-service.ts` | 계정 정보와 마이페이지 집계 |
| `recommendation-service.ts` | 기록 기반 추천 상품 |
| `listing-service.ts` | 사용자가 확인·수정한 상품 상세 저장 |
| `auth-service.ts` | 회원가입, 로그인, 게스트 기록 이전 |

백엔드 DTO는 `src/services/api-types.ts`, 화면 모델은 `src/types/marketplace.ts`에 분리되어 있습니다.

## 거래 준비와 거래 상태

거래 준비 화면은 다음 서버 상태를 사용합니다.

```ts
stage: 'BEFORE_CONTACT' | 'CONTACTING' | 'SCHEDULED' | 'COMPLETED'
decision: 'CONSIDERING' | 'HOLD' | 'EXCLUDED' | null
meeting_at: string | null
meeting_place: string | null
trade_method: 'IN_PERSON' | 'DELIVERY' | null
memo: string | null
payment_method: string | null
```

사용자가 거래 상태를 선택해야 거래 내역에 표시됩니다. 상태나 판단만 변경하더라도 기존 일정, 장소, 방식, 메모, 결제 수단이 사라지지 않도록 화면이 현재 전체 상태를 함께 전송합니다.

거래 내역과 최근 분석 화면은 로딩 실패를 화면 상태로 처리합니다. API 오류를 렌더링 단계까지 전파해 Expo 오류 화면으로 전환하지 않습니다.

## 데이터 저장 위치

### 서버

- 분석 결과와 분석 기록
- 찜 목록
- 비교 후보와 비교 결과 snapshot
- 거래 단계, 판단, 일정, 장소, 방식, 메모, 결제 수단
- 거래 준비 체크리스트 상태
- 계정 정보와 마이페이지 집계
- 비밀번호 해시와 인증 관련 사용자 정보

### 기기 로컬 저장소

- 인증 세션
- 게스트 ID
- 분석 상세 조회 보조 캐시
- 사용자가 수정한 일부 표시 정보
- 현재 거래 준비 대상으로 선택한 상품 ID
- 온보딩 완료 상태

서버 데이터와 로컬 캐시는 역할이 다릅니다. 로컬 캐시는 서버 응답을 임의의 mock 데이터로 대체하지 않습니다.

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
  components/       화면 및 공통 컴포넌트
  constants/        테마와 공통 상수
  mocks/            제한적으로 사용하는 UI 보조 데이터
  repositories/     AsyncStorage 기반 캐시와 선택 상태
  services/         API client, DTO, 도메인별 서버 요청
  storage/          인증 세션과 게스트 ID
  types/            화면 도메인 모델
  utils/            URL 검증, 분석 초안, 위험 수준 매핑
```

## 검증

```bash
npx tsc --noEmit
npm run lint
npm test
```

플랫폼 번들까지 확인하려면 다음 명령을 사용할 수 있습니다.

```bash
npx expo export --platform web
npx expo export --platform android
```

주요 수동 확인 항목:

1. 게스트 상태에서 URL을 분석하고 결과 화면에 진입할 수 있는지 확인합니다.
2. 추출된 상품 정보를 수정한 뒤 결과와 기록에 반영되는지 확인합니다.
3. 분석 결과에서 원본 링크, 찜, 비교, 거래 준비 버튼을 확인합니다.
4. 비교 후보 2개 이상으로 각 우선순위 비교를 실행합니다.
5. 거래 준비 체크리스트 상태가 화면 재진입 후에도 유지되는지 확인합니다.
6. Web과 앱에서 거래 일시를 입력하고 다시 불러올 수 있는지 확인합니다.
7. 거래 단계를 선택한 항목만 거래 내역에 나타나는지 확인합니다.
8. 회원가입 후 게스트 기록이 계정으로 이전되는지 확인합니다.
9. 로그아웃 후 실제 가입 계정으로 다시 로그인할 수 있는지 확인합니다.
10. 분석·비교 기록 삭제와 API 실패 상태가 정상적으로 표시되는지 확인합니다.

## 디자인 원칙

- [바톤 공유 Figma](https://www.figma.com/design/I2LnQwZJQ1VCPd3PkeM8MZ/)를 기준으로 구현합니다.
- API 연결을 이유로 기존 화면 구조와 시각 언어를 임의로 변경하지 않습니다.
- 데이터가 없으면 전체 화면을 대체하지 않고 해당 영역에 빈 상태나 오류 상태를 표시합니다.
- Figma 자산은 `assets/images`에 저장해 사용합니다.
- 서버가 제공하지 않는 필드는 임의 값으로 채우지 않습니다.
