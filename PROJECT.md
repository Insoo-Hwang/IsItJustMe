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
| 5 | 취향 우주 공유 | 6개 테스트 완료 후 이름을 담은 공유 링크 생성 |
| 6 | 친구와 비교 | 공유자와 친구 1:1 육각형 비교, 공유자 중심의 취향 우주 |
| 7 | 완료 표시 | 완료한 카테고리에 체크 표시, 누르면 결과로 이동 |

## 작업 규칙

- 커밋에 Claude 관련 흔적을 남기지 않는다 (Co-Authored-By, "Generated with Claude" 등 문구 금지).
- 커밋 메시지는 한국어로, 담백하게 변경 내용만 짧게 적는다.
- 작업 후 정리를 할 땐 어떤 작업을 진행했는지 이해하기 쉽게 작성한다.
- API가 추가되면 아래 API 명세에 역할 · Request · Response를 표로 정리한다.
- 게스트에 속한 데이터 테이블은 `guest_id` 외래키에 `ON DELETE CASCADE`를 건다. (게스트 삭제 시 함께 지워지도록)

## 잠재된 위험

- 취향 우주에 등록한 뒤 등록을 취소하거나 행성 이름을 바꿀 수 없다.
- 공유자가 다시 테스트해도, 초대장 · 비교 · 우주는 최대 30분 동안 예전 답으로 보인다. (공유방 캐시)
- 결과 화면을 연 사람이 집계 캐시가 만들어진 뒤 답을 고쳤다면, 캐시가 만료될 때까지(최대 1시간) 참여자가 1명 많게 나온다.

## Redis 캐시

모든 사용자가 똑같이 받는 데이터만 Redis에 캐시한다. 사람마다 다른 값(내 답, 완료 여부, 비교 결과)은 캐시하지 않고, 캐시한 값에 요청마다 합친다.

| 캐시 이름 | 내용 | TTL | Key | 읽는 곳 |
|---|---|---|---|---|
| `categories` | 카테고리 · 질문 목록 | 없음 | `categories::SimpleKey []` | 모든 카테고리 API, 공유방 |
| `participants` | 카테고리별 참여자 수 | 5분 | `participants::SimpleKey []` | 홈 |
| `option0-rates` | 질문별 선택 비율 (60문항) | 30분 | `option0-rates::SimpleKey []` | 홈, 결과 |
| `combination-stats` | 카테고리의 성별 · 나이대별 조합 인원 배열(1024칸) + 캐시 시각 | 1시간 | `combination-stats::{카테고리 id}` | 결과 |
| `question-stats` | 카테고리의 문항 × 성별 · 나이대별 선택 인원 | 1시간 | `question-stats::{카테고리 id}` | 자세한 결과 |
| `rooms` | 공유방(방 id · 공유자 · 이름) + 공유자 답 | 30분 | `rooms::{공유 토큰}` | 초대장, 비교, 우주, 우주 등록 |
| `overall-bit-stats` | 종합 완료 인원 + 60문항별 두 번째 선택지 인원 + 캐시 시각 | 30분 | `overall-bit-stats::SimpleKey []` | 종합 결과 (평균 취향 일치율) |

- **설정**: `CacheConfig` (`@EnableCaching`, 캐시별 TTL · 저장 타입). 캐시하는 메서드는 `CategoryStatsCache`, `RoomCards`에 모았다.
- **저장 형식**: 캐시마다 정해진 record 하나를 JSON으로 저장한다 (`JacksonJsonRedisSerializer`). 값에 클래스 이름이 들어가지 않는다.
- **쓰기**: 저장 · 삭제가 끝난 뒤에 응답한다 (`immediateWrites`, 기본값은 백그라운드 저장).
- **갱신**: TTL이 지나면 다음 요청이 DB에서 다시 읽어 저장한다. 공유자 이름을 바꾸면 커밋 후 그 방의 캐시를 지운다. `STORY.md`로 카테고리 · 문항이 바뀌면 `categories` 캐시를 지운다.
- **결과 보정**: 조합별 인원 캐시에는 만든 시각을 함께 저장한다. 내 답이 그 뒤에 저장됐으면(답 수정 · 프로필 변경 포함) 캐시에 나를 1명 더해서 계산한다. (`StatsSnapshot.allWith` · `peersWith`)
- **Redis 장애**: 연결 · 명령 제한 시간을 0.5초로 두고, 캐시 오류는 로그만 남기고 DB에서 읽는다. 읽을 수 없는 값(코드 변경 전에 저장된 값 등)은 지운다.
- **로컬 실행**: `compose.yaml`의 `redis:8` (포트 6379). 값 확인은 `docker exec -it <컨테이너> redis-cli`에서 `KEYS *`, `GET "participants::SimpleKey []"`, `TTL <key>`.
- **캐시하지 않는 것**: 종합 결과(DB에서 직접 계산), 취향 우주 행성 목록, 게스트 세션.

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
| 역할 | 게스트의 성별 · 나이대를 저장하고, 이미 제출한 답변과 집계를 새 성별 · 나이대로 옮긴다 |
| 호출 시점 | 첫 테스트의 마지막 문항을 답한 뒤 결과를 보기 전, 나의 정보 화면에서 저장할 때 |
| Request | 쿠키 `guest_token` 필수. Body `{ "gender": "FEMALE" \| "MALE", "ageGroup": "TEENS" \| "TWENTIES" \| "THIRTIES" \| "FORTIES" \| "FIFTIES_PLUS" }` |
| Response | Body 없음 |

| 상황 | 상태 코드 | 동작 |
|---|---|---|
| 유효한 토큰 | 204 No Content | 성별 · 나이대 저장 (이미 있으면 덮어씀), 기존 답변의 집계를 새 칸으로 이동 |
| 쿠키 없음 / DB에 없는 토큰 | 401 Unauthorized | 저장하지 않음. 프론트는 세션을 다시 받고 한 번 재시도 |
| 값 누락 / 허용되지 않은 값 | 400 Bad Request | 저장하지 않음 |

### `GET /api/v1/categories` — 카테고리 목록

| 항목 | 내용 |
|---|---|
| 역할 | 카테고리와 질문 10개, 참여자 수, 질문별 선택 비율, 이 게스트의 완료 시각을 내려준다 |
| 호출 시점 | 앱 첫 진입 시 (화면을 그리기 전에 1회) |
| Request | 쿠키 `guest_token` 선택 (없거나 DB에 없으면 `completedAt`이 모두 `null`) |
| Response Body | `[{ "code", "name", "icon", "description", "tagline", "minutes", "recommend": string[], "participants", "questions": [{ "code", "prompt", "option0", "option1", "option0Rate" }], "completedAt" }]` — `option0Rate`는 option0을 고른 비율(%), 응답이 없으면 50. `completedAt`은 마지막으로 답을 제출한 시각, 없으면 `null` |

### `PUT /api/v1/categories/{code}/answer` — 답변 제출

| 항목 | 내용 |
|---|---|
| 역할 | 10문항 답을 저장하고 조합별 집계를 갱신한다 (다시 제출하면 덮어씀) |
| 호출 시점 | 마지막 문항을 답하고 (첫 테스트면 프로필 입력 후) 결과를 보기 전 |
| Request | 쿠키 `guest_token` 필수. Body `{ "answerBits": 0 ~ 1023 }` — n번 비트가 1이면 n+1번 문항에서 option1 선택 |
| Response | Body 없음 |

