-- Public 'post-images' bucket for community-post photo uploads from
-- the /write page. Anonymous users insert; everyone reads.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'post-images',
  'post-images',
  true,
  5242880,                          -- 5 MB per file
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Anon can upload (the API has its own validation already; storage just
-- enforces the bucket-level mime/size caps above).
DROP POLICY IF EXISTS "post_images_insert_anon" ON storage.objects;
CREATE POLICY "post_images_insert_anon"
  ON storage.objects FOR INSERT
  TO anon
  WITH CHECK (bucket_id = 'post-images');

-- Public read so honsulmap.com (and the post detail page) can <img src=>
-- the URLs without signed download tokens.
DROP POLICY IF EXISTS "post_images_select_public" ON storage.objects;
CREATE POLICY "post_images_select_public"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'post-images');
