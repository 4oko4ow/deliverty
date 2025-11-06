import { useState, useEffect } from "react";
import AirportInput from "../components/AirportInput";
import { api, isAuthenticated } from "../lib/api";
import { useNavigate, useSearchParams } from "react-router-dom";
import { HiOutlineCalendar, HiOutlineCube, HiOutlineExclamationCircle } from "react-icons/hi";
import { HiOutlineSparkles, HiOutlineGift, HiOutlineTruck } from "react-icons/hi2";
import { usePostHog } from "posthog-js/react";

export default function PublishPage() {
    const [searchParams] = useSearchParams();
    const posthog = usePostHog();
    const [kind, setKind] = useState<"request" | "trip">("request");
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

    // Helper function to track events
    const track = (eventName: string, properties?: Record<string, any>) => {
        if (posthog) {
            posthog.capture(eventName, properties);
            if (import.meta.env.DEV) {
                console.log(`[PostHog] Tracked: ${eventName}`, properties);
            }
        } else if (import.meta.env.DEV) {
            console.warn(`[PostHog] Skipped: ${eventName} (PostHog not ready)`, properties);
        }
    };

    // Track page view
    useEffect(() => {
        if (posthog) {
            const urlKind = searchParams.get("kind");
            const properties = {
                kind: urlKind || null,
                from_url_param: searchParams.get("from") || null,
                to_url_param: searchParams.get("to") || null,
            };
            posthog.capture("publish_page_viewed", properties);
            if (import.meta.env.DEV) {
                console.log("[PostHog] Tracked: publish_page_viewed", properties);
            }
        } else if (import.meta.env.DEV) {
            console.warn("[PostHog] Skipped: publish_page_viewed (PostHog not ready)");
        }
    }, [posthog, searchParams]); // Track when PostHog is ready and searchParams change

    // Pre-fill form from URL parameters or restored state
    useEffect(() => {
        // First, try to restore from localStorage (after login)
        const savedState = localStorage.getItem("publish_form_state");
        if (savedState) {
            try {
                const formState = JSON.parse(savedState);
                setKind(formState.kind || "request");
                setFrom(formState.from || "");
                setTo(formState.to || "");
                setDS(formState.dateStart || "");
                setDE(formState.dateEnd || "");
                setItem(formState.item || "documents");
                setWeight(formState.weight || "envelope");
                setDesc(formState.desc || "");
                // Clear saved state after restoring
                localStorage.removeItem("publish_form_state");
                return;
            } catch (e) {
                console.error("Failed to restore form state:", e);
                localStorage.removeItem("publish_form_state");
            }
        }

        // Otherwise, use URL parameters
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
            track("publish_attempted_not_authenticated", { kind });
            // Save form state to localStorage before redirect
            const formState = {
                kind,
                from,
                to,
                dateStart,
                dateEnd,
                item,
                weight,
                desc,
            };
            localStorage.setItem("publish_form_state", JSON.stringify(formState));
            nav(`/auth?return=${encodeURIComponent("/publish")}`);
            return;
        }

        if (kind === "trip") {
            // For trips, only date is required
            if (!from || !to || !dateStart) {
                setError("Заполните все обязательные поля");
                track("publish_error", { reason: "missing_fields", kind });
                return;
            }
        } else {
            // For requests, date range is required
            if (!from || !to || !dateStart || !dateEnd) {
                setError("Заполните все обязательные поля");
                track("publish_error", { reason: "missing_fields", kind });
                return;
            }

            // Validate date range
            const start = new Date(dateStart);
            const end = new Date(dateEnd);
            const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

            if (daysDiff < 1) {
                setError("Дата окончания должна быть позже даты начала");
                track("publish_error", { reason: "invalid_date_range", kind });
                return;
            }
            if (daysDiff > 14) {
                setError("Диапазон дат не должен превышать 14 дней");
                track("publish_error", { reason: "date_range_too_long", kind });
                return;
            }
        }

        setError(null);
        setSubmitting(true);

        track("publish_started", {
            kind,
            from_iata: from,
            to_iata: to,
            item,
            weight,
            has_description: !!desc,
        });

        try {
            const body: any = {
                kind,
                from_iata: from,
                to_iata: to,
                item,
                weight,
                description: desc,
            };

            if (kind === "trip") {
                // For trips, use single date
                body.date = dateStart;
            } else {
                // For requests, use date range
                body.date_start = dateStart;
                body.date_end = dateEnd;
            }


            const res = await api.createPub(body);
            if ('error' in res) {
                setError(res.error || "Ошибка при создании объявления");
                track("publish_error", {
                    kind,
                    error: res.error,
                    from_iata: from,
                    to_iata: to,
                });
            } else if ('id' in res) {
                track("publish_completed", {
                    pub_id: res.id,
                    kind,
                    from_iata: from,
                    to_iata: to,
                    item,
                    weight,
                    has_description: !!desc,
                });
                // Return to home page after successful publication
                nav("/");
            } else {
                setError("Не удалось создать объявление");
                track("publish_error", {
                    kind,
                    error: "unknown_error",
                    from_iata: from,
                    to_iata: to,
                });
            }
        } catch (err) {
            setError("Произошла ошибка. Попробуйте еще раз.");
            track("publish_error", {
                kind,
                error: String(err),
                from_iata: from,
                to_iata: to,
            });
        } finally {
            setSubmitting(false);
        }
    }

    const isFormValid = from && to && dateStart && (kind === "trip" || dateEnd);

    return (
        <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
            <div className="text-center space-y-2">
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Создать объявление</h1>
                <p className="text-sm sm:text-base text-gray-600">
                    {kind === "request"
                        ? "Нужно передать что-то? Создайте запрос и найдем тех, кто летит по вашему маршруту"
                        : "Летите по маршруту? Создайте объявление и найдем тех, кому нужно что-то передать"}
                </p>
            </div>

            <div className="card p-4 sm:p-6 space-y-5 sm:space-y-6">
                {/* Publication Type Selection */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                        Тип объявления
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                        <button
                            type="button"
                            onClick={() => {
                                track("publish_kind_changed", { kind: "request" });
                                setKind("request");
                            }}
                            className={`p-4 rounded-lg border-2 transition-all touch-manipulation min-h-[110px] ${kind === "request"
                                ? "border-primary-500 bg-primary-50"
                                : "border-gray-200 hover:border-gray-300 active:bg-gray-50"
                                }`}
                        >
                            <div className="flex flex-col items-center gap-2 justify-center mb-2">
                                <HiOutlineGift className={`w-6 h-6 ${kind === "request" ? "text-primary-600" : "text-gray-400"}`} />
                                <span className={`font-semibold text-base ${kind === "request" ? "text-primary-900" : "text-gray-600"}`}>
                                    Я ищу
                                </span>
                            </div>
                            <p className="text-xs text-gray-500 text-center">
                                Нужна доставка
                            </p>
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                track("publish_kind_changed", { kind: "trip" });
                                setKind("trip");
                            }}
                            className={`p-4 rounded-lg border-2 transition-all touch-manipulation min-h-[110px] ${kind === "trip"
                                ? "border-primary-500 bg-primary-50"
                                : "border-gray-200 hover:border-gray-300 active:bg-gray-50"
                                }`}
                        >
                            <div className="flex flex-col items-center gap-2 justify-center mb-2">
                                <HiOutlineTruck className={`w-6 h-6 ${kind === "trip" ? "text-primary-600" : "text-gray-400"}`} />
                                <span className={`font-semibold text-base ${kind === "trip" ? "text-primary-900" : "text-gray-600"}`}>
                                    Я лечу
                                </span>
                            </div>
                            <p className="text-xs text-gray-500 text-center">
                                Могу взять посылку
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
                    <label className="block text-sm font-medium text-gray-700 mb-2.5">
                        <HiOutlineCalendar className="w-4 h-4 inline mr-1.5" />
                        {kind === "trip" ? "Дата полета" : "Период доставки"}
                    </label>
                    {kind === "trip" ? (
                        <div>
                            <input
                                className="input"
                                type="date"
                                value={dateStart}
                                onChange={(e) => setDS(e.target.value)}
                                min={new Date().toISOString().split('T')[0]}
                            />
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs text-gray-500 mb-2 font-medium">Дата начала</label>
                                <input
                                    className="input"
                                    type="date"
                                    value={dateStart}
                                    onChange={(e) => setDS(e.target.value)}
                                    min={new Date().toISOString().split('T')[0]}
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-500 mb-2 font-medium">Дата окончания</label>
                                <input
                                    className="input"
                                    type="date"
                                    value={dateEnd}
                                    onChange={(e) => setDE(e.target.value)}
                                    min={dateStart || new Date().toISOString().split('T')[0]}
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Item Details */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2.5">
                        <HiOutlineCube className="w-4 h-4 inline mr-1.5" />
                        {kind === "request" ? "Характеристики отправления" : "Что могу взять"}
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs text-gray-500 mb-2 font-medium">Тип</label>
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
                            <label className="block text-xs text-gray-500 mb-2 font-medium">Вес</label>
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
                    <label className="block text-sm font-medium text-gray-700 mb-2.5">
                        Описание
                    </label>
                    <textarea
                        className="input resize-none"
                        placeholder={
                            kind === "request"
                                ? "Добавьте дополнительные детали о том, что нужно передать. Можно указать желаемое вознаграждение, особые требования, размеры и т.д. Учтите: контакты (телефон, @username, ссылки) запрещены в описании."
                                : "Добавьте дополнительные детали о вашей поездке. Можно указать желаемое вознаграждение, размер багажа, особые условия и т.д. Учтите: контакты (телефон, @username, ссылки) запрещены в описании."
                        }
                        value={desc}
                        onChange={(e) => {
                            setDesc(e.target.value);
                            setError(null);
                        }}
                        maxLength={500}
                        rows={6}
                    />
                    <div className="text-xs text-gray-500 mt-2 text-right">
                        {desc.length}/500
                    </div>
                </div>

                {/* Submit Button */}
                <button
                    className="btn btn-primary w-full"
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
                            <span>{kind === "request" ? "Опубликовать и найти совпадения" : "Опубликовать поездку"}</span>
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