| 상황 | 상태 코드 | 동작 |
|---|---|---|
| 저장 성공 | 204 No Content | 이전 조합 -1, 새 조합 +1 (같은 답이면 변경 없음) |
| 범위 밖 / 누락된 값 | 400 Bad Request | 저장하지 않음 |
| 쿠키 없음 / DB에 없는 토큰 | 401 Unauthorized | 저장하지 않음. 프론트는 세션을 다시 받고 한 번 재시도 |
| 없는 카테고리 | 404 Not Found | 저장하지 않음 |
| 프로필 미입력 | 409 Conflict | 저장하지 않음. 프론트는 프로필 입력 단계로 이동 |

### `GET /api/v1/categories/{code}/result` — 결과 조회

| 항목 | 내용 |
|---|---|
| 역할 | 내 답을 같은 카테고리 참여자 전체 · 같은 성별 나이대와 비교한 결과를 내려준다 |
| 호출 시점 | 결과 화면 진입 시 |
| Request | 쿠키 `guest_token` 필수 |
| Response Body | `{ "answerBits", "overall": Summary, "peer": { "profile": { "gender", "ageGroup" }, "summary": Summary }, "questions": [...] }` — `questions`는 카테고리의 질문 (목록 API와 같은 형식) |
| Summary | `{ "participants", "exact", "similar", "opposite", "different", "similarCount", "oppositeCount" }` — 참여자 수, 나와 완전히 같은 다른 참여자 수, 8개 이상 일치하는 다른 참여자 비율(%), 2개 이하로 일치하는 다른 참여자 비율(%), 10개 모두 다른 참여자 수, `similar` · `opposite`에 해당하는 다른 참여자 수 |

| 상황 | 상태 코드 | 동작 |
|---|---|---|
| 답변 있음 | 200 OK | 결과 반환 |
| 쿠키 없음 / DB에 없는 토큰 | 401 Unauthorized | 프론트는 세션을 다시 받고 한 번 재시도 |
| 없는 카테고리 / 답변 없음 | 404 Not Found | 프론트는 테스트 소개 화면으로 이동 |

### `GET /api/v1/categories/result` — 종합 결과 조회

| 항목 | 내용 |
|---|---|
| 역할 | 모든 카테고리의 답을 하나의 조합으로 묶어, 모든 카테고리를 완료한 참여자와 비교한 결과를 내려준다 |
| 호출 시점 | 종합 결과 화면 · 엔딩 화면 진입 시 |
| Request | 쿠키 `guest_token` 필수 |
| Response Body | `{ "questions", "overall": Summary, "averageMatch", "topPercent" }` — `questions`는 비교한 문항 수(카테고리 6개 = 60), Summary는 결과 조회와 같은 형식 (유사 = 80% 이상 일치, 갈림 = 20% 이하 일치). `averageMatch`는 다른 종합 완료자들과 같은 답을 고른 문항 비율의 평균(%, 소수 첫째 자리), 나 말고 완료한 사람이 없으면 `null`. `topPercent`는 종합 완료자를 평균 취향 일치율이 낮은(희귀한) 순으로 세웠을 때 내 위치(상위 %, 소수 첫째 자리, 최소 0.1), 나 말고 완료한 사람이 없으면 `null` |

| 상황 | 상태 코드 | 동작 |
|---|---|---|
| 모든 카테고리 답변 있음 | 200 OK | 결과 반환 |
| 쿠키 없음 / DB에 없는 토큰 | 401 Unauthorized | 프론트는 세션을 다시 받고 한 번 재시도 |
| 답하지 않은 카테고리 있음 | 404 Not Found | 반환하지 않음 |

### `GET /api/v1/categories/{code}/result/questions` — 자세한 결과 조회

| 항목 | 내용 |
|---|---|
| 역할 | 카테고리의 질문마다 성별 · 나이대별 선택 인원을 내려준다 |
| 호출 시점 | 결과 화면에서 "더 자세한 결과 보기"를 눌렀을 때 |
| Request | 쿠키 `guest_token` 필수 |
| Response Body | `{ "answerBits", "questions": [{ "code", "prompt", "option0", "option1", "groups": [{ "gender", "ageGroup", "option0", "total" }] }] }` — `option0`은 그룹에서 option0을 고른 인원, `total`은 그룹의 응답 수. 응답이 없는 그룹은 빠짐 |

| 상황 | 상태 코드 | 동작 |
|---|---|---|
| 답변 있음 | 200 OK | 결과 반환 |
| 쿠키 없음 / DB에 없는 토큰 | 401 Unauthorized | 프론트는 세션을 다시 받고 한 번 재시도 |
| 없는 카테고리 / 답변 없음 | 404 Not Found | 프론트는 테스트 소개 화면으로 이동 |

### `POST /api/v1/rooms` — 공유방 만들기

| 항목 | 내용 |
|---|---|
| 역할 | 내 공유방의 공유 토큰을 돌려준다. 처음이면 방을 만들고, 이미 있으면 공유자 이름만 바꾼다 (한 사람당 방 1개) |
| 호출 시점 | 종합 결과 · 공유 링크 화면에서 친구에게 보여줄 이름을 입력한 뒤 |
| Request | 쿠키 `guest_token` 필수. Body `{ "name" }` — 앞뒤 공백 제외 1 ~ 10자 |
| Response Body | `{ "shareToken" }` — 링크는 `/invite/{shareToken}` |

| 상황 | 상태 코드 | 동작 |
|---|---|---|
| 모든 카테고리 답변 있음 | 200 OK | 기존 방 또는 새 방의 토큰 반환 |
| 이름 누락 · 빈 값 · 10자 초과 | 400 Bad Request | 방을 만들지 않음 |
| 쿠키 없음 / DB에 없는 토큰 | 401 Unauthorized | 프론트는 세션을 다시 받고 한 번 재시도 |
| 답하지 않은 카테고리 있음 | 409 Conflict | 방을 만들지 않음 |

### `GET /api/v1/rooms/{shareToken}` — 초대장 조회

| 항목 | 내용 |
|---|---|
| 역할 | 공유자 이름 · 카테고리별 답, 행성 수, 보는 사람과 방의 관계를 내려준다 |
| 호출 시점 | 공유 링크 화면 진입 시, 초대받은 사람의 홈 · 결과 화면 |
| Request | 쿠키 `guest_token` 선택 (없으면 `VISITOR`) |
| Response Body | `{ "ownerName", "owner": [{ "code", "answerBits" }], "planets", "viewer": { "role": "OWNER" \| "MEMBER" \| "VISITOR", "complete", "planetId" } }` — `owner`는 화면 순서, `complete`는 보는 사람이 6개 테스트를 모두 끝냈는지, `planetId`는 등록한 경우 내 행성 |

| 상황 | 상태 코드 | 동작 |
|---|---|---|
| 있는 방 | 200 OK | 반환 |
| 없는 토큰 | 404 Not Found | 프론트는 없는 링크 안내 |

### `POST /api/v1/rooms/{shareToken}/planets` — 취향 우주에 등록

| 항목 | 내용 |
|---|---|
| 역할 | 보는 사람을 행성으로 등록한다 (일치율 공개 동의). 이미 등록했으면 기존 행성을 돌려준다 |
| 호출 시점 | 공유 링크 화면에서 "OO의 취향 우주에 나 등록하기" → 행성 이름 입력 후 |
| Request | 쿠키 `guest_token` 필수. Body `{ "name" }` — 앞뒤 공백 제외 1 ~ 10자 |
| Response Body | `{ "planetId" }` |

