-- 006_add_city_ru.sql
-- Add Russian city names for better search support

ALTER TABLE airport ADD COLUMN IF NOT EXISTS city_ru TEXT;

-- Russia
UPDATE airport SET city_ru = 'Москва' WHERE iata = 'SVO';
UPDATE airport SET city_ru = 'Москва' WHERE iata = 'DME';
UPDATE airport SET city_ru = 'Москва' WHERE iata = 'VKO';
UPDATE airport SET city_ru = 'Санкт-Петербург' WHERE iata = 'LED';
UPDATE airport SET city_ru = 'Краснодар' WHERE iata = 'KRR';
UPDATE airport SET city_ru = 'Ростов-на-Дону' WHERE iata = 'ROV';
UPDATE airport SET city_ru = 'Сочи' WHERE iata = 'AER';
UPDATE airport SET city_ru = 'Казань' WHERE iata = 'KZN';
UPDATE airport SET city_ru = 'Уфа' WHERE iata = 'UFA';
UPDATE airport SET city_ru = 'Екатеринбург' WHERE iata = 'SVX';
UPDATE airport SET city_ru = 'Новосибирск' WHERE iata = 'OVB';
UPDATE airport SET city_ru = 'Красноярск' WHERE iata = 'KJA';
UPDATE airport SET city_ru = 'Иркутск' WHERE iata = 'IKT';
UPDATE airport SET city_ru = 'Владивосток' WHERE iata = 'VVO';
UPDATE airport SET city_ru = 'Хабаровск' WHERE iata = 'KHV';
UPDATE airport SET city_ru = 'Калининград' WHERE iata = 'KGD';
UPDATE airport SET city_ru = 'Минеральные Воды' WHERE iata = 'MRV';
UPDATE airport SET city_ru = 'Астрахань' WHERE iata = 'ASF';
UPDATE airport SET city_ru = 'Махачкала' WHERE iata = 'MCX';
UPDATE airport SET city_ru = 'Грозный' WHERE iata = 'GRZ';
UPDATE airport SET city_ru = 'Омск' WHERE iata = 'OMS';
UPDATE airport SET city_ru = 'Тюмень' WHERE iata = 'TJM';
UPDATE airport SET city_ru = 'Челябинск' WHERE iata = 'CEK';
UPDATE airport SET city_ru = 'Нижневартовск' WHERE iata = 'NJC';
UPDATE airport SET city_ru = 'Барнаул' WHERE iata = 'BAX';
UPDATE airport SET city_ru = 'Новый Уренгой' WHERE iata = 'NUX';
UPDATE airport SET city_ru = 'Самара' WHERE iata = 'KUF';
UPDATE airport SET city_ru = 'Пермь' WHERE iata = 'PEE';
UPDATE airport SET city_ru = 'Саратов' WHERE iata = 'RTW';
UPDATE airport SET city_ru = 'Волгоград' WHERE iata = 'VOG';
UPDATE airport SET city_ru = 'Воронеж' WHERE iata = 'VOZ';
UPDATE airport SET city_ru = 'Белгород' WHERE iata = 'EGO';
UPDATE airport SET city_ru = 'Мурманск' WHERE iata = 'MMK';
UPDATE airport SET city_ru = 'Архангельск' WHERE iata = 'ARH';
UPDATE airport SET city_ru = 'Псков' WHERE iata = 'PKV';
UPDATE airport SET city_ru = 'Сыктывкар' WHERE iata = 'SCW';
UPDATE airport SET city_ru = 'Иваново' WHERE iata = 'IWA';
UPDATE airport SET city_ru = 'Тверь' WHERE iata = 'KLD';
UPDATE airport SET city_ru = 'Калуга' WHERE iata = 'KLF';
UPDATE airport SET city_ru = 'Орск' WHERE iata = 'OSW';
UPDATE airport SET city_ru = 'Сургут' WHERE iata = 'SGC';
UPDATE airport SET city_ru = 'Магнитогорск' WHERE iata = 'MQF';
UPDATE airport SET city_ru = 'Брянск' WHERE iata = 'BZK';
UPDATE airport SET city_ru = 'Кострома' WHERE iata = 'KMW';
UPDATE airport SET city_ru = 'Липецк' WHERE iata = 'LPK';
UPDATE airport SET city_ru = 'Набережные Челны' WHERE iata = 'NBC';
UPDATE airport SET city_ru = 'Рязань' WHERE iata = 'RZN';
UPDATE airport SET city_ru = 'Тамбов' WHERE iata = 'TBW';
UPDATE airport SET city_ru = 'Томск' WHERE iata = 'TOF';
UPDATE airport SET city_ru = 'Ульяновск' WHERE iata = 'ULY';
UPDATE airport SET city_ru = 'Якутск' WHERE iata = 'YKS';
UPDATE airport SET city_ru = 'Мирный' WHERE iata = 'MJZ';
UPDATE airport SET city_ru = 'Петропавловск-Камчатский' WHERE iata = 'PKC';

