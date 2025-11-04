import { useState } from "react";
import AirportInput from "../components/AirportInput";
import { api } from "../lib/api";
import { useNavigate } from "react-router-dom";
import { HiOutlineCalendar, HiOutlineCube, HiOutlineExclamationCircle } from "react-icons/hi";
import { HiOutlineSparkles } from "react-icons/hi2";

export default function PublishPage() {
    const [from, setFrom] = useState("");
    const [to, setTo] = useState("");
    const [dateStart, setDS] = useState("");
    const [dateEnd, setDE] = useState("");
    const [item, setItem] = useState("documents");
    const [weight, setWeight] = useState("envelope");
    const [desc, setDesc] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const nav = useNavigate();

    async function submit() {
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
                kind: "request",
                from_iata: from,
                to_iata: to,
                date_start: dateStart,
                date_end: dateEnd,
                item,
                weight,
                description: desc,
            };
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
                <h1 className="text-3xl font-bold text-gray-900">Создать объявление</h1>
                <p className="text-gray-600">Нужно передать что-то? Создайте запрос и мы найдем людей, которые летят по вашему маршруту</p>
            </div>

            <div className="card p-6 space-y-6">
                {/* Route */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <AirportInput label="Откуда" value={from} onChange={setFrom} />
                    <AirportInput label="Куда" value={to} onChange={setTo} />
                </div>

                {/* Dates */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        <HiOutlineCalendar className="w-4 h-4 inline mr-1" />
                        Период доставки
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">Дата начала</label>
                            <input
                                className="input"
                                type="date"
                                value={dateStart}
                                onChange={(e) => setDS(e.target.value)}
                                min={new Date().toISOString().split('T')[0]}
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">Дата окончания</label>
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
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        <HiOutlineCube className="w-4 h-4 inline mr-1" />
                        Характеристики отправления
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">Тип</label>
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
                            <label className="block text-xs text-gray-500 mb-1">Вес</label>
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

                {/* Description */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Описание
                    </label>
                    <textarea
                        className="input h-32 resize-none"
                        placeholder="Добавьте дополнительные детали о том, что нужно передать. Учтите: контакты (телефон, @username, ссылки) запрещены в описании."
                        value={desc}
                        onChange={(e) => {
                            setDesc(e.target.value);
                            setError(null);
                        }}
                        maxLength={500}
                    />
                    <div className="text-xs text-gray-500 mt-1 text-right">
                        {desc.length}/500
                    </div>
                </div>

                {/* Submit Button */}
                <button
                    className="btn btn-primary w-full text-base py-4"
                    onClick={submit}
                    disabled={!isFormValid || submitting}
                >
                    {submitting ? (
                        <>
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            Публикация...
                        </>
                    ) : (
                        <>
                            <HiOutlineSparkles className="w-5 h-5" />
                            Опубликовать и найти совпадения
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
                    <p className="text-sm text-amber-600 text-center">
                        Пожалуйста, заполните все обязательные поля (Откуда, Куда и Даты)
                    </p>
                )}
            </div>
        </div>
    );
}