| 상황 | 상태 코드 | 동작 |
|---|---|---|
| 등록 성공 / 이미 등록 | 200 OK | 행성 id 반환 (이미 등록했으면 이름은 그대로) |
| 이름 누락 · 빈 값 · 10자 초과, 공유자 본인 | 400 Bad Request | 등록하지 않음 |
| 쿠키 없음 / DB에 없는 토큰 | 401 Unauthorized | 프론트는 세션을 다시 받고 한 번 재시도 |
| 없는 방 | 404 Not Found | 등록하지 않음 |
| 답하지 않은 카테고리 있음 | 409 Conflict | 등록하지 않음 |

### `GET /api/v1/rooms/{shareToken}/universe` — 취향 우주 조회

| 항목 | 내용 |
|---|---|
| 역할 | 행성마다 이름과 공유자와의 취향 일치율만 내려준다 (답 · 카테고리별 비교는 없음, 참여자끼리는 비교하지 않음) |
| 호출 시점 | 공유 링크 화면 진입 시 |
| Request | 쿠키 `guest_token` 선택 (내 행성 표시용) |
| Response Body | `{ "planets": [{ "id", "name", "match", "me" }] }` — 등록 순서. `match`는 60문항 중 같은 답 비율(%), `me`는 보는 사람의 행성인지 |

| 상황 | 상태 코드 | 동작 |
|---|---|---|
| 있는 방 | 200 OK | 반환 (행성이 없으면 빈 배열) |
| 없는 토큰 | 404 Not Found | 프론트는 없는 링크 안내 |

### `GET /api/v1/rooms/{shareToken}/compare` — 공유자와 나 비교

| 항목 | 내용 |
|---|---|
| 역할 | 공유자와 보는 사람의 카테고리별 답 · 같은 답 수 · 전체 일치율을 내려준다. 다른 사람끼리의 비교는 조회할 수 없다 |
| 호출 시점 | 공유 링크 화면에서 6개 테스트를 모두 끝낸 사람에게 비교를 보여줄 때 |
| Request | 쿠키 `guest_token` 필수 |
| Response Body | `{ "ownerName", "planetId", "planetName", "match", "categories": [{ "code", "ownerBits", "otherBits", "matched" }] }` — `planetId` · `planetName`은 등록 전이면 `null`, `otherBits`는 내 답, `matched`는 카테고리 10문항 중 같은 답 수 |

| 상황 | 상태 코드 | 동작 |
|---|---|---|
| 비교 가능 | 200 OK | 반환 |
| 공유자 본인 | 400 Bad Request | 프론트는 공유자에게 비교를 요청하지 않음 |
| 쿠키 없음 / DB에 없는 토큰 | 401 Unauthorized | 프론트는 세션을 다시 받고 한 번 재시도 |
| 없는 방 | 404 Not Found | 프론트는 없는 링크 안내 |
| 답하지 않은 카테고리 있음 | 409 Conflict | 프론트는 미리보기와 테스트 버튼을 표시 |

### `GET /api/v1/rooms/{shareToken}/planets/{planetId}` — 행성 답 보기 (우주 주인 전용)

| 항목 | 내용 |
|---|---|
| 역할 | 우주 주인에게 한 행성(친구)의 답을 주인의 답과 나란히 내려준다. 답은 친구가 등록할 때 저장해 둔 두 사람의 답이라, 우주에 보이는 일치율과 항상 맞는다 |
| 호출 시점 | 우주 주인이 자기 우주에서 행성을 눌렀을 때 |
| Request | 쿠키 `guest_token` 필수 |
| Response Body | `{ "id", "name", "match", "categories": [{ "code", "ownerBits", "otherBits", "matched" }] }` — `otherBits`는 친구의 답, `matched`는 카테고리 10문항 중 같은 답 수 |

| 상황 | 상태 코드 | 동작 |
|---|---|---|
| 우주 주인 | 200 OK | 반환 |
| 쿠키 없음 / DB에 없는 토큰 | 401 Unauthorized | 프론트는 세션을 다시 받고 한 번 재시도 |
| 주인이 아닌 사람 | 403 Forbidden | 프론트는 주인에게만 요청함 |
| 없는 방 / 그 방의 행성이 아님 | 404 Not Found | 반환하지 않음 |

### `POST /api/v1/events` — 행동 기록

| 항목 | 내용 |
|---|---|
| 역할 | 광고 노출 · 클릭, 공유, 링크 열람 같은 행동 하나를 어드민 통계용으로 기록한다 |
| 호출 시점 | 광고가 보일 때(아래쪽 카드는 절반 이상 화면에 들어왔을 때) · 눌릴 때 · 건너뛸 때, 공유했을 때, 초대 · 나만 그래? 링크를 열었을 때, 취향 카드를 저장했을 때, 엔딩에 들어갔을 때. 화면은 응답을 기다리지 않는다 (`lib/track.ts`) |
| Request | `{ "type": string, "category": string \| null, "ad": string \| null, "placement": string \| null }` — `type`은 `AD_VIEW` · `AD_CLICK` · `AD_SKIP` · `SHARE_UNIVERSE` · `SHARE_DEBATE` · `SHARE_KAKAO` · `INVITE_OPEN` · `DEBATE_OPEN` · `DEBATE_PICK` · `CARD_SAVE` · `ENDING_OPEN`, `category`는 카테고리 코드 (없으면 생략). `ad`는 광고 id(`lib/ads.ts`, 영소문자 · 숫자 · `-` 30자 이내), `placement`는 광고 자리(`QUIZ_BREAK` · `ANALYZING` · `RESULT_BANNER` · `SUMMARY_BANNER` · `ENDING_BANNER`). 광고 행동(`AD_*`)은 둘 다 필수, 다른 행동은 보내도 버린다. 쿠키 `guest_token`은 있으면 함께 저장 |
| Response Body | 없음 |

| 상황 | 상태 코드 | 동작 |
|---|---|---|
| 기록 | 204 No Content | `event`에 한 행 저장 (세션이 없으면 게스트 없이 저장) |
| 없는 `type` · 없는 카테고리 · 없는 `placement` · 형식이 틀린 `ad` · 광고 행동에 `ad`나 `placement`가 없음 | 400 Bad Request | 저장하지 않음 |
| 한 주소에서 1분에 120회 초과 | 429 Too Many Requests | 저장하지 않음 (`Retry-After: 60`) |
| 같은 게스트 · 광고 · 위치 · 테스트의 `AD_VIEW`가 30분 안에 또 옴 | 204 No Content | 저장하지 않음 (노출 중복 방지) |

### `GET /api/v1/admin/dashboard` — 어드민 대시보드

| 항목 | 내용 |
|---|---|
| 역할 | 어드민 화면(`/backstage`)의 모든 숫자를 한 번에 내려준다. 캐시하지 않고 DB에서 바로 읽는다 |
| 호출 시점 | 어드민 화면 진입, 기간 변경, 새로고침 |
| Request | 헤더 `X-Admin-Token` 필수 (`ADMIN_TOKEN` 환경 변수 값). 쿼리 `days` 1 ~ 90 (기본 14): 오늘(한국 시간)로 끝나는 기간 |
| Response Body | `{ "generatedAt", "days", "totals", "period", "daily", "funnel", "progress", "categories", "demographics", "hours", "questions" }` |

