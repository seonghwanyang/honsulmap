const ADJECTIVES = [
  '신나는', '조용한', '달달한', '부지런한', '엉뚱한',
  '고독한', '소박한', '든든한', '다정한', '느긋한',
];

const NOUNS = [
  '파인애플', '고래', '라면', '토마토', '고양이',
  '감자', '만두', '호랑이', '오징어', '찰떡',
];

function randomPick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomNumber(): number {
  return Math.floor(Math.random() * 900) + 100; // 100~999
}

export function generateNickname(): string {
  return `${randomPick(ADJECTIVES)}${randomPick(NOUNS)}${randomNumber()}`;
}
