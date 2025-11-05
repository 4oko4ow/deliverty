CREATE TABLE rating_log (
  deal_id BIGINT NOT NULL REFERENCES deal(id) ON DELETE CASCADE,
  rater_tg BIGINT NOT NULL,
  target_user_id BIGINT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (deal_id, rater_tg)
);