| 필드 | 내용 |
|---|---|
| `totals` | 전체 기간 합계: 방문자 · 프로필 입력 · 1개 이상 완료 · 전부 완료 · 완료한 테스트 수 · 공유 링크 · 친구 등록 · 친구가 온 링크 |
| `period` | 기간 안의 수와 바로 앞 같은 길이 기간의 수 (`{ "current", "previous" }`). 키는 `guests` · `answers` · `finished` · `rooms` · `planets`와 행동 `type` |
| `daily` | 날짜별 새 방문자 · 완료한 테스트 · 전부 완료 · 공유 링크 · 친구 등록 · 행동 수 |
| `funnel` | 방문 → 프로필 입력 → 1개 완료 → 절반 이상 완료 → 전부 완료 → 공유 링크 생성 |
| `progress` | 끝낸 테스트 수(0 ~ 6)별 방문자 수 |
| `categories` | 카테고리별 끝낸 사람 · 첫 테스트로 고른 사람 |
| `demographics` | 성별 · 나이대별 방문자 · 전부 완료한 사람 |
| `hours` | 기간 안의 테스트 완료를 시간대(한국 시간 0 ~ 23시)별로 |
| `questions` | 60문항의 A 선택 인원 · 전체 응답 인원 |

| 상황 | 상태 코드 | 동작 |
|---|---|---|
| 토큰 일치 | 200 OK | 반환 |
| 토큰 없음 / 불일치 | 401 Unauthorized | 프론트는 토큰 입력 화면으로 |
| 한 주소에서 토큰 10번 틀림 | 429 Too Many Requests | 15분 동안 맞는 토큰도 거절 |
| `days` 범위 밖 | 400 Bad Request | - |

### `GET /api/v1/admin/ads` — 광고 리포트

| 항목 | 내용 |
|---|---|
| 역할 | 어드민 "광고 리포트" 탭의 숫자를 내려준다. 광고 하나를 고르면 그 광고로 나눠 보고, 없으면 전체. 캐시하지 않는다 |
| 호출 시점 | 광고 리포트 탭 진입, 기간 · 광고 변경, 새로고침 |
| Request | 헤더 `X-Admin-Token` 필수. 쿼리 `days` 1 ~ 90 (기본 14), `ad` 광고 id (선택) |
| Response Body | `{ "generatedAt", "days", "ad", "ads", "total", "daily", "audiences", "categories", "hours", "placements", "matrix", "retention" }` |

| 필드 | 내용 |
|---|---|
| `ads` | 광고별 노출 · 도달(본 사람 수) · 클릭 · 클릭한 사람 · 건너뛰기 · 테스트 중간 광고 노출(`skippableViews`, 건너뛴 비율의 분모), 이전 같은 길이 기간의 노출 · 클릭. `ad` 선택과 관계없이 전부 |
| `total` | 전체 광고 합계. 도달은 여러 광고를 본 사람도 한 번만 센다 |
| `daily` | 날짜별 노출 · 클릭 · 건너뛰기 |
| `audiences` | 성별 · 나이대별 노출 · 클릭 · 건너뛰기 (프로필 입력한 방문자) |
| `categories` | 광고를 본 순간 하던 테스트별 노출 · 클릭 · 건너뛰기 |
| `hours` | 시간대(한국 시간 0 ~ 23시)별 노출 · 클릭 · 건너뛰기, 24개 |
| `placements` | 광고 자리별 노출 · 클릭 · 건너뛰기 |
| `matrix` | 광고 × 위치별 노출 · 클릭. `ad` 선택과 관계없이 전부 |
| `retention` | 테스트 중간 광고(`QUIZ_BREAK`)를 본 (방문자, 테스트) 수와 그중 광고 뒤에 그 테스트를 끝낸 수 |

| 상황 | 상태 코드 | 동작 |
|---|---|---|
| 토큰 일치 | 200 OK | 반환 |
| 토큰 없음 / 불일치 | 401 Unauthorized | 프론트는 토큰 입력 화면으로 |
| `days` 범위 밖 · 형식이 틀린 `ad` | 400 Bad Request | - |

### `GET /api/v1/admin/maintenance` · `PUT /api/v1/admin/maintenance` — 점검 모드

| 항목 | 내용 |
|---|---|
| 역할 | 점검 모드 상태를 읽고 켜고 끈다. 켜져 있는 동안 어드민을 뺀 모든 `/api/**`가 503으로 답한다 (`MaintenanceGuard`) |
| 호출 시점 | 어드민 "운영" 탭 진입, 점검 시작 · 끝내기, 안내 문구 바꾸기 |
| Request | 헤더 `X-Admin-Token` 필수. `PUT` 본문 `{ "enabled": boolean, "message": string \| null }` — `message`는 200자 이내, 비우면 기본 문구 |
| Response Body | `{ "enabled": boolean, "message": string, "since": string \| null }` — `since`는 점검을 시작한 시각, 열려 있으면 `null` |

| 상황 | 상태 코드 | 동작 |
|---|---|---|
| 조회 · 변경 | 200 OK | 현재 상태 반환. 상태는 서버 메모리에 있어 재시작하면 `site.maintenance`(`MAINTENANCE` 환경 변수) 값으로 돌아감 |
| 토큰 없음 / 불일치 | 401 Unauthorized | - |
| 문구 200자 초과 | 400 Bad Request | - |

점검 중 방문자 API의 응답: `503 Service Unavailable`, 본문 `{ "maintenance": true, "message": string }`. 화면은 시작할 때 이 응답을 받으면 점검 안내를 보여준다.

## 배포 전 보안 체크리스트

코드에서 막을 수 있는 것은 이미 막았다 (아래 "지금 적용된 보호"). 여기 남은 것은 배포 환경을 정할 때 함께 해야 하는 일이다.

### 반드시

| # | 할 일 | 이유 |
|---|---|---|
| 1 | **어드민 토큰을 긴 무작위 값으로 교체**: `openssl rand -base64 32` 같은 32자 이상 값을 `ADMIN_TOKEN` 환경 변수로. 로컬 `backend/.env`의 값은 쓰지 않는다 | 지금 값은 짧고 추측 가능하다. 24자 미만이면 서버가 시작할 때 경고를 남긴다 |
| 2 | **HTTPS만 사용**, `app.guest.cookie-secure`는 기본값(true) 유지 | 게스트 쿠키와 어드민 토큰이 평문으로 오가지 않게 |
| 3 | **프록시 뒤라면 실제 접속 주소를 믿게 설정**: `server.forward-headers-strategy=native` (또는 `framework`), 프록시는 `X-Forwarded-For`를 덮어쓰도록 | 요청 수 제한 · 어드민 잠금이 접속 주소 기준이다. 설정하지 않으면 모든 방문자가 프록시 주소 하나로 보여 서로의 한도를 나눠 쓰게 된다 |
| 4 | **DB · Redis를 인터넷에 열지 않기**: 같은 사설망에서만 접속, DB는 강한 비밀번호, Redis는 `requirepass`(또는 ACL)와 `spring.data.redis.password` | `compose.yaml`의 `secret`과 비밀번호 없는 Redis는 개발용이다. Redis에 쓸 수 있으면 방문자에게 보이는 통계를 바꿀 수 있다 |
| 5 | **비밀값은 환경 변수나 비밀 저장소로만**: `ADMIN_TOKEN`, DB · Redis 비밀번호 | 저장소 · 이미지 · 로그에 남지 않게. `.env`는 git에서 제외돼 있다 |
| 6 | **`ADMIN_TOKEN`을 꼭 설정** | 비어 있으면 시작할 때 임의 토큰을 만들어 로그에 찍는다. 로그를 외부로 보내면 토큰도 같이 나간다 |

### 권장

