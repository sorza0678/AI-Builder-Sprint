# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v54.0.0/ before writing any code.

IMPORTANT: Create pull requests and issues against the forked repository, and push all commits only to branches in the forked repository. Do not create or push anything to the original parent repository.

````md
# AGENTS.md

## Project Overview

이 프로젝트는 중고 매물의 링크 또는 이미지를 입력하면 가격 적정성, 물품 상태, 위험 신호, 거래 체크리스트를 제공하는 모바일 애플리케이션입니다.

프론트엔드는 React Native, Expo, TypeScript를 사용합니다.

현재 단계에서는 디자인과 백엔드 API가 확정되지 않았으므로, 프론트엔드 화면 구조와 Mock 데이터 기반 사용자 흐름을 우선 구현합니다.

---

## Tech Stack

- React Native
- Expo
- TypeScript
- 프로젝트에 이미 설정된 네비게이션 방식
  - Expo Router 또는 React Navigation 중 현재 저장소에서 사용 중인 것만 사용
- 프로젝트에 이미 설정된 스타일링 방식

새 라이브러리를 도입하기 전에 반드시 기존 의존성과 구현 방식을 확인합니다.

---

## Development Principles

1. 기존 프로젝트 구조와 코딩 컨벤션을 우선합니다.
2. 요구되지 않은 대규모 리팩터링을 하지 않습니다.
3. 기존 파일을 불필요하게 삭제하거나 이름을 변경하지 않습니다.
4. 새로운 패키지를 임의로 설치하지 않습니다.
5. 이미 설치된 라이브러리와 공통 컴포넌트를 우선 재사용합니다.
6. 디자인이 확정되기 전까지 세부 시각 디자인보다 기능 구조와 사용자 흐름을 우선합니다.
7. 실제 백엔드가 연결되기 전까지 Mock 데이터와 서비스 계층을 사용합니다.
8. 화면 컴포넌트가 Mock 데이터 파일을 직접 참조하지 않도록 합니다.
9. 이후 API 교체가 쉽도록 데이터 접근 로직을 서비스 계층에 분리합니다.
10. 구현 범위를 벗어난 기능을 추측하여 추가하지 않습니다.

---

## Current User Flow

현재 구현 대상 사용자 흐름은 다음과 같습니다.

1. 온보딩
2. 소셜 로그인
3. 홈
4. 분석 전 정보 확인 바텀시트
5. 분석 결과
6. 비교
7. 거래 준비
8. 마이페이지

현재 실제 인증과 분석 API는 연결하지 않습니다.

---

## Screen Responsibilities

### Onboarding

- 서비스 소개
- 로그인 화면으로 이동
- 복잡한 캐러셀이나 애니메이션은 현재 구현하지 않음

### Login

- 카카오 로그인 버튼
- 네이버 로그인 버튼
- 구글 로그인 버튼
- 현재는 Mock 로그인 처리
- 실제 인증 연동 위치에는 TODO를 남김

### Home

- 매물 URL 입력
- URL 유효성 검사
- 클립보드 붙여넣기
- 이미지 선택 및 미리보기
- 최근 분석 내역
- 저장한 매물 일부
- 분석 시작

URL 또는 이미지 중 최소 하나가 있어야 분석을 시작할 수 있습니다.

### Analysis Confirmation

- 홈 화면 위에 바텀시트로 표시
- 추출된 매물 정보 확인
- 정보 수정
- Mock 분석 결과 화면으로 이동

### Analysis Result

- 매물 기본 정보
- 가격 적정성
- 시세 범위
- 상태 등급
- 위험도
- 주요 하자
- 주의 신호
- 정보 부족 항목
- 거래 체크리스트
- 비교 및 거래 준비 화면으로 이동

### Compare

- 매물 2~3개 비교
- 모바일에서 읽기 어려운 넓은 표 사용 금지
- 항목별 카드 또는 세로형 비교 UI 사용

### Trade Preparation

- 판매자에게 물어볼 질문
- 거래 체크리스트
- 직거래 및 택배 거래 주의사항
- 거래 상태 관리
- 현재 거래 상태는 로컬 화면 상태로만 관리

### My Page

- 사용자 Mock 정보
- 분석 기록
- 저장한 매물
- 거래 준비 중인 매물
- 통계 요약
- 설정
- 로그아웃

찜 목록은 별도 메인 화면이 아니라 마이페이지 내부의 저장한 매물 영역으로 구성합니다.

---

## Navigation Rules

1. 저장소에서 이미 사용하는 네비게이션 방식만 사용합니다.
2. Expo Router와 React Navigation을 동시에 도입하지 않습니다.
3. 동적 라우트 파라미터가 없는 경우와 잘못된 경우를 처리합니다.
4. 화면 이름과 경로를 임의로 중복 생성하지 않습니다.
5. 기존 라우트 구조가 있다면 최소 변경으로 확장합니다.

예상 화면:

- Onboarding
- Login
- Home
- Analysis Result
- Compare
- Trade Preparation
- My Page

