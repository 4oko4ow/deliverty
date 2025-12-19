import { useState, useEffect } from "react";
import AirportInput from "../components/AirportInput";
import SEO from "../components/SEO";
import { api, isAuthenticated } from "../lib/api";
import { useNavigate } from "react-router-dom";
import { HiOutlineCalendar, HiOutlineCube, HiOutlineExclamationCircle, HiOutlineUser, HiOutlineCheckCircle, HiOutlineXCircle } from "react-icons/hi";
import { HiOutlineGift, HiOutlineTruck, HiOutlineViewGrid, HiOutlineHandshake } from "react-icons/hi2";

type Tab = "create" | "publications" | "deals";

type Publication = {
    id: number;
    kind: "request" | "trip";
    from_iata: string;
    to_iata: string;
    date_start?: string;
    date_end?: string;
    date?: string;
    item: string;
    weight: string;
    reward_hint?: number;
    description: string;
    flight_no?: string;
    airline?: string;
    capacity_hint?: string;
    is_active: boolean;
    created_at: string;
    user_id: number;
    tg_user_id: number;
    tg_username: string;
    user_rating: number;
};

type Deal = {
    id: number;
    status: string;
    created_at: string;
    last_message_at?: string;
    request_pub_id: number;
    request_from: string;
    request_to: string;
    request_date_start?: string;
    request_date_end?: string;
    request_date?: string;
    request_tg_user_id: number;
    request_username: string;
    trip_pub_id: number;
    trip_from: string;
    trip_to: string;
    trip_date?: string;
    trip_tg_user_id: number;
    trip_username: string;
};

type Match = {
    other_pub_id: number;
    kind: string;
    from_iata: string;
    to_iata: string;
    date_start?: string;
    date_end?: string;
    date?: string;
    item: string;
    weight: string;
    score: number;
    user_rating: number;
    username: string;
};