| # | 할 일 | 이유 |
|---|---|---|
| 7 | 서버가 2대 이상이면 요청 수 제한 · 점검 모드 상태를 Redis로 옮긴다 | 지금은 서버 메모리에 있어 서버마다 따로 센다 |
| 8 | 글꼴 · 아이콘을 직접 호스팅하거나 jsDelivr 스타일시트에 `integrity`(SRI)를 붙인다 | 외부 CDN이 바뀌면 화면이 바뀔 수 있다. 직접 호스팅하면 보안 정책(CSP)에서 외부 주소도 뺄 수 있다 |
| 9 | HSTS(`Strict-Transport-Security`)는 HTTPS를 붙이는 프록시에서 건다 | 앱은 HTTP로 뜰 수도 있어 앱에서 걸지 않았다 |
| 10 | 백엔드 의존성 취약점 검사(OWASP Dependency-Check 등)를 CI에 넣는다 | 프론트는 `npm audit` 0건을 확인했지만 백엔드는 검사 도구가 없다 |
| 11 | 개인정보 삭제 요청 처리 방법을 정한다 (게스트 행 삭제 = 관련 행 CASCADE) | 개인정보처리방침이 "요청하면 삭제"라고 약속한다. 지워도 조합별 집계 숫자는 줄지 않는다 |
| 12 | 오래 안 온 게스트 정리 정책 | 게스트가 영구 보관된다 |
| 13 | 공유 링크를 끄거나 새로 만드는 기능 | 링크를 아는 사람은 주인의 답을 계속 볼 수 있다 |
| 14 | 문의처 이메일(`frontend/src/data/legal.ts`의 `CONTACT_EMAIL`)과 정책 문구 법률 검토 | 지금은 "준비 중"이다. 10대 이용자가 있어 만 14세 미만 동의 부분 확인 필요 |
| 15 | 어드민 접속을 IP로 제한하거나 계정 · 2단계 인증으로 바꾼다 | 토큰 하나가 새면 어드민 전체가 열린다 |

### 지금 적용된 보호

- **요청 수 제한** (`RateLimitGuard`): 접속 주소마다 1분에 세션 30 · 답 제출 30 · 공유방 · 친구 등록 20 · 행동 기록 120 · 프로필 20회. 넘으면 429. `site.rate-limit.enabled=false`로 끌 수 있음
- **어드민 잠금** (`AdminAuth`): 한 주소에서 토큰을 10번 틀리면 15분 동안 맞는 토큰도 거절(429). 틀린 시도는 로그에 남음. 점검 모드를 켜고 끈 주소도 로그에 남음
- **보안 헤더** (`SecurityHeaders`): CSP(자기 스크립트와 카카오톡 공유 SDK만, 외부는 글꼴 · 아이콘 스타일과 카카오 공유 API · 공유 창만), `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`. 배포 빌드로 홈 · 결과 · 종합 · 어드민을 열어 위반 0건 확인
- **친구 답 역추적 방지**: 우주의 친구 일치율은 등록할 때 고정(`universe_planet.match_percent`). 주인이 답을 바꿔 가며 친구의 답을 알아낼 수 없음
- **우주 크기 제한**: 한 공유방에 친구 300명까지
- **이름 검사**: 제어 문자 · 보이지 않는 서식 문자(방향 뒤집기 등) 거절
- **광고 노출 중복 방지**: 같은 사람 · 광고 · 위치 · 테스트의 노출은 30분에 한 번만 저장
- **개발 DB · Redis 포트**는 이 컴퓨터(127.0.0.1)에만 열림
- 이미 안전한 것: SQL은 모두 바인딩, HTML 직접 삽입 없음, 쿠키 SameSite=Lax · HttpOnly · Secure, 게스트 토큰 256비트 무작위 · DB에는 해시만, 캐시는 타입 고정 JSON, 액추에이터는 health · info만

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

### 6. 답변 저장 · 결과 API
카테고리와 질문을 DB로 옮기고, 답변을 서버에 저장해 실제 참여자와 비교한 결과를 보여준다.

- **답변 저장**: 10문항 답을 10비트 정수(`answer_bits`) 하나로 저장한다. 같은 조합의 인원은 `combination_stats`에 버전 · 성별 · 나이대별로 모은다.
- **질문 버전**: 질문 세트는 `category_version`으로 관리한다. 비교는 같은 버전끼리, 질문별 비율은 질문 `code` 기준으로 버전을 넘어 합산한다.
- **결과 계산**: 완전 일치, 80% 이상 유사(다른 비트 2개 이하), 희귀도를 버전 하나의 집계로 계산한다. (`RarityCalculator`)
- **게스트 영구 보관**: 180일 미접속 게스트 정리 작업을 제거했다.
- **구현**
  - Backend: Flyway V4(테이블), V5(기존 카테고리 6개 · 질문 60개 시드), `CategoryService` · `CategoryController` · `CombinationStatsRepository`
  - Frontend: 카테고리를 API로 불러오고, 결과 화면은 결과 API 값을 사용 (`api/categories.ts`)
- **테스트**: 결과 계산 (`RarityCalculatorTests`), API 응답 · 400 · 409 · 404 (`CategoryControllerTests`), 실제 Postgres에서 재제출 시 집계 이동 · 결과 계산 (`CategoryServiceTests`)

### 7. 화면 정리
- 하단 탭 바와 도감 · 통계 · 더보기 화면 제거 (도감 · 통계 데이터는 공개하지 않음)
- 홈의 완료한 카테고리 카드에 체크 표시, 누르면 결과 화면으로 이동
- 결과 화면의 친구 비교 버튼, 통계 버튼 제거

### 8. 나의 정보 (성별 · 나이대 수정)
- 홈 우측 상단 "나의 정보" 버튼, 수정 화면(`/me`) 추가 (`ProfileStep` 재사용)
- 프로필을 바꾸면 이미 제출한 답변과 집계도 새 성별 · 나이대로 이동 (`GuestProfileChanged` 이벤트 → `CategoryService.onProfileChanged`)
- 테스트: 프로필 변경 시 답변 · 집계 이동 (`CategoryServiceTests`)

### 9. 결과 화면 개편
- 결과 카드: 오른쪽 위를 "n명 중 1명꼴"(나와 답이 같은 사람 비율)로 변경, 등급은 소수 쪽(선택 비율 50% 미만)을 고른 문항 수로 결정 (7개 이상 희귀종 / 5~6 개성파 / 3~4 소신파 / 0~2 국룰러)
- 지표 추가: 나와 취향이 갈리는 사람(2개 이하 일치, %), 나와 완전히 다른 사람(10개 모두 다름, 명). 희귀도(`top`) 제거
- 또래 카드: 같은 성별 · 나이대 중 나와 완전히 같은 사람 비율(소수점 두 자리)과 인원
- 가장 흔한 내 선택 TOP 3 추가
- 하단: 친구에게 공유하기 · 더 자세한 결과 보기 · 다시 테스트 (다른 카테고리 제거)
- 자세한 결과 화면(`/result/:catId/detail`): 문항별 선택 비율, 성별 · 나이대 필터, 내 선택 강조
- API: Summary 변경, `GET /api/v1/categories/{code}/result/questions` 추가
- 테스트: 갈리는 사람 · 완전히 다른 사람 계산 (`RarityCalculatorTests`), 그룹별 선택 인원 (`CategoryServiceTests`), 자세한 결과 응답 (`CategoryControllerTests`)

