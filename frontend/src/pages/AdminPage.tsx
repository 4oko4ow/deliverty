import { useState, useEffect } from "react";
import AirportInput from "../components/AirportInput";
import SEO from "../components/SEO";
import { api, isAuthenticated } from "../lib/api";
import { useNavigate } from "react-router-dom";
import { HiOutlineCalendar, HiOutlineCube, HiOutlineExclamationCircle, HiOutlineUser } from "react-icons/hi";

export default function AdminPage() {
    const nav = useNavigate();
    const [kind, setKind] = useState<"request" | "trip">("request");
    const [from, setFrom] = useState("");
    const [to, setTo] = useState("");
    const [dateStart, setDS] = useState("");
    const [dateEnd, setDE] = useState("");
    const [date, setDate] = useState("");
    const [item, setItem] = useState("documents");
    const [weight, setWeight] = useState("envelope");
    const [desc, setDesc] = useState("");
    const [rewardHint, setRewardHint] = useState("");
    const [flightNo, setFlightNo] = useState("");
    const [airline, setAirline] = useState("");
    const [capacityHint, setCapacityHint] = useState("");
    
    // Поля для указания пользователя
    const [tgUserID, setTgUserID] = useState("");
    const [tgUsername, setTgUsername] = useState("");
    
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    // Проверка аутентификации
    useEffect(() => {
        if (!isAuthenticated()) {
            nav("/auth?return=" + encodeURIComponent("/admin"));
            return;
        }
    }, [nav]);

    async function submit() {
        // Валидация
        if (!from || !to) {
            setError("Укажите аэропорты отправления и назначения");
            return;
        }

        if (kind === "trip") {
            if (!date) {
                setError("Укажите дату поездки");
                return;
            }
        } else {
            if (!dateStart || !dateEnd) {
                setError("Укажите диапазон дат");
                return;
            }
            const start = new Date(dateStart);
            const end = new Date(dateEnd);
            const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
            if (daysDiff < 1 || daysDiff > 14) {
                setError("Диапазон дат должен быть от 1 до 14 дней");
                return;
            }
        }

        if (!tgUserID && !tgUsername) {
            setError("Укажите tg_user_id или tg_username");
            return;
        }

        setError(null);
        setSuccess(null);
        setSubmitting(true);

        try {
            const body: any = {
                kind,
                from_iata: from,
                to_iata: to,
                item,
                weight,
            };

            if (kind === "trip") {
                body.date = date;
            } else {
                body.date_start = dateStart;
                body.date_end = dateEnd;
            }

            if (desc) body.description = desc;
            if (rewardHint) body.reward_hint = parseInt(rewardHint);
            if (flightNo) body.flight_no = flightNo;
            if (airline) body.airline = airline;
            if (capacityHint) body.capacity_hint = capacityHint;

            if (tgUserID) {
                body.tg_user_id = parseInt(tgUserID);
            }
            if (tgUsername) {
                body.tg_username = tgUsername;
            }

            const result = await api.createAdminPub(body);
            
            if ("error" in result) {
                setError(result.error);
            } else {
                setSuccess(`Публикация создана! ID: ${result.id}`);
                // Очистить форму
                setFrom("");
                setTo("");
                setDS("");
                setDE("");
                setDate("");
                setDesc("");
                setRewardHint("");
                setFlightNo("");
                setAirline("");
                setCapacityHint("");
                setTgUserID("");
                setTgUsername("");
            }
        } catch (err: any) {
            setError(err.message || "Ошибка при создании публикации");
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <>
            <SEO title="Админ-панель - Deliverty" />
            <div className="max-w-2xl mx-auto">
                <div className="mb-6">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">Админ-панель</h1>
                    <p className="text-gray-600">Добавление объявлений от имени других пользователей</p>
                </div>

                {error && (
                    <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                        <HiOutlineExclamationCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="text-red-800 font-medium">Ошибка</p>
                            <p className="text-red-700 text-sm">{error}</p>
                        </div>
                    </div>
                )}

                {success && (
                    <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                        <p className="text-green-800 font-medium">{success}</p>
                    </div>
                )}

                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-6">
                    {/* Тип объявления */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Тип объявления
                        </label>
                        <div className="flex gap-4">
                            <label className="flex items-center">
                                <input
                                    type="radio"
                                    value="request"
                                    checked={kind === "request"}
                                    onChange={(e) => setKind(e.target.value as "request")}
                                    className="mr-2"
                                />
                                <span>Запрос</span>
                            </label>
                            <label className="flex items-center">
                                <input
                                    type="radio"
                                    value="trip"
                                    checked={kind === "trip"}
                                    onChange={(e) => setKind(e.target.value as "trip")}
                                    className="mr-2"
                                />
                                <span>Поездка</span>
                            </label>
                        </div>
                    </div>

                    {/* Пользователь */}
                    <div className="border-t pt-6">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            <HiOutlineUser className="w-4 h-4 inline mr-1" />
                            Пользователь (укажите один из вариантов)
                        </label>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm text-gray-600 mb-1">
                                    Telegram User ID
                                </label>
                                <input
                                    type="number"
                                    value={tgUserID}
                                    onChange={(e) => setTgUserID(e.target.value)}
                                    placeholder="123456789"
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                />
                            </div>
                            <div className="text-sm text-gray-500">или</div>
                            <div>
                                <label className="block text-sm text-gray-600 mb-1">
                                    Telegram Username (без @)
                                </label>
                                <input
                                    type="text"
                                    value={tgUsername}
                                    onChange={(e) => setTgUsername(e.target.value)}
                                    placeholder="username"
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Маршрут */}
                    <div className="border-t pt-6">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Маршрут
                        </label>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <AirportInput label="Откуда" value={from} onChange={setFrom} />
                            </div>
                            <div>
                                <AirportInput label="Куда" value={to} onChange={setTo} />
                            </div>
                        </div>
                    </div>

                    {/* Даты */}
                    <div className="border-t pt-6">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            <HiOutlineCalendar className="w-4 h-4 inline mr-1" />
                            {kind === "trip" ? "Дата поездки" : "Диапазон дат"}
                        </label>
                        {kind === "trip" ? (
                            <input
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            />
                        ) : (
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm text-gray-600 mb-1">С</label>
                                    <input
                                        type="date"
                                        value={dateStart}
                                        onChange={(e) => setDS(e.target.value)}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-600 mb-1">По</label>
                                    <input
                                        type="date"
                                        value={dateEnd}
                                        onChange={(e) => setDE(e.target.value)}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Тип и вес */}
                    <div className="border-t pt-6">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            <HiOutlineCube className="w-4 h-4 inline mr-1" />
                            Тип и вес
                        </label>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm text-gray-600 mb-1">Тип</label>
                                <select
                                    value={item}
                                    onChange={(e) => setItem(e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                >
                                    <option value="documents">Документы</option>
                                    <option value="small">Мелкие вещи</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm text-gray-600 mb-1">Вес</label>
                                <select
                                    value={weight}
                                    onChange={(e) => setWeight(e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                >
                                    <option value="envelope">Конверт</option>
                                    <option value="le1kg">До 1 кг</option>
                                    <option value="le3kg">До 3 кг</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Описание */}
                    <div className="border-t pt-6">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Описание
                        </label>
                        <textarea
                            value={desc}
                            onChange={(e) => setDesc(e.target.value)}
                            rows={3}
                            maxLength={500}
                            placeholder="Описание объявления (необязательно)"
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        />
                        <p className="text-xs text-gray-500 mt-1">{desc.length}/500</p>
                    </div>

                    {/* Дополнительные поля для поездки */}
                    {kind === "trip" && (
                        <div className="border-t pt-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Номер рейса
                                </label>
                                <input
                                    type="text"
                                    value={flightNo}
                                    onChange={(e) => setFlightNo(e.target.value)}
                                    placeholder="SU100"
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Авиакомпания
                                </label>
                                <input
                                    type="text"
                                    value={airline}
                                    onChange={(e) => setAirline(e.target.value)}
                                    placeholder="Aeroflot"
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Вместимость
                                </label>
                                <input
                                    type="text"
                                    value={capacityHint}
                                    onChange={(e) => setCapacityHint(e.target.value)}
                                    placeholder="envelope/1kg/3kg"
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                />
                            </div>
                        </div>
                    )}

                    {/* Вознаграждение */}
                    <div className="border-t pt-6">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Вознаграждение (необязательно)
                        </label>
                        <input
                            type="number"
                            value={rewardHint}
                            onChange={(e) => setRewardHint(e.target.value)}
                            placeholder="1000"
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        />
                    </div>

                    {/* Кнопка отправки */}
                    <div className="border-t pt-6">
                        <button
                            onClick={submit}
                            disabled={submitting}
                            className="w-full bg-primary-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {submitting ? "Создание..." : "Создать публикацию"}
                        </button>
                    </div>
                </div>

                <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-sm text-yellow-800">
                        <strong>Важно:</strong> Если указан только username без tg_user_id, для внешних пользователей будет создан специальный ID. 
                        Когда реальный пользователь с таким username зарегистрируется, он создаст нового пользователя с реальным ID, 
                        а публикации останутся привязанными к старому пользователю. Рекомендуется использовать реальный tg_user_id, если он известен.
                    </p>
                </div>
            </div>
        </>
    );
}

