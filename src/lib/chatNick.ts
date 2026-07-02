// 채팅 익명 닉네임·아바타(#6) — 게스트의 카톡/구글 실명·프로필을 노출하지 않기 위해
// user_id에서 '형용사+동물+숫자' 닉과 그에 맞는 기본 프사(동물 이모지)를 결정적으로
// 만든다. 같은 계정은 어느 방에서나 같은 닉/프사 → 사장님이 단골을 알아볼 수 있고,
// DB 저장 없이 순수 계산으로 끝난다. (사장님 구분은 닉이 아니라 is_owner 배지가 담당.)
// 나중에 /me에서 직접 바꾼 닉/프사는 서버가 이 기본값 위에 덮어쓴다.

const ADJECTIVES = [
  '배고픈', '졸린', '신난', '수줍은', '용감한', '엉뚱한', '느긋한', '행복한',
  '까칠한', '새침한', '명랑한', '차분한', '활발한', '진지한', '깜찍한', '든든한',
  '상냥한', '씩씩한', '우아한', '똑똑한', '게으른', '부지런한', '엉큼한', '도도한',
  '천진한', '발랄한', '다정한', '시크한',
];

// [이름, 이모지] — 닉의 동물과 프사 이모지가 항상 일치하도록 한 쌍으로 둔다.
const ANIMALS: readonly (readonly [string, string])[] = [
  ['하마', '🦛'], ['너구리', '🦝'], ['펭귄', '🐧'], ['수달', '🦦'],
  ['다람쥐', '🐿️'], ['고슴도치', '🦔'], ['알파카', '🦙'], ['코알라', '🐨'],
  ['햄스터', '🐹'], ['판다', '🐼'], ['여우', '🦊'], ['토끼', '🐰'],
  ['곰', '🐻'], ['사슴', '🦌'], ['부엉이', '🦉'], ['호랑이', '🐯'],
  ['물개', '🦭'], ['고양이', '🐱'], ['강아지', '🐶'], ['오리', '🦆'],
  ['거북이', '🐢'], ['돌고래', '🐬'], ['양', '🐑'], ['늑대', '🐺'],
];

// 프사 배경색 — 이모지가 잘 보이는 파스텔.
const COLORS = [
  '#fde68a', '#fbcfe8', '#bfdbfe', '#bbf7d0', '#ddd6fe',
  '#fed7aa', '#a5f3fc', '#fecaca', '#c7d2fe', '#fef08a',
];

export interface ChatAvatar {
  emoji: string;
  color: string;
}

// FNV-1a 32bit — 비트가 고르게 섞여 형용사/동물/숫자/색을 서로 다른 비트창에서 뽑아도
// 충분히 독립적이다.
function hash32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export function chatNick(userId: string): string {
  const h = hash32(userId);
  const adj = ADJECTIVES[h % ADJECTIVES.length];
  const [animal] = ANIMALS[(h >>> 8) % ANIMALS.length];
  const num = ((h >>> 16) % 99) + 1; // 1~99, 충돌 방지용 작은 꼬리표
  return `${adj}${animal}${num}`;
}

export function chatAvatar(userId: string): ChatAvatar {
  const h = hash32(userId);
  const [, emoji] = ANIMALS[(h >>> 8) % ANIMALS.length]; // 닉의 동물과 동일 인덱스
  const color = COLORS[(h >>> 4) % COLORS.length];
  return { emoji, color };
}