### 10. 음악 취향 → 소비 취향
- 음악 취향 카테고리 비활성화, 같은 자리에 소비 취향 카테고리 · 질문 10개 추가 (Flyway V6)
- 카드 색: 소비 취향 초록, 인간관계 보라

### 11. 종합 결과
- 홈 카테고리 아래 "종합 결과 보기" 버튼, 6개 테스트를 모두 완료해야 열림 (진행 수 n/6 표시)
- 종합 결과 화면(`/summary`): 60문항 중 소수 쪽 선택 비율로 종합 등급, 카테고리별 등급 · "n명 중 1명꼴" 목록
- 등급 기준을 소수 쪽 선택 비율로 변경 (70% 이상 희귀종 / 50% 개성파 / 30% 소신파), 등급 색은 공통 CSS(`tier.module.css`)로 분리

### 12. 희귀도 보고서 · 엔딩
- API: `GET /api/v1/categories/result` 추가. 6개 카테고리 답을 60비트로 묶어 비교 (`CategoryService.overallResult`), `RarityCalculator`가 문항 수를 받도록 변경
- 종합 결과 화면을 희귀도 보고서로 변경: 유사 취향 비율 · 완전 일치 · 소수 선택 수, 카테고리별 소수 선택 비율 육각형(`RarityHexagon`), "n명 기준 잠정 결과" 표기, 하단 "마지막 비교 대상 만나기" 카드
- 엔딩 화면(`/ending`): 마지막 질문(3지선다) → 몇 년 전의 나 공개 → 미연시 대화(선택별 첫 인사 + 종합 등급별 대화) → 등급별 편지
- 서버에 답이 없는 카테고리가 있으면 보고서 · 엔딩 대신 그 테스트 소개 화면으로 이동
- 대사 · 편지는 `data/ending.ts`, 종합 결과 계산은 보고서와 엔딩이 같이 쓰도록 `lib/summary.ts`로 분리
- 테스트: 60문항 기준 유사 · 갈림 계산 (`RarityCalculatorTests`), 모든 카테고리 완료자끼리 비교 · 미완료 404 (`CategoryServiceTests`), 응답 형식 (`CategoryControllerTests`)

### 13. 완료 표시를 서버 기준으로 변경
- 카테고리 목록 API에 `completedAt` 추가
- 앱 시작 시 브라우저의 완료 기록을 서버 값으로 덮어씀 (`syncResults`). 쿠키가 바뀌었거나 답변 API 이전에 완료한 기록이 남아 있던 문제 수정
- 브라우저 완료 기록에서 답 내용 제거 (완료 시각만 저장)
- 테스트: 게스트별 완료 표시 (`CategoryServiceTests`), 응답 형식 (`CategoryControllerTests`)

### 14. 질문 버전 제거
카테고리와 질문이 바뀌지 않으므로 버전 관리를 없앴다.

- 테이블: `category_version` 제거 (6개 → 5개). `question` · `category_answer` · `combination_stats`가 카테고리를 직접 참조
- `category.active`와 음악 취향 카테고리 제거
- 마이그레이션 V4 ~ V6을 V4(테이블) · V5(카테고리 6개 · 질문 60개 시드)로 다시 작성
- 잠재된 위험의 "테스트 도중 질문 버전 변경" 항목 해소
- API 응답 형식은 그대로

### 15. 친구 공유 · 취향 우주
- 결과 화면의 "친구에게 공유하기"를 "홈으로 가기"로 변경 (카테고리별 공유 없음)
- 종합 결과 화면에 "공유하기": 보여줄 이름 입력 → `/invite/{공유 토큰}` 링크 공유 (공유 시트, 없으면 복사)
- 공유 링크 화면(`/invite/:token`) 하나에 초대장 · 나와 공유자 비교 · 취향 우주를 위에서부터 차례로 표시
  - 테스트 전: 공유자의 육각형 · 카테고리별 등급 미리보기, "나도 테스트하고 OO와 비교하기"
  - 테스트 후: 취향 일치율, 소수 선택 비율 육각형 겹쳐 그리기, 가장 비슷한 · 가장 다른 취향, 카테고리별 같은 답 수 (누르면 문항별로 공유자 · 내 선택), 우주 등록
  - 취향 우주: 공유자 중심, 행성 거리 = 100 − 일치율, 각도는 등록 순서 × 황금각. 행성을 누르면 이름 · 일치율 · 멘트만 표시
  - 공유자 본인: 초대장 · 다시 공유하기 · 취향 우주
- 초대받은 사람은 모든 페이지 주소에 `?invite={공유 토큰}` 유지, 홈의 종합 결과 버튼 아래에 "OO와 비교하기" 버튼 (6개 완료 전에는 잠김)
- 테이블: `share_room`(공유방: 공유자 · 공유 토큰 · 공유자 이름), `universe_planet`(취향 우주: 행성 이름 · 등록 시각) (Flyway V6)
- API: `POST /api/v1/rooms`, `GET /api/v1/rooms/{token}`, `POST /api/v1/rooms/{token}/planets`, `GET /api/v1/rooms/{token}/universe`, `GET /api/v1/rooms/{token}/compare`
- 6개 카테고리 답 조회를 `CategoryService.completeAnswers`로 분리해 종합 결과와 같이 사용
- 테스트: 일치율 계산 (`TasteMatchTests`), 방 생성 · 이름 변경 · 등록 · 우주 · 비교 · 400 · 404 · 409 (`RoomServiceTests`), 응답 형식 · 다른 사람 비교 경로 없음 (`RoomControllerTests`)

### 16. 종합 결과 계산을 DB로 이동
- 테이블: `overall_answer`(게스트 · 60비트 답안) 추가, 기존 답변으로 채움 (Flyway V7)
- 6개 카테고리를 모두 답했을 때와 답을 고칠 때 `submit`에서 함께 저장
- 종합 결과는 답변 전체를 읽지 않고, DB에서 XOR · `bit_count`로 센 숫자만 받는다 (`OverallAnswerRepository.count`)
- `RarityCalculator`: 센 숫자(`Counts`)로 결과를 만드는 메서드 분리
- API 응답 형식은 그대로
- 테스트: 갈림 · 완전히 다른 사람, 재응답 시 종합 결과 변경 (`CategoryServiceTests`)

### 17. 사용하지 않는 인덱스 삭제
- `idx_guest_last_seen_at`(미접속 게스트 정리용), `idx_category_answer_category`(종합 결과 전체 조회용) 삭제 (Flyway V8)

### 18. Redis 캐시
- 모든 사용자에게 같은 데이터 6종을 Redis에 캐시 (위 "Redis 캐시" 참고)
- 카테고리별 참여자 수를 답변 테이블 전체 대신 `combination_stats` 합계로 계산
- 카테고리 · 질문은 캐시한 목록에서 찾음 (`CategoryCatalog`)
- 프로필을 바꾸면 답변의 `updated_at`도 바꿈 (결과 보정에 사용)
- 결과 · 자세한 결과 화면에 "바로 반영되지 않을 수 있어요" 안내 문구
- API 응답 형식은 그대로
- 테스트: 캐시 값이 Redis에서 그대로 읽히는지 · TTL · 공유자 이름 변경 시 캐시 삭제 (`CacheTests`), 캐시 이후 답 보정 (`StatsSnapshotTests`), Redis가 꺼져 있어도 DB에서 읽음 (`RedisDownTests`)

### 19. 사용하지 않는 Kafka · 마지막 방문 시각 제거
- Kafka 의존성 · compose 서비스 · 테스트 컨테이너 제거
- `guest.last_seen_at` 컬럼 삭제 (Flyway V9), 세션 확인 시 방문 시각 갱신 제거