실제 파일명과 경로는 기존 저장소 구조를 따릅니다.

---

## TypeScript Rules

1. `any`를 사용하지 않습니다.
2. 공통 데이터 모델은 별도 타입 파일에 정의합니다.
3. 컴포넌트 Props 타입을 명시합니다.
4. 라우트 파라미터 타입을 명시합니다.
5. 비동기 함수 반환 타입을 명확히 합니다.
6. nullable 또는 optional 값은 화면에서 안전하게 처리합니다.
7. 불필요한 type assertion을 피합니다.
8. 타입 오류를 숨기기 위한 `@ts-ignore`를 사용하지 않습니다.

---

## Data Model Guidelines

다음 데이터 모델을 기준으로 구현합니다.

### Listing

- id
- title
- platform
- imageUrl
- sourceUrl
- price
- modelName
- year
- sizeOrCapacity
- color
- usagePeriod
- components
- defects
- sellerDescription
- saved

### AnalysisResult

- id
- listing
- marketPrice
  - min
  - average
  - max
- priceGrade
- conditionGrade
- riskLevel
- warningSignals
- missingInformation
- tradeChecklist
- sellerQuestions
- analyzedAt

### Status Types

PriceGrade:

- GOOD
- FAIR
- EXPENSIVE

ConditionGrade:

- A
- B
- C
- D

RiskLevel:

- LOW
- MEDIUM
- HIGH

TradeStatus:

- INTERESTED
- CONTACTED
- SCHEDULED
- COMPLETED
- CANCELED

필드 이름은 기존 프로젝트 컨벤션과 충돌할 경우 조정할 수 있지만, 의미를 임의로 변경하지 않습니다.

---

## Mock Data Rules

1. Mock 데이터는 화면 컴포넌트 내부에 작성하지 않습니다.
2. Mock 데이터는 별도 `mocks` 디렉터리에 둡니다.
3. 화면은 Mock 파일을 직접 import하지 않습니다.
4. 화면은 서비스 함수를 통해 데이터를 조회합니다.
5. 서비스 함수는 Promise를 반환합니다.
6. 로딩, 성공, 실패 상태를 처리합니다.
7. Mock 매물은 최소 3개를 구성합니다.
8. 매물마다 가격, 상태, 위험도, 하자, 저장 여부가 다르게 보이도록 합니다.

권장 구조:

```text
src/
  mocks/
  services/
  types/
  components/
  screens/
```
````

단, 실제 저장소 구조가 다르면 기존 구조를 따릅니다.

---

## React Native Rules

1. HTML 태그를 사용하지 않습니다.
2. 웹 전용 API와 CSS를 사용하지 않습니다.
3. React Native 기본 컴포넌트 또는 기존 설치 라이브러리를 사용합니다.
4. 긴 화면은 `ScrollView` 또는 `FlatList`로 처리합니다.
5. 불필요하게 `ScrollView`를 중첩하지 않습니다.
6. 안전 영역을 고려합니다.
7. 키보드가 입력창을 가리지 않도록 처리합니다.
8. Pressable 영역은 충분한 터치 크기를 확보합니다.
9. 이미지 URI 누락과 로드 실패를 처리합니다.
10. 고정 화면 크기에 의존하지 않습니다.
11. 지원되지 않는 `StyleSheet` 속성을 사용하지 않습니다.
12. `Platform.OS` 분기는 실제로 필요한 경우에만 사용합니다.
13. 최종 코드에 디버깅용 `console.log`를 남기지 않습니다.

---

## Expo Package Rules

다음 기능은 패키지가 이미 설치된 경우에만 사용합니다.

### Clipboard

- `expo-clipboard`가 설치되어 있으면 사용
- 설치되어 있지 않으면 패키지를 임의 설치하지 않음
- 기능을 비활성화하거나 TODO 처리
- 실패 시 앱이 중단되지 않도록 처리

### Image Picker

- `expo-image-picker`가 설치되어 있으면 사용
- 설치되어 있지 않으면 패키지를 임의 설치하지 않음
- 기능을 비활성화하거나 TODO 처리
- 권한 거부와 선택 취소를 처리

### Bottom Sheet

- 기존 바텀시트 라이브러리가 있으면 재사용
- 없다면 `Modal`, `Pressable`, `View`를 사용해 구현
- 새 라이브러리를 임의 설치하지 않음

---

## Component Rules

1. 페이지 또는 화면 컴포넌트가 지나치게 커지지 않도록 기능 단위로 분리합니다.
2. 한 화면에서만 쓰이는 작은 컴포넌트를 무조건 공통 컴포넌트로 만들지 않습니다.
3. 동일한 UI 패턴이 반복될 때 공통화합니다.
4. 기존 공통 컴포넌트가 있으면 우선 재사용합니다.
5. 컴포넌트 이름은 역할이 명확해야 합니다.
6. 데이터 조회 로직과 표현 컴포넌트를 가능한 한 분리합니다.

고려할 수 있는 컴포넌트:

