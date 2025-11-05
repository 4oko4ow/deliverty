-- 005_change_trip_date.sql
-- Change date_start/date_end to single date for trips only
-- Requests keep date_start/date_end (range)

-- Add new date column for trips (nullable, only used for kind='trip')
ALTER TABLE publication ADD COLUMN date DATE;

-- Migrate existing trip data: use date_start as the single date
UPDATE publication SET date = date_start WHERE kind = 'trip' AND date IS NULL;

-- For trips, date_start and date_end should be the same (we'll keep them for compatibility but ignore date_end)
-- Actually, let's keep both columns but make date_start the primary for trips

-- Create table for contact requests
CREATE TABLE contact_request (
  id BIGSERIAL PRIMARY KEY,
  publication_id BIGINT NOT NULL REFERENCES publication(id) ON DELETE CASCADE,
  requester_user_id BIGINT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, agreed, declined
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(publication_id, requester_user_id)
);

CREATE INDEX idx_contact_request_pub ON contact_request(publication_id);
CREATE INDEX idx_contact_request_requester ON contact_request(requester_user_id);
CREATE INDEX idx_contact_request_status ON contact_request(status);

-- Update index to include date for trips
DROP INDEX IF EXISTS idx_pub_route_dates;
CREATE INDEX idx_pub_route_dates ON publication(from_iata, to_iata, date_start, date_end) WHERE is_active AND kind = 'request';
CREATE INDEX idx_pub_route_date_trip ON publication(from_iata, to_iata, date) WHERE is_active AND kind = 'trip';

