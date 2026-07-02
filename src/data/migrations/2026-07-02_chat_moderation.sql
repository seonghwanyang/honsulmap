-- 채팅 메시지 신고를 기존 reports 시스템에 편입. target_type에 'chat_message' 추가.
-- (삭제는 chat_messages.is_deleted 소프트삭제 — 스키마 변경 불필요.)
ALTER TABLE reports DROP CONSTRAINT IF EXISTS reports_target_type_check;
ALTER TABLE reports
  ADD CONSTRAINT reports_target_type_check
  CHECK (target_type IN ('post', 'comment', 'chat_message'));
