/** 프차 목록 문서 자동생성 — DB의 바를 핸들 프리픽스로 브랜드 그룹핑 → docs/bars-franchise-list.md */
import * as dotenv from 'dotenv'; dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'fs';

// [브랜드명, 핸들 정규식] — 구체적인 것 먼저. 매칭 안 되면 단독으로 분류.
const BRANDS: [string, RegExp][] = [
  ['제주아홉', /^9[._]*jeju/], ['야화', /^yahwa/], ['고도', /^godo/],
  ['곁', /gyut/], ['또똣', /^ddoddot/], ['노웨이브', /^nowave/], ['꼼바', /^commbar/],
  ['지옥도', /^jiokdo/], ['잔소리', /^jansori/], ['블렌딩바', /^blending/],
  ['내잔', /^naejan/], ['미열', /^miyeol/], ['도란', /^doran/], ['오내', /^onae/],
  ['지문인식', /^jimuninsik/], ['서울림', /^seoulrim/], ['될대로', /^ehlfeofh/],
  ['자유의지', /^freewill/], ['엮은이', /^the[._]editor/], ['자작(제주)', /^jeju_jajac/],
  ['43번지', /^43st/], ['유사길', /^yusagil/], ['헌집', /^old\.house/],
  ['혼술바제비', /^bar_jebi/], ['제주보름', /^jejumoon/], ['헤르츠', /^hertzbar/],
  ['제주연', /^jeju_ye0n/], ['날걷', /^nalgeod/], ['테이블포원', /^table_for/],
  ['주인', /^juin/], ['애프터퇴근', /^(after_work|makjan)/], ['사이사이', /^sai_sai/],
];
const CITY_KR: Record<string, string> = { seoul:'서울', gyeonggi:'경기', jeju:'제주', busan:'부산', incheon:'인천', daegu:'대구', chungbuk:'충북', gwangju:'광주', daejeon:'대전', chungnam:'충남', gyeongnam:'경남', gangwon:'강원', jeonbuk:'전북', gyeongbuk:'경북', ulsan:'울산', jeonnam:'전남', sejong:'세종' };

(async () => {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { data } = await sb.from('spots').select('name, instagram_id, city').eq('category','bar').order('name');
  const bars = data!;
  const groups: Record<string, {name:string;ig:string|null;city:string}[]> = {};
  const standalone: {name:string;ig:string|null;city:string}[] = [];
  for (const b of bars) {
    const ig = (b.instagram_id||'').toLowerCase();
    const hit = ig ? BRANDS.find(([,re]) => re.test(ig)) : null;
    if (hit) (groups[hit[0]] ??= []).push({name:b.name, ig:b.instagram_id, city:b.city});
    else standalone.push({name:b.name, ig:b.instagram_id, city:b.city});
  }
  // 2+ 지점만 프차. 1개짜리는 단독으로 강등.
  const fr = Object.entries(groups).filter(([,v])=>v.length>=2).sort((a,b)=>b[1].length-a[1].length);
  for (const [k,v] of Object.entries(groups)) if (v.length<2) standalone.push(...v);
  const frBranchTotal = fr.reduce((s,[,v])=>s+v.length,0);

  const L: string[] = [];
  L.push('# 혼술바 프랜차이즈 / 단독 가게 목록', '');
  L.push(`**기준일:** 2026-07-23 · **총 혼술바 ${bars.length}곳** = 체인 ${fr.length}개 브랜드 ${frBranchTotal}지점 + 단독 ${standalone.length}곳`);
  L.push('(핸들 프리픽스 기준 자동 그룹핑 · 2지점 이상 = 프랜차이즈)', '');
  L.push('> `scripts/gen_franchise_doc.ts` 로 DB에서 자동생성. 갱신하려면 재실행.', '');
  L.push('---', '', `## 🏢 프랜차이즈 (${fr.length}개 브랜드 · ${frBranchTotal}지점)`, '');
  L.push('| 브랜드 | 지점 | 지역 |', '|---|---|---|');
  for (const [brand, v] of fr) {
    const cities = [...new Set(v.map(x=>CITY_KR[x.city]||x.city))].join('·');
    L.push(`| **${brand}** | ${v.length} | ${cities} |`);
  }
  L.push('', '### 지점 상세', '');
  for (const [brand, v] of fr) {
    L.push(`**${brand} (${v.length})**`);
    L.push(v.map(x=>`${x.name.replace(/제주혼술바|혼술바/g,'').replace(/\s+/g,' ').trim()}${x.ig?` @${x.ig}`:' (IG없음)'}`).join(' · '));
    L.push('');
  }
  // 단독: 도시별 카운트
  L.push('---', '', `## 🍶 단독 가게 (${standalone.length}곳)`, '');
  const byCity: Record<string, {name:string;ig:string|null}[]> = {};
  for (const s of standalone) (byCity[s.city] ??= []).push({name:s.name, ig:s.ig});
  for (const [city, arr] of Object.entries(byCity).sort((a,b)=>b[1].length-a[1].length)) {
    L.push(`**${CITY_KR[city]||city} (${arr.length})**: ` + arr.map(x=>`${x.name}${x.ig?` @${x.ig}`:''}`).join(' · '));
  }
  L.push('', '---', '', '## DM 캠페인 우선순위', '');
  L.push(`체인 ${fr.length}곳 본사만 뚫으면 **${frBranchTotal}지점(전체의 ${Math.round(frBranchTotal/bars.length*100)}%)** 커버. 상위: ` + fr.slice(0,6).map(([b,v])=>`${b}(${v.length})`).join(' > ') + '.');

  writeFileSync('docs/bars-franchise-list.md', L.join('\n'), 'utf-8');
  console.log(`✓ 문서 생성: 총 ${bars.length}곳 · 프차 ${fr.length}브랜드 ${frBranchTotal}지점 · 단독 ${standalone.length}`);
  console.log('상위 프차:', fr.slice(0,8).map(([b,v])=>`${b} ${v.length}`).join(' / '));
})();
