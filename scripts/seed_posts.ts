import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

type Category = 'status' | 'review' | 'tip' | 'free';

interface SeedPost {
  category: Category;
  title: string;
  content: string;
  nickname: string;
  minutesAgo: number;
  likes: number;
  comments: number;
}

const SEED_POSTS: SeedPost[] = [
  { category: 'status', title: '애월 웨이브 지금 자리 많아요', content: '방금 도착. 창가 바로 앉음. 음악 좋고 사람 적음.', nickname: '혼술러', minutesAgo: 12, likes: 8, comments: 2 },
  { category: 'review', title: '제주시내 "달빛한잔" 3번째 방문 후기', content: '사장님이 기억해주셔서 감동. 한라산 보틀 5천원은 혜자임.', nickname: '달밤감성', minutesAgo: 45, likes: 23, comments: 7 },
  { category: 'tip', title: '제주 혼술바 예약 꿀팁', content: '금요일 저녁은 무조건 전화 예약. 특히 서귀포 구도심은 8시 이후 자리 없음.', nickname: '제주토박이', minutesAgo: 120, likes: 54, comments: 15 },
  { category: 'free', title: '오늘 비오는데 혼술 어디가 좋을까요', content: '애월보단 시내 쪽이 낫겠죠? 추천 좀요.', nickname: '비오는날', minutesAgo: 30, likes: 4, comments: 9 },
  { category: 'status', title: '서귀포 "바다소리" 웨이팅 30분', content: '사람 많음. 지금 오면 대기 확실.', nickname: '서귀포러버', minutesAgo: 8, likes: 3, comments: 1 },
  { category: 'review', title: '게스트하우스 바 중 최고는 어디?', content: '이번 여행에서 5군데 돌았는데 개인 순위 적어봄. 1위 협재 스테이...', nickname: '5박6일', minutesAgo: 180, likes: 31, comments: 12 },
  { category: 'tip', title: '혼자 갔을 때 어색하지 않게 노는 법', content: '1) 바 카운터에 앉기 2) 노트북은 꺼두기 3) 사장님한테 오늘 추천 뭔지 묻기. 이거면 끝.', nickname: '혼술10년차', minutesAgo: 240, likes: 72, comments: 19 },
  { category: 'free', title: '제주 음주운전 단속 정보 공유', content: '어제 애월~중문 구간 단속 많았음. 대리 미리 부르세요.', nickname: '안전제일', minutesAgo: 360, likes: 18, comments: 5 },
  { category: 'status', title: '함덕 "파도소리" 자리 있음', content: '지금 안쪽 구석 테이블 1자리 비어있어요.', nickname: '함덕지기', minutesAgo: 22, likes: 5, comments: 0 },
  { category: 'review', title: '애월 "노을바" 솔직 후기 (재방문X)', content: '분위기는 좋은데 가격 대비 아쉬움. 안주가 너무 적게 나옴.', nickname: '솔직리뷰', minutesAgo: 480, likes: 14, comments: 22 },
  { category: 'tip', title: '게스트하우스 파티 참여 시 주의사항', content: '음식은 가져가면 좋아하심. 술게임 빡센 곳 피하려면 "조용한 곳" 키워드 검색.', nickname: '게하마스터', minutesAgo: 720, likes: 40, comments: 8 },
  { category: 'free', title: '혼자 여행 3일차인데 우울하네요', content: '밤마다 혼술하는데 이게 맞나 싶음. 제주 좋은 사람들 있으신가요', nickname: '3일차', minutesAgo: 600, likes: 28, comments: 34 },
  { category: 'status', title: '중문 "ocean view" 라이브 시작함', content: '9시 어쿠스틱 공연 중. 분위기 최고.', nickname: '중문사람', minutesAgo: 5, likes: 11, comments: 3 },
  { category: 'review', title: '제주에서 마신 칵테일 TOP 3', content: '1. 한라봉 마티니 (달빛한잔) 2. 동백 모히또 (노을바) 3. 감귤 위스키 사워 (협재스테이)', nickname: '칵테일러버', minutesAgo: 840, likes: 65, comments: 11 },
  { category: 'tip', title: '공항에서 애월까지 대중교통 루트', content: '101번 → 애월리 하차. 택시보다 20분 더 걸리지만 만원 아낌.', nickname: '뚜벅이', minutesAgo: 1080, likes: 36, comments: 6 },
  { category: 'free', title: '제주 현지인한테 추천받고 싶어요', content: '관광객 적고 분위기 있는 곳. 예산은 인당 3-4만원 정도.', nickname: '서울러', minutesAgo: 1200, likes: 9, comments: 17 },
  { category: 'status', title: '구좌 "달과별" 오늘 휴무네요', content: '헛걸음. 인스타 공지도 없고. 다른 분들 참고하세요.', nickname: '헛걸음', minutesAgo: 60, likes: 21, comments: 4 },
  { category: 'review', title: '한라산 1병 = 서귀포 평균 가격', content: '5군데 조사 결과 평균 6,500원. 시내가 더 저렴한 편.', nickname: '가격조사단', minutesAgo: 1440, likes: 47, comments: 13 },
  { category: 'tip', title: '혼술맵 북마크 기능 활용법', content: '가고싶은 곳 미리 찜해두고 동선 짜면 효율적. 저는 지역별로 3-4개씩 찜해둠.', nickname: '혼술맵팬', minutesAgo: 1600, likes: 25, comments: 7 },
  { category: 'free', title: '제주 혼술바 주인장들 너무 좋아요', content: '어제 가게 6군데 돌면서 다 친절하셨음. 혼자 와도 편한 분위기 만들어주심.', nickname: '감동받은여행자', minutesAgo: 1800, likes: 88, comments: 21 },
];

async function seed() {
  const passwordHash = await bcrypt.hash('seed-password', 10);
  const now = Date.now();

  const rows = SEED_POSTS.map((p) => ({
    category: p.category,
    title: p.title,
    content: p.content,
    nickname: p.nickname,
    password_hash: passwordHash,
    image_urls: null,
    like_count: p.likes,
    comment_count: p.comments,
    created_at: new Date(now - p.minutesAgo * 60_000).toISOString(),
  }));

  console.log(`Inserting ${rows.length} seed posts...`);
  const { error, data } = await supabase.from('posts').insert(rows).select('id');
  if (error) {
    console.error('Insert error:', error.message);
    process.exit(1);
  }
  console.log(`Done. Inserted ${data?.length ?? 0} posts.`);
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
