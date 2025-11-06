-- 006_add_city_ru.sql
-- Add Russian city names for better search support

ALTER TABLE airport ADD COLUMN IF NOT EXISTS city_ru TEXT;

-- Update Vietnam airports with Russian names
UPDATE airport SET city_ru = 'Ханой' WHERE iata = 'HAN';
UPDATE airport SET city_ru = 'Хошимин' WHERE iata = 'SGN';
UPDATE airport SET city_ru = 'Дананг' WHERE iata = 'DAD';
UPDATE airport SET city_ru = 'Нячанг' WHERE iata = 'NHA';

-- Update other popular destinations with Russian names
UPDATE airport SET city_ru = 'Бангкок' WHERE iata = 'BKK';
UPDATE airport SET city_ru = 'Бангкок' WHERE iata = 'DMK';
UPDATE airport SET city_ru = 'Пхукет' WHERE iata = 'HKT';
UPDATE airport SET city_ru = 'Самуи' WHERE iata = 'USM';
UPDATE airport SET city_ru = 'Чиангмай' WHERE iata = 'CNX';
UPDATE airport SET city_ru = 'Краби' WHERE iata = 'KBV';
UPDATE airport SET city_ru = 'Паттайя' WHERE iata = 'UTP';

-- Turkey
UPDATE airport SET city_ru = 'Стамбул' WHERE iata = 'IST';
UPDATE airport SET city_ru = 'Стамбул' WHERE iata = 'SAW';
UPDATE airport SET city_ru = 'Анталья' WHERE iata = 'AYT';
UPDATE airport SET city_ru = 'Даламан' WHERE iata = 'DLM';
UPDATE airport SET city_ru = 'Бодрум' WHERE iata = 'BJV';
UPDATE airport SET city_ru = 'Измир' WHERE iata = 'IZM';
UPDATE airport SET city_ru = 'Анкара' WHERE iata = 'ANK';

-- UAE
UPDATE airport SET city_ru = 'Дубай' WHERE iata = 'DXB';
UPDATE airport SET city_ru = 'Дубай' WHERE iata = 'DWC';
UPDATE airport SET city_ru = 'Абу-Даби' WHERE iata = 'AUH';
UPDATE airport SET city_ru = 'Шарджа' WHERE iata = 'SHJ';

-- Egypt
UPDATE airport SET city_ru = 'Каир' WHERE iata = 'CAI';
UPDATE airport SET city_ru = 'Хургада' WHERE iata = 'HRG';
UPDATE airport SET city_ru = 'Шарм-эль-Шейх' WHERE iata = 'SSH';

-- China
UPDATE airport SET city_ru = 'Пекин' WHERE iata = 'PEK';
UPDATE airport SET city_ru = 'Шанхай' WHERE iata = 'PVG';
UPDATE airport SET city_ru = 'Гуанчжоу' WHERE iata = 'CAN';
UPDATE airport SET city_ru = 'Шэньчжэнь' WHERE iata = 'SZX';

-- Japan
UPDATE airport SET city_ru = 'Токио' WHERE iata = 'NRT';
UPDATE airport SET city_ru = 'Токио' WHERE iata = 'HND';

-- South Korea
UPDATE airport SET city_ru = 'Сеул' WHERE iata = 'ICN';

-- Singapore
UPDATE airport SET city_ru = 'Сингапур' WHERE iata = 'SIN';

-- Malaysia
UPDATE airport SET city_ru = 'Куала-Лумпур' WHERE iata = 'KUL';

-- Indonesia
UPDATE airport SET city_ru = 'Джакарта' WHERE iata = 'CGK';
UPDATE airport SET city_ru = 'Бали' WHERE iata = 'DPS';

-- Philippines
UPDATE airport SET city_ru = 'Манила' WHERE iata = 'MNL';

-- India
UPDATE airport SET city_ru = 'Дели' WHERE iata = 'DEL';
UPDATE airport SET city_ru = 'Мумбаи' WHERE iata = 'BOM';
UPDATE airport SET city_ru = 'Бангалор' WHERE iata = 'BLR';
UPDATE airport SET city_ru = 'Калькутта' WHERE iata = 'CCU';
UPDATE airport SET city_ru = 'Ченнаи' WHERE iata = 'MAA';
UPDATE airport SET city_ru = 'Гоа' WHERE iata = 'GOI';

-- Sri Lanka
UPDATE airport SET city_ru = 'Коломбо' WHERE iata = 'CMB';

-- Maldives
UPDATE airport SET city_ru = 'Мале' WHERE iata = 'MLE';

