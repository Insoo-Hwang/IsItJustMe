# IsItJustMe

## 프로젝트 소개

> "탕수육은 찍먹? 민트초코는 호? 나와 취향이 비슷한 사람은 얼마나 있을까?"

사용자가 주제별 취향 테스트에 답하고, 서비스에 참여한 다른 사람들과 취향이 얼마나 비슷한지 확인한 뒤, 결과 카드와 친구 비교 링크를 공유하는 서비스다.

## 구현할 기능

| # | 기능 | 내용 |
|---|---|---|
| 1 | 취향 테스트 | 테스트 선택, 2지선다 문항 응답, 진행률 표시, 이전 질문 수정 |
| 2 | 유사 인구 비율 | 같은 테스트 참여자 중 내 답변과 80% 이상 일치하는 사람의 비율 |
| 3 | 완전 일치 인원 | 답변이 모두 같은 다른 참여자 수 |
| 4 | 나의 희귀한 취향 | 내가 고른 선택지 중 선택 비율이 낮은 TOP 3 |
| 5 | 결과 카드 공유 | 카드형 결과 페이지 + 링크 복사 |
| 6 | 친구와 비교 | 공유 링크로 들어온 친구와 일치율 · 공통점 · 차이점 비교 |
| 7 | 취향 도감 | 완료한 테스트와 결과 모아보기 |
| 8 | 취향 통계 | 질문별 선택 비율, 참여자 수, 내 선택 위치 |

## 작업 규칙

- 커밋에 Claude 관련 흔적을 남기지 않는다 (Co-Authored-By, "Generated with Claude" 등 문구 금지).
- 커밋 메시지는 한국어로, 담백하게 변경 내용만 짧게 적는다.
- 작업 후 정리를 할 땐 어떤 작업을 진행했는지 이해하기 쉽게 작성한다.
- API가 추가되면 아래 API 명세에 역할 · Request · Response를 표로 정리한다.
- 게스트에 속한 데이터 테이블은 `guest_id` 외래키에 `ON DELETE CASCADE`를 건다. (미접속 게스트 삭제 시 함께 지워지도록)

## API 명세

### `POST /api/v1/guests/session` — 게스트 세션 발급 / 확인

| 항목 | 내용 |
|---|---|
| 역할 | 접속한 사용자에게 guest token을 발급하거나, 이미 가진 토큰을 확인한다 |
| 호출 시점 | 앱 첫 진입 시 (어느 페이지로 들어오든 `AppShell`에서 1회) |
| Request | Body 없음. 쿠키 `guest_token`이 있으면 함께 전송 (없어도 됨) |
| Response Body | `{ "issued": boolean, "profile": { "gender", "ageGroup" } \| null }` — 새로 발급했는지 여부, 저장된 성별 · 나이대 (없으면 `null`) |
| Response Cookie | `guest_token` (HttpOnly · Secure · SameSite=Lax · 만료 180일, 요청마다 연장) |

| 상황 | 상태 코드 | 동작 |
|---|---|---|
| 쿠키 없음 / DB에 없는 토큰 | 201 Created | 새 토큰 발급, DB에 해시 저장, `issued: true` |
| 유효한 토큰 | 200 OK | 마지막 방문 시각 갱신, 쿠키 만료일 연장, `issued: false` |

### `PUT /api/v1/guests/profile` — 성별 · 나이대 저장

| 항목 | 내용 |
|---|---|
| 역할 | 게스트의 성별 · 나이대를 저장한다 (게스트당 한 번 입력) |
| 호출 시점 | 첫 테스트의 마지막 문항을 답한 뒤, 결과를 보기 전 |
| Request | 쿠키 `guest_token` 필수. Body `{ "gender": "FEMALE" \| "MALE", "ageGroup": "TEENS" \| "TWENTIES" \| "THIRTIES" \| "FORTIES" \| "FIFTIES_PLUS" }` |
| Response | Body 없음 |

| 상황 | 상태 코드 | 동작 |
|---|---|---|
| 유효한 토큰 | 204 No Content | 성별 · 나이대 저장 (이미 있으면 덮어씀) |
| 쿠키 없음 / DB에 없는 토큰 | 401 Unauthorized | 저장하지 않음. 프론트는 세션을 다시 받고 한 번 재시도 |
| 값 누락 / 허용되지 않은 값 | 400 Bad Request | 저장하지 않음 |

## 작업 기록

### 1. 프로젝트 초기 설정
- Spring Boot(backend) + React(frontend) 프로젝트 골격 생성, GitHub 저장소 연결

### 2. 게스트 토큰 발급
로그인 없이 사용자를 구분하기 위해, 접속하면 guest token을 발급한다.

