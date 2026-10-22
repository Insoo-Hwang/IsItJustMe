export type Choice = 'a' | 'b'

export type Question = {
  id: string
  prompt: string
  a: string
  b: string
  // % of participants who picked A. Placeholder until the stats API exists.
  aRate: number
}

export type Category = {
  id: string
  name: string
  icon: string
  desc: string
  tagline: string
  minutes: number
  recommend: string[]
  // Placeholder until the stats API exists.
  participants: number
  tint: { bg: string; fg: string }
  questions: Question[]
}

export const QUESTION_COUNT = 10

type Row = [prompt: string, a: string, b: string, aRate: number]

function questions(prefix: string, rows: Row[]): Question[] {
  return rows.map(([prompt, a, b, aRate], i) => ({ id: `${prefix}${i + 1}`, prompt, a, b, aRate }))
}

export const CATEGORIES: Category[] = [
  {
    id: 'food',
    name: '음식 취향',
    icon: 'restaurant',
    desc: '찍먹부터 민초까지',
    tagline: '사소한 음식 취향으로 보는 나의 성향',
    minutes: 1,
    recommend: ['음식 얘기만 해도 신나는 분', '민초 논쟁에 할 말 많은 분', '친구랑 메뉴 고르다 싸워본 분'],
    participants: 48213,
    tint: { bg: 'oklch(0.94 0.045 28)', fg: 'oklch(0.58 0.17 28)' },
    questions: questions('f', [
      ['탕수육은?', '찍먹', '부먹', 38],
      ['민트초코는?', '좋아한다 (호)', '싫어한다 (불호)', 27],
      ['라면에 계란은?', '넣는다', '안 넣는다', 81],
      ['붕어빵은 어디부터?', '머리부터', '꼬리부터', 64],
      ['치킨은?', '후라이드', '양념', 52],
      ['중식당에서는?', '짜장면', '짬뽕', 47],
      ['고수는?', '좋아한다', '못 먹는다', 31],
      ['김치찌개에는?', '돼지고기', '참치', 66],
      ['빙수 팥은?', '듬뿍', '조금만', 58],
      ['아침밥은?', '꼭 먹는다', '건너뛴다', 44],
    ]),
  },
  {
    id: 'love',
    name: '연애 취향',
    icon: 'favorite',
    desc: '연락 빈도와 기념일',
    tagline: '연애할 때 나는 어떤 사람일까',
    minutes: 1,
    recommend: ['연애 밸런스게임을 좋아하는 분', '연인과 같이 해보고 싶은 분', '내 연애 스타일이 궁금한 분'],
    participants: 39507,
    tint: { bg: 'oklch(0.94 0.04 0)', fg: 'oklch(0.58 0.17 0)' },
    questions: questions('l', [
      ['연락은?', '자주 하는 편', '필요할 때만', 61],
      ['첫 데이트 장소는?', '맛집', '전시·산책', 55],
      ['기념일은?', '꼭 챙긴다', '평소에 잘하자', 49],
      ['다투고 나면?', '바로 대화', '시간을 갖는다', 57],
      ['고백은?', '내가 먼저', '기다린다', 42],
      ['커플 여행은?', '계획형', '즉흥형', 63],
      ['애칭은?', '쓴다', '이름이 좋다', 51],
      ['깜짝 이벤트는?', '좋다', '부담스럽다', 46],
      ['이성 친구는?', '괜찮다', '안 된다', 39],
      ['연애 사실은?', '공개', '비공개', 53],
    ]),
  },
  {
    id: 'life',
    name: '생활 습관',
    icon: 'home',
    desc: '아침형 vs 저녁형',
    tagline: '하루를 보내는 방식에도 취향이 있다',
    minutes: 1,
    recommend: ['루틴이 확실한 분', '나만 이런가 싶었던 분', '룸메이트와 비교해보고 싶은 분'],
    participants: 41880,
    tint: { bg: 'oklch(0.95 0.06 90)', fg: 'oklch(0.55 0.12 75)' },
    questions: questions('h', [
      ['나는?', '아침형', '저녁형', 35],
      ['알람은?', '한 번에 기상', '여러 개 맞춘다', 41],
      ['방 정리는?', '매일 조금씩', '몰아서 한 번에', 37],
      ['샤워는?', '아침에', '밤에', 29],
      ['저녁은?', '배달', '집밥', 58],
      ['주말에는?', '집콕', '외출', 62],
      ['배터리 20%면?', '바로 충전', '0%까지 버틴다', 72],
      ['메모는?', '휴대폰 앱', '종이', 76],
      ['치약은?', '끝부터 짠다', '중간부터 짠다', 68],
      ['이불은?', '매일 갠다', '안 갠다', 40],
    ]),
  },
  {
    id: 'travel',
    name: '여행 스타일',
    icon: 'flight',
    desc: '계획형 vs 즉흥형',
    tagline: '짐 싸는 순간부터 드러나는 나',
    minutes: 1,
    recommend: ['여행 계획 세우는 게 즐거운 분', '여행 메이트를 찾는 분', '다음 휴가를 고민 중인 분'],
    participants: 35764,
    tint: { bg: 'oklch(0.94 0.035 230)', fg: 'oklch(0.55 0.13 230)' },
    questions: questions('t', [
      ['여행은?', '계획형', '즉흥형', 54],
      ['숙소는?', '호텔', '감성 숙소', 48],
      ['바다 vs 산?', '바다', '산', 71],
      ['맛집 웨이팅은?', '한다', '안 한다', 45],
      ['여행 사진은?', '많이 찍는다', '눈으로 담는다', 52],
      ['가고 싶은 곳은?', '국내', '해외', 43],
      ['여행은 누구랑?', '혼자', '같이', 26],
      ['짐은?', '최대한 가볍게', '만약을 대비해', 39],
      ['일정은?', '빡빡하게', '여유롭게', 34],
      ['기념품은?', '꼭 산다', '안 산다', 57],
    ]),
  },
  {
    id: 'music',
    name: '음악 취향',
    icon: 'music_note',
    desc: '가사파 vs 멜로디파',
    tagline: '플레이리스트가 말해주는 나',
    minutes: 1,
    recommend: ['이어폰을 늘 끼고 다니는 분', '노래방 선곡에 진심인 분', '음악 취향 친구를 찾는 분'],
    participants: 29341,
    tint: { bg: 'oklch(0.94 0.04 300)', fg: 'oklch(0.55 0.15 300)' },
    questions: questions('m', [
      ['이어폰은?', '유선', '무선', 18],
      ['노래 들을 때?', '가사가 중요', '멜로디가 중요', 47],
      ['플레이리스트는?', '듣던 노래 반복', '새 노래 탐색', 59],
      ['노래방에선?', '발라드', '신나는 노래', 44],
      ['콘서트는?', '스탠딩', '좌석', 41],
      ['일할 때?', '노동요 필수', '조용히', 66],
      ['볼륨은?', '크게', '작게', 38],
      ['재생 방식은?', '셔플', '순서대로', 55],
      ['장르는?', '최애 하나', '잡식', 30],
      ['아침 출근길엔?', '음악 듣는다', '안 듣는다', 50],
    ]),
  },
  {
    id: 'people',
    name: '인간관계',
    icon: 'group',
    desc: '단톡 답장 속도는?',
    tagline: '사람을 대하는 나만의 방식',
    minutes: 1,
    recommend: ['친구들 사이 내 포지션이 궁금한 분', '인간관계 고민이 많은 분', '단톡방에 공유하고 싶은 분'],
    participants: 33092,
    tint: { bg: 'oklch(0.94 0.045 150)', fg: 'oklch(0.52 0.12 150)' },
    questions: questions('p', [
      ['단톡 답장은?', '바로 한다', '몰아서 한다', 46],
      ['약속은?', '먼저 잡는다', '기다린다', 40],
      ['친구는?', '넓고 얕게', '좁고 깊게', 24],
      ['고민 상담에선?', '듣는 편', '말하는 편', 68],
      ['생일 선물은?', '기프티콘', '직접 고른 선물', 52],
      ['약속이 취소되면?', '아쉽다', '반갑다', 45],
      ['첫 만남에선?', '먼저 말 건다', '기다린다', 37],
      ['안 맞는 사람은?', '빠르게 정리', '참고 본다', 42],
      ['칭찬은?', '직접 한다', '돌려서 한다', 58],
      ['모임에선?', '끝까지 있는다', '먼저 집에 간다', 33],
    ]),
  },
]

export const TOTAL_PARTICIPANTS = CATEGORIES.reduce((sum, c) => sum + c.participants, 0)

export function findCategory(id: string | undefined): Category | undefined {
  return CATEGORIES.find((c) => c.id === id)
}