-- Europe
UPDATE airport SET city_ru = 'Мадрид' WHERE iata = 'MAD';
UPDATE airport SET city_ru = 'Барселона' WHERE iata = 'BCN';
UPDATE airport SET city_ru = 'Пальма' WHERE iata = 'PMI';
UPDATE airport SET city_ru = 'Малага' WHERE iata = 'AGP';
UPDATE airport SET city_ru = 'Аликанте' WHERE iata = 'ALC';
UPDATE airport SET city_ru = 'Ибица' WHERE iata = 'IBZ';

UPDATE airport SET city_ru = 'Рим' WHERE iata = 'FCO';
UPDATE airport SET city_ru = 'Милан' WHERE iata = 'MXP';
UPDATE airport SET city_ru = 'Венеция' WHERE iata = 'VCE';
UPDATE airport SET city_ru = 'Неаполь' WHERE iata = 'NAP';
UPDATE airport SET city_ru = 'Флоренция' WHERE iata = 'FLR';

UPDATE airport SET city_ru = 'Афины' WHERE iata = 'ATH';
UPDATE airport SET city_ru = 'Ираклион' WHERE iata = 'HER';
UPDATE airport SET city_ru = 'Родос' WHERE iata = 'RHO';
UPDATE airport SET city_ru = 'Санторини' WHERE iata = 'JTR';

UPDATE airport SET city_ru = 'Ларнака' WHERE iata = 'LCA';
UPDATE airport SET city_ru = 'Пафос' WHERE iata = 'PFO';

UPDATE airport SET city_ru = 'София' WHERE iata = 'SOF';
UPDATE airport SET city_ru = 'Варна' WHERE iata = 'VAR';
UPDATE airport SET city_ru = 'Бургас' WHERE iata = 'BOJ';

UPDATE airport SET city_ru = 'Подгорица' WHERE iata = 'TGD';
UPDATE airport SET city_ru = 'Тиват' WHERE iata = 'TIV';

UPDATE airport SET city_ru = 'Загреб' WHERE iata = 'ZAG';
UPDATE airport SET city_ru = 'Сплит' WHERE iata = 'SPU';
UPDATE airport SET city_ru = 'Дубровник' WHERE iata = 'DBV';

UPDATE airport SET city_ru = 'Белград' WHERE iata = 'BEG';

UPDATE airport SET city_ru = 'Прага' WHERE iata = 'PRG';

UPDATE airport SET city_ru = 'Варшава' WHERE iata = 'WAW';
UPDATE airport SET city_ru = 'Краков' WHERE iata = 'KRK';

UPDATE airport SET city_ru = 'Будапешт' WHERE iata = 'BUD';

UPDATE airport SET city_ru = 'Вена' WHERE iata = 'VIE';

UPDATE airport SET city_ru = 'Мюнхен' WHERE iata = 'MUC';
UPDATE airport SET city_ru = 'Франкфурт' WHERE iata = 'FRA';
UPDATE airport SET city_ru = 'Берлин' WHERE iata = 'TXL';
UPDATE airport SET city_ru = 'Берлин' WHERE iata = 'BER';

UPDATE airport SET city_ru = 'Париж' WHERE iata = 'CDG';
UPDATE airport SET city_ru = 'Париж' WHERE iata = 'ORY';
UPDATE airport SET city_ru = 'Ницца' WHERE iata = 'NCE';

UPDATE airport SET city_ru = 'Амстердам' WHERE iata = 'AMS';

UPDATE airport SET city_ru = 'Лондон' WHERE iata = 'LHR';
UPDATE airport SET city_ru = 'Лондон' WHERE iata = 'LGW';

UPDATE airport SET city_ru = 'Хельсинки' WHERE iata = 'HEL';

UPDATE airport SET city_ru = 'Таллин' WHERE iata = 'TLL';

UPDATE airport SET city_ru = 'Рига' WHERE iata = 'RIX';

UPDATE airport SET city_ru = 'Вильнюс' WHERE iata = 'VNO';

-- USA
UPDATE airport SET city_ru = 'Нью-Йорк' WHERE iata = 'JFK';
UPDATE airport SET city_ru = 'Лос-Анджелес' WHERE iata = 'LAX';
UPDATE airport SET city_ru = 'Майами' WHERE iata = 'MIA';

-- Canada
UPDATE airport SET city_ru = 'Торонто' WHERE iata = 'YYZ';
UPDATE airport SET city_ru = 'Ванкувер' WHERE iata = 'YVR';

-- Brazil
UPDATE airport SET city_ru = 'Сан-Паулу' WHERE iata = 'GRU';
UPDATE airport SET city_ru = 'Рио-де-Жанейро' WHERE iata = 'GIG';

-- Australia
UPDATE airport SET city_ru = 'Сидней' WHERE iata = 'SYD';
UPDATE airport SET city_ru = 'Мельбурн' WHERE iata = 'MEL';

-- New Zealand
UPDATE airport SET city_ru = 'Окленд' WHERE iata = 'AKL';