### 20. 조합별 인원 캐시를 배열로 저장
- `combination-stats` 캐시 값을 행 목록에서 성별 · 나이대별 1024칸 배열로 변경 (`StatsSnapshot.groups`)
- `RarityCalculator.summarize`가 배열을 받아 계산
- 예전 형태로 캐시된 값은 읽지 않고 지운 뒤 DB에서 다시 읽음
- API 응답 형식은 그대로
- 테스트: 배열 보정 · JSON 왕복 · 예전 형태 거부 (`StatsSnapshotTests`), `RarityCalculatorTests` 배열로 변경

### 21. 종합 결과에 평균 취향 일치율 추가
- 테이블: `overall_stats`(종합 완료 인원 · 60문항별 두 번째 선택지 인원, 한 행) (Flyway V10)
- `overall_answer`의 추가 · 수정 · 삭제(게스트 삭제 CASCADE 포함) 때 트리거가 같은 트랜잭션에서 갱신
- 기존 답은 마이그레이션에서 `overall_stats_rebuild()`로 집계 (값이 어긋나면 같은 함수로 다시 집계)
- 집계를 Redis에 30분 캐시 (`overall-bit-stats`). 내 답이 캐시 시각 10초 전 이후에 바뀌었으면 DB에서 바로 읽음
- 종합 결과 API에 `averageMatch` 추가, 종합 결과 화면에 카드 추가 (비교할 사람이 없으면 안내 문구)
- 기존 종합 결과 계산은 그대로
- 테스트: 1명 · 2명 · 모두 같음 · 모두 반대 · 전부 0 · 전부 1 · 직접 XOR 비교 (`RarityCalculatorTests`), 추가 · 수정 · 삭제 · 게스트 삭제 · 재집계 · 동시 저장 · DB XOR 비교 (`OverallStatsTests`), 재응답 전후 · 혼자일 때 (`CategoryServiceTests`), 캐시 이후 답 · TTL (`CacheTests`), Redis 장애 (`RedisDownTests`), 응답 형식 (`CategoryControllerTests`)

### 22. STORY.md
- `STORY.md`: 사용자 유형 · 흐름 · 등급 · 엔딩 스토리 · 카테고리와 문항 정리
- 등급표 · 우주 멘트 · 엔딩 대사 · 편지를 `STORY.md`에서 읽음 (`frontend/story/plugin.ts`, 개발 서버는 저장 시 바로 반영, 형식 오류 시 빌드 실패)
- 카테고리 · 문항 문구를 서버 시작 시 `STORY.md`에서 DB로 반영하고 카테고리 캐시 삭제 (`StorySync`). 로컬 실행 중에는 저장하면 바로 반영
- `STORY.md`를 jar에 포함, 프론트 빌드 입력에 추가 (`build.gradle`)
- 등급 헤드라인 · 우주 멘트 · 엔딩 대사 · 편지 · 카테고리 소개 · 문항 문구 수정
- 테스트: 문서 읽기 · 형식 오류 (`StoryCategoriesTests`), DB · 캐시 반영 · 순서 변경 거부 (`StorySyncTests`)

### 23. 엔딩 대화 이미지
- 대화 화면: 등급별 배경, 어릴 적 나 · 지금의 나 캐릭터 이미지 (말하는 쪽 강조, 지금의 나는 좌우 반전), 공개 화면에 어릴 적 나 이미지
- 표정: `STORY.md` 대사에 `화자(표정)` 형식 추가 (어릴 적 나 웃음 · 놀람 · 시무룩, 지금의 나 미소), 다음 대사까지 유지
- 이미지는 WebP로 변환해 `frontend/src/assets/ending`에 두고 (19MB → 704KB), 원본 PNG는 `design/ending-original` (git 제외)
- 엔딩 진입 시 캐릭터 · 배경 이미지 미리 불러오기 (`data/endingArt.ts`)

### 24. 종합 결과 지표 설명
- "n명과 비교해본 나" 제목 아래 유사 취향 비율 · 완전 일치 · 소수 선택. 이름에 밑줄, 누르면 설명 팝오버
- "n명 기준 잠정 결과" 문구 제거
- 공유 카드에 취향 우주 안내 문구 추가

### 25. 소수파 순위
- 종합 결과에 "내 희귀도는 상위 n%" 카드(막대 · 순위 멘트), 순위 멘트는 `STORY.md` 3-4
- 종합 결과 API에 `topPercent` 추가. 평균 취향 일치율 순서를 문항별 인원 가중치 합으로 DB에서 계산 (`RarityCalculator.rarityWeights` · `rarityScore` · `topPercent`, `OverallAnswerRepository.countRarer`)
- 테스트: 순서가 평균 일치율과 같음 · 상위 % 계산 (`RarityCalculatorTests`), DB 계산 = 직접 계산 (`OverallStatsTests`), 동점 · 혼자일 때 (`CategoryServiceTests`), 응답 형식 (`CategoryControllerTests`)

### 26. 취향 카드 이미지
- 종합 결과에 캡처용 취향 카드 미리보기 · 저장 · 크게 보기 (`TasteCard`, `lib/tasteCard.ts`). 크게 보기는 화면 맞춤 ↔ 원본 크기(눌러서 전환)
- 카드 내용: 등급 · 헤드라인, 희귀도 상위 %, 소수 선택 · 평균 일치율 · 완전 일치, 육각형, 카테고리별 등급, 가장 적은 사람이 고른 내 선택

### 27. 취향 논쟁 링크 (보류: 결과 화면 버튼 · `/vs` 경로를 빼 둠)
- 카테고리 결과에 "가장 희귀한 내 선택"으로 논쟁 링크 보내기 (`DebateShareButton`)
- 논쟁 화면 `/vs/:catId/:n`: 공유자 선택을 보고 편 고르기 → 선택 비율 · 같은 편 / 다른 편 결과 → 테스트 또는 내 결과로 (`DebatePage`)
- 문구는 `STORY.md` 3-5

### 28. 테스트 수정
- `StoryCategoriesTests`: Windows(`core.autocrlf`)에서 `STORY.md`가 CRLF로 읽혀 문항 삭제가 적용되지 않던 문제. 읽을 때 LF로 맞춤

### 29. 질문 중간 광고
- 카테고리 질문 5 → 6 사이에 광고 (`AdBreak`). 질문 화면 틀(상단바 · 진행 바) 안에서 질문 자리에 표시, 바로 건너뛰기 가능, 이미지를 누르면 상품 페이지(새 탭). 카테고리마다 방문당 한 번
- 광고 이미지는 WebP로 변환해 `frontend/src/assets/ad/ad-quiz.webp` (2.3MB → 107KB)

