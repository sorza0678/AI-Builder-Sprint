# 바톤 (Baton)

중고거래 매물 링크를 넣으면 시세가 적정한지, 사기 위험은 없는지, 물건 상태는 어떤지를 대신 확인해주는 모바일 앱입니다. 분석 결과를 바탕으로 현장 확인 체크리스트와 판매자 문의 문구까지 만들어줍니다.

중고 거래는 대부분 휴대폰으로 매물을 보다가 그 자리에서 판단하게 됩니다. 그래서 앱을 기준으로 만들었고, Android와 iOS, 웹을 하나의 코드베이스(Expo / React Native)로 함께 지원합니다. 중고 앱에서 "공유하기"로 복사한 문구를 그대로 붙여넣으면 그 안에서 매물 링크만 뽑아내고, 거래 일시는 각 플랫폼의 기본 날짜 선택기를 씁니다.

AI Builder Sprint 2026 (주최: 부산대학교 APPTIVE / 후원: Upstage, 부산대 Anchor 사업단, 부산대 AI융합교육원) 예선 제출 저장소입니다.

## 배포 주소

앱이 기준이지만, 설치 없이 확인하실 수 있도록 웹도 함께 배포했습니다. 두 곳 모두 같은 백엔드를 쓰고 기능도 동일합니다.

| 구분 | 주소 |
| --- | --- |
| Android 앱 (APK) | https://expo.dev/accounts/yj0602/projects/baton/builds/6baecfec-c12f-44fa-bb3f-af4ff5cdf68f |
| 웹 (설치 없이 바로 확인) | https://baton-ai.vercel.app |
| 백엔드 API | https://baton-exc8.onrender.com (`/health`, `/docs`) |

iOS는 배포에 Apple Developer Program 계정이 필요해 이번 예선에서는 빌드를 올리지 않았습니다. 같은 코드베이스로 동작하며 `npm run ios`로 시뮬레이터에서 확인하실 수 있습니다.

백엔드가 Render 무료 티어라 한동안 요청이 없으면 잠들어 있습니다. 첫 요청은 30초 정도 걸릴 수 있습니다. SQLite 파일 DB를 쓰기 때문에 서버가 재시작되면 계정과 기록이 초기화될 수 있습니다. 로그인이 안 되면 회원가입부터 다시 하시면 됩니다.

## 사용해보기

앱과 웹 모두 첫 화면의 "로그인 없이 둘러보기"로 회원가입 없이 바로 쓸 수 있습니다.

1. 홈 화면 입력창에 중고 매물 URL을 붙여넣고 분석
2. 추출된 상품 정보 확인·수정
3. 분석 결과 확인 (시세 비교, 신뢰도 점수, 위험 신호)
4. 찜 / 비교 / 거래 준비로 이어가기
5. 회원가입하면 게스트로 만든 기록이 계정으로 옮겨집니다

### 지원하는 매물 사이트

매물 페이지를 실제로 읽어오기 때문에 사이트별로 동작이 다릅니다.

| 사이트 | 지원 |
| --- | --- |
| 번개장터 (`bunjang.co.kr`) | 공개 상품 API 사용, 가장 안정적 |
| 당근마켓 (`daangn.com`), 중고나라 (`web.joongna.com`) | JSON-LD 파싱 |
| 네이버 카페 (`cafe.naver.com`) | 미지원. 클라이언트 렌더링이라 수집이 불가능하며, 이 경우 임의 데이터로 채우지 않고 `SCRAPE_FAILED`를 반환합니다 |

### 화면 상태별 확인용 URL

네트워크나 매물 상황과 관계없이 위험 등급별 화면과 에러 처리를 확인하려면 URL에 아래 단어를 넣으면 됩니다. (예: `https://example.com/danger`)

| URL에 포함 | 결과 |
| --- | --- |
| `mock-safe` | 안전 매물 (신뢰도 82) |
| `warning` | 주의 매물 (신뢰도 55) |
| `danger` | 위험 매물 (신뢰도 18) |
| `fail` | 수집 실패 화면 (400 `SCRAPE_FAILED`) |

