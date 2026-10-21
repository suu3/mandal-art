# 만다라트

큰 목표를 여덟 가지 작은 실천으로 나누는 개인 목표 플래너.

**서비스:** https://mandalart.mandalart.workers.dev

React/Vite 프론트와 Hono API를 하나의 Cloudflare Worker로 배포하고 D1에 저장한다. 별도 서버나 keep-alive cron을 운영하지 않는다. 사용자가 선택한 무료 Cloudflare 구성을 유지하면서 FSD와 TanStack Query 데이터 흐름을 적용했다. Next.js와 서버 prefetch/hydration은 현재 범위에 포함하지 않는다.

## 데이터 흐름과 구조

`API 요청·응답 검증 → 공통 Query 캐시 → 화면별 훅의 select → UI`

`['boards', 'detail', boardId]` 캐시에는 원본 보드 하나만 저장한다. 만다라트 표·목표 목록·진행률은 동일한 queryOptions를 서로 다른 select로 구독한다. 입력 초안은 폼 상태로 관리하고, 명시적인 저장이 성공하면 캐시를 갱신한다. 완료 체크는 낙관적으로 반영하고 실패하면 복구한다. 계정 전환·로그아웃 시 이전 QueryClient를 정리한다.

| 위치            | 책임                                   |
| --------------- | -------------------------------------- |
| `src/app/`      | Router·QueryProvider·세션 경계         |
| `src/pages/`    | 보드 목록·상세 화면 구성               |
| `src/widgets/`  | 편집기·목표 목록·진행률과 각 select 훅 |
| `src/features/` | 로그인·보드 생성/삭제·목표 편집/완료   |
| `src/entities/` | 보드/세션 모델·API·공통 조회·계산      |
| `src/shared/`   | 통신·범용 도구                         |
| `server/`       | Hono·better-auth·D1·소유권 검증        |
| `migrations/`   | 데이터 보존 SQL migration              |


## 개발과 검증

Node.js 22.12+ 또는 24 LTS 환경에서 실행한다.

```sh
npm ci
npm run db:migrate
npm run dev
npm run check
```

http://127.0.0.1:5173 에서 실행된다. `.dev.vars.example`을 `.dev.vars`로 복사하고 필요한 OAuth 값만 설정한다. 로그인 없이 기기 보드를 사용할 수 있다. `npm run check`는 FSD import 경계·테스트·타입·빌드를 검증한다. 테스트에는 실제 workerd/D1의 계정별 소유권·revision 경합·migration, 공유 캐시와 select, 낙관적 실패 복구, 폼 초안 보존과 기기 데이터 복구가 포함된다.

## 인증