### 30. 어드민 대시보드 · 행동 기록
- 행동 기록: `event` 테이블(V12)과 `POST /api/v1/events`. 광고 노출 · 클릭 · 건너뛰기, 공유, 링크 열람, 취향 카드 저장, 엔딩 진입을 화면에서 보냄 (`lib/track.ts`). 노출처럼 "보였다"는 기록은 페이지를 연 동안 한 번만 보냄
- 어드민 API: `GET /api/v1/admin/dashboard` (`AdminDashboardRepository`). `X-Admin-Token` 헤더로 보호 (`AdminAuth`). `ADMIN_TOKEN`이 없으면 시작할 때 임의 토큰을 만들어 로그에 남김
- 어드민 화면 `/backstage`: 한눈에 보기(자동 문장), 최근 N일 지표와 이전 기간 대비, 일별 추이, 전환 퍼널, 공유 · 유입, 카테고리 · 시간대, 참여자 구성, 60문항 선택 비율. 기간 7 · 14 · 30 · 90일
- 어드민 화면은 따로 불러오는 묶음(`React.lazy`)이라 방문자 번들에 들어가지 않음. 차트는 라이브러리 없이 SVG · CSS로 그리고, 차트마다 같은 숫자의 표를 둠
- 로컬 실행: `backend/.env`에 `ADMIN_TOKEN=...`을 적고(git 제외) `./gradlew bootRun` 후 `http://localhost:5173/backstage`
- 테스트: `AdminControllerTests`(토큰 · 기간 검증), `AdminDashboardRepositoryTests`(집계), `EventControllerTests`

### 31. 광고 10종 · 확률 노출 · 광고 리포트
- 광고를 swiswi 상품 10개로 늘림 (`lib/ads.ts`, 이미지 `assets/ad/<상품 이름>.webp`, 각 800px · 100 ~ 160KB). 이번 방문에 아직 안 보인 광고 중에서 무작위로 고름. 광고 id와 이미지 파일명은 스마트스토어 상품명을 줄인 영문(예: `mush-dot-case`), 어드민에는 상품명 그대로
- 5번 → 6번에서 매번 뜨던 광고를 30% 확률로 (`AD_CHANCE`). 카테고리마다 방문당 한 번만 뽑아, 앞뒤로 오가도 다시 뽑지 않음
- 행동 기록에 광고 id와 자리(`placement`)를 함께 저장 (V13). 자리는 서버 enum `AdPlacement`로 검사
- 어드민 "광고 리포트" 탭 (`GET /api/v1/admin/ads`): 광고별 노출 · 도달 · 1인당 노출 · 클릭 · CTR · 평균 대비 · 건너뛴 비율, 일별 · 시간대별, 나이대 · 성별 CTR, 테스트별 CTR, 자리별, 광고 뒤 테스트 완료율, 광고주용 자동 문장과 CSV 내려받기. 노출 30번 미만은 순위에서 빼고 "표본 적음" 표시
- 서비스 탭의 카테고리별 광고 표는 광고 리포트로 옮김
- 테스트: `AdReportRepositoryTests`, `EventControllerTests`(광고 id · 자리 검사), `AdminControllerTests`(광고 리포트 인증 · 검증)
- 광고 자리 추가: 취향 분석 중 화면(`ANALYZING`, 그 테스트 중간에 광고가 없었을 때만 30%, 분석 시간 1.5초는 그대로), 카테고리 결과 아래(`RESULT_BANNER`) · 종합 결과 아래(`SUMMARY_BANNER`) · 엔딩 편지 아래(`ENDING_BANNER`)의 작은 카드(`AdCard`, 항상). 자리별 확률은 `lib/ads.ts`의 `CHANCE`
- 아래쪽 카드는 절반 이상 화면에 들어왔을 때만 노출로 셈 (`IntersectionObserver`). 스크롤하지 않은 사람의 노출은 세지 않음
- 광고 카드: 세로로 긴 상품 사진, 상품명(" - " 앞) · 옵션(뒤, 없으면 폰케이스 · 파우치 · 카드지갑), "스마트스토어에서 보기". 상품명 말고는 아무 문구도 지어내지 않음. 카테고리 결과에서는 버튼들 아래로 옮겨 잘못 누르지 않게 함

### 32. 안내 페이지 · 점검 모드
- 공용 안내 화면 `StatusScreen`(아이콘 · 제목 · 설명 · 버튼). 라우터 없이도 그려져서 앱이 뜨기 전에도 씀
- 404 (`NotFoundPage`): 모르는 주소, 없는 카테고리 · 문항 · 나만 그래? 링크. 예전에는 조용히 홈으로 보냈음. 앱 안에서 온 경우에만 "이전 페이지로"
- 화면 오류 (`ErrorBoundary`): 페이지가 그리다 깨지면 다시 시도 · 홈으로. 주소마다 새로 시작해서 다른 페이지로 가면 풀림
- 시작 실패 (`BootScreen`): 인터넷 끊김(다시 연결되면 자동 재시도) · 점검 중(서버가 준 문구) · 서버 연결 실패. 새로고침 없이 다시 시도. 어드민 주소는 실패해도 열려서 점검 중에도 끌 수 있음
- 없는 공유 링크 · 우주 불러오기 실패도 같은 안내 화면으로
- 개인정보처리방침 `/privacy` · 이용약관 `/terms` (`LegalPage`, 문구는 `data/legal.ts`). 실제로 저장하는 항목(쿠키 180일, 성별 · 나이대, 답, 공유 이름, 행동 기록)과 맞춰 씀. 홈 맨 아래에 링크. 문의처(`CONTACT_EMAIL`)는 비어 있어 "준비 중"으로 보임
- 점검 모드: `site.maintenance`(`MAINTENANCE`)와 어드민 "운영" 탭 스위치 · 안내 문구.
- 어드민 주소에 화면 상태를 담음: 탭은 `/backstage` · `/backstage/ads` · `/backstage/ops`, 기간 `?days=`, 고른 광고 `?ad=`. 뒤로가기가 어드민 안에서 이전 화면으로 돌아가고, 새로고침 · 링크 공유해도 같은 화면
- 테스트: `MaintenanceGuardTests`(점검 중 503과 문구, 어드민은 열림, 토큰 없이 못 바꿈)

### 33. 보안 보강 · 광고 리포트 정확도 · 광고 위치
- 보안: 요청 수 제한, 어드민 토큰 10회 실패 시 15분 잠금 · 짧은 토큰 경고 · 점검 전환 기록, 보안 헤더(CSP 등), 친구 일치율 등록 시점 고정(V14), 한 우주 300명 제한, 이름의 숨은 문자 거절, 개발 DB · Redis 포트를 127.0.0.1로. 배포 때 할 일은 "배포 전 보안 체크리스트"
- 광고 리포트 바로잡기: "광고 뒤 테스트 완료"는 테스트 중간 광고만 셈(결과 아래 카드는 테스트가 끝난 뒤라 빠짐), "건너뛴 비율"의 분모는 건너뛰기 버튼이 있는 테스트 중간 광고 노출만
- 광고 숫자 믿을 수 있게: 아래쪽 카드는 절반 이상이 1초 넘게 보여야 노출, 같은 사람 · 광고 · 위치 · 테스트의 노출은 30분에 한 번만 저장(V15), 어드민에 로그인한 브라우저는 기록하지 않음(운영 탭에서 켜고 끔)
- 광고 리포트 추가: CTR 오차 범위(±, 95% Wilson), 순위 · 평균 대비는 노출 100번 이상만, 상품 종류별(폰케이스 · 파우치 · 카드지갑), 광고 × 위치 표, 시간대별은 클릭 수 대신 클릭률, 그룹별 노출 비중. CSV에도 반영
- 광고 위치: 종합 결과는 취향 우주 바로 위, 카테고리 결과는 "나만 그래?" 공유 바로 위
- 테스트: `RateLimiterTests`, 어드민 잠금 · 보안 헤더(`AdminControllerTests`), 행동 기록 요청 수 제한(`EventControllerTests`), 노출 중복 · 건너뛰기 분모 · 완료율 범위(`AdReportRepositoryTests`), 일치율 고정 · 숨은 문자(`RoomServiceTests`)
