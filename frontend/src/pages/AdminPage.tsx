import { useState, useEffect } from "react";
import AirportInput from "../components/AirportInput";
import SEO from "../components/SEO";
import { api, isAuthenticated } from "../lib/api";
import { useNavigate } from "react-router-dom";
import { HiOutlineCalendar, HiOutlineCube, HiOutlineExclamationCircle, HiOutlineUser, HiOutlineCheckCircle, HiOutlineXCircle, HiOutlineUserGroup, HiOutlineCollection, HiOutlineChartBar } from "react-icons/hi";
import { HiOutlineGift, HiOutlineTruck } from "react-icons/hi2";

type Tab = "dashboard" | "create" | "publications" | "deals" | "users";

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
    deal_count: number;
    possible_matches_count: number;
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

type Stats = {
    active_publications: {
        requests: number;
        trips: number;
        total: number;
    };
    deals: {
        new: number;
        agreed: number;
        handoff_done: number;
        cancelled: number;
        total: number;
    };
    users: {
        today: number;
        week: number;
        month: number;
        total: number;
    };
    popular_routes: Array<{
        from_iata: string;
        to_iata: string;
        from_city: string;
        to_city: string;
        count: number;
    }>;
    conversion_rate: number;
    daily_stats: Array<{
        date: string;
        publications: number;
        deals: number;
    }>;
    alerts: {
        publications_no_matches: Array<{
            id: number;
            kind: string;
            from_iata: string;
            to_iata: string;
            created_at: string;
            days_old: number;
        }>;
        inactive_users: Array<{
            id: number;
            tg_username: string;
            last_active: string;
            days_inactive: number;
        }>;
        deals_no_activity: Array<{
            id: number;
            status: string;
            created_at: string;
            last_message_at?: string;
            days_no_activity: number;
        }>;
    };
};

