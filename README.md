# 바톤 (Baton)

**"이 가격 맞아요?"** — 중고거래 매물의 링크 하나만 넣으면, 시세가 적정한지·사기 위험은 없는지·물건 상태는 어떤지를 AI가 대신 확인해주는 서비스입니다. 시세 비교, 사기 위험 신호, 신뢰도 점수, 거래 체크리스트까지 한 번에 제공해 중고거래 초심자도 안전하게 거래를 준비할 수 있도록 돕습니다.

- **AI Builder Sprint 2026** (주최: 부산대학교 APPTIVE / 후원: Upstage, 부산대 Anchor 사업단, 부산대 AI융합교육원) 예선 제출 저장소입니다.
- 팀 대표 Fork: [github.com/sorza0678/AI-Builder-Sprint](https://github.com/sorza0678/AI-Builder-Sprint)

## 배포 주소 (심사용)

| 구분 | 주소 |
| --- | --- |
| 프론트엔드 (Web) | https://baton-ai.vercel.app |
| 백엔드 API | https://baton-exc8.onrender.com (`/health`, `/docs`) |
| Android APK 설치 페이지 | https://expo.dev/accounts/yj0602/projects/baton/builds/6baecfec-c12f-44fa-bb3f-af4ff5cdf68f |

> ℹ️ 백엔드는 Render 무료 티어라 **한동안 요청이 없으면 잠들었다가 다시 깨어납니다.** 첫 요청이 30초 정도 걸릴 수 있으니 잠시 기다려 주세요. 또한 파일 기반 SQLite를 쓰고 있어 서버 재시작 시 그동안 쌓인 계정·기록이 초기화될 수 있습니다(분석 기능 자체는 영향 없음). 로그인이 안 되면 회원가입부터 다시 진행하면 됩니다.

## 빠른 체험 가이드 (심사용)

**웹에서 바로 써보기** → https://baton-ai.vercel.app

1. 첫 화면에서 **"로그인 없이 둘러보기"** 를 누르면 회원가입 없이 바로 사용할 수 있습니다.
2. 홈 화면의 입력창에 중고 매물 URL을 붙여넣고 분석을 실행합니다.
3. 추출된 상품 정보를 확인·수정한 뒤 분석 결과(시세 비교·신뢰도 점수·위험 신호)를 봅니다.
4. 결과 화면에서 **찜 / 비교 / 거래 준비**로 이어갈 수 있습니다. 거래 준비에서는 현장 확인 체크리스트, 판매자 문의 문구, 가격 제안을 제공합니다.
5. 회원가입 후 로그인하면 게스트로 만든 기록이 계정으로 자동 이전됩니다.

**실제 매물 URL로 테스트할 때** — 매물 페이지를 실제로 수집하므로 아래 플랫폼 링크를 사용해 주세요.

| 플랫폼 | 지원 |
| --- | --- |
| 번개장터 (`bunjang.co.kr`) | ✅ 가장 안정적 (공개 상품 API 사용) |
| 당근마켓 (`daangn.com`) · 중고나라 (`web.joongna.com`) | ✅ JSON-LD 파싱 |
| 네이버 카페 (`cafe.naver.com`) | ❌ 클라이언트 렌더링 SPA라 수집 불가 — 가짜 데이터로 넘어가지 않고 정직하게 `SCRAPE_FAILED` 반환 |

**네트워크 상황과 무관하게 각 UI 상태를 확인하려면** — URL에 아래 단어를 포함하면 고정 응답이 나옵니다 (예: `https://example.com/danger`). 실제 분석 파이프라인 검증용이 아니라 **위험 등급별 화면과 예외 처리를 재현**하기 위한 개발용 트리거입니다.

| URL에 포함 | 결과 |
| --- | --- |
| `mock-safe` | 안전 매물 (신뢰도 82, SAFE) |
| `warning` | 주의 매물 (신뢰도 55, WARNING) |
| `danger` | 위험 매물 (신뢰도 18, DANGER) |
| `fail` | 수집 실패 에러 화면 (400 `SCRAPE_FAILED`) |

## 문제 정의와 솔루션

중고거래를 처음 하거나 자주 하지 않는 사람은 "이 가격이 적정한지", "이 매물이 사기는 아닌지", "실제로 만나서 뭘 확인해야 하는지"를 판단하기 어렵습니다. 바톤은 매물 URL 하나로 이 판단을 대신해줍니다.

1. 매물 URL 입력 → 실제 페이지를 수집(스크래핑)
2. 같은 매물 시세를 검색해 평균가·최저가·최고가 비교
3. 결정론적 규칙 엔진으로 신뢰도 점수(0~100)와 위험 등급 산출 (LLM이 점수를 매기지 않음 — 재현성 보장)
4. Upstage Solar LLM으로 하자·누락 구성품·사기 의심 문구를 텍스트로 보강
5. 현장 확인 체크리스트, 판매자 문의 문구, 가격 제안까지 자동 생성
6. 분석 기록·찜·비교·거래 진행 상태를 계정에 저장해 여러 매물을 비교하고 거래를 이어갈 수 있음

## 기술 스택

| | 스택 |
| --- | --- |
| 백엔드 | FastAPI, SQLite/PostgreSQL(Supabase) 이중 지원, Upstage Solar LLM |
| 프론트엔드 | Expo(React Native 0.81, SDK 54), Expo Router, TypeScript, React Native Web |
| 배포 | 백엔드: Render / 프론트엔드: Vercel(Web) + Expo(APK) |
| 인증 | PBKDF2 비밀번호 해시 + HMAC 서명 Bearer 토큰 (자체 구현, 외부 인증 서비스 없음) |

## 로컬 실행 가이드

### 실행 환경

| | 요구 버전 | 비고 |
| --- | --- | --- |
| Python | 3.11 이상 | 개발·검증 환경 3.11.5 |
| Node.js | 20.19 이상 | Expo SDK 54 요구사항 |
| DB | 별도 설치 불필요 | 기본값 SQLite, 실행 시 `backend/resale_guard.db` 자동 생성 |
| 외부 API | 없어도 실행됨 | Upstage 키가 없으면 Rule Engine만으로 동작 (분석·점수 정상) |

> 로컬 실행에 **외부 클라우드 의존성이 없습니다.** DB는 SQLite 자동 생성이고, Upstage API 키가 없어도 서비스 전체가 동작합니다(LLM 텍스트 보강만 생략). 저장소를 클론한 뒤 아래 명령만으로 바로 기동됩니다.

### 백엔드 (FastAPI, :8000)

```bash
cd backend
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn app.main:app --reload --port 8000
```

- Swagger: http://localhost:8000/docs
- 상태 확인: `GET /health`
- 테스트: `.venv/bin/python -m pytest tests/ -q`

Windows는 `.venv/Scripts/pip`, `.venv/Scripts/python`을 사용합니다. 상세 API 계약은 [backend/README.md](backend/README.md) 참고.

### 프론트엔드 (Expo, :8081)

```bash
cd frontend
npm install
npm start          # 또는 npm run web / npm run android / npm run ios
```

상세 화면 구성·서비스 계층 구조는 [frontend/README.md](frontend/README.md) 참고.

## 환경변수

### `backend/.env` (`.env.example` 참고)

```env
# 비워두면 SQLite(로컬 개발/테스트 기본값), 채우면 Postgres(Supabase)로 자동 전환
DATABASE_URL=postgresql://user:password@host:6543/dbname?pgbouncer=true

# Upstage Solar API 키 — 없으면 Rule Engine만으로 동작 (심사용 키는 주최측 보유분 사용 가능)
UPSTAGE_API_KEY=

# 토큰 서명키 — 배포 시 반드시 무작위 값으로 채울 것: python3 -c "import secrets;print(secrets.token_hex(32))"
AUTH_SECRET=

# 1이면 전체 API에 로그인(Bearer 토큰) 필수
# AUTH_REQUIRED=1
```

### `frontend/.env` (`.env.example` 참고)

```env
EXPO_PUBLIC_API_BASE_URL=https://baton-exc8.onrender.com/
```

**로컬 백엔드에 붙일 때는 `.env` 없이도 동작합니다** — 값이 없으면 자동으로 `http://localhost:8000`(Android 에뮬레이터는 `http://10.0.2.2:8000`)을 사용합니다. 실기기(Expo Go)에서 테스트할 때만 개발 PC의 LAN IP로 지정해 주세요.

| 실행 환경 | 자동 기본값 |
| --- | --- |
| Web / iOS 시뮬레이터 | `http://localhost:8000` |
| Android 에뮬레이터 | `http://10.0.2.2:8000` |
| Expo Go 실기기 | 직접 지정 필요 (`http://<개발-PC-LAN-IP>:8000`) |

`UPSTAGE_API_KEY`, `AUTH_SECRET` 등 서버 비밀값은 백엔드에서만 관리하며 `EXPO_PUBLIC_*` 변수에 넣지 않습니다 (앱 번들에 그대로 노출되기 때문).

## AI 활용 증빙

이 프로젝트는 개발 전 과정(설계 검토·구현·버그 수정·보안 점검·테스트 작성)에 **Claude Code**를 코딩 에이전트로 사용했습니다. 관련 설정·지침 파일을 저장소에 포함하고 있습니다.

- [backend/AGENTS.md](backend/AGENTS.md) / [backend/CLAUDE.md](backend/CLAUDE.md) — 백엔드 작업 지침, API 설계 결정, 발견한 이슈와 해결 과정 기록
- [backend/.claude/agents/plan.md](backend/.claude/agents/plan.md) — 신규 엔드포인트/스키마 변경 시 설계를 먼저 검토하는 서브에이전트
- [backend/.claude/skills/team-conventions/](backend/.claude/skills/team-conventions/SKILL.md) — 공통 응답 형식·에러 처리·커밋 컨벤션을 에이전트가 일관되게 따르도록 만든 스킬
- [frontend/AGENTS.md](frontend/AGENTS.md) / [frontend/CLAUDE.md](frontend/CLAUDE.md) — 프론트엔드 작업 지침 (Figma 반영 규칙, 백엔드 API 계약 준수, Mock 데이터 경계 등)

**Claude Code로 수행한 주요 작업**:

- 프론트 요구사항 문서 12~18번 항목을 additive하게 구현 (기존 API 응답 필드 무변경, 신규 필드만 추가)
- 어드버세리얼 리뷰 방식으로 실제 취약점 재현 후 수정: IDOR(남의 매물 데이터 참조), SSRF(`/analyze`로 내부망 접근), 인증 우회(Content-Type 대소문자로 신원 대조 회피) 등
- 시세 정확도 개선 — 자기 매물 자기 시세 표본 포함, 다른 모델 세대 혼입, 키워드 스터핑(가격 낚시) 매물 필터링
- 거래내역 500 오류 원인 규명(타임존 이중 표기)부터 회귀 테스트 작성, 배포 서버 실측 검증까지 전체 사이클
- 위 과정에서 발견한 결함·수정 근거·재현 명령을 각 커밋 메시지와 `AGENTS.md`에 기록

## 프로젝트 구조

이 저장소는 워크스페이스 루트이며, 백엔드와 프론트엔드가 한 저장소 안에서 폴더로 분리되어 있습니다.

```text
backend/    FastAPI 서비스 — API, DB, Rule Engine, Upstage 연동 (상세: backend/README.md, backend/AGENTS.md)
frontend/   Expo React Native 앱 — Android/iOS/Web 공통 코드 (상세: frontend/README.md, frontend/AGENTS.md)
```

## 팀 개발 방식

- Backend A(AI 분석 파이프라인)·Backend B(서비스·DB)가 같은 FastAPI 앱 안에서 파일/엔드포인트 단위로 작업을 분담했습니다.
- 공통 응답 형식(`{ ok, data, error }`), 에러 코드, 커밋 컨벤션은 [backend/.claude/skills/team-conventions](backend/.claude/skills/team-conventions/SKILL.md)에 문서화되어 팀 전체와 에이전트가 동일하게 따릅니다.
- 프론트엔드는 백엔드 API 계약이 확정된 부분만 연결하고, 아직 없는 기능은 임의로 추측해 만들지 않습니다 (`frontend/AGENTS.md` "Backend and Mock Boundaries" 참고).