-- Ukraine
UPDATE airport SET city_ru = 'Киев' WHERE iata = 'KBP';
UPDATE airport SET city_ru = 'Киев' WHERE iata = 'IEV';
UPDATE airport SET city_ru = 'Одесса' WHERE iata = 'ODS';
UPDATE airport SET city_ru = 'Харьков' WHERE iata = 'HRK';
UPDATE airport SET city_ru = 'Днепр' WHERE iata = 'DNK';
UPDATE airport SET city_ru = 'Львов' WHERE iata = 'LWO';
UPDATE airport SET city_ru = 'Запорожье' WHERE iata = 'ZTR';

-- Belarus
UPDATE airport SET city_ru = 'Минск' WHERE iata = 'MSQ';

-- Kazakhstan
UPDATE airport SET city_ru = 'Алматы' WHERE iata = 'ALA';
UPDATE airport SET city_ru = 'Нур-Султан' WHERE iata = 'NQZ';
UPDATE airport SET city_ru = 'Актобе' WHERE iata = 'AKX';
UPDATE airport SET city_ru = 'Атырау' WHERE iata = 'GUW';
UPDATE airport SET city_ru = 'Караганда' WHERE iata = 'KGF';
UPDATE airport SET city_ru = 'Семей' WHERE iata = 'PLX';
UPDATE airport SET city_ru = 'Актау' WHERE iata = 'SCO';
UPDATE airport SET city_ru = 'Шымкент' WHERE iata = 'CIT';
UPDATE airport SET city_ru = 'Павлодар' WHERE iata = 'PWQ';
UPDATE airport SET city_ru = 'Усть-Каменогорск' WHERE iata = 'UKK';
UPDATE airport SET city_ru = 'Кызылорда' WHERE iata = 'KZO';
UPDATE airport SET city_ru = 'Талдыкорган' WHERE iata = 'TDK';
UPDATE airport SET city_ru = 'Жезказган' WHERE iata = 'DZN';
UPDATE airport SET city_ru = 'Костанай' WHERE iata = 'KSN';
UPDATE airport SET city_ru = 'Тараз' WHERE iata = 'KVD';

-- Uzbekistan
UPDATE airport SET city_ru = 'Ташкент' WHERE iata = 'TAS';
UPDATE airport SET city_ru = 'Самарканд' WHERE iata = 'SKD';
UPDATE airport SET city_ru = 'Бухара' WHERE iata = 'BHK';

-- Kyrgyzstan
UPDATE airport SET city_ru = 'Бишкек' WHERE iata = 'FRU';
UPDATE airport SET city_ru = 'Ош' WHERE iata = 'OSS';

-- Tajikistan
UPDATE airport SET city_ru = 'Душанбе' WHERE iata = 'DYU';

-- Armenia
UPDATE airport SET city_ru = 'Ереван' WHERE iata = 'EVN';

-- Georgia
UPDATE airport SET city_ru = 'Тбилиси' WHERE iata = 'TBS';
UPDATE airport SET city_ru = 'Батуми' WHERE iata = 'BUS';
UPDATE airport SET city_ru = 'Кутаиси' WHERE iata = 'KUT';

-- Azerbaijan
UPDATE airport SET city_ru = 'Баку' WHERE iata = 'GYD';

-- Moldova
UPDATE airport SET city_ru = 'Кишинёв' WHERE iata = 'KIV';

-- Turkmenistan
UPDATE airport SET city_ru = 'Ашхабад' WHERE iata = 'ASB';

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

