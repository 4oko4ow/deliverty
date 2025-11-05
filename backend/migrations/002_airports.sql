-- 002_airports.sql

CREATE TABLE airport (
  iata CHAR(3) PRIMARY KEY,            -- e.g., BKK
  name TEXT NOT NULL,                   -- Suvarnabhumi Airport
  city TEXT,
  country TEXT,
  tz TEXT NOT NULL                      -- IANA tz, e.g., Asia/Bangkok
);

-- Optional: keep referential integrity (skip if you want flexibility during MVP)
-- Only add constraints if publication table exists and constraints don't exist yet
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'publication') THEN
    IF NOT EXISTS (SELECT FROM information_schema.table_constraints WHERE constraint_name = 'fk_pub_from') THEN
      ALTER TABLE publication ADD CONSTRAINT fk_pub_from FOREIGN KEY (from_iata) REFERENCES airport(iata);
    END IF;
    IF NOT EXISTS (SELECT FROM information_schema.table_constraints WHERE constraint_name = 'fk_pub_to') THEN
      ALTER TABLE publication ADD CONSTRAINT fk_pub_to FOREIGN KEY (to_iata) REFERENCES airport(iata);
    END IF;
  END IF;
END $$;

-- Extended seed: CIS countries and popular tourist destinations from CIS
INSERT INTO airport (iata, name, city, country, tz) VALUES
-- Russia (major cities)
('SVO','Sheremetyevo','Moscow','Russia','Europe/Moscow'),
('DME','Domodedovo','Moscow','Russia','Europe/Moscow'),
('VKO','Vnukovo','Moscow','Russia','Europe/Moscow'),
('LED','Pulkovo','Saint Petersburg','Russia','Europe/Moscow'),
('KRR','Krasnodar','Krasnodar','Russia','Europe/Moscow'),
('ROV','Rostov-on-Don','Rostov-on-Don','Russia','Europe/Moscow'),
('AER','Sochi','Sochi','Russia','Europe/Moscow'),
('KZN','Kazan','Kazan','Russia','Europe/Moscow'),
('UFA','Ufa','Ufa','Russia','Asia/Yekaterinburg'),
('SVX','Koltsovo','Yekaterinburg','Russia','Asia/Yekaterinburg'),
('OVB','Novosibirsk','Novosibirsk','Russia','Asia/Novosibirsk'),
('KJA','Krasnoyarsk','Krasnoyarsk','Russia','Asia/Krasnoyarsk'),
('IKT','Irkutsk','Irkutsk','Russia','Asia/Irkutsk'),
('VVO','Vladivostok','Vladivostok','Russia','Asia/Vladivostok'),
('KHV','Khabarovsk','Khabarovsk','Russia','Asia/Vladivostok'),
('KGD','Khrabrovo','Kaliningrad','Russia','Europe/Kaliningrad'),
('MRV','Mineralnye Vody','Mineralnye Vody','Russia','Europe/Moscow'),
('ASF','Astrakhan','Astrakhan','Russia','Europe/Samara'),
('OMS','Omsk','Omsk','Russia','Asia/Omsk'),
('TJM','Roshchino','Tyumen','Russia','Asia/Yekaterinburg'),
('CEK','Chelyabinsk','Chelyabinsk','Russia','Asia/Yekaterinburg'),
('NJC','Nizhnevartovsk','Nizhnevartovsk','Russia','Asia/Yekaterinburg'),
('BAX','Barnaul','Barnaul','Russia','Asia/Barnaul'),
('NUX','Novy Urengoy','Novy Urengoy','Russia','Asia/Yekaterinburg'),
-- Ukraine
('KBP','Boryspil','Kyiv','Ukraine','Europe/Kyiv'),
('IEV','Zhuliany','Kyiv','Ukraine','Europe/Kyiv'),
('ODS','Odessa','Odessa','Ukraine','Europe/Kyiv'),
('HRK','Kharkiv','Kharkiv','Ukraine','Europe/Kyiv'),
('DNK','Dnipro','Dnipro','Ukraine','Europe/Kyiv'),
('LWO','Lviv','Lviv','Ukraine','Europe/Kyiv'),
('ZTR','Zaporizhzhia','Zaporizhzhia','Ukraine','Europe/Kyiv'),
-- Belarus
('MSQ','Minsk National','Minsk','Belarus','Europe/Minsk'),
-- Kazakhstan
('ALA','Almaty','Almaty','Kazakhstan','Asia/Almaty'),
('NQZ','Nur-Sultan','Nur-Sultan','Kazakhstan','Asia/Almaty'),
('AKX','Aktobe','Aktobe','Kazakhstan','Asia/Aqtobe'),
('GUW','Atyrau','Atyrau','Kazakhstan','Asia/Atyrau'),
('KGF','Karaganda','Karaganda','Kazakhstan','Asia/Almaty'),
('PLX','Semey','Semey','Kazakhstan','Asia/Almaty'),
('SCO','Aktau','Aktau','Kazakhstan','Asia/Aqtau'),
('CIT','Shymkent','Shymkent','Kazakhstan','Asia/Almaty'),
('PWQ','Pavlodar','Pavlodar','Kazakhstan','Asia/Almaty'),
('UKK','Ust-Kamenogorsk','Ust-Kamenogorsk','Kazakhstan','Asia/Almaty'),
-- Uzbekistan
('TAS','Tashkent','Tashkent','Uzbekistan','Asia/Tashkent'),
('SKD','Samarkand','Samarkand','Uzbekistan','Asia/Samarkand'),
('BHK','Bukhara','Bukhara','Uzbekistan','Asia/Samarkand'),
-- Kyrgyzstan
('FRU','Manas','Bishkek','Kyrgyzstan','Asia/Bishkek'),
('OSS','Osh','Osh','Kyrgyzstan','Asia/Bishkek'),
-- Tajikistan
('DYU','Dushanbe','Dushanbe','Tajikistan','Asia/Dushanbe'),
-- Armenia
('EVN','Zvartnots','Yerevan','Armenia','Asia/Yerevan'),
-- Georgia
('TBS','Tbilisi','Tbilisi','Georgia','Asia/Tbilisi'),
('BUS','Batumi','Batumi','Georgia','Asia/Tbilisi'),
('KUT','Kutaisi','Kutaisi','Georgia','Asia/Tbilisi'),
-- Azerbaijan
('GYD','Heydar Aliyev','Baku','Azerbaijan','Asia/Baku'),
-- Moldova
('KIV','Chișinău','Chișinău','Moldova','Europe/Chisinau'),
-- Turkmenistan
('ASB','Ashgabat','Ashgabat','Turkmenistan','Asia/Ashgabat'),
-- Turkey (popular destination from CIS)
('IST','Istanbul','Istanbul','Turkey','Europe/Istanbul'),
('SAW','Sabiha Gokcen','Istanbul','Turkey','Europe/Istanbul'),
('AYT','Antalya','Antalya','Turkey','Europe/Istanbul'),
('DLM','Dalaman','Dalaman','Turkey','Europe/Istanbul'),
('BJV','Bodrum','Bodrum','Turkey','Europe/Istanbul'),
('IZM','Izmir','Izmir','Turkey','Europe/Istanbul'),
('ANK','Ankara','Ankara','Turkey','Europe/Istanbul'),
('ADB','Adnan Menderes','Izmir','Turkey','Europe/Istanbul'),
('BOD','Bodrum Milas','Bodrum','Turkey','Europe/Istanbul'),
('GZT','Gaziantep','Gaziantep','Turkey','Europe/Istanbul'),
-- UAE (popular destination)
('DXB','Dubai','Dubai','United Arab Emirates','Asia/Dubai'),
('AUH','Abu Dhabi','Abu Dhabi','United Arab Emirates','Asia/Dubai'),
('SHJ','Sharjah','Sharjah','United Arab Emirates','Asia/Dubai'),
-- Egypt (popular destination)
('CAI','Cairo','Cairo','Egypt','Africa/Cairo'),
('HRG','Hurghada','Hurghada','Egypt','Africa/Cairo'),
('SSH','Sharm El Sheikh','Sharm El Sheikh','Egypt','Africa/Cairo'),
-- Thailand (extended)
('BKK','Suvarnabhumi Airport','Bangkok','Thailand','Asia/Bangkok'),
('DMK','Don Mueang Intl','Bangkok','Thailand','Asia/Bangkok'),
('HKT','Phuket Intl','Phuket','Thailand','Asia/Bangkok'),
('USM','Koh Samui','Koh Samui','Thailand','Asia/Bangkok'),
('CNX','Chiang Mai','Chiang Mai','Thailand','Asia/Bangkok'),
('KBV','Krabi','Krabi','Thailand','Asia/Bangkok'),
('UTP','U-Tapao','Pattaya','Thailand','Asia/Bangkok'),
-- Vietnam
('SGN','Tan Son Nhat','Ho Chi Minh City','Vietnam','Asia/Ho_Chi_Minh'),
('HAN','Noi Bai','Hanoi','Vietnam','Asia/Ho_Chi_Minh'),
('DAD','Da Nang','Da Nang','Vietnam','Asia/Ho_Chi_Minh'),
('NHA','Cam Ranh','Nha Trang','Vietnam','Asia/Ho_Chi_Minh'),
-- India
('DEL','Indira Gandhi','New Delhi','India','Asia/Kolkata'),
('BOM','Chhatrapati Shivaji','Mumbai','India','Asia/Kolkata'),
('BLR','Kempegowda','Bangalore','India','Asia/Kolkata'),
('CCU','Netaji Subhash Chandra Bose','Kolkata','India','Asia/Kolkata'),
('MAA','Chennai','Chennai','India','Asia/Kolkata'),
('GOI','Dabolim','Goa','India','Asia/Kolkata'),
-- Sri Lanka
('CMB','Bandaranaike','Colombo','Sri Lanka','Asia/Colombo'),
-- Maldives
('MLE','Velana','Male','Maldives','Indian/Maldives'),
-- Spain (popular destination)
('MAD','Barajas','Madrid','Spain','Europe/Madrid'),
('BCN','El Prat','Barcelona','Spain','Europe/Madrid'),
('PMI','Palma de Mallorca','Palma','Spain','Europe/Madrid'),
('AGP','Malaga','Malaga','Spain','Europe/Madrid'),
('ALC','Alicante','Alicante','Spain','Europe/Madrid'),
('IBZ','Ibiza','Ibiza','Spain','Europe/Madrid'),
-- Italy
('FCO','Fiumicino','Rome','Italy','Europe/Rome'),
('MXP','Malpensa','Milan','Italy','Europe/Rome'),
('VCE','Marco Polo','Venice','Italy','Europe/Rome'),
('NAP','Naples','Naples','Italy','Europe/Rome'),
('FLR','Peretola','Florence','Italy','Europe/Rome'),
-- Greece
('ATH','Eleftherios Venizelos','Athens','Greece','Europe/Athens'),
('HER','Heraklion','Heraklion','Greece','Europe/Athens'),
('RHO','Rhodes','Rhodes','Greece','Europe/Athens'),
('JTR','Santorini','Santorini','Greece','Europe/Athens'),
-- Cyprus
('LCA','Larnaca','Larnaca','Cyprus','Asia/Nicosia'),
('PFO','Paphos','Paphos','Cyprus','Asia/Nicosia'),
-- Bulgaria
('SOF','Sofia','Sofia','Bulgaria','Europe/Sofia'),
('VAR','Varna','Varna','Bulgaria','Europe/Sofia'),
('BOJ','Burgas','Burgas','Bulgaria','Europe/Sofia'),
-- Montenegro
('TGD','Podgorica','Podgorica','Montenegro','Europe/Podgorica'),
('TIV','Tivat','Tivat','Montenegro','Europe/Podgorica'),
-- Croatia
('ZAG','Zagreb','Zagreb','Croatia','Europe/Zagreb'),
('SPU','Split','Split','Croatia','Europe/Zagreb'),
('DBV','Dubrovnik','Dubrovnik','Croatia','Europe/Zagreb'),
-- Serbia
('BEG','Belgrade','Belgrade','Serbia','Europe/Belgrade'),
-- Czech Republic
('PRG','Václav Havel','Prague','Czech Republic','Europe/Prague'),
-- Poland
('WAW','Warsaw Chopin','Warsaw','Poland','Europe/Warsaw'),
('KRK','Krakow','Krakow','Poland','Europe/Warsaw'),
-- Hungary
('BUD','Budapest','Budapest','Hungary','Europe/Budapest'),
-- Austria
('VIE','Vienna','Vienna','Austria','Europe/Vienna'),
-- Germany
('MUC','Munich','Munich','Germany','Europe/Berlin'),
('FRA','Frankfurt','Frankfurt','Germany','Europe/Berlin'),
('TXL','Tegel','Berlin','Germany','Europe/Berlin'),
('BER','Berlin Brandenburg','Berlin','Germany','Europe/Berlin'),
-- France
('CDG','Charles de Gaulle','Paris','France','Europe/Paris'),
('ORY','Orly','Paris','France','Europe/Paris'),
('NCE','Nice','Nice','France','Europe/Paris'),
-- Netherlands
('AMS','Schiphol','Amsterdam','Netherlands','Europe/Amsterdam'),
-- United Kingdom
('LHR','Heathrow','London','United Kingdom','Europe/London'),
('LGW','Gatwick','London','United Kingdom','Europe/London'),
-- Finland
('HEL','Helsinki-Vantaa','Helsinki','Finland','Europe/Helsinki'),
-- Estonia
('TLL','Tallinn','Tallinn','Estonia','Europe/Tallinn'),
-- Latvia
('RIX','Riga','Riga','Latvia','Europe/Riga'),
-- Lithuania
('VNO','Vilnius','Vilnius','Lithuania','Europe/Vilnius'),
-- China (popular transit/destination)
('PEK','Capital','Beijing','China','Asia/Shanghai'),
('PVG','Pudong','Shanghai','China','Asia/Shanghai'),
('CAN','Baiyun','Guangzhou','China','Asia/Shanghai'),
('SZX','Shenzhen','Shenzhen','China','Asia/Shanghai'),
-- Japan
('NRT','Narita','Tokyo','Japan','Asia/Tokyo'),
('HND','Haneda','Tokyo','Japan','Asia/Tokyo'),
-- South Korea
('ICN','Incheon','Seoul','South Korea','Asia/Seoul'),
-- Singapore
('SIN','Changi','Singapore','Singapore','Asia/Singapore'),
-- Malaysia
('KUL','Kuala Lumpur','Kuala Lumpur','Malaysia','Asia/Kuala_Lumpur'),
-- Indonesia
('CGK','Soekarno-Hatta','Jakarta','Indonesia','Asia/Jakarta'),
('DPS','Ngurah Rai','Bali','Indonesia','Asia/Makassar'),
-- Philippines
('MNL','Ninoy Aquino','Manila','Philippines','Asia/Manila'),
-- Australia
('SYD','Sydney','Sydney','Australia','Australia/Sydney'),
('MEL','Melbourne','Melbourne','Australia','Australia/Melbourne'),
-- New Zealand
('AKL','Auckland','Auckland','New Zealand','Pacific/Auckland'),
-- USA (major hubs)
('JFK','John F. Kennedy','New York','United States','America/New_York'),
('LAX','Los Angeles','Los Angeles','United States','America/Los_Angeles'),
('MIA','Miami','Miami','United States','America/New_York'),
-- Canada
('YYZ','Pearson','Toronto','Canada','America/Toronto'),
('YVR','Vancouver','Vancouver','Canada','America/Vancouver'),
-- Brazil
('GRU','Guarulhos','São Paulo','Brazil','America/Sao_Paulo'),
('GIG','Galeão','Rio de Janeiro','Brazil','America/Sao_Paulo');

-- Later: import a full list (IATA, name, tz) from OpenFlights or OurAirports CSV.