- ScreenContainer
- AppButton
- AppTextInput
- LoadingState
- ErrorState
- EmptyState
- ListingCard
- SectionHeader
- AnalysisConfirmSheet
- ListingSummaryCard
- PriceEvaluationCard
- ConditionEvaluationCard
- RiskSignalCard
- ChecklistPreview

필요하지 않은 컴포넌트까지 선제적으로 만들지 않습니다.

---

## Styling Rules

1. 디자인 확정 전에는 최소한의 구조적 스타일만 적용합니다.
2. 화면 배경, 여백, 카드, 입력창, 버튼, 상태 배지 수준으로 구성합니다.
3. 색상과 간격 값을 여러 파일에 중복 하드코딩하지 않습니다.
4. 기존 theme 또는 design token이 있다면 반드시 재사용합니다.
5. 없다면 최소한의 constants 파일로 분리할 수 있습니다.
6. 최종 디자인처럼 보이게 만들기 위해 임의의 장식이나 애니메이션을 추가하지 않습니다.
7. Figma 디자인이 확정되면 쉽게 교체할 수 있는 구조를 유지합니다.

---

## API and Authentication Boundaries

현재 단계에서는 다음을 구현하지 않습니다.

- 실제 백엔드 API 호출
- API 엔드포인트 추측
- 실제 소셜 로그인
- 세션 및 토큰 저장
- Upstage API 호출
- 크롤링
- 실제 시세 분석
- 실제 상태 판정
- 서버 데이터 저장

실제 연동이 필요한 지점에는 명확한 TODO를 남깁니다.

예:

```ts
// TODO: 실제 분석 API 호출로 교체
```

TODO에는 구현되지 않은 이유와 교체 지점이 드러나야 합니다.

---

## Error Handling

1. 비동기 작업은 로딩과 오류 상태를 처리합니다.
2. 클립보드 접근 실패를 처리합니다.
3. 이미지 권한 거부와 선택 취소를 처리합니다.
4. Mock 데이터 조회 실패를 처리합니다.
5. 라우트 파라미터 누락을 처리합니다.
6. 이미지 로드 실패를 처리합니다.
7. 오류가 발생해도 앱 전체가 중단되지 않도록 합니다.
8. 사용자에게 표시되는 오류 문구는 이해 가능한 한국어로 작성합니다.

---

## Validation

작업 완료 전 다음을 확인합니다.

- TypeScript 타입 검사
- 프로젝트에 정의된 lint 실행
- 사용하지 않는 import 제거
- 잘못된 라우트 확인
- 동적 라우트 파라미터 확인
- 웹 전용 코드 포함 여부 확인
- 신규 패키지 설치 여부 확인
- iOS와 Android에서 문제가 될 수 있는 코드 확인
- 최종 코드에 `console.log`가 남아 있지 않은지 확인

`package.json`에 정의된 명령을 우선 사용합니다.

---

## Git Rules

1. 현재 작업 범위와 무관한 파일을 수정하지 않습니다.
2. 자동 포맷팅으로 프로젝트 전체 파일을 변경하지 않습니다.
3. 생성 파일과 수정 파일을 작업 완료 후 명확하게 보고합니다.
4. 잠금 파일은 실제 의존성 변경이 있을 때만 수정합니다.
5. 빌드 산출물과 로컬 환경 파일을 커밋하지 않습니다.
6. 사용자 요청 없이 commit 또는 push하지 않습니다.

---

## Completion Report

작업 완료 후 다음을 보고합니다.

1. 확인한 프로젝트 구조
2. 생성한 파일
3. 수정한 파일
4. 구현한 사용자 흐름
5. Mock 데이터 및 서비스 구조
6. 사용한 기존 패키지
7. 새로 설치한 패키지 여부
8. 실행한 검사와 결과
9. 남아 있는 TODO
10. 디자인 확정 후 수정할 영역
11. 실제 API 및 인증 연동 지점

````

이미 Codex가 작업 중이라면 `AGENTS.md`를 추가한 다음 Codex에 이것만 이어서 보내면 돼.

```text
프로젝트 루트에 AGENTS.md가 추가되었습니다.

현재까지 수행한 작업을 즉시 중단할 필요는 없지만, 다음 작업을 진행하기 전에 AGENTS.md 전체를 읽고 현재 변경 사항이 지침과 충돌하는지 검토해 주세요.

특히 다음을 확인하세요.

- React Native + Expo 프로젝트인지
- 기존 네비게이션 방식만 사용했는지
- 웹 전용 코드나 HTML 태그를 사용하지 않았는지
- 새 패키지를 임의로 설치하지 않았는지
- Mock 데이터를 화면 내부에 직접 작성하지 않았는지
- 화면이 Mock 파일을 직접 참조하지 않고 서비스 계층을 사용하는지
- TypeScript any를 사용하지 않았는지
- 실제 API나 인증을 추측해서 구현하지 않았는지
- 작업 범위를 벗어난 파일을 수정하지 않았는지

충돌하는 변경 사항이 있으면 AGENTS.md 기준으로 수정한 뒤 작업을 계속해 주세요.
````
