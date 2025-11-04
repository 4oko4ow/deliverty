-- 002_airports.sql

CREATE TABLE airport (
  iata CHAR(3) PRIMARY KEY,            -- e.g., BKK
  name TEXT NOT NULL,                   -- Suvarnabhumi Airport
  city TEXT,
  country TEXT,
  tz TEXT NOT NULL                      -- IANA tz, e.g., Asia/Bangkok
);

-- Optional: keep referential integrity (skip if you want flexibility during MVP)
ALTER TABLE publication
  ADD CONSTRAINT fk_pub_from FOREIGN KEY (from_iata) REFERENCES airport(iata),
  ADD CONSTRAINT fk_pub_to   FOREIGN KEY (to_iata)   REFERENCES airport(iata);

-- Minimal seed (replace with full CSV later)
INSERT INTO airport (iata, name, city, country, tz) VALUES
('BKK','Suvarnabhumi Airport','Bangkok','Thailand','Asia/Bangkok'),
('DMK','Don Mueang Intl','Bangkok','Thailand','Asia/Bangkok'),
('SVO','Sheremetyevo','Moscow','Russia','Europe/Moscow'),
('DME','Domodedovo','Moscow','Russia','Europe/Moscow'),
('HKT','Phuket Intl','Phuket','Thailand','Asia/Bangkok');

-- Later: import a full list (IATA, name, tz) from OpenFlights or OurAirports CSV.