- **저장 방식**: 쿠키에는 토큰만 두고, 응답 · 결과 등 실제 데이터는 DB에 저장한다.
  - 통계 · 공유 · 친구 비교가 모두 서버 데이터 기준이라 DB 저장이 필요하다.
  - 쿠키는 사용자가 조작할 수 있고 용량(약 4KB)도 작다.
- **보안**
  - 토큰은 추측할 수 없는 랜덤 값(32바이트)이다.
  - DB에는 토큰의 SHA-256 해시만 저장한다. DB가 유출돼도 저장된 값으로 쿠키를 만들 수 없다.
  - 쿠키는 HttpOnly라 JS로 읽을 수 없다.
- **구현**
  - Backend: `guest` 테이블(Flyway), `Guest` 엔티티 · `GuestService` · `GuestController`
  - Frontend: `/main` 빈 페이지, 접속 시 세션 API 호출 (`/`는 `/main`으로 이동)
  - 테스트: 첫 방문 발급 · 재방문 유지 · 쿠키 속성 확인 (`GuestControllerTests`)

### 3. 장기 미접속 게스트 정리
180일 동안 방문하지 않은 게스트는 서버에서 삭제한다.

- **기준**: 마지막 방문(`last_seen_at`) 후 180일. 쿠키 만료도 같은 180일이다. (`GuestService.RETENTION`)
- **정리 작업**: 매일 새벽 4시(한국 시간)에 180일이 지난 게스트를 한 번의 쿼리로 삭제하고, 삭제 건수를 로그로 남긴다. (`GuestCleanupJob`)
- **연관 데이터**: 앞으로 생길 응답 · 결과 테이블은 `guest_id`에 `ON DELETE CASCADE`를 걸어, 게스트가 지워지면 함께 지워지게 한다.
- **구현**
  - Backend: 스케줄링 활성화(`SchedulingConfig`), 삭제 쿼리(`GuestRepository.deleteByLastSeenAtBefore`), `last_seen_at` 인덱스(Flyway V2)
  - 테스트: 쿠키 Max-Age 180일 확인, 181일 지난 게스트만 삭제되는지 실제 Postgres로 확인 (`GuestRepositoryTests`)

### 4. 화면 구현
Claude Design 시안을 React 화면으로 옮겼다. 테스트 · 결과 API가 아직 없어서 답변과 결과는 localStorage에 저장하고, 참여자 수 · 선택 비율은 임시 값을 쓴다.

- **화면**: 랜딩(`/main`), 테스트 소개(`/test/:catId`), 질문(`/test/:catId/q/:n`), 결과(`/result/:catId`), 친구 비교(`/compare/:shareId`), 취향 도감(`/dex`), 취향 통계(`/stats/:catId?`), 바텀시트(`?sheet=share|restore|menu`)
- **희귀도 계산** (`lib/rarity.ts`, 문항별 선택 비율로 추정)
  - 희귀도: 내 답변 조합보다 드물거나 같은 조합을 가진 사람의 비율 ("100명 중 n명")
  - 유사 인구 비율: 10문항 중 8개 이상 일치할 확률
  - 완전 일치 인원: (참여자 수 − 1) × 내 조합 확률
  - 희귀 TOP 3: 내가 고른 쪽의 선택 비율이 낮은 순
- **친구 비교**: 공유 링크에 답변을 담는다 (`/compare/food-9h`). 친구가 테스트를 마치면 결과 화면에서 비교로 이어진다.
- **구현**: `AppShell`(모바일 프레임 · 하단 탭 · 게스트 세션 호출), `data/categories.ts`(문항), `store/testStore.ts`(localStorage 저장), CSS Modules

### 5. 성별 · 나이대 입력
첫 테스트의 10번 문항 뒤, 결과를 보기 전에 성별 · 나이대를 필수로 입력받는다. 게스트에 저장되므로 다음 테스트부터는 묻지 않는다.

- **저장**: `guest` 테이블에 `gender` · `age_group` 컬럼 추가 (Flyway V3, 허용 값과 "둘 다 있거나 둘 다 없음"을 CHECK 제약으로 보장)
- **API**: 세션 응답에 `profile` 추가, `PUT /api/v1/guests/profile` 추가
- **화면**
  - 입력 단계(`ProfileStep`): 성별 2개 · 나이대 5개(10대 ~ 50대 이상) 중 선택
  - 결과: "20대 여성 중에서는 100명 중 n명" 카드
  - 통계: 전체 / 나이대별 / 성별 보기, 내 그룹 강조
  - 그룹별 수치는 결과 API 전까지 임시 값 (`lib/demographics.ts`)
- **테스트**: 프로필 저장 · 401 · 400, 세션 응답의 프로필 (`GuestControllerTests`), 실제 Postgres에 저장 · 조회 (`GuestRepositoryTests`)
