import { useState, useEffect } from "react";
import AirportInput from "../components/AirportInput";
import { api, isAuthenticated } from "../lib/api";
import { useNavigate, useSearchParams } from "react-router-dom";
import { HiOutlineCalendar, HiOutlineCube, HiOutlineExclamationCircle, HiOutlinePaperAirplane } from "react-icons/hi";
import { HiOutlineSparkles, HiOutlineGift, HiOutlineTruck } from "react-icons/hi2";

export default function PublishPage() {
    const [searchParams] = useSearchParams();
    const [kind, setKind] = useState<"request" | "trip">("request");
    const [from, setFrom] = useState("");
    const [to, setTo] = useState("");
    const [dateStart, setDS] = useState("");
    const [dateEnd, setDE] = useState("");
    const [item, setItem] = useState("documents");
    const [weight, setWeight] = useState("envelope");
    const [desc, setDesc] = useState("");
    const [flightNo, setFlightNo] = useState("");
    const [airline, setAirline] = useState("");
    const [capacityHint, setCapacityHint] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const nav = useNavigate();

    // Pre-fill form from URL parameters
    useEffect(() => {
        const urlKind = searchParams.get("kind");
        const urlFrom = searchParams.get("from");
        const urlTo = searchParams.get("to");
        const urlDateStart = searchParams.get("date_start");
        const urlDateEnd = searchParams.get("date_end");

        if (urlKind === "request" || urlKind === "trip") {
            setKind(urlKind);
        }
        if (urlFrom) setFrom(urlFrom);
        if (urlTo) setTo(urlTo);
        if (urlDateStart) setDS(urlDateStart);
        if (urlDateEnd) setDE(urlDateEnd);
    }, [searchParams]);

    async function submit() {
        // Check authentication before creating publication
        if (!isAuthenticated()) {
            nav("/auth");
            return;
        }

        if (!from || !to || !dateStart || !dateEnd) {
            setError("Заполните все обязательные поля");
            return;
        }

        // Validate date range
        const start = new Date(dateStart);
        const end = new Date(dateEnd);
        const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

        if (daysDiff < 1) {
            setError("Дата окончания должна быть позже даты начала");
            return;
        }
        if (daysDiff > 14) {
            setError("Диапазон дат не должен превышать 14 дней");
            return;
        }

        setError(null);
        setSubmitting(true);
        try {
            const body: any = {
                kind,
                from_iata: from,
                to_iata: to,
                date_start: dateStart,
                date_end: dateEnd,
                item,
                weight,
                description: desc,
            };
            
            // Add trip-specific fields
            if (kind === "trip") {
                if (flightNo) body.flight_no = flightNo;
                if (airline) body.airline = airline;
                if (capacityHint) body.capacity_hint = capacityHint;
            }
            
            const res = await api.createPub(body);
            if ('error' in res) {
                setError(res.error || "Ошибка при создании объявления");
            } else if ('id' in res) {
                nav(`/matches/${res.id}`);
            } else {
                setError("Не удалось создать объявление");
            }
        } catch (err) {
            setError("Произошла ошибка. Попробуйте еще раз.");
        } finally {
            setSubmitting(false);
        }
    }

    const isFormValid = from && to && dateStart && dateEnd;

    return (
        <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
            <div className="text-center space-y-2">
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Создать объявление</h1>
                <p className="text-sm sm:text-base text-gray-600">
                    {kind === "request" 
                        ? "Нужно передать что-то? Создайте запрос и мы найдем людей, которые летят по вашему маршруту"
                        : "Летите по маршруту? Создайте объявление о поездке и найдите тех, кому нужно что-то передать"}
                </p>
            </div>

            <div className="card p-4 sm:p-6 space-y-5 sm:space-y-6">
                {/* Publication Type Selection */}
                <div>
                    <label className="block text-sm sm:text-sm font-medium text-gray-700 mb-3">
                        Тип объявления
                    </label>
                    <div className="grid grid-cols-2 gap-2 sm:gap-3">
                        <button
                            type="button"
                            onClick={() => setKind("request")}
                            className={`p-3 sm:p-4 rounded-lg border-2 transition-all touch-manipulation min-h-[100px] sm:min-h-[120px] ${
                                kind === "request"
                                    ? "border-primary-500 bg-primary-50"
                                    : "border-gray-200 hover:border-gray-300 active:bg-gray-50"
                            }`}
                        >
                            <div className="flex flex-col sm:flex-row items-center gap-1.5 sm:gap-2 justify-center mb-2">
                                <HiOutlineGift className={`w-5 h-5 sm:w-5 sm:h-5 ${kind === "request" ? "text-primary-600" : "text-gray-400"}`} />
                                <span className={`font-semibold text-sm sm:text-base ${kind === "request" ? "text-primary-900" : "text-gray-600"}`}>
                                    Хочу отправить
                                </span>
                            </div>
                            <p className="text-xs sm:text-xs text-gray-500 text-center">
                                Ищу путешественника для доставки
                            </p>
                        </button>
                        <button
                            type="button"
                            onClick={() => setKind("trip")}
                            className={`p-3 sm:p-4 rounded-lg border-2 transition-all touch-manipulation min-h-[100px] sm:min-h-[120px] ${
                                kind === "trip"
                                    ? "border-primary-500 bg-primary-50"
                                    : "border-gray-200 hover:border-gray-300 active:bg-gray-50"
                            }`}
                        >
                            <div className="flex flex-col sm:flex-row items-center gap-1.5 sm:gap-2 justify-center mb-2">
                                <HiOutlineTruck className={`w-5 h-5 sm:w-5 sm:h-5 ${kind === "trip" ? "text-primary-600" : "text-gray-400"}`} />
                                <span className={`font-semibold text-sm sm:text-base ${kind === "trip" ? "text-primary-900" : "text-gray-600"}`}>
                                    Я еду
                                </span>
                            </div>
                            <p className="text-xs sm:text-xs text-gray-500 text-center">
                                Могу взять посылку с собой
                            </p>
                        </button>
                    </div>
                </div>

                {/* Route */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <AirportInput label="Откуда" value={from} onChange={setFrom} />
                    <AirportInput label="Куда" value={to} onChange={setTo} />
                </div>

                {/* Dates */}
                <div>
                    <label className="block text-sm sm:text-sm font-medium text-gray-700 mb-2">
                        <HiOutlineCalendar className="w-4 h-4 sm:w-4 sm:h-4 inline mr-1" />
                        Период доставки
                    </label>
                    <div className="grid grid-cols-2 gap-2 sm:gap-3">
                        <div>
                            <label className="block text-xs sm:text-xs text-gray-500 mb-1">Дата начала</label>
                            <input
                                className="input"
                                type="date"
                                value={dateStart}
                                onChange={(e) => setDS(e.target.value)}
                                min={new Date().toISOString().split('T')[0]}
                            />
                        </div>
                        <div>
                            <label className="block text-xs sm:text-xs text-gray-500 mb-1">Дата окончания</label>
                            <input
                                className="input"
                                type="date"
                                value={dateEnd}
                                onChange={(e) => setDE(e.target.value)}
                                min={dateStart || new Date().toISOString().split('T')[0]}
                            />
                        </div>
                    </div>
                </div>

                {/* Item Details */}
                <div>
                    <label className="block text-sm sm:text-sm font-medium text-gray-700 mb-2">
                        <HiOutlineCube className="w-4 h-4 sm:w-4 sm:h-4 inline mr-1" />
                        {kind === "request" ? "Характеристики отправления" : "Что могу взять"}
                    </label>
                    <div className="grid grid-cols-2 gap-2 sm:gap-3">
                        <div>
                            <label className="block text-xs sm:text-xs text-gray-500 mb-1">Тип</label>
                            <select
                                className="input"
                                value={item}
                                onChange={(e) => setItem(e.target.value)}
                            >
                                <option value="documents">Документы</option>
                                <option value="small">Мелкие вещи</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs sm:text-xs text-gray-500 mb-1">Вес</label>
                            <select
                                className="input"
                                value={weight}
                                onChange={(e) => setWeight(e.target.value)}
                            >
                                <option value="envelope">Конверт</option>
                                <option value="le1kg">До 1 кг</option>
                                <option value="le3kg">До 3 кг</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Trip-specific fields */}
                {kind === "trip" && (
                    <div className="space-y-4 p-3 sm:p-4 bg-blue-50 rounded-lg border border-blue-200">
                        <label className="block text-sm sm:text-sm font-medium text-gray-700 mb-3">
                            <HiOutlinePaperAirplane className="w-4 h-4 sm:w-4 sm:h-4 inline mr-1" />
                            Информация о рейсе (необязательно)
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                            <div>
                                <label className="block text-xs sm:text-xs text-gray-500 mb-1">Номер рейса</label>
                                <input
                                    className="input"
                                    type="text"
                                    placeholder="SU123"
                                    value={flightNo}
                                    onChange={(e) => setFlightNo(e.target.value)}
                                    maxLength={20}
                                />
                            </div>
                            <div>
                                <label className="block text-xs sm:text-xs text-gray-500 mb-1">Авиакомпания</label>
                                <input
                                    className="input"
                                    type="text"
                                    placeholder="Аэрофлот"
                                    value={airline}
                                    onChange={(e) => setAirline(e.target.value)}
                                    maxLength={50}
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs sm:text-xs text-gray-500 mb-1">Емкость (необязательно)</label>
                            <input
                                className="input"
                                type="text"
                                placeholder="например: конверт/1кг/3кг"
                                value={capacityHint}
                                onChange={(e) => setCapacityHint(e.target.value)}
                                maxLength={50}
                            />
                            <p className="text-xs sm:text-xs text-gray-400 mt-1">
                                Укажите, что конкретно можете взять с собой
                            </p>
                        </div>
                    </div>
                )}

                {/* Description */}
                <div>
                    <label className="block text-sm sm:text-sm font-medium text-gray-700 mb-2">
                        Описание
                    </label>
                    <textarea
                        className="input h-32 sm:h-32 resize-none"
                        placeholder={
                            kind === "request"
                                ? "Добавьте дополнительные детали о том, что нужно передать. Учтите: контакты (телефон, @username, ссылки) запрещены в описании."
                                : "Добавьте дополнительные детали о вашей поездке. Учтите: контакты (телефон, @username, ссылки) запрещены в описании."
                        }
                        value={desc}
                        onChange={(e) => {
                            setDesc(e.target.value);
                            setError(null);
                        }}
                        maxLength={500}
                    />
                    <div className="text-xs sm:text-xs text-gray-500 mt-1 text-right">
                        {desc.length}/500
                    </div>
                </div>

                {/* Submit Button */}
                <button
                    className="btn btn-primary w-full text-base sm:text-base py-4 sm:py-4"
                    onClick={submit}
                    disabled={!isFormValid || submitting}
                >
                    {submitting ? (
                        <>
                            <div className="w-5 h-5 sm:w-5 sm:h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            Публикация...
                        </>
                    ) : (
                        <>
                            <HiOutlineSparkles className="w-5 h-5 sm:w-5 sm:h-5" />
                            <span className="text-sm sm:text-base">{kind === "request" ? "Опубликовать и найти совпадения" : "Опубликовать поездку"}</span>
                        </>
                    )}
                </button>

                {error && (
                    <div className="flex items-start gap-2 p-4 bg-red-50 border border-red-200 rounded-lg">
                        <HiOutlineExclamationCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-red-700">{error}</p>
                    </div>
                )}

                {!isFormValid && !error && (
                    <p className="text-xs sm:text-sm text-amber-600 text-center">
                        Пожалуйста, заполните все обязательные поля (Откуда, Куда и Даты)
                    </p>
                )}
            </div>
        </div>
    );
}