## 만들게 된 이유와 동작 방식

중고거래를 자주 하지 않는 사람은 이 가격이 적정한지, 사기는 아닌지, 만나서 뭘 확인해야 하는지를 판단하기 어렵습니다. 매물 링크 하나로 그 판단을 대신하는 것이 목표였습니다.

```
매물 URL 수집 → 시세 검색·비교 → 규칙 엔진 점수 산출 → LLM 텍스트 보강 → 체크리스트·문의 문구 생성
```

신뢰도 점수(0~100)와 위험 등급은 규칙 엔진이 계산합니다. LLM은 점수에 관여하지 않고, 매물 설명에서 하자와 누락 구성품, 사기 의심 문구를 뽑아내는 데만 씁니다. 같은 매물이면 항상 같은 점수가 나오도록 하기 위해서입니다.

분석 기록과 찜, 비교, 거래 진행 상태는 계정에 저장돼서 여러 매물을 비교하고 거래를 이어갈 수 있습니다.

## 기술 스택

| 영역 | 스택 |
| --- | --- |
| 앱 | Expo (React Native 0.81, SDK 54), Expo Router, TypeScript |
| 웹 | React Native Web. 앱과 같은 코드베이스에서 빌드 |
| 백엔드 | FastAPI, SQLite / PostgreSQL(Supabase) 이중 지원, Upstage Solar |
| 배포 | 앱 Expo 빌드(APK), 웹 Vercel, 백엔드 Render |
| 인증 | PBKDF2 비밀번호 해시 + HMAC 서명 토큰 (외부 인증 서비스 없이 직접 구현) |

화면은 React Native 컴포넌트와 `StyleSheet`로만 구성했고 웹 전용 HTML/CSS 화면을 따로 두지 않았습니다. 플랫폼마다 입력 방식이 달라야 하는 부분만 `Platform.OS`로 나눕니다.

| | 앱 (Android / iOS) | 웹 |
| --- | --- | --- |
| 거래 일시 입력 | OS 기본 날짜·시간 선택기 | 브라우저 날짜·시간 입력 |
| 링크 붙여넣기 | 클립보드 버튼. 공유 문구에서 URL만 추출 | 동일 |
| 로그인 세션·게스트 기록 | 기기 저장소 | 브라우저 저장소 |

어느 쪽이든 서버에 보내는 거래 일시는 같은 ISO 형식으로 맞춰서, 앱에서 만든 기록을 웹에서 그대로 볼 수 있습니다.

## 로컬 실행

### 실행 환경

| | 요구 사항 |
| --- | --- |
| Python | 3.11 이상 |
| Node.js | 20.19 이상 (Expo SDK 54 요구사항) |
| DB | 설치 불필요. 실행 시 `backend/resale_guard.db` 자동 생성 |
| 외부 API | 없어도 실행됩니다. Upstage 키가 없으면 규칙 엔진만으로 동작하고 점수와 분석은 정상입니다 |

외부 클라우드에 의존하지 않기 때문에 클론 후 아래 명령만으로 바로 띄울 수 있습니다.

### 백엔드 (:8000)

```bash
cd backend
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn app.main:app --reload --port 8000
```

Windows는 `.venv/Scripts/pip`, `.venv/Scripts/python`을 씁니다.

- Swagger: http://localhost:8000/docs
- 상태 확인: `GET /health`
- 테스트: `.venv/bin/python -m pytest tests/ -q`

API 상세는 [backend/README.md](backend/README.md)에 있습니다.

### 앱 / 웹 (:8081)

```bash
cd frontend
npm install
npm start
```

`npm start` 후 터미널의 QR 코드를 Expo Go로 찍으면 실기기에서 바로 볼 수 있습니다. 플랫폼을 지정해 띄우려면 아래를 씁니다.

```bash
npm run android   # Android 에뮬레이터
npm run ios       # iOS 시뮬레이터
npm run web       # 브라우저
```