export default function AdminPage() {
    const nav = useNavigate();
    const [activeTab, setActiveTab] = useState<Tab>("create");

    // Create tab state
    const [kind, setKind] = useState<"request" | "trip">("request");
    const [from, setFrom] = useState("");
    const [to, setTo] = useState("");
    const [dateStart, setDS] = useState("");
    const [dateEnd, setDE] = useState("");
    const [date, setDate] = useState("");
    const [item, setItem] = useState("documents");
    const [weight, setWeight] = useState("envelope");
    const [desc, setDesc] = useState("");
    const [flightNo, setFlightNo] = useState("");
    const [airline, setAirline] = useState("");
    const [capacityHint, setCapacityHint] = useState("");
    const [tgUsername, setTgUsername] = useState("");

    // Publications tab state
    const [publications, setPublications] = useState<Publication[]>([]);
    const [loadingPubs, setLoadingPubs] = useState(false);
    const [pubFilters, setPubFilters] = useState({
        kind: "",
        from: "",
        to: "",
        is_active: "",
    });
    const [selectedPub, setSelectedPub] = useState<Publication | null>(null);
    const [matches, setMatches] = useState<Match[]>([]);
    const [loadingMatches, setLoadingMatches] = useState(false);

    // Deals tab state
    const [deals, setDeals] = useState<Deal[]>([]);
    const [loadingDeals, setLoadingDeals] = useState(false);
    const [dealFilters, setDealFilters] = useState({
        status: "",
    });

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

    // Загрузка публикаций при переключении на вкладку
    useEffect(() => {
        if (activeTab === "publications") {
            loadPublications();
        }
    }, [activeTab, pubFilters]);

    // Загрузка сделок при переключении на вкладку
    useEffect(() => {
        if (activeTab === "deals") {
            loadDeals();
        }
    }, [activeTab, dealFilters]);

    async function loadPublications() {
        setLoadingPubs(true);
        setError(null);
        try {
            const params: any = {};
            if (pubFilters.kind) params.kind = pubFilters.kind;
            if (pubFilters.from) params.from = pubFilters.from;
            if (pubFilters.to) params.to = pubFilters.to;
            if (pubFilters.is_active !== "") params.is_active = pubFilters.is_active === "true";
            params.limit = 200;

            const result = await api.listAdminPubs(params);
            if ("error" in result) {
                setError(result.error);
            } else {
                setPublications(result as Publication[]);
            }
        } catch (err: any) {
            setError(err.message || "Ошибка при загрузке публикаций");
        } finally {
            setLoadingPubs(false);
        }
    }

    async function loadDeals() {
        setLoadingDeals(true);
        setError(null);
        try {
            const params: any = {};
            if (dealFilters.status) params.status = dealFilters.status;
            params.limit = 200;

            const result = await api.listAdminDeals(params);
            if ("error" in result) {
                setError(result.error);
            } else {
                setDeals(result as Deal[]);
            }
        } catch (err: any) {
            setError(err.message || "Ошибка при загрузке сделок");
        } finally {
            setLoadingDeals(false);
        }
    }

    async function loadMatches(pubId: number) {
        setLoadingMatches(true);
        setError(null);
        try {
            const result = await api.getAdminMatches(pubId);
            if ("error" in result) {
                setError(result.error);
            } else {
                setMatches(result as Match[]);
            }
        } catch (err: any) {
            setError(err.message || "Ошибка при загрузке совпадений");
        } finally {
            setLoadingMatches(false);
        }
    }

    async function createDeal(requestPubId: number, tripPubId: number) {
        setError(null);
        setSuccess(null);
        try {
            const result = await api.createAdminDeal(requestPubId, tripPubId);
            if ("error" in result) {
                setError(result.error);
            } else {
                setSuccess(`Сделка создана! ID: ${(result as any).id}`);
                setSelectedPub(null);
                setMatches([]);
                loadDeals();
            }
        } catch (err: any) {
            setError(err.message || "Ошибка при создании сделки");
        }
    }

    async function submit() {
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

        if (!tgUsername) {
            setError("Укажите Telegram username");
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
            if (flightNo) body.flight_no = flightNo;
            if (airline) body.airline = airline;
            if (capacityHint) body.capacity_hint = capacityHint;

            body.tg_username = tgUsername;

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
                setFlightNo("");
                setAirline("");
                setCapacityHint("");
                setTgUsername("");
                // Перезагрузить список публикаций
                if (activeTab === "publications") {
                    loadPublications();
                }
            }
        } catch (err: any) {
            setError(err.message || "Ошибка при создании публикации");
        } finally {
            setSubmitting(false);
        }
    }

    function formatDate(dateStr?: string) {
        if (!dateStr) return "-";
        const d = new Date(dateStr);
        return d.toLocaleDateString("ru-RU");
    }

    function formatDateTime(dateStr: string) {
        const d = new Date(dateStr);
        return d.toLocaleString("ru-RU");
    }

    return (
        <>
            <SEO title="Админ-панель - Deliverty" />
            <div className="max-w-6xl mx-auto">
                <div className="mb-6">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">Панель менеджера</h1>
                    <p className="text-gray-600">Управление публикациями и ручное связывание клиентов</p>
                </div>

                {/* Tabs */}
                <div className="mb-6 border-b border-gray-200">
                    <nav className="flex space-x-8">
                        <button
                            onClick={() => setActiveTab("create")}
                            className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === "create"
                                    ? "border-primary-500 text-primary-600"
                                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                                }`}
                        >
                            <HiOutlineGift className="w-5 h-5 inline mr-2" />
                            Создать публикацию
                        </button>
                        <button
                            onClick={() => setActiveTab("publications")}
                            className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === "publications"
                                    ? "border-primary-500 text-primary-600"
                                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                                }`}
                        >
                            <HiOutlineViewGrid className="w-5 h-5 inline mr-2" />
                            Публикации
                        </button>
                        <button
                            onClick={() => setActiveTab("deals")}
                            className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === "deals"
                                    ? "border-primary-500 text-primary-600"
                                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                                }`}
                        >
                            <HiOutlineHandshake className="w-5 h-5 inline mr-2" />
                            Сделки
                        </button>
                    </nav>
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
                    <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
                        <HiOutlineCheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                        <p className="text-green-800 font-medium">{success}</p>
                    </div>
                )}

                {/* Create Tab */}
                {activeTab === "create" && (
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-3">
                                Тип объявления
                            </label>
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    type="button"
                                    onClick={() => setKind("request")}
                                    className={`p-4 rounded-lg border-2 transition-all touch-manipulation min-h-[110px] ${kind === "request"
                                            ? "border-primary-500 bg-primary-50"
                                            : "border-gray-200 hover:border-gray-300 active:bg-gray-50"
                                        }`}
                                >
                                    <div className="flex flex-col items-center gap-2 justify-center mb-2">
                                        <HiOutlineGift className={`w-6 h-6 ${kind === "request" ? "text-primary-600" : "text-gray-400"}`} />
                                        <span className={`font-semibold text-base ${kind === "request" ? "text-primary-900" : "text-gray-600"}`}>
                                            Запрос
                                        </span>
                                    </div>
                                    <p className="text-xs text-gray-500 text-center">
                                        Нужна доставка
                                    </p>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setKind("trip")}
                                    className={`p-4 rounded-lg border-2 transition-all touch-manipulation min-h-[110px] ${kind === "trip"
                                            ? "border-primary-500 bg-primary-50"
                                            : "border-gray-200 hover:border-gray-300 active:bg-gray-50"
                                        }`}
                                >
                                    <div className="flex flex-col items-center gap-2 justify-center mb-2">
                                        <HiOutlineTruck className={`w-6 h-6 ${kind === "trip" ? "text-primary-600" : "text-gray-400"}`} />
                                        <span className={`font-semibold text-base ${kind === "trip" ? "text-primary-900" : "text-gray-600"}`}>
                                            Поездка
                                        </span>
                                    </div>
                                    <p className="text-xs text-gray-500 text-center">
                                        Могу взять посылку
                                    </p>
                                </button>
                            </div>
                        </div>

                        <div className="border-t pt-6">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                <HiOutlineUser className="w-4 h-4 inline mr-1" />
                                Пользователь
                            </label>
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
                )}

                {/* Publications Tab */}
                {activeTab === "publications" && (
                    <div className="space-y-4">
                        {/* Filters */}
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Тип</label>
                                    <select
                                        value={pubFilters.kind}
                                        onChange={(e) => setPubFilters({ ...pubFilters, kind: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                    >
                                        <option value="">Все</option>
                                        <option value="request">Запрос</option>
                                        <option value="trip">Поездка</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Откуда</label>
                                    <AirportInput value={pubFilters.from} onChange={(v) => setPubFilters({ ...pubFilters, from: v })} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Куда</label>
                                    <AirportInput value={pubFilters.to} onChange={(v) => setPubFilters({ ...pubFilters, to: v })} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Статус</label>
                                    <select
                                        value={pubFilters.is_active}
                                        onChange={(e) => setPubFilters({ ...pubFilters, is_active: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                    >
                                        <option value="">Все</option>
                                        <option value="true">Активные</option>
                                        <option value="false">Неактивные</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Publications List */}
                        {loadingPubs ? (
                            <div className="text-center py-8 text-gray-500">Загрузка...</div>
                        ) : publications.length === 0 ? (
                            <div className="text-center py-8 text-gray-500">Публикации не найдены</div>
                        ) : (
                            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Тип</th>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Маршрут</th>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Дата</th>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Пользователь</th>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Статус</th>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Действия</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {publications.map((pub) => (
                                                <tr key={pub.id} className="hover:bg-gray-50">
                                                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{pub.id}</td>
                                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                                        {pub.kind === "request" ? "Запрос" : "Поездка"}
                                                    </td>
                                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                                        {pub.from_iata} → {pub.to_iata}
                                                    </td>
                                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                                        {pub.date ? formatDate(pub.date) : `${formatDate(pub.date_start)} - ${formatDate(pub.date_end)}`}
                                                    </td>
                                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                                        {pub.tg_username ? `@${pub.tg_username}` : `ID: ${pub.tg_user_id}`}
                                                        <br />
                                                        <span className="text-xs text-gray-400">⭐ {pub.user_rating}</span>
                                                    </td>
                                                    <td className="px-4 py-3 whitespace-nowrap text-sm">
                                                        {pub.is_active ? (
                                                            <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded">Активна</span>
                                                        ) : (
                                                            <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded">Неактивна</span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3 whitespace-nowrap text-sm">
                                                        <button
                                                            onClick={() => {
                                                                setSelectedPub(pub);
                                                                loadMatches(pub.id);
                                                            }}
                                                            className="text-primary-600 hover:text-primary-800 font-medium"
                                                        >
                                                            Найти совпадения
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* Matches Modal */}
                        {selectedPub && (
                            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                                <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                                    <div className="p-6 border-b border-gray-200">
                                        <div className="flex justify-between items-center">
                                            <h3 className="text-lg font-semibold text-gray-900">
                                                Совпадения для публикации #{selectedPub.id}
                                            </h3>
                                            <button
                                                onClick={() => {
                                                    setSelectedPub(null);
                                                    setMatches([]);
                                                }}
                                                className="text-gray-400 hover:text-gray-600"
                                            >
                                                <HiOutlineXCircle className="w-6 h-6" />
                                            </button>
                                        </div>
                                        <div className="mt-2 text-sm text-gray-600">
                                            {selectedPub.kind === "request" ? "Запрос" : "Поездка"}: {selectedPub.from_iata} → {selectedPub.to_iata}
                                        </div>
                                    </div>
                                    <div className="p-6">
                                        {loadingMatches ? (
                                            <div className="text-center py-8 text-gray-500">Загрузка совпадений...</div>
                                        ) : matches.length === 0 ? (
                                            <div className="text-center py-8 text-gray-500">Совпадений не найдено</div>
                                        ) : (
                                            <div className="space-y-4">
                                                {matches.map((match) => (
                                                    <div key={match.other_pub_id} className="border border-gray-200 rounded-lg p-4">
                                                        <div className="flex justify-between items-start mb-2">
                                                            <div>
                                                                <div className="font-medium text-gray-900">
                                                                    Публикация #{match.other_pub_id} ({match.kind === "request" ? "Запрос" : "Поездка"})
                                                                </div>
                                                                <div className="text-sm text-gray-600 mt-1">
                                                                    {match.from_iata} → {match.to_iata}
                                                                </div>
                                                                <div className="text-sm text-gray-600">
                                                                    Дата: {match.date ? formatDate(match.date) : `${formatDate(match.date_start)} - ${formatDate(match.date_end)}`}
                                                                </div>
                                                                <div className="text-sm text-gray-600">
                                                                    Пользователь: {match.username ? `@${match.username}` : "N/A"} ⭐ {match.user_rating}
                                                                </div>
                                                                <div className="text-sm text-gray-600">
                                                                    Тип: {match.item === "documents" ? "Документы" : "Мелкие вещи"}, Вес: {match.weight}
                                                                </div>
                                                                <div className="text-sm font-medium text-primary-600 mt-1">
                                                                    Оценка совпадения: {match.score}
                                                                </div>
                                                            </div>
                                                            {selectedPub.kind === "request" && match.kind === "trip" && (
                                                                <button
                                                                    onClick={() => createDeal(selectedPub.id, match.other_pub_id)}
                                                                    className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium"
                                                                >
                                                                    Создать сделку
                                                                </button>
                                                            )}
                                                            {selectedPub.kind === "trip" && match.kind === "request" && (
                                                                <button
                                                                    onClick={() => createDeal(match.other_pub_id, selectedPub.id)}
                                                                    className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium"
                                                                >
                                                                    Создать сделку
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Deals Tab */}
                {activeTab === "deals" && (
                    <div className="space-y-4">
                        {/* Filters */}
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Статус</label>
                                    <select
                                        value={dealFilters.status}
                                        onChange={(e) => setDealFilters({ ...dealFilters, status: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                    >
                                        <option value="">Все</option>
                                        <option value="new">Новая</option>
                                        <option value="agreed">Согласована</option>
                                        <option value="handoff_done">Передача выполнена</option>
                                        <option value="cancelled">Отменена</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Deals List */}
                        {loadingDeals ? (
                            <div className="text-center py-8 text-gray-500">Загрузка...</div>
                        ) : deals.length === 0 ? (
                            <div className="text-center py-8 text-gray-500">Сделки не найдены</div>
                        ) : (
                            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Запрос</th>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Поездка</th>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Статус</th>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Создана</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {deals.map((deal) => (
                                                <tr key={deal.id} className="hover:bg-gray-50">
                                                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{deal.id}</td>
                                                    <td className="px-4 py-3 text-sm text-gray-500">
                                                        <div>#{deal.request_pub_id}</div>
                                                        <div className="text-xs">{deal.request_from} → {deal.request_to}</div>
                                                        <div className="text-xs text-gray-400">
                                                            {deal.request_username ? `@${deal.request_username}` : `ID: ${deal.request_tg_user_id}`}
                                                        </div>
                                                        <div className="text-xs text-gray-400">
                                                            {deal.request_date ? formatDate(deal.request_date) : `${formatDate(deal.request_date_start)} - ${formatDate(deal.request_date_end)}`}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-gray-500">
                                                        <div>#{deal.trip_pub_id}</div>
                                                        <div className="text-xs">{deal.trip_from} → {deal.trip_to}</div>
                                                        <div className="text-xs text-gray-400">
                                                            {deal.trip_username ? `@${deal.trip_username}` : `ID: ${deal.trip_tg_user_id}`}
                                                        </div>
                                                        <div className="text-xs text-gray-400">
                                                            {deal.trip_date ? formatDate(deal.trip_date) : "-"}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 whitespace-nowrap text-sm">
                                                        {deal.status === "new" && (
                                                            <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">Новая</span>
                                                        )}
                                                        {deal.status === "agreed" && (
                                                            <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded">Согласована</span>
                                                        )}
                                                        {deal.status === "handoff_done" && (
                                                            <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded">Выполнена</span>
                                                        )}
                                                        {deal.status === "cancelled" && (
                                                            <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded">Отменена</span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                                        {formatDateTime(deal.created_at)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </>
    );
}