export default function AdminPage() {
    const nav = useNavigate();
    const [activeTab, setActiveTab] = useState<Tab>("dashboard");

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
        search: "",
    });
    const [selectedPub, setSelectedPub] = useState<Publication | null>(null);
    const [matches, setMatches] = useState<Match[]>([]);
    const [loadingMatches, setLoadingMatches] = useState(false);
    const [editingPub, setEditingPub] = useState<Publication | null>(null);
    const [selectedPubIds, setSelectedPubIds] = useState<Set<number>>(new Set());
    const [bulkAction, setBulkAction] = useState<"activate" | "deactivate" | "">("");
    const [pubPage, setPubPage] = useState(1);
    const [pubSortField, setPubSortField] = useState<string>("");
    const [pubSortDir, setPubSortDir] = useState<"asc" | "desc">("desc");

    // Deals tab state
    const [deals, setDeals] = useState<Deal[]>([]);
    const [loadingDeals, setLoadingDeals] = useState(false);
    const [dealFilters, setDealFilters] = useState({
        status: "",
        from: "",
        to: "",
        from_date: "",
        to_date: "",
        search: "",
    });
    const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
    const [dealDetails, setDealDetails] = useState<any>(null);
    const [loadingDealDetails, setLoadingDealDetails] = useState(false);
    const [dealPage, setDealPage] = useState(1);
    const [dealSortField, setDealSortField] = useState<string>("");
    const [dealSortDir, setDealSortDir] = useState<"asc" | "desc">("desc");

    // Dashboard tab state
    const [stats, setStats] = useState<Stats | null>(null);
    const [loadingStats, setLoadingStats] = useState(false);
    const [analyticsIssues, setAnalyticsIssues] = useState<any[]>([]);
    const [loadingIssues, setLoadingIssues] = useState(false);

    // Users tab state
    const [users, setUsers] = useState<any[]>([]);
    const [loadingUsers, setLoadingUsers] = useState(false);
    const [userFilters, setUserFilters] = useState({
        username: "",
        tg_user_id: "",
    });
    const [selectedUser, setSelectedUser] = useState<any | null>(null);
    const [userDetails, setUserDetails] = useState<any>(null);
    const [loadingUserDetails, setLoadingUserDetails] = useState(false);
    const [userPage, setUserPage] = useState(1);
    const [userSortField, setUserSortField] = useState<string>("");
    const [userSortDir, setUserSortDir] = useState<"asc" | "desc">("desc");

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

    // Горячие клавиши
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "k") {
                e.preventDefault();
                if (activeTab === "publications") {
                    const searchInput = document.querySelector('input[placeholder*="ID, username"]') as HTMLInputElement;
                    searchInput?.focus();
                } else if (activeTab === "deals") {
                    const searchInput = document.querySelector('input[placeholder*="ID сделки"]') as HTMLInputElement;
                    searchInput?.focus();
                }
            }
            if ((e.ctrlKey || e.metaKey) && e.key === "n") {
                e.preventDefault();
                setActiveTab("create");
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [activeTab]);

    // Загрузка фильтров из localStorage
    useEffect(() => {
        const savedPubFilters = localStorage.getItem("admin_pub_filters");
        if (savedPubFilters) {
            try {
                setPubFilters(JSON.parse(savedPubFilters));
            } catch (e) {
                // Игнорируем ошибки парсинга
            }
        }
        const savedDealFilters = localStorage.getItem("admin_deal_filters");
        if (savedDealFilters) {
            try {
                setDealFilters(JSON.parse(savedDealFilters));
            } catch (e) {
                // Игнорируем ошибки парсинга
            }
        }
    }, []);

    // Сохранение фильтров в localStorage
    useEffect(() => {
        if (activeTab === "publications") {
            localStorage.setItem("admin_pub_filters", JSON.stringify(pubFilters));
        }
    }, [pubFilters, activeTab]);

    useEffect(() => {
        if (activeTab === "deals") {
            localStorage.setItem("admin_deal_filters", JSON.stringify(dealFilters));
        }
    }, [dealFilters, activeTab]);

    // Загрузка публикаций при переключении на вкладку
    useEffect(() => {
        if (activeTab === "publications") {
            loadPublications();
        }
    }, [activeTab, pubFilters, pubPage, pubSortField, pubSortDir]);

    // Загрузка сделок при переключении на вкладку
    useEffect(() => {
        if (activeTab === "deals") {
            loadDeals();
        }
    }, [activeTab, dealFilters, dealPage, dealSortField, dealSortDir]);

    // Загрузка статистики при переключении на вкладку дашборда
    useEffect(() => {
        if (activeTab === "dashboard") {
            loadStats();
            loadAnalyticsIssues();
        }
    }, [activeTab]);

    // Загрузка пользователей при переключении на вкладку
    useEffect(() => {
        if (activeTab === "users") {
            loadUsers();
        }
    }, [activeTab, userFilters, userPage, userSortField, userSortDir]);

    async function loadPublications() {
        setLoadingPubs(true);
        setError(null);
        try {
            const params: any = {};
            if (pubFilters.kind) params.kind = pubFilters.kind;
            if (pubFilters.from) params.from = pubFilters.from;
            if (pubFilters.to) params.to = pubFilters.to;
            if (pubFilters.is_active !== "") params.is_active = pubFilters.is_active === "true";
            if (pubFilters.search) params.search = pubFilters.search;
            params.limit = 50;
            params.offset = (pubPage - 1) * 50;

            const result = await api.listAdminPubs(params);
            if ("error" in result) {
                setError(result.error);
            } else {
                let sorted = result as Publication[];
                if (pubSortField) {
                    sorted = [...sorted].sort((a, b) => {
                        let aVal: any = a[pubSortField as keyof Publication];
                        let bVal: any = b[pubSortField as keyof Publication];
                        if (typeof aVal === "string") {
                            aVal = aVal.toLowerCase();
                            bVal = bVal.toLowerCase();
                        }
                        if (aVal < bVal) return pubSortDir === "asc" ? -1 : 1;
                        if (aVal > bVal) return pubSortDir === "asc" ? 1 : -1;
                        return 0;
                    });
                }
                setPublications(sorted);
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
            if (dealFilters.from) params.from = dealFilters.from;
            if (dealFilters.to) params.to = dealFilters.to;
            if (dealFilters.from_date) params.from_date = dealFilters.from_date;
            if (dealFilters.to_date) params.to_date = dealFilters.to_date;
            if (dealFilters.search) params.search = dealFilters.search;
            params.limit = 50;
            params.offset = (dealPage - 1) * 50;

            const result = await api.listAdminDeals(params);
            if ("error" in result) {
                setError(result.error);
            } else {
                let sorted = result as Deal[];
                if (dealSortField) {
                    sorted = [...sorted].sort((a, b) => {
                        let aVal: any = a[dealSortField as keyof Deal];
                        let bVal: any = b[dealSortField as keyof Deal];
                        if (typeof aVal === "string") {
                            aVal = aVal.toLowerCase();
                            bVal = bVal.toLowerCase();
                        }
                        if (aVal < bVal) return dealSortDir === "asc" ? -1 : 1;
                        if (aVal > bVal) return dealSortDir === "asc" ? 1 : -1;
                        return 0;
                    });
                }
                setDeals(sorted);
            }
        } catch (err: any) {
            setError(err.message || "Ошибка при загрузке сделок");
        } finally {
            setLoadingDeals(false);
        }
    }

    async function loadDealDetails(dealId: number) {
        setLoadingDealDetails(true);
        setError(null);
        try {
            const result = await api.getAdminDeal(dealId);
            if ("error" in result) {
                setError(result.error);
            } else {
                setDealDetails(result);
            }
        } catch (err: any) {
            setError(err.message || "Ошибка при загрузке деталей сделки");
        } finally {
            setLoadingDealDetails(false);
        }
    }

    async function updateDealStatus(dealId: number, newStatus: string) {
        setError(null);
        setSuccess(null);
        try {
            const result = await api.updateAdminDeal(dealId, newStatus);
            if ("error" in result) {
                setError(result.error);
            } else {
                setSuccess("Статус сделки обновлен");
                loadDeals();
                if (selectedDeal && selectedDeal.id === dealId) {
                    loadDealDetails(dealId);
                }
            }
        } catch (err: any) {
            setError(err.message || "Ошибка при обновлении статуса");
        }
    }

    async function loadUsers() {
        setLoadingUsers(true);
        setError(null);
        try {
            const params: any = {};
            if (userFilters.username) params.username = userFilters.username;
            if (userFilters.tg_user_id) params.tg_user_id = userFilters.tg_user_id;
            params.limit = 50;
            params.offset = (userPage - 1) * 50;

            const result = await api.listAdminUsers(params);
            if ("error" in result) {
                setError(result.error);
            } else {
                let sorted = result as any[];
                if (userSortField) {
                    sorted = [...sorted].sort((a, b) => {
                        let aVal: any = a[userSortField];
                        let bVal: any = b[userSortField];
                        if (typeof aVal === "string") {
                            aVal = aVal.toLowerCase();
                            bVal = bVal.toLowerCase();
                        }
                        if (aVal < bVal) return userSortDir === "asc" ? -1 : 1;
                        if (aVal > bVal) return userSortDir === "asc" ? 1 : -1;
                        return 0;
                    });
                }
                setUsers(sorted);
            }
        } catch (err: any) {
            setError(err.message || "Ошибка при загрузке пользователей");
        } finally {
            setLoadingUsers(false);
        }
    }

    async function loadUserDetails(userId: number) {
        setLoadingUserDetails(true);
        setError(null);
        try {
            const result = await api.getAdminUser(userId);
            if ("error" in result) {
                setError(result.error);
            } else {
                setUserDetails(result);
            }
        } catch (err: any) {
            setError(err.message || "Ошибка при загрузке деталей пользователя");
        } finally {
            setLoadingUserDetails(false);
        }
    }

    async function toggleUserBlock(userId: number, currentStatus: boolean) {
        setError(null);
        setSuccess(null);
        try {
            const result = await api.updateAdminUser(userId, { is_blocked: !currentStatus });
            if ("error" in result) {
                setError(result.error);
            } else {
                setSuccess(currentStatus ? "Пользователь разблокирован" : "Пользователь заблокирован");
                loadUsers();
                if (selectedUser && selectedUser.id === userId) {
                    loadUserDetails(userId);
                }
            }
        } catch (err: any) {
            setError(err.message || "Ошибка при обновлении статуса пользователя");
        }
    }

    async function loadStats() {
        setLoadingStats(true);
        setError(null);
        try {
            const result = await api.getAdminStats();
            if ("error" in result) {
                setError(result.error);
            } else {
                setStats(result as Stats);
            }
        } catch (err: any) {
            setError(err.message || "Ошибка при загрузке статистики");
        } finally {
            setLoadingStats(false);
        }
    }

    async function loadAnalyticsIssues() {
        setLoadingIssues(true);
        try {
            const result = await api.getAdminAnalyticsIssues();
            if ("error" in result) {
                // Не показываем ошибку, просто не загружаем проблемы
            } else {
                setAnalyticsIssues(result as any[]);
            }
        } catch (err: any) {
            // Игнорируем ошибки загрузки проблем
        } finally {
            setLoadingIssues(false);
        }
    }

    async function handleExport(type: "publications" | "deals", format: "csv" | "json", filters?: any) {
        setError(null);
        setSuccess(null);
        try {
            const result = await api.exportAdminData(type, format, filters);
            if ("error" in result) {
                setError(result.error);
            } else {
                setSuccess(`Экспорт ${type} в ${format.toUpperCase()} начат`);
            }
        } catch (err: any) {
            setError(err.message || "Ошибка при экспорте");
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
                            onClick={() => setActiveTab("dashboard")}
                            className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === "dashboard"
                                ? "border-primary-500 text-primary-600"
                                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                                }`}
                        >
                            <HiOutlineChartBar className="w-5 h-5 inline mr-2" />
                            Дашборд
                        </button>
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
                            <HiOutlineCollection className="w-5 h-5 inline mr-2" />
                            Публикации
                        </button>
                        <button
                            onClick={() => setActiveTab("deals")}
                            className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === "deals"
                                ? "border-primary-500 text-primary-600"
                                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                                }`}
                        >
                            <HiOutlineUserGroup className="w-5 h-5 inline mr-2" />
                            Сделки
                        </button>
                        <button
                            onClick={() => setActiveTab("users")}
                            className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === "users"
                                ? "border-primary-500 text-primary-600"
                                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                                }`}
                        >
                            <HiOutlineUser className="w-5 h-5 inline mr-2" />
                            Пользователи
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

                {/* Dashboard Tab */}
                {activeTab === "dashboard" && (
                    <div className="space-y-6">
                        {loadingStats ? (
                            <div className="text-center py-12 text-gray-500">Загрузка статистики...</div>
                        ) : stats ? (
                            <>
                                {/* Статистические карточки */}
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-sm text-gray-600">Активные публикации</p>
                                                <p className="text-2xl font-bold text-gray-900 mt-1">{stats.active_publications.total}</p>
                                                <p className="text-xs text-gray-500 mt-1">
                                                    {stats.active_publications.requests} запросов, {stats.active_publications.trips} поездок
                                                </p>
                                            </div>
                                            <HiOutlineCollection className="w-8 h-8 text-primary-500" />
                                        </div>
                                    </div>
                                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-sm text-gray-600">Активные сделки</p>
                                                <p className="text-2xl font-bold text-gray-900 mt-1">{stats.deals.total}</p>
                                                <p className="text-xs text-gray-500 mt-1">
                                                    {stats.deals.new} новых, {stats.deals.agreed} согласовано
                                                </p>
                                            </div>
                                            <HiOutlineUserGroup className="w-8 h-8 text-blue-500" />
                                        </div>
                                    </div>
                                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-sm text-gray-600">Новые пользователи</p>
                                                <p className="text-2xl font-bold text-gray-900 mt-1">{stats.users.month}</p>
                                                <p className="text-xs text-gray-500 mt-1">
                                                    {stats.users.today} сегодня, {stats.users.week} за неделю
                                                </p>
                                            </div>
                                            <HiOutlineUser className="w-8 h-8 text-green-500" />
                                        </div>
                                    </div>
                                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-sm text-gray-600">Конверсия</p>
                                                <p className="text-2xl font-bold text-gray-900 mt-1">{stats.conversion_rate.toFixed(1)}%</p>
                                                <p className="text-xs text-gray-500 mt-1">Публикации → Сделки</p>
                                            </div>
                                            <HiOutlineChartBar className="w-8 h-8 text-amber-500" />
                                        </div>
                                    </div>
                                </div>

                                {/* Популярные маршруты */}
                                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Популярные маршруты</h3>
                                    {stats.popular_routes.length > 0 ? (
                                        <div className="space-y-2">
                                            {stats.popular_routes.map((route, idx) => (
                                                <div key={`${route.from_iata}-${route.to_iata}-${idx}`} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                                    <div>
                                                        <span className="font-medium text-gray-900">
                                                            {route.from_city || route.from_iata} → {route.to_city || route.to_iata}
                                                        </span>
                                                        <span className="text-sm text-gray-500 ml-2">
                                                            ({route.from_iata} → {route.to_iata})
                                                        </span>
                                                    </div>
                                                    <span className="px-2 py-1 bg-primary-100 text-primary-700 rounded text-sm font-medium">
                                                        {route.count} {route.count === 1 ? "публикация" : route.count < 5 ? "публикации" : "публикаций"}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-gray-500 text-center py-4">Нет данных</p>
                                    )}
                                </div>

                                {/* График динамики */}
                                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Динамика за последние 30 дней</h3>
                                    {stats.daily_stats.length > 0 ? (
                                        <div className="space-y-2">
                                            {stats.daily_stats.slice(0, 10).map((day, idx) => {
                                                const maxValue = Math.max(
                                                    ...stats.daily_stats.map(d => Math.max(d.publications, d.deals))
                                                );
                                                const pubHeight = maxValue > 0 ? (day.publications / maxValue) * 100 : 0;
                                                const dealHeight = maxValue > 0 ? (day.deals / maxValue) * 100 : 0;
                                                return (
                                                    <div key={day.date} className="flex items-end gap-2">
                                                        <div className="flex-1">
                                                            <div className="text-xs text-gray-500 mb-1">{new Date(day.date).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}</div>
                                                            <div className="flex items-end gap-1 h-20">
                                                                <div className="flex-1 bg-primary-200 rounded-t" style={{ height: `${pubHeight}%` }} title={`Публикации: ${day.publications}`} />
                                                                <div className="flex-1 bg-blue-200 rounded-t" style={{ height: `${dealHeight}%` }} title={`Сделки: ${day.deals}`} />
                                                            </div>
                                                            <div className="flex gap-2 text-xs text-gray-600 mt-1">
                                                                <span>П: {day.publications}</span>
                                                                <span>С: {day.deals}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <p className="text-gray-500 text-center py-4">Нет данных</p>
                                    )}
                                </div>

                                {/* Проблемные публикации */}
                                {analyticsIssues.length > 0 && (
                                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Проблемные публикации</h3>
                                        <div className="space-y-3">
                                            {analyticsIssues.slice(0, 10).map((issue, idx) => (
                                                <div key={`${issue.type}-${issue.publication.id}-${idx}`} className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                                                    <div className="flex items-start justify-between">
                                                        <div className="flex-1">
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <span className={`px-2 py-1 text-xs font-medium rounded ${issue.type === "duplicate" ? "bg-red-100 text-red-800" :
                                                                        issue.type === "no_matches" ? "bg-yellow-100 text-yellow-800" :
                                                                            "bg-blue-100 text-blue-800"
                                                                    }`}>
                                                                    {issue.type === "duplicate" ? "Дубликат" :
                                                                        issue.type === "no_matches" ? "Нет совпадений" :
                                                                            "Множественные сделки"}
                                                                </span>
                                                                {issue.count && <span className="text-xs text-gray-600">({issue.count})</span>}
                                                            </div>
                                                            <div className="text-sm">
                                                                <a
                                                                    href={`/publication/${issue.publication.id}`}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="text-primary-600 hover:text-primary-800 font-medium"
                                                                >
                                                                    Публикация #{issue.publication.id}
                                                                </a>
                                                                <span className="text-gray-600 ml-2">
                                                                    {issue.publication.from_iata} → {issue.publication.to_iata}
                                                                </span>
                                                            </div>
                                                            <div className="text-xs text-gray-500 mt-1">
                                                                Пользователь: {issue.publication.tg_username ? `@${issue.publication.tg_username}` : `ID: ${issue.publication.user_id}`}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Требуют внимания */}
                                {stats.alerts && (
                                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Требуют внимания</h3>
                                        <div className="space-y-4">
                                            {stats.alerts.publications_no_matches.length > 0 && (
                                                <div>
                                                    <h4 className="text-sm font-semibold text-gray-700 mb-2">Публикации без совпадений ({stats.alerts.publications_no_matches.length})</h4>
                                                    <div className="space-y-2">
                                                        {stats.alerts.publications_no_matches.map((pub) => (
                                                            <div key={pub.id} className="p-2 bg-yellow-50 border border-yellow-200 rounded text-sm">
                                                                <a
                                                                    href={`/publication/${pub.id}`}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="text-primary-600 hover:text-primary-800 font-medium"
                                                                >
                                                                    #{pub.id}
                                                                </a>
                                                                <span className="text-gray-600 ml-2">{pub.from_iata} → {pub.to_iata}</span>
                                                                <span className="text-gray-500 ml-2">({pub.days_old} дней)</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                            {stats.alerts.inactive_users.length > 0 && (
                                                <div>
                                                    <h4 className="text-sm font-semibold text-gray-700 mb-2">Неактивные пользователи ({stats.alerts.inactive_users.length})</h4>
                                                    <div className="space-y-2">
                                                        {stats.alerts.inactive_users.map((user) => (
                                                            <div key={user.id} className="p-2 bg-gray-50 border border-gray-200 rounded text-sm">
                                                                <span className="font-medium">{user.tg_username ? `@${user.tg_username}` : `ID: ${user.id}`}</span>
                                                                <span className="text-gray-500 ml-2">({user.days_inactive} дней неактивен)</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                            {stats.alerts.deals_no_activity.length > 0 && (
                                                <div>
                                                    <h4 className="text-sm font-semibold text-gray-700 mb-2">Сделки без активности ({stats.alerts.deals_no_activity.length})</h4>
                                                    <div className="space-y-2">
                                                        {stats.alerts.deals_no_activity.map((deal) => (
                                                            <div key={deal.id} className="p-2 bg-blue-50 border border-blue-200 rounded text-sm">
                                                                <span className="font-medium">Сделка #{deal.id}</span>
                                                                <span className="text-gray-500 ml-2">({deal.days_no_activity} дней без активности)</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                            {stats.alerts.publications_no_matches.length === 0 &&
                                                stats.alerts.inactive_users.length === 0 &&
                                                stats.alerts.deals_no_activity.length === 0 && (
                                                    <p className="text-gray-500 text-center py-4">Нет активных алертов</p>
                                                )}
                                        </div>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="text-center py-12 text-gray-500">Не удалось загрузить статистику</div>
                        )}
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
                        {/* Filters and Export */}
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                            <div className="flex items-center justify-between mb-4">
                                <div className="grid grid-cols-1 md:grid-cols-5 gap-4 flex-1">
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
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Поиск</label>
                                        <input
                                            type="text"
                                            value={pubFilters.search}
                                            onChange={(e) => setPubFilters({ ...pubFilters, search: e.target.value })}
                                            placeholder="ID, username, описание..."
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Bulk Actions */}
                            {selectedPubIds.size > 0 && (
                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center justify-between">
                                    <span className="text-sm text-blue-800">
                                        Выбрано: {selectedPubIds.size} {selectedPubIds.size === 1 ? "публикация" : selectedPubIds.size < 5 ? "публикации" : "публикаций"}
                                    </span>
                                    <div className="flex gap-2">
                                        <select
                                            value={bulkAction}
                                            onChange={(e) => setBulkAction(e.target.value as "activate" | "deactivate" | "")}
                                            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                        >
                                            <option value="">Выберите действие</option>
                                            <option value="activate">Активировать</option>
                                            <option value="deactivate">Деактивировать</option>
                                        </select>
                                        <button
                                            onClick={async () => {
                                                if (!bulkAction) return;
                                                setError(null);
                                                setSuccess(null);
                                                try {
                                                    const result = await api.bulkUpdateAdminPubs(Array.from(selectedPubIds), bulkAction);
                                                    if ("error" in result) {
                                                        setError(result.error);
                                                    } else {
                                                        setSuccess(`Обновлено публикаций: ${(result as any).updated || selectedPubIds.size}`);
                                                        setSelectedPubIds(new Set());
                                                        setBulkAction("");
                                                        loadPublications();
                                                    }
                                                } catch (err: any) {
                                                    setError(err.message || "Ошибка при массовом обновлении");
                                                }
                                            }}
                                            disabled={!bulkAction}
                                            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                                        >
                                            Применить
                                        </button>
                                        <button
                                            onClick={() => {
                                                setSelectedPubIds(new Set());
                                                setBulkAction("");
                                            }}
                                            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm font-medium"
                                        >
                                            Отмена
                                        </button>
                                    </div>
                                </div>
                            )}

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
                                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedPubIds.size === publications.length && publications.length > 0}
                                                            onChange={(e) => {
                                                                if (e.target.checked) {
                                                                    setSelectedPubIds(new Set(publications.map(p => p.id)));
                                                                } else {
                                                                    setSelectedPubIds(new Set());
                                                                }
                                                            }}
                                                            className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                                                        />
                                                    </th>
                                                    <th
                                                        className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                                        onClick={() => {
                                                            if (pubSortField === "id") {
                                                                setPubSortDir(pubSortDir === "asc" ? "desc" : "asc");
                                                            } else {
                                                                setPubSortField("id");
                                                                setPubSortDir("desc");
                                                            }
                                                        }}
                                                    >
                                                        ID {pubSortField === "id" && (pubSortDir === "asc" ? "↑" : "↓")}
                                                    </th>
                                                    <th
                                                        className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                                        onClick={() => {
                                                            if (pubSortField === "kind") {
                                                                setPubSortDir(pubSortDir === "asc" ? "desc" : "asc");
                                                            } else {
                                                                setPubSortField("kind");
                                                                setPubSortDir("asc");
                                                            }
                                                        }}
                                                    >
                                                        Тип {pubSortField === "kind" && (pubSortDir === "asc" ? "↑" : "↓")}
                                                    </th>
                                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Маршрут</th>
                                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Дата</th>
                                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Пользователь</th>
                                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Статус</th>
                                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Сделки</th>
                                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Возможные совпадения</th>
                                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Действия</th>
                                                </tr>
                                            </thead>
                                            <tbody className="bg-white divide-y divide-gray-200">
                                                {publications.map((pub) => (
                                                    <tr key={pub.id} className="hover:bg-gray-50">
                                                        <td className="px-4 py-3 whitespace-nowrap">
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedPubIds.has(pub.id)}
                                                                onChange={(e) => {
                                                                    const newSet = new Set(selectedPubIds);
                                                                    if (e.target.checked) {
                                                                        newSet.add(pub.id);
                                                                    } else {
                                                                        newSet.delete(pub.id);
                                                                    }
                                                                    setSelectedPubIds(newSet);
                                                                }}
                                                                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                                                            />
                                                        </td>
                                                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                                                            <a
                                                                href={`/publication/${pub.id}`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="text-primary-600 hover:text-primary-800"
                                                            >
                                                                {pub.id}
                                                            </a>
                                                        </td>
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
                                                            {pub.deal_count > 0 ? (
                                                                <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                                                                    {pub.deal_count} {pub.deal_count === 1 ? "сделка" : pub.deal_count < 5 ? "сделки" : "сделок"}
                                                                </span>
                                                            ) : (
                                                                <span className="text-xs text-gray-400">Нет сделок</span>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-3 whitespace-nowrap text-sm">
                                                            {pub.possible_matches_count > 0 ? (
                                                                <span className="px-2 py-1 text-xs font-medium bg-amber-100 text-amber-800 rounded">
                                                                    {pub.possible_matches_count} {pub.possible_matches_count === 1 ? "совпадение" : pub.possible_matches_count < 5 ? "совпадения" : "совпадений"}
                                                                </span>
                                                            ) : (
                                                                <span className="text-xs text-gray-400">Нет</span>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-3 whitespace-nowrap text-sm">
                                                            <div className="flex gap-2">
                                                                <button
                                                                    onClick={() => {
                                                                        setEditingPub(pub);
                                                                    }}
                                                                    className="text-primary-600 hover:text-primary-800 font-medium"
                                                                >
                                                                    Редактировать
                                                                </button>
                                                                <button
                                                                    onClick={() => {
                                                                        setSelectedPub(pub);
                                                                        loadMatches(pub.id);
                                                                    }}
                                                                    className="text-primary-600 hover:text-primary-800 font-medium"
                                                                >
                                                                    {pub.deal_count > 0 ? "Просмотр" : "Найти совпадения"}
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* Edit Publication Modal */}
                            {editingPub && (
                                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                                    <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                                        <div className="p-6 border-b border-gray-200">
                                            <div className="flex justify-between items-center">
                                                <h3 className="text-lg font-semibold text-gray-900">
                                                    Редактирование публикации #{editingPub.id}
                                                </h3>
                                                <button
                                                    onClick={() => setEditingPub(null)}
                                                    className="text-gray-400 hover:text-gray-600"
                                                >
                                                    <HiOutlineXCircle className="w-6 h-6" />
                                                </button>
                                            </div>
                                        </div>
                                        <EditPublicationForm
                                            pub={editingPub}
                                            onSave={async (data) => {
                                                setError(null);
                                                setSuccess(null);
                                                try {
                                                    const result = await api.updateAdminPub(editingPub.id, data);
                                                    if ("error" in result) {
                                                        setError(result.error);
                                                    } else {
                                                        setSuccess("Публикация обновлена");
                                                        setEditingPub(null);
                                                        loadPublications();
                                                    }
                                                } catch (err: any) {
                                                    setError(err.message || "Ошибка при обновлении");
                                                }
                                            }}
                                            onCancel={() => setEditingPub(null)}
                                        />
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
                                {/* Filters and Export */}
                                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 flex-1">
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
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Откуда</label>
                                                <AirportInput value={dealFilters.from} onChange={(v) => setDealFilters({ ...dealFilters, from: v })} />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Куда</label>
                                                <AirportInput value={dealFilters.to} onChange={(v) => setDealFilters({ ...dealFilters, to: v })} />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Дата с</label>
                                                <input
                                                    type="date"
                                                    value={dealFilters.from_date}
                                                    onChange={(e) => setDealFilters({ ...dealFilters, from_date: e.target.value })}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Дата по</label>
                                                <input
                                                    type="date"
                                                    value={dealFilters.to_date}
                                                    onChange={(e) => setDealFilters({ ...dealFilters, to_date: e.target.value })}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Поиск</label>
                                                <input
                                                    type="text"
                                                    value={dealFilters.search}
                                                    onChange={(e) => setDealFilters({ ...dealFilters, search: e.target.value })}
                                                    placeholder="ID сделки/публикации, username..."
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                                />
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
                                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Действия</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="bg-white divide-y divide-gray-200">
                                                        {deals.map((deal) => (
                                                            <tr key={deal.id} className="hover:bg-gray-50">
                                                                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{deal.id}</td>
                                                                <td className="px-4 py-3 text-sm text-gray-500">
                                                                    <div>
                                                                        <a
                                                                            href={`/publication/${deal.request_pub_id}`}
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                            className="text-primary-600 hover:text-primary-800 font-medium"
                                                                        >
                                                                            #{deal.request_pub_id}
                                                                        </a>
                                                                    </div>
                                                                    <div className="text-xs">{deal.request_from} → {deal.request_to}</div>
                                                                    <div className="text-xs text-gray-400">
                                                                        {deal.request_username ? `@${deal.request_username}` : `ID: ${deal.request_tg_user_id}`}
                                                                    </div>
                                                                    <div className="text-xs text-gray-400">
                                                                        {deal.request_date ? formatDate(deal.request_date) : `${formatDate(deal.request_date_start)} - ${formatDate(deal.request_date_end)}`}
                                                                    </div>
                                                                </td>
                                                                <td className="px-4 py-3 text-sm text-gray-500">
                                                                    <div>
                                                                        <a
                                                                            href={`/publication/${deal.trip_pub_id}`}
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                            className="text-primary-600 hover:text-primary-800 font-medium"
                                                                        >
                                                                            #{deal.trip_pub_id}
                                                                        </a>
                                                                    </div>
                                                                    <div className="text-xs">{deal.trip_from} → {deal.trip_to}</div>
                                                                    <div className="text-xs text-gray-400">
                                                                        {deal.trip_username ? `@${deal.trip_username}` : `ID: ${deal.trip_tg_user_id}`}
                                                                    </div>
                                                                    <div className="text-xs text-gray-400">
                                                                        {deal.trip_date ? formatDate(deal.trip_date) : "-"}
                                                                    </div>
                                                                </td>
                                                                <td className="px-4 py-3 whitespace-nowrap text-sm">
                                                                    <select
                                                                        value={deal.status}
                                                                        onChange={(e) => updateDealStatus(deal.id, e.target.value)}
                                                                        className="px-2 py-1 text-xs font-medium rounded border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                                                        style={{
                                                                            backgroundColor: deal.status === "new" ? "#dbeafe" : deal.status === "agreed" ? "#fef3c7" : deal.status === "handoff_done" ? "#d1fae5" : "#fee2e2",
                                                                            color: deal.status === "new" ? "#1e40af" : deal.status === "agreed" ? "#92400e" : deal.status === "handoff_done" ? "#065f46" : "#991b1b",
                                                                        }}
                                                                    >
                                                                        <option value="new">Новая</option>
                                                                        <option value="agreed">Согласована</option>
                                                                        <option value="handoff_done">Выполнена</option>
                                                                        <option value="cancelled">Отменена</option>
                                                                    </select>
                                                                </td>
                                                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                                                    {formatDateTime(deal.created_at)}
                                                                </td>
                                                                <td className="px-4 py-3 whitespace-nowrap text-sm">
                                                                    <button
                                                                        onClick={() => {
                                                                            setSelectedDeal(deal);
                                                                            loadDealDetails(deal.id);
                                                                        }}
                                                                        className="text-primary-600 hover:text-primary-800 font-medium"
                                                                    >
                                                                        Детали
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                            {/* Pagination */}
                                            <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
                                                <div className="text-sm text-gray-600">
                                                    Страница {dealPage}
                                                </div>
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => setDealPage(Math.max(1, dealPage - 1))}
                                                        disabled={dealPage === 1}
                                                        className="px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                                                    >
                                                        Назад
                                                    </button>
                                                    <button
                                                        onClick={() => setDealPage(dealPage + 1)}
                                                        disabled={deals.length < 50}
                                                        className="px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                                                    >
                                                        Вперед
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Deal Details Modal */}
                                    {selectedDeal && (
                                        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                                            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                                                <div className="p-6 border-b border-gray-200">
                                                    <div className="flex justify-between items-center">
                                                        <h3 className="text-lg font-semibold text-gray-900">
                                                            Детали сделки #{selectedDeal.id}
                                                        </h3>
                                                        <button
                                                            onClick={() => {
                                                                setSelectedDeal(null);
                                                                setDealDetails(null);
                                                            }}
                                                            className="text-gray-400 hover:text-gray-600"
                                                        >
                                                            <HiOutlineXCircle className="w-6 h-6" />
                                                        </button>
                                                    </div>
                                                </div>
                                                <div className="p-6">
                                                    {loadingDealDetails ? (
                                                        <div className="text-center py-8 text-gray-500">Загрузка деталей...</div>
                                                    ) : dealDetails ? (
                                                        <div className="space-y-6">
                                                            <div>
                                                                <h4 className="text-sm font-semibold text-gray-700 mb-2">Статус</h4>
                                                                <select
                                                                    value={dealDetails.status}
                                                                    onChange={(e) => updateDealStatus(dealDetails.id, e.target.value)}
                                                                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                                                >
                                                                    <option value="new">Новая</option>
                                                                    <option value="agreed">Согласована</option>
                                                                    <option value="handoff_done">Выполнена</option>
                                                                    <option value="cancelled">Отменена</option>
                                                                </select>
                                                            </div>

                                                            <div className="grid grid-cols-2 gap-6">
                                                                <div>
                                                                    <h4 className="text-sm font-semibold text-gray-700 mb-3">Запрос</h4>
                                                                    <div className="space-y-2 text-sm">
                                                                        <div>
                                                                            <span className="font-medium">Публикация:</span>{" "}
                                                                            <a
                                                                                href={`/publication/${dealDetails.request_pub_id}`}
                                                                                target="_blank"
                                                                                rel="noopener noreferrer"
                                                                                className="text-primary-600 hover:text-primary-800"
                                                                            >
                                                                                #{dealDetails.request_pub_id}
                                                                            </a>
                                                                        </div>
                                                                        <div>
                                                                            <span className="font-medium">Маршрут:</span> {dealDetails.request_from} → {dealDetails.request_to}
                                                                        </div>
                                                                        <div>
                                                                            <span className="font-medium">Дата:</span>{" "}
                                                                            {dealDetails.request_date
                                                                                ? formatDate(dealDetails.request_date)
                                                                                : `${formatDate(dealDetails.request_date_start)} - ${formatDate(dealDetails.request_date_end)}`}
                                                                        </div>
                                                                        <div>
                                                                            <span className="font-medium">Пользователь:</span>{" "}
                                                                            {dealDetails.request_username ? `@${dealDetails.request_username}` : `ID: ${dealDetails.request_tg_user_id}`}
                                                                            <span className="text-gray-500 ml-2">⭐ {dealDetails.request_rating}</span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                <div>
                                                                    <h4 className="text-sm font-semibold text-gray-700 mb-3">Поездка</h4>
                                                                    <div className="space-y-2 text-sm">
                                                                        <div>
                                                                            <span className="font-medium">Публикация:</span>{" "}
                                                                            <a
                                                                                href={`/publication/${dealDetails.trip_pub_id}`}
                                                                                target="_blank"
                                                                                rel="noopener noreferrer"
                                                                                className="text-primary-600 hover:text-primary-800"
                                                                            >
                                                                                #{dealDetails.trip_pub_id}
                                                                            </a>
                                                                        </div>
                                                                        <div>
                                                                            <span className="font-medium">Маршрут:</span> {dealDetails.trip_from} → {dealDetails.trip_to}
                                                                        </div>
                                                                        <div>
                                                                            <span className="font-medium">Дата:</span> {dealDetails.trip_date ? formatDate(dealDetails.trip_date) : "-"}
                                                                        </div>
                                                                        <div>
                                                                            <span className="font-medium">Пользователь:</span>{" "}
                                                                            {dealDetails.trip_username ? `@${dealDetails.trip_username}` : `ID: ${dealDetails.trip_tg_user_id}`}
                                                                            <span className="text-gray-500 ml-2">⭐ {dealDetails.trip_rating}</span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <div className="pt-4 border-t">
                                                                <div className="text-sm text-gray-600">
                                                                    <div><span className="font-medium">Создана:</span> {formatDateTime(dealDetails.created_at)}</div>
                                                                    {dealDetails.last_message_at && (
                                                                        <div><span className="font-medium">Последнее сообщение:</span> {formatDateTime(dealDetails.last_message_at)}</div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="text-center py-8 text-gray-500">Не удалось загрузить детали</div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                )}

                                {/* Users Tab */}
                                {activeTab === "users" && (
                                    <div className="space-y-4">
                                        {/* Filters */}
                                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                                                    <input
                                                        type="text"
                                                        value={userFilters.username}
                                                        onChange={(e) => setUserFilters({ ...userFilters, username: e.target.value })}
                                                        placeholder="Поиск по username..."
                                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-1">Telegram User ID</label>
                                                    <input
                                                        type="text"
                                                        value={userFilters.tg_user_id}
                                                        onChange={(e) => setUserFilters({ ...userFilters, tg_user_id: e.target.value })}
                                                        placeholder="Поиск по tg_user_id..."
                                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Users List */}
                                        {loadingUsers ? (
                                            <div className="text-center py-8 text-gray-500">Загрузка...</div>
                                        ) : users.length === 0 ? (
                                            <div className="text-center py-8 text-gray-500">Пользователи не найдены</div>
                                        ) : (
                                            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                                                <div className="overflow-x-auto">
                                                    <table className="min-w-full divide-y divide-gray-200">
                                                        <thead className="bg-gray-50">
                                                            <tr>
                                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Telegram</th>
                                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Рейтинг</th>
                                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Публикации</th>
                                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Сделки</th>
                                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Статус</th>
                                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Действия</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="bg-white divide-y divide-gray-200">
                                                            {users.map((user) => (
                                                                <tr key={user.id} className="hover:bg-gray-50">
                                                                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{user.id}</td>
                                                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                                                        {user.tg_username ? `@${user.tg_username}` : `ID: ${user.tg_user_id}`}
                                                                    </td>
                                                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                                                        ⭐ {user.rating}
                                                                    </td>
                                                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                                                        {user.publications_count || 0}
                                                                    </td>
                                                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                                                        {user.deals_count || 0}
                                                                    </td>
                                                                    <td className="px-4 py-3 whitespace-nowrap text-sm">
                                                                        {user.is_blocked ? (
                                                                            <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded">Заблокирован</span>
                                                                        ) : (
                                                                            <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded">Активен</span>
                                                                        )}
                                                                    </td>
                                                                    <td className="px-4 py-3 whitespace-nowrap text-sm">
                                                                        <button
                                                                            onClick={() => {
                                                                                setSelectedUser(user);
                                                                                loadUserDetails(user.id);
                                                                            }}
                                                                            className="text-primary-600 hover:text-primary-800 font-medium mr-3"
                                                                        >
                                                                            Детали
                                                                        </button>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                                {/* Pagination */}
                                                <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
                                                    <div className="text-sm text-gray-600">
                                                        Страница {userPage}
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={() => setUserPage(Math.max(1, userPage - 1))}
                                                            disabled={userPage === 1}
                                                            className="px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                                                        >
                                                            Назад
                                                        </button>
                                                        <button
                                                            onClick={() => setUserPage(userPage + 1)}
                                                            disabled={users.length < 50}
                                                            className="px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                                                        >
                                                            Вперед
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* User Details Modal */}
                                        {selectedUser && (
                                            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                                                <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                                                    <div className="p-6 border-b border-gray-200">
                                                        <div className="flex justify-between items-center">
                                                            <h3 className="text-lg font-semibold text-gray-900">
                                                                Детали пользователя #{selectedUser.id}
                                                            </h3>
                                                            <button
                                                                onClick={() => {
                                                                    setSelectedUser(null);
                                                                    setUserDetails(null);
                                                                }}
                                                                className="text-gray-400 hover:text-gray-600"
                                                            >
                                                                <HiOutlineXCircle className="w-6 h-6" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <div className="p-6">
                                                        {loadingUserDetails ? (
                                                            <div className="text-center py-8 text-gray-500">Загрузка деталей...</div>
                                                        ) : userDetails ? (
                                                            <div className="space-y-6">
                                                                <div className="grid grid-cols-2 gap-6">
                                                                    <div>
                                                                        <h4 className="text-sm font-semibold text-gray-700 mb-2">Информация</h4>
                                                                        <div className="space-y-2 text-sm">
                                                                            <div><span className="font-medium">ID:</span> {userDetails.id}</div>
                                                                            <div><span className="font-medium">Telegram User ID:</span> {userDetails.tg_user_id}</div>
                                                                            <div><span className="font-medium">Username:</span> {userDetails.tg_username ? `@${userDetails.tg_username}` : "Не указан"}</div>
                                                                            <div><span className="font-medium">Рейтинг:</span> ⭐ {userDetails.rating}</div>
                                                                            <div><span className="font-medium">Зарегистрирован:</span> {formatDateTime(userDetails.created_at)}</div>
                                                                        </div>
                                                                    </div>
                                                                    <div>
                                                                        <h4 className="text-sm font-semibold text-gray-700 mb-2">Статистика</h4>
                                                                        <div className="space-y-2 text-sm">
                                                                            <div><span className="font-medium">Публикаций:</span> {userDetails.publications_count || 0}</div>
                                                                            <div><span className="font-medium">Сделок:</span> {userDetails.deals_count || 0}</div>
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                <div>
                                                                    <div className="flex items-center justify-between mb-4">
                                                                        <h4 className="text-sm font-semibold text-gray-700">Статус блокировки</h4>
                                                                        <button
                                                                            onClick={() => toggleUserBlock(userDetails.id, userDetails.is_blocked)}
                                                                            className={`px-4 py-2 rounded-lg font-medium text-sm ${userDetails.is_blocked
                                                                                    ? "bg-green-600 text-white hover:bg-green-700"
                                                                                    : "bg-red-600 text-white hover:bg-red-700"
                                                                                }`}
                                                                        >
                                                                            {userDetails.is_blocked ? "Разблокировать" : "Заблокировать"}
                                                                        </button>
                                                                    </div>
                                                                    {userDetails.is_blocked ? (
                                                                        <p className="text-sm text-red-600">Пользователь заблокирован</p>
                                                                    ) : (
                                                                        <p className="text-sm text-green-600">Пользователь активен</p>
                                                                    )}
                                                                </div>

                                                                {userDetails.publications && userDetails.publications.length > 0 && (
                                                                    <div>
                                                                        <h4 className="text-sm font-semibold text-gray-700 mb-3">Публикации ({userDetails.publications.length})</h4>
                                                                        <div className="space-y-2 max-h-60 overflow-y-auto">
                                                                            {userDetails.publications.map((pub: any) => (
                                                                                <div key={pub.id} className="p-3 bg-gray-50 rounded-lg text-sm">
                                                                                    <div className="flex items-center justify-between">
                                                                                        <div>
                                                                                            <a
                                                                                                href={`/publication/${pub.id}`}
                                                                                                target="_blank"
                                                                                                rel="noopener noreferrer"
                                                                                                className="text-primary-600 hover:text-primary-800 font-medium"
                                                                                            >
                                                                                                #{pub.id}
                                                                                            </a>
                                                                                            <span className="ml-2 text-gray-600">
                                                                                                {pub.kind === "request" ? "Запрос" : "Поездка"}
                                                                                            </span>
                                                                                        </div>
                                                                                        {pub.is_active ? (
                                                                                            <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded">Активна</span>
                                                                                        ) : (
                                                                                            <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded">Неактивна</span>
                                                                                        )}
                                                                                    </div>
                                                                                    <div className="text-gray-600 mt-1">
                                                                                        {pub.from_iata} → {pub.to_iata}
                                                                                    </div>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                {userDetails.deals && userDetails.deals.length > 0 && (
                                                                    <div>
                                                                        <h4 className="text-sm font-semibold text-gray-700 mb-3">Сделки ({userDetails.deals.length})</h4>
                                                                        <div className="space-y-2 max-h-60 overflow-y-auto">
                                                                            {userDetails.deals.map((deal: any) => (
                                                                                <div key={deal.id} className="p-3 bg-gray-50 rounded-lg text-sm">
                                                                                    <div className="flex items-center justify-between">
                                                                                        <span className="font-medium">Сделка #{deal.id}</span>
                                                                                        <span className={`px-2 py-1 text-xs font-medium rounded ${deal.status === "new" ? "bg-blue-100 text-blue-800" :
                                                                                                deal.status === "agreed" ? "bg-yellow-100 text-yellow-800" :
                                                                                                    deal.status === "handoff_done" ? "bg-green-100 text-green-800" :
                                                                                                        "bg-red-100 text-red-800"
                                                                                            }`}>
                                                                                            {deal.status === "new" ? "Новая" :
                                                                                                deal.status === "agreed" ? "Согласована" :
                                                                                                    deal.status === "handoff_done" ? "Выполнена" :
                                                                                                        "Отменена"}
                                                                                        </span>
                                                                                    </div>
                                                                                    <div className="text-gray-600 mt-1">
                                                                                        Запрос: #{deal.request_pub_id}, Поездка: #{deal.trip_pub_id}
                                                                                    </div>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <div className="text-center py-8 text-gray-500">Не удалось загрузить детали</div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
        </>
                );
}

                // Компонент формы редактирования публикации
                function EditPublicationForm({pub, onSave, onCancel}: {pub: Publication; onSave: (data: any) => Promise<void>; onCancel: () => void }) {
    const [from, setFrom] = useState(pub.from_iata);
                    const [to, setTo] = useState(pub.to_iata);
                    const [dateStart, setDateStart] = useState(pub.date_start || "");
                    const [dateEnd, setDateEnd] = useState(pub.date_end || "");
                    const [date, setDate] = useState(pub.date || "");
                    const [item, setItem] = useState(pub.item);
                    const [weight, setWeight] = useState(pub.weight);
                    const [desc, setDesc] = useState(pub.description);
                    const [flightNo, setFlightNo] = useState(pub.flight_no || "");
                    const [airline, setAirline] = useState(pub.airline || "");
                    const [capacityHint, setCapacityHint] = useState(pub.capacity_hint || "");
                    const [isActive, setIsActive] = useState(pub.is_active);
                    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
                        e.preventDefault();
                    setSaving(true);
                    const data: any = { };
                    if (from !== pub.from_iata) data.from_iata = from;
                    if (to !== pub.to_iata) data.to_iata = to;
                    if (pub.kind === "trip") {
            if (date !== pub.date) data.date = date;
        } else {
            if (dateStart !== pub.date_start) data.date_start = dateStart;
                    if (dateEnd !== pub.date_end) data.date_end = dateEnd;
        }
                    if (item !== pub.item) data.item = item;
                    if (weight !== pub.weight) data.weight = weight;
                    if (desc !== pub.description) data.description = desc;
                    if (pub.kind === "trip") {
            if (flightNo !== (pub.flight_no || "")) data.flight_no = flightNo;
                    if (airline !== (pub.airline || "")) data.airline = airline;
                    if (capacityHint !== (pub.capacity_hint || "")) data.capacity_hint = capacityHint;
        }
                    if (isActive !== pub.is_active) data.is_active = isActive;

                    await onSave(data);
                    setSaving(false);
    };

                    return (
                    <form onSubmit={handleSubmit} className="p-6 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Откуда</label>
                                <AirportInput value={from} onChange={setFrom} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Куда</label>
                                <AirportInput value={to} onChange={setTo} />
                            </div>
                        </div>

                        {pub.kind === "trip" ? (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Дата</label>
                                <input
                                    type="date"
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                />
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Дата начала</label>
                                    <input
                                        type="date"
                                        value={dateStart}
                                        onChange={(e) => setDateStart(e.target.value)}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Дата окончания</label>
                                    <input
                                        type="date"
                                        value={dateEnd}
                                        onChange={(e) => setDateEnd(e.target.value)}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                    />
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Тип</label>
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
                                <label className="block text-sm font-medium text-gray-700 mb-1">Вес</label>
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

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Описание</label>
                            <textarea
                                value={desc}
                                onChange={(e) => setDesc(e.target.value)}
                                rows={3}
                                maxLength={500}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            />
                            <p className="text-xs text-gray-500 mt-1">{desc.length}/500</p>
                        </div>

                        {pub.kind === "trip" && (
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Номер рейса</label>
                                    <input
                                        type="text"
                                        value={flightNo}
                                        onChange={(e) => setFlightNo(e.target.value)}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Авиакомпания</label>
                                    <input
                                        type="text"
                                        value={airline}
                                        onChange={(e) => setAirline(e.target.value)}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Вместимость</label>
                                    <input
                                        type="text"
                                        value={capacityHint}
                                        onChange={(e) => setCapacityHint(e.target.value)}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                    />
                                </div>
                            </div>
                        )}

                        <div>
                            <label className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={isActive}
                                    onChange={(e) => setIsActive(e.target.checked)}
                                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                                />
                                <span className="text-sm font-medium text-gray-700">Активна</span>
                            </label>
                        </div>

                        <div className="flex justify-end gap-3 pt-4 border-t">
                            <button
                                type="button"
                                onClick={onCancel}
                                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium"
                            >
                                Отмена
                            </button>
                            <button
                                type="submit"
                                disabled={saving}
                                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                            >
                                {saving ? "Сохранение..." : "Сохранить"}
                            </button>
                        </div>
                    </form>
                    );
}
