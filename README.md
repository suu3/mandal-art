# 만다라트

큰 목표를 여덟 가지 작은 실천으로 나누는 개인 목표 플래너.

**서비스:** https://mandalart.mandalart.workers.dev

React/Vite 프론트와 Hono API를 하나의 Cloudflare Worker로 배포하고 D1에 저장한다. keep-alive cron이나 별도 서버가 필요 없다. GitHub 로그인은 기본 프로필·이메일 읽기만 요청하며 저장소 권한을 요청하지 않는다. 로그인 없이도 브라우저 기기 저장을 사용할 수 있다.

## 개발

Node.js 22.12+ 또는 24 LTS 권장.

```sh
npm ci
npm run db:migrate
npm run dev
```

http://127.0.0.1:5173 에서 실행된다. OAuth 설정이 없으면 로그인은 준비 중 상태이며 기기 저장은 정상 동작한다. 로컬 DB는 `.wrangler/`에 생성된다. 비밀값은 `.dev.vars.example`을 복사한 `.dev.vars`에만 넣는다. 로컬 OAuth를 검증하려면 운영 앱과 별도의 개발 OAuth 앱을 만들고 `http://127.0.0.1:5173/api/auth/callback/github`를 등록한다.

```sh
npm test
npm run typecheck
npm run build
npm run deploy:check
```

테스트는 순환/중복 트리, 계정 격리, 저장 큐 실패/재시도, 실제 workerd/D1와 서명된 better-auth 세션을 통한 API 검증을 포함한다.

## 배포

현재 저장소의 `wrangler.jsonc`는 이미 생성한 `mandalart` D1을 참조한다. 다른 계정으로 배포할 때는 아래 명령으로 생성한 ID로 교체한다.

```sh
npx wrangler login
npx wrangler d1 create mandalart
npm run db:migrate:remote
npm run build
npx wrangler deploy
```

Cloudflare 이메일 인증이 필요하다. Workers Paid, R2, KV, 유료 외부 서비스를 활성화할 필요가 없다. 배포 스크립트는 플랜을 업그레이드하지 않는다.

GitHub [OAuth 앱 설정](https://github.com/settings/developers)에서 서비스 URL과 `<서비스 origin>/api/auth/callback/github` 콜백을 등록한다. 와일드카드 콜백과 Device Flow는 사용하지 않는다.

```sh
npx wrangler secret put GITHUB_CLIENT_ID
npx wrangler secret put GITHUB_CLIENT_SECRET
npx wrangler secret put BETTER_AUTH_SECRET
npx wrangler secret put BETTER_AUTH_URL
```

`BETTER_AUTH_SECRET`은 암호학적 난수 32바이트 이상, `BETTER_AUTH_URL`은 정확한 서비스 origin이다. 운영 비밀값은 Cloudflare secrets에만 저장하며 브라우저 번들/Git에 포함하지 않는다. 설정 후 `/api/config`가 `{ "githubLogin": true }`를 반환하는지 확인한다.

CI는 타입·테스트·빌드만 수행한다. 자동 운영 배포는 설정하지 않았다. 변경 반영은 `npm run deploy`와 Git push를 각각 수행한다. GitHub에 push하는 것만으로 서비스가 갱신되지는 않는다.

### 개인 도메인

Cloudflare에 관리 중인 도메인을 등록한 뒤 Workers & Pages → mandalart → Settings → Domains & Routes → Add → Custom Domain에서 연결한다. 이후 `BETTER_AUTH_URL`과 GitHub OAuth 콜백을 새 origin으로 함께 변경한다. 도메인 **연결**은 무료지만 도메인 **구입·갱신**은 별도다. 현재는 무료 `workers.dev` 주소를 사용한다.

### 무료 한도

Workers 무료: 동적 요청 10만/일, 요청당 CPU 10ms. D1 무료: 읽기 500만 행/일, 쓰기 10만 행/일, 계정 총 저장 5GB. 한도 초과 시 서비스가 제한될 수 있다. 무료 한도는 무제한이나 영구적인 가격 보장이 아니다. [공식 Workers 요금](https://developers.cloudflare.com/workers/platform/pricing/), [D1 요금](https://developers.cloudflare.com/d1/platform/pricing/).

비밀번호 해싱의 CPU 비용을 피하기 위해 이메일/비밀번호 로그인은 소셜 로그인으로 대체했다. OAuth 왕복, API 및 CPU 제한은 운영 환경에서도 확인해야 한다. 결제·대용량 업로드·keep-alive 작업은 없다.

## 데이터와 이전

- 비로그인 데이터와 로그인 계정별 캐시는 분리한다. 비로그인 목표를 로그인 계정에 자동 업로드하지 않는다. 옮기려면 JSON 백업을 내보낸 뒤 로그인하여 가져온다.
- 과거 `madalart-next-goals` 저장값은 자동 덮어쓰기하지 않는다. 안내에서 원본을 내려받고 메뉴의 가져오기를 사용한다. 이미지가 든 백업은 별도 이전이 필요하며 조용히 이미지를 버리지 않는다.
- 기존 Neon/Supabase 이메일 계정과 OAuth 계정을 자동 연결하지 않는다. 기존 운영 데이터는 먼저 해당 버전에서 JSON으로 백업한다. 과거 스키마는 `neon/`, `supabase/`에 참고용으로 남아 있으며 현재 런타임에서 사용하지 않는다.
- 목표 수 1,000개, 제목 120자, 설명 4,000자, 요청/백업 파일 256KiB 제한. 이미지 업로드는 지원하지 않는다.
- 저장은 650ms 동안 묶고 직렬 처리한다. 보드 revision이 다르면 409로 멈춘다. 내 변경을 JSON으로 백업한 뒤 서버를 다시 불러온다. 저장 실패 시 로컬 변경과 재시도를 유지한다.
- PWA는 공개 정적 자산만 캐시한다. 인증·목표 API 응답은 Cache Storage에 넣지 않는다. 네트워크가 없을 때 로그인 상태를 새로 확인할 수 없으면 기기 모드로 시작한다.

운영 DB 백업:

```sh
npx wrangler d1 export mandalart --remote --output=mandalart-backup.sql
```

인증·개인정보가 포함되므로 SQL 백업은 Git에 커밋하지 말고 안전하게 보관한다. 롤백은 Cloudflare Deployments의 이전 버전과 사전 DB 백업을 사용한다. Next.js/Neon 이전 구현은 Git 커밋 `8e75018`에 남아 있다.

## 구조

| 위치                  | 책임                         |
| --------------------- | ---------------------------- |
| `src/domain/`         | 공유 타입·트리 검증·진행률   |
| `src/data/`           | 계정별 저장·revision 저장 큐 |
| `src/features/board/` | 보드·상세 편집·내보내기      |
| `src/features/auth/`  | OAuth 클라이언트             |
| `server/`             | Hono API·인증·D1 접근        |
| `migrations/`         | D1 SQL migration             |

