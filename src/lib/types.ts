// ===== Database Types =====

export type SpotCategory = 'bar' | 'guesthouse' | 'pub' | 'wine_bar' | 'karaoke_bar';
export type Region = 'jeju' | 'aewol' | 'seogwipo' | 'east' | 'west';
export type PostCategory = 'status' | 'review' | 'tip' | 'free';
export type MediaType = 'image' | 'video';
export type TargetType = 'spot' | 'post' | 'comment';
export type MoodVoteType = 'up' | 'down';

export interface Spot {
  id: string;
  name: string;
  slug: string;
  instagram_id: string | null;
  category: SpotCategory;
  region: Region;
  address: string;
  lat: number;
  lng: number;
  phone: string | null;
  business_hours: string | null;
  memo: string | null;
  naver_place_id: string | null;
  like_count: number;
  mood_up: number;
  mood_down: number;
  image_urls: string[] | null;
  created_at: string;
}

export interface Story {
  id: string;
  spot_id: string;
  instagram_id: string;
  media_url: string;
  media_type: MediaType;
  thumbnail_url: string | null;
  posted_at: string;
  expires_at: string;
  scraped_at: string;
}

export interface Post {
  id: string;
  spot_id: string | null;
  category: PostCategory;
  title: string;
  content: string;
  nickname: string;
  password_hash: string;
  image_urls: string[] | null;
  like_count: number;
  comment_count: number;
  created_at: string;
  // joined
  spot?: Spot | null;
}

export interface Comment {
  id: string;
  post_id: string | null;
  spot_id: string | null;
  parent_id: string | null;
  nickname: string;
  password_hash: string;
  content: string;
  like_count: number;
  created_at: string;
  // nested
  replies?: Comment[];
}

export interface Like {
  id: string;
  target_type: TargetType;
  target_id: string;
  fingerprint: string;
  created_at: string;
}

export interface MoodVote {
  id: string;
  spot_id: string;
  vote: MoodVoteType;
  fingerprint: string;
}

export interface ContributionRanking {
  nickname: string;
  post_count: number;
  status_count: number;
  review_count: number;
  total_likes: number;
  score: number;
}

// ===== API Request/Response Types =====

export interface SpotWithStories extends Spot {
  stories: Story[];
  latest_story_at: string | null;
}

export interface PostCreateRequest {
  category: PostCategory;
  title: string;
  content: string;
  nickname: string;
  password: string;
  spot_id?: string;
  image_urls?: string[];
}

export interface CommentCreateRequest {
  post_id?: string;
  spot_id?: string;
  parent_id?: string;
  nickname: string;
  password: string;
  content: string;
}

// ===== Filter Types =====

export const REGIONS: { value: Region | 'all'; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'jeju', label: '제주시' },
  { value: 'aewol', label: '애월' },
  { value: 'seogwipo', label: '서귀포' },
  { value: 'east', label: '동쪽' },
  { value: 'west', label: '서쪽' },
];

export const POST_CATEGORIES: { value: PostCategory | 'all'; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'status', label: '현황' },
  { value: 'review', label: '후기' },
  { value: 'tip', label: '꿀팁' },
  { value: 'free', label: '자유' },
];