화면 구성과 서비스 계층 구조는 [frontend/README.md](frontend/README.md)에 있습니다.

## 환경변수

### backend/.env

`.env.example`을 복사해서 씁니다. 전부 비워둬도 로컬에서는 동작합니다.

```env
# 비워두면 SQLite, 채우면 Postgres(Supabase)로 자동 전환
DATABASE_URL=postgresql://user:password@host:6543/dbname?pgbouncer=true

# 없으면 규칙 엔진만으로 동작
UPSTAGE_API_KEY=

# 토큰 서명키. 배포 시에는 반드시 무작위 값을 넣어야 합니다
# python3 -c "import secrets;print(secrets.token_hex(32))"
AUTH_SECRET=

# 1이면 모든 API에 로그인 필수
# AUTH_REQUIRED=1
```

### frontend/.env

```env
EXPO_PUBLIC_API_BASE_URL=https://baton-exc8.onrender.com/
```

로컬 백엔드에 붙일 때는 `.env` 없이도 됩니다. 값이 없으면 웹과 iOS 시뮬레이터는 `http://localhost:8000`, 안드로이드 에뮬레이터는 `http://10.0.2.2:8000`을 자동으로 씁니다. Expo Go로 실기기에서 테스트할 때만 개발 PC의 LAN IP를 직접 지정하면 됩니다.

서버 비밀값은 백엔드에서만 관리합니다. `EXPO_PUBLIC_*` 변수는 앱 번들에 그대로 들어가기 때문에 API 키를 넣지 않습니다.

## AI 활용

개발 전 과정에 Claude Code를 사용했습니다. 에이전트 설정과 작업 지침 파일을 저장소에 포함하고 있습니다.

| 파일 | 내용 |
| --- | --- |
| [backend/AGENTS.md](backend/AGENTS.md), [backend/CLAUDE.md](backend/CLAUDE.md) | 백엔드 작업 지침, API 설계 결정과 발견한 이슈 기록 |
| [backend/.claude/agents/plan.md](backend/.claude/agents/plan.md) | 엔드포인트·스키마 변경 전 설계를 먼저 검토하는 서브에이전트 |
| [backend/.claude/skills/team-conventions](backend/.claude/skills/team-conventions/SKILL.md) | 응답 형식, 에러 처리, 커밋 규칙을 팀과 에이전트가 같이 따르도록 정리한 스킬 |
| [frontend/AGENTS.md](frontend/AGENTS.md), [frontend/CLAUDE.md](frontend/CLAUDE.md) | 프론트엔드 작업 지침. Figma 반영 규칙, API 계약 준수, Mock 데이터 경계 |

주로 이런 작업에 활용했습니다.

- API 응답 확장. 기존 필드는 그대로 두고 새 필드만 추가하는 방식으로 프론트와의 계약을 깨지 않게 했습니다
- 보안 점검. 취약점을 실제로 재현한 뒤 수정했습니다 (남의 매물 데이터 참조, `/analyze`를 통한 내부망 접근, Content-Type 대소문자를 이용한 인증 우회)
- 시세 정확도 개선. 분석 대상 매물이 자기 시세 표본에 섞이는 문제, 다른 세대 모델 혼입, 키워드를 잔뜩 넣은 낚시 매물 필터링
- 버그 원인 규명부터 회귀 테스트 작성, 배포 서버 실측 확인까지

## 저장소 구조

백엔드와 프론트엔드가 한 저장소 안에 폴더로 나뉘어 있습니다.

```
backend/    FastAPI 서버. API, DB, 규칙 엔진, Upstage 연동
frontend/   Expo 앱. Android / iOS / Web 공통 코드
```

Backend A(분석 파이프라인)와 Backend B(서비스·DB)가 같은 FastAPI 앱 안에서 파일과 엔드포인트 단위로 나눠 작업했습니다. 응답 형식과 에러 코드, 커밋 규칙은 [team-conventions](backend/.claude/skills/team-conventions/SKILL.md)에 정리해두고 팀 전체가 따랐습니다.
