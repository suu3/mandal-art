# 아키텍처와 설계 결정


React/Vite 프론트와 Hono API를 하나의 Cloudflare Worker에서 제공하고 D1에 저장한다. 로그인 후 목표를 편집하는 흐름을 중심으로 설계해 서버 렌더링 대신 클라이언트 조회와 공유 캐시를 사용한다. 프론트와 API를 같은 origin으로 제공해 배포 구성과 인증 쿠키 처리를 단순하게 유지한다.

FSD는 화면 조합, 사용자 행동, 도메인 데이터의 책임을 나누는 데 사용한다. 보드 원본은 TanStack Query 캐시 한 곳에서 관리하고 표·목록·진행률을 파생한다. 별도 상태 복제에 따른 불일치를 줄이는 것이 목적이다.

## 데이터 흐름

```text
Hono API / D1
 → shared/api/client.ts: HTTP 오류·응답 스키마 검증
 → entities/board/api/boardApi.ts: 요청·도메인 검증
 → entities/board/api/boardQueries.ts: 원본 보드 캐시
 → 각 위젯 model 훅의 select
 → 위젯 Container → View
```

보드 상세 키는 `['boards','detail',boardId]`다. 같은 ID에 대해 별도의 표/목록/진행률 Query를 만들지 않는다.

| UI          | 구독 훅                                             | select 결과                 |
| ----------- | --------------------------------------------------- | --------------------------- |
| 만다라트 표 | `widgets/mandalart-editor/model/useMandalartEditor` | 제목·목표 트리              |
| 목표 목록   | `widgets/board-goals/model/useBoardGoals`           | root를 제외한 목표 목록     |
| 진행률      | `widgets/board-progress/model/useBoardProgress`     | 말단 목표 수·완료 수·퍼센트 |

캐시는 `Board` 원본을 유지하고 select 반환값만 다르다. 진행률은 말단 실행 목표 기준으로 계산한다. 위젯의 별도 local state에 진행률·목표 목록을 복사하지 않는다.

## 레이어

- `src/app`: Router와 QueryProvider. 세션 ID를 key로 하여 계정 전환 시 QueryClient를 교체하고 이전 요청·캐시를 정리한다.
- `src/pages`: 보드 목록과 상세 구성. 위젯·기능을 조합하며 UI 선택 상태를 가진다.
- `src/widgets`: 표/목록/진행률의 각 조회 훅과 UI. 편집기는 실제로 조합이 필요한 상태 처리와 View를 분리한다.
- `src/features`: 소셜 로그인, 보드 생성·삭제, 목표 편집·완료 체크 등 행동.
- `src/entities`: 보드와 세션의 타입·API·공통 Query·순수 selector. `index.ts`를 외부 진입점으로 사용한다.
- `src/shared`: HTTP 기반, 범용 focus 처리.
- `server`: Hono 엔드포인트·인증·DB. 프론트 FSD 계층을 서버에 억지로 적용하지 않는다.

`npm run check:boundaries`는 하위 레이어의 상위 의존, 같은 레이어의 서로 다른 slice 간 의존, 외부 slice의 내부 경로 직접 접근을 검사한다. TypeScript 구문 트리로 정적 import·재수출·문자열 리터럴 동적 import·import 타입을 검사하며 주석과 일반 문자열은 의존으로 취급하지 않는다. 현재 프로젝트의 상대 경로를 대상으로 하며, 경로 별칭을 도입하면 검사기도 함께 확장해야 한다.

`pages`·`widgets`·`features`·`entities`의 외부 소비자는 각 slice의 `index.ts`를 통해 접근한다. 예를 들어 `features/edit-goal`에서 `GoalEditor`, `useSaveBoard`를 가져오며 `features/edit-goal/model/useSaveBoard`를 직접 참조하지 않는다. 같은 slice 안에서는 내부 파일을 상대 경로로 가져온다. `shared`와 `app`은 slice로 나누지 않는 예외 레이어이므로 이 slice 공개 API 규칙의 대상이 아니다. 통합 테스트는 내부 동작을 직접 검증할 수 있도록 기존과 같이 검사에서 제외한다.

`model`·`api`·`ui`는 필요한 책임이 있을 때 만드는 세그먼트다. 공통 보드 요청과 Query 옵션은 `entities/board`에 유지하며 각 feature/widget에 복제하지 않는다. 불필요한 빈 폴더나 형식적인 Container는 만들지 않는다.

## 저장과 인증

목표 이름·메모·우선순위·기한의 입력 초안은 편집 폼 상태다. **입력 → 변경 저장 → API 성공 → 원본 Query 캐시 교체** 순서다. 실패 시 초안과 오류 안내를 남긴다.

완료 체크만 낙관적으로 캐시를 갱신한다. 실패 시 저장 전 캐시로 복구한다. 보드별 mutation scope와 UI 잠금으로 같은 화면의 수정이 겹치지 않게 하며, 서버에서는 revision 조건부 UPDATE로 다른 탭과의 경합을 409로 반환한다.

Google과 GitHub의 설정 여부는 독립적이다. Google-only 환경도 지원하며, 실제 client ID/secret이 없는 provider를 활성화된 것처럼 표시하지 않는다. 모든 보드 API는 세션 사용자 ID와 소유권을 확인한다. 클라이언트가 owner ID를 보내서 권한을 얻을 수 없다.

## 기존 데이터

`0002_multiple_boards.sql`은 과거 `board` 행을 `boards`의 `legacy-<ownerId>` 보드로 복사하고 revision·목표를 보존한다. 이전 테이블은 제거하지 않는다. 이전 JS 번들이 사용하는 `/api/board`도 새 legacy 행을 읽고 쓰도록 연결해 데이터가 두 갈래로 나뉘지 않게 했다.

보드 삭제는 deleted_at을 기록하여 목록에서 숨긴다. 기기 보드와 과거 localStorage 원본은 유지하며 자동으로 다른 계정에 업로드하지 않는다.

## 검증

- `src/entities/board/model/cache.test.tsx`: 조회 1회 공유, select 3개 동시 반영, 원본 캐시 유지, 낙관적 완료 실패 복구.
- `tests/query-boundary.test.tsx`: 입력 초안이 캐시를 바꾸지 않음, 명시적 저장 후 반영, 계정 경계 교체 시 캐시 제거.
- `tests/boards.test.ts`: 실제 D1 migration 데이터 보존, 다중 보드 생성/삭제/수정 및 A/B 소유권.
- `tests/auth-providers.test.ts`: Google-only, GitHub-only, 불완전 설정 처리.


## 리소스 제한과 브라우저 정책

보드 생성은 `server/board-creation.ts`의 공통 함수에서 처리한다. 활성 보드는 계정당 50개, 최근 60초 동안 생성은 최대 5개로 제한한다. 삭제한 보드도 생성 속도 제한에 포함하며, 구버전 호환 API도 같은 함수를 사용한다. D1의 단일 INSERT SELECT에서 검사와 생성을 함께 수행해 동시 요청이 상한을 넘지 않게 한다. 기존 데이터는 제한 도입으로 삭제하지 않는다.

정적 응답에는 CSP, 프레임 삽입 차단, nosniff, no-referrer, 브라우저 기능 제한을 적용한다. 테마 초기화는 외부 스크립트로 분리해 inline JavaScript와 eval을 허용하지 않는다. React의 inline style과 PNG 변환에 필요한 스타일·data/blob 이미지는 허용한다.

보안·기능 검증 범위와 남은 제약은 [검증과 제약사항](verification.md)을 참조한다.