Google과 GitHub 공급자를 독립적으로 설정할 수 있다. Google은 `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, GitHub는 `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`이 필요하다. 공통으로 `BETTER_AUTH_SECRET`(32바이트 이상 난수), `BETTER_AUTH_URL`(서비스 origin)을 설정한다.

OAuth 리디렉션 URI는 `<서비스 origin>/api/auth/callback/google` 또는 `/api/auth/callback/github`이다. 기본 프로필·이메일 로그인만 사용하고 GitHub 저장소 권한은 요청하지 않는다. Google Cloud에서 웹 OAuth 클라이언트를 등록한 후 운영 값은 Cloudflare secrets에 저장한다. 로컬 개발은 별도 클라이언트와 localhost 콜백을 사용한다.

```sh
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
npx wrangler secret put BETTER_AUTH_SECRET
npx wrangler secret put BETTER_AUTH_URL
```

GitHub 사용 시 공급자 이름을 바꿔 등록한다. `/api/config`의 `googleLogin`, `githubLogin`은 완전한 운영 설정이 있는 공급자만 true로 반환한다. 소스 구현만으로 Google 로그인이 활성화되지는 않는다. 비밀값은 Git이나 프론트 번들에 넣지 않는다.

## 배포

```sh
npx wrangler login
npx wrangler d1 export mandalart --remote --output=.wrangler/pre-migration-backup.sql
npm run db:migrate:remote
npm run deploy
```

기존 `wrangler.jsonc`는 생성된 mandalart D1을 참조한다. 다른 계정에서는 `npx wrangler d1 create mandalart` 결과의 ID로 바꾼다. Cloudflare 이메일 인증이 필요하다. 유료 플랜·R2·KV를 활성화하는 스크립트는 없다. GitHub Actions는 모든 push와 PR에서 검증하고, `master` push에서는 검증 성공 후 Worker와 정적 자산을 자동 배포한다. PR과 다른 브랜치에서는 배포하지 않는다. 배포는 동시에 실행되지 않으며 진행 중인 배포를 새 push로 취소하지 않는다.

최초 연결 시 저장소 Settings → Secrets and variables → Actions → Repository secrets에 `CLOUDFLARE_API_TOKEN`과 `CLOUDFLARE_ACCOUNT_ID`를 등록한다. API 토큰은 대상 Cloudflare 계정에 한정해 Workers Scripts 편집 및 해당 D1 바인딩에 필요한 D1 읽기 권한을 부여한다. 토큰과 OAuth 비밀값은 Git에 넣지 않는다. 기존 OAuth 값은 Cloudflare Worker secrets에 유지한다.

Secrets 등록 후 새 `master` push를 하거나 Actions → Check and deploy → Run workflow에서 `master`를 선택한다. 자격 증명이 없으면 배포 작업은 누락된 secret 이름만 표시하고 실패한다. 자동 배포는 원격 D1 migration을 실행하지 않으므로 스키마 변경 시 위 백업·원격 migration 절차를 별도로 수행한다.

무료 플랜의 제공량은 무제한이 아니다. 현재 조건은 [Workers 공식 요금](https://developers.cloudflare.com/workers/platform/pricing/)과 [D1 공식 요금](https://developers.cloudflare.com/d1/platform/pricing/)을 확인한다. 현재 서비스는 무료 `workers.dev` 주소를 사용한다. 보유 도메인은 Workers Settings → Domains & Routes → Custom Domain으로 연결하고 서비스 origin과 OAuth 콜백을 함께 변경한다. 도메인 구입·갱신 비용은 별도다.

## 데이터 보존

- `0002_multiple_boards.sql`은 기존 단일 보드의 snapshot과 revision을 `legacy-<ownerId>` 보드로 복사하고 원래 테이블을 보존한다. 전환 중 구버전 쓰기도 트리거로 전달하며 구 API는 같은 새 보드에 접근한다.
- 서버는 모든 보드 요청에서 세션과 소유권을 확인한다. 목록·생성·삭제·수정은 로그인 계정에만 적용된다. 삭제는 soft delete다. 수정은 revision 불일치 시 409를 반환한다.
- 기기 보드는 브라우저 저장소에 남고 클라우드로 자동 업로드하지 않는다. JSON 백업과 가져오기로 직접 옮긴다. 손상된 기기 데이터는 원본 다운로드·별도 복사본 생성 후 복구한다.
- 과거 `madalart-next-goals` 값은 자동으로 덮어쓰지 않는다. 화면에서 원본을 내려받은 뒤 가져온다. 이미지가 든 구형 백업은 별도 이전이 필요하다.
- 목표 1,000개, 제목 120자, 설명 4,000자, 요청/백업 256KiB 제한. 이미지 업로드는 지원하지 않는다.
- PWA는 공개 정적 자산만 캐시하고 인증·목표 API 응답은 캐시하지 않는다.
- 과거 Neon/Supabase 계정을 OAuth 계정에 자동 연결하지 않는다. `neon/`, `supabase/`는 참고용이며 현재 런타임에서 사용하지 않는다.

DB 백업에는 개인정보가 포함되므로 Git에 커밋하지 않는다. 배포 롤백은 Cloudflare Deployments를 사용하고 DB 복구는 사전 백업으로 별도 처리한다. 과거 Next.js/Neon 구현은 Git 커밋 `8e75018`에 남아 있다.
