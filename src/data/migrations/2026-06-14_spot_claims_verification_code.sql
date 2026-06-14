-- DM-code verification for ownership claims. On submit the owner gets a
-- one-time code; they DM it to @honsulmap FROM their venue's IG account, and
-- the operator matches the code + sender handle in /admin/claims before
-- approving. Run in the Supabase SQL Editor.
alter table spot_claims add column if not exists verification_code text;

notify pgrst, 'reload schema';
