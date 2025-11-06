CREATE TABLE reminder_log (
  key TEXT PRIMARY KEY,            -- e.g., pre24:trip:123
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


