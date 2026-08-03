# 바톤 (Baton) — 이 가격 맞아요?

중고거래 매물의 링크 하나만 넣으면, 시세가 적정한지·사기 위험은 없는지·물건 상태는 어떤지를 AI가 대신 확인해주는 서비스입니다. 시세 비교, 사기 위험 신호, 신뢰도 점수, 거래 체크리스트까지 한 번에 제공해 중고거래 초심자도 안전하게 거래를 준비할 수 있도록 돕습니다.

- **AI Builder Sprint 2026** (주최: 부산대학교 APPTIVE / 후원: Upstage, 부산대 Anchor 사업단, 부산대 AI융합교육원) 예선 제출 저장소입니다.
- 팀 대표 Fork: [github.com/sorza0678/AI-Builder-Sprint](https://github.com/sorza0678/AI-Builder-Sprint)

## 배포 주소 (심사용)

| 구분 | 주소 |
| --- | --- |
| 프론트엔드 (Web) | https://baton-ai.vercel.app |
| 백엔드 API | https://baton-exc8.onrender.com (`/health`, `/docs`) |
| Android APK 설치 페이지 | https://expo.dev/accounts/yj0602/projects/baton/builds/6baecfec-c12f-44fa-bb3f-af4ff5cdf68f |

> ⚠️ 백엔드는 Render 무료 티어에 배포되어 있습니다. 기본값은 SQLite 파일 DB라 서버가 유휴 상태로 일정 시간 멈췄다가 다시 깨어나거나 재배포되면 그동안 쌓인 계정·기록이 초기화될 수 있습니다. 데모 중 데이터가 사라져 보이면 이 때문이며, 회원가입부터 다시 진행하면 정상 동작합니다.

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
