-- Admin MVP: user-submitted spot requests and post/comment reports.
-- Both tables accept anonymous inserts (enforced via API) and are read
-- by admin endpoints using the service role key, which bypasses RLS.

-- ============================================================
-- TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS spot_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  ig_handle       TEXT,
  region          TEXT NOT NULL
                    CHECK (region IN ('jeju', 'aewol', 'seogwipo', 'east', 'west')),
  category        TEXT NOT NULL DEFAULT 'bar'
                    CHECK (category IN ('bar', 'guesthouse')),
  address         TEXT,
  note            TEXT,
  fingerprint     TEXT,
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewer_note   TEXT,
  created_spot_id UUID REFERENCES spots(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at     TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS reports (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type     TEXT NOT NULL CHECK (target_type IN ('post', 'comment')),
  target_id       UUID NOT NULL,
  reason          TEXT NOT NULL
                    CHECK (reason IN ('spam', 'abuse', 'illegal', 'other')),
  detail          TEXT,
  fingerprint     TEXT,
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'resolved', 'dismissed')),
  resolver_note   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at     TIMESTAMPTZ,

  -- Prevent the same browser from reporting the same target repeatedly
  CONSTRAINT reports_unique_per_fingerprint
    UNIQUE (target_type, target_id, fingerprint)
);


-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_spot_requests_status
  ON spot_requests (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_reports_status
  ON reports (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_reports_target
  ON reports (target_type, target_id);


-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE spot_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports       ENABLE ROW LEVEL SECURITY;

-- Anon can submit requests/reports; reads are gated through admin API
-- using the service role, so no SELECT policy is granted to anon.
CREATE POLICY "spot_requests_insert_anon"
  ON spot_requests FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "reports_insert_anon"
  ON reports FOR INSERT
  TO anon
  WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
