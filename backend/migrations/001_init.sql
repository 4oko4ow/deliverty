-- 001_init.sql

CREATE TYPE pub_type AS ENUM ('request','trip');

CREATE TYPE item_type AS ENUM ('documents','small');

CREATE TYPE weight_band AS ENUM ('envelope','le1kg','le3kg');

CREATE TYPE deal_status AS ENUM ('new','agreed','handoff_done','cancelled');

CREATE TABLE app_user (
  id BIGSERIAL PRIMARY KEY,
  tg_user_id BIGINT UNIQUE NOT NULL,        -- Telegram user id
  tg_username TEXT,                         -- no contacts in descriptions, but store handle
  rating_small INT DEFAULT 0,               -- simple sum; can average later
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unified publications: both senders' requests and couriers' trips
CREATE TABLE publication (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  kind pub_type NOT NULL,                   -- request | trip
  from_iata CHAR(3) NOT NULL,
  to_iata   CHAR(3) NOT NULL,
  date_start DATE NOT NULL,
  date_end   DATE NOT NULL,                 -- window (<=14d enforced in app)
  item item_type NOT NULL DEFAULT 'documents',
  weight weight_band NOT NULL DEFAULT 'envelope',
  reward_hint INT,                          -- optional, in local currency text later
  description TEXT,
  -- Trip-only (nullable for requests)
  flight_no TEXT,
  airline TEXT,
  capacity_hint TEXT,                       -- e.g., "envelope/1kg/3kg"
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Precomputed matches (optional; can also compute on the fly)
CREATE TABLE match_candidate (
  id BIGSERIAL PRIMARY KEY,
  a_pub_id BIGINT NOT NULL REFERENCES publication(id) ON DELETE CASCADE,
  b_pub_id BIGINT NOT NULL REFERENCES publication(id) ON DELETE CASCADE,
  score SMALLINT NOT NULL DEFAULT 0,        -- simple rank
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(a_pub_id, b_pub_id)
);

-- Deal/relay chat envelope
CREATE TABLE deal (
  id BIGSERIAL PRIMARY KEY,
  request_pub_id BIGINT NOT NULL REFERENCES publication(id) ON DELETE CASCADE,
  trip_pub_id    BIGINT NOT NULL REFERENCES publication(id) ON DELETE CASCADE,
  status deal_status NOT NULL DEFAULT 'new',
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(request_pub_id, trip_pub_id)
);

-- Indexes for fast route/date matching
CREATE INDEX idx_pub_route_dates ON publication(from_iata, to_iata, date_start, date_end) WHERE is_active;
CREATE INDEX idx_pub_kind_active ON publication(kind, is_active);
CREATE INDEX idx_deal_status ON deal(status);









