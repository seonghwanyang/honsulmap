// 부적절 콘텐츠 1차 필터 (App Store 1.2 UGC "콘텐츠 필터링 수단" 요건).
// 명백한 욕설·혐오·성적 표현을 등록 단계에서 차단한다. 완벽하진 않지만
// 신고·차단·관리자 삭제와 함께 다층으로 UGC를 관리하는 첫 관문 역할.
const BANNED = [
  // 한국어 욕설/혐오
  '씨발', '시발', '씨빨', 'ㅅㅂ', '병신', 'ㅂㅅ', '지랄', '좆같', '개새끼',
  '창녀', '보지', '자지', '강간', '느금마', '니애미', '엠창', '몰카',
  // 영어
  'fuck', 'shit', 'bitch', 'asshole', 'rape', 'nigger', 'cunt',
];

// 명백히 부적절한 표현이 있으면 매칭된 단어를, 없으면 null.
export function findObjectionable(text: string): string | null {
  if (!text) return null;
  const normalized = text.toLowerCase().replace(/\s+/g, '');
  for (const w of BANNED) {
    if (normalized.includes(w.toLowerCase())) return w;
  }
  return null;
}

// 여러 필드 중 하나라도 부적절하면 true.
export function isObjectionable(...parts: (string | null | undefined)[]): boolean {
  return parts.some((p) => findObjectionable(p ?? '') !== null);
}
