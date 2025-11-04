import { useState } from "react";
import AirportInput from "../components/AirportInput";
import { api } from "../lib/api";
import { Link, useNavigate } from "react-router-dom";
import { HiOutlineSearch, HiOutlineLocationMarker, HiOutlineCalendar, HiOutlineCube, HiArrowRight, HiOutlineExclamationCircle, HiOutlineSparkles } from "react-icons/hi";
import { HiOutlineTruck, HiOutlineGift } from "react-icons/hi2";
import { formatItem, formatWeight } from "../lib/translations";

export default function BrowsePage() {
  const navigate = useNavigate();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [kindFilter, setKindFilter] = useState<"request" | "trip">("request");
  const [rows, setRows] = useState<any[]>([]);
  const [matchesMap, setMatchesMap] = useState<Record<number, any[]>>({});
  const [loadingMatches, setLoadingMatches] = useState<Record<number, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function search() {
    if (!from || !to) {
      setError("Выберите аэропорты отправления и назначения");
      return;
    }
    setError(null);
    setLoading(true);
    setSearched(true);
    setMatchesMap({});
    try {
      // Если выбран конкретный тип, ищем противоположный (совпадения)
      // Если kindFilter "all", не задаем searchKind - покажем все
      let searchKind: string | undefined;
      if (kindFilter === "request") {
        searchKind = "trip"; // Я ищу → показываем поездки
      } else if (kindFilter === "trip") {
        searchKind = "request"; // Я лечу → показываем запросы
      }
      // kindFilter === "all" → searchKind остается undefined, покажем все

      const result: any = await api.listPubs(from, to, searchKind);
      if (Array.isArray(result)) {
        setRows(result);
        // Загружаем совпадения для каждого результата
        if (result.length > 0) {
          loadMatchesForResults(result);
        }
      } else if (result && typeof result === "object" && "error" in result) {
        setError(result.error || "Ошибка при поиске");
        setRows([]);
      } else {
        setRows([]);
      }
    } catch (err) {
      setError("Произошла ошибка при поиске. Попробуйте еще раз.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadMatchesForResults(results: any[]) {
    const loadingState: Record<number, boolean> = {};
    results.forEach(r => {
      loadingState[r.id] = true;
    });
    setLoadingMatches(loadingState);

    // Загружаем совпадения для каждого результата параллельно
    const matchesPromises = results.map(r => api.matches(String(r.id)));
    const matchesResults = await Promise.all(matchesPromises);

    const newMatchesMap: Record<number, any[]> = {};
    results.forEach((r, idx) => {
      if (Array.isArray(matchesResults[idx])) {
        newMatchesMap[r.id] = matchesResults[idx];
      } else {
        newMatchesMap[r.id] = [];
      }
    });

    setMatchesMap(newMatchesMap);
    setLoadingMatches({});
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return date.toLocaleDateString("ru-RU", { month: "short", day: "numeric", year: "numeric" });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="text-center space-y-2">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Найдите подходящий вариант</h1>
        <p className="text-sm sm:text-base text-gray-600">Поиск объявлений по маршруту</p>
      </div>

      <div className="card p-4 sm:p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <AirportInput label="Откуда" value={from} onChange={setFrom} />
          <AirportInput label="Куда" value={to} onChange={setTo} />
        </div>

        {/* Filter by kind */}
        <div>
          <label className="block text-sm sm:text-sm font-medium text-gray-700 mb-2">
            Я
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setKindFilter("request")}
              className={`px-3 py-3 sm:px-4 sm:py-3 rounded-lg border-2 transition-all text-sm sm:text-base flex items-center justify-center gap-2 touch-manipulation min-h-[56px] ${kindFilter === "request"
                ? "border-primary-500 bg-primary-50 text-primary-900 font-semibold"
                : "border-gray-200 hover:border-gray-300 active:bg-gray-50 text-gray-700"
                }`}
            >
              <HiOutlineGift className="w-5 h-5 sm:w-5 sm:h-5 flex-shrink-0" />
              <span>ищу</span>
            </button>
            <button
              type="button"
              onClick={() => setKindFilter("trip")}
              className={`px-3 py-3 sm:px-4 sm:py-3 rounded-lg border-2 transition-all text-sm sm:text-base flex items-center justify-center gap-2 touch-manipulation min-h-[56px] ${kindFilter === "trip"
                ? "border-primary-500 bg-primary-50 text-primary-900 font-semibold"
                : "border-gray-200 hover:border-gray-300 active:bg-gray-50 text-gray-700"
                }`}
            >
              <HiOutlineTruck className="w-5 h-5 sm:w-5 sm:h-5 flex-shrink-0" />
              <span>лечу</span>
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2 text-center">
            {kindFilter === "request"
              ? "Найду поездки, которые могут доставить ваш запрос"
              : "Найду запросы, которые можно доставить вашей поездкой"}
          </p>
        </div>

        <button
          className="btn btn-primary w-full"
          onClick={search}
          disabled={loading || !from || !to}
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Поиск...
            </>
          ) : (
            <>
              <HiOutlineSearch className="w-5 h-5" />
              Найти
            </>
          )}
        </button>

        {error && (
          <div className="flex items-start gap-2 p-4 bg-red-50 border border-red-200 rounded-lg">
            <HiOutlineExclamationCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}
      </div>

      {searched && (
        <div className="space-y-3">
          {loading ? (
            <div className="card p-12 text-center">
              <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto mb-4" />
              <p className="text-gray-600">Поиск совпадений...</p>
            </div>
          ) : rows.length === 0 ? (
            <div className="card p-6 sm:p-12 text-center">
              <HiOutlineSearch className="w-12 h-12 sm:w-16 sm:h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">Результаты не найдены</h3>
              <p className="text-sm sm:text-base text-gray-600 mb-4">
                {kindFilter === "trip"
                  ? "Пока нет запросов на доставку по этому маршруту. Попробуйте изменить критерии поиска или создайте свое объявление."
                  : "Пока нет поездок по этому маршруту. Попробуйте изменить критерии поиска или создайте свое объявление."}
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={() => {
                    setFrom("");
                    setTo("");
                    setSearched(false);
                    setRows([]);
                  }}
                  className="btn btn-secondary"
                >
                  Очистить поиск
                </button>
                <button
                  onClick={() => navigate(`/publish?kind=${kindFilter === "request" ? "request" : "trip"}&from=${from}&to=${to}`)}
                  className="btn btn-primary"
                >
                  Создать объявление
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
                  {rows.length} {rows.length === 1 ? "результат" : rows.length < 5 ? "результата" : "результатов"}
                </h2>
              </div>
              <div className="grid gap-4">
                {rows.map((r, idx) => (
                  <Link
                    key={r.id}
                    to={`/matches/${r.id}`}
                    className="card-hover p-4 sm:p-5 animate-slide-up touch-manipulation"
                    style={{ animationDelay: `${idx * 50}ms` }}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        {r.kind === "request" ? (
                          <span className="badge-primary">
                            <HiOutlineGift className="w-3 h-3 sm:w-3 sm:h-3" />
                            <span className="text-xs sm:text-xs">Ищу</span>
                          </span>
                        ) : (
                          <span className="badge-success">
                            <HiOutlineTruck className="w-3 h-3 sm:w-3 sm:h-3" />
                            <span className="text-xs sm:text-xs">Лечу</span>
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 sm:gap-3 mb-4">
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <div className="p-1.5 bg-primary-50 rounded-lg">
                          <HiOutlineLocationMarker className="w-4 h-4 sm:w-4 sm:h-4 text-primary-600" />
                        </div>
                        <span className="font-semibold text-gray-900 text-sm sm:text-base">{r.from_iata}</span>
                      </div>
                      <HiArrowRight className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 flex-shrink-0" />
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <div className="p-1.5 bg-primary-50 rounded-lg">
                          <HiOutlineLocationMarker className="w-4 h-4 sm:w-4 sm:h-4 text-primary-600" />
                        </div>
                        <span className="font-semibold text-gray-900 text-sm sm:text-base">{r.to_iata}</span>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center gap-2 sm:gap-4 text-xs sm:text-sm text-gray-600 mb-4">
                      <div className="flex items-center gap-1.5">
                        <HiOutlineCalendar className="w-4 h-4 sm:w-4 sm:h-4 flex-shrink-0" />
                        <span className="break-words">{formatDate(r.date_start)} – {formatDate(r.date_end)}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <HiOutlineCube className="w-4 h-4 sm:w-4 sm:h-4 flex-shrink-0" />
                        <span>{formatItem(r.item)}</span>
                        <span className="text-gray-400">•</span>
                        <span>{formatWeight(r.weight)}</span>
                      </div>
                    </div>

                    {/* Show matches if available */}
                    {matchesMap[r.id] !== undefined && (
                      <div className="mt-4 pt-4 border-t border-gray-100">
                        {loadingMatches[r.id] ? (
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <div className="w-3 h-3 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
                            Поиск совпадений...
                          </div>
                        ) : matchesMap[r.id] && matchesMap[r.id].length > 0 ? (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-xs font-medium text-gray-700">
                              <HiOutlineSparkles className="w-4 h-4 text-primary-600" />
                              Найдено {matchesMap[r.id].length} {matchesMap[r.id].length === 1 ? "совпадение" : matchesMap[r.id].length < 5 ? "совпадения" : "совпадений"}
                            </div>
                            <div className="space-y-2">
                              {matchesMap[r.id].slice(0, 2).map((match: any) => (
                                <div key={match.other_pub_id} className="p-2 bg-gray-50 rounded-lg text-xs">
                                  <div className="flex items-center gap-2 mb-1">
                                    {match.kind === "request" ? (
                                      <span className="badge-primary text-xs px-1.5 py-0.5">
                                        <HiOutlineGift className="w-3 h-3" />
                                        <span>Ищу</span>
                                      </span>
                                    ) : (
                                      <span className="badge-success text-xs px-1.5 py-0.5">
                                        <HiOutlineTruck className="w-3 h-3" />
                                        <span>Лечу</span>
                                      </span>
                                    )}
                                    <span className="text-primary-600 font-semibold">{match.score}%</span>
                                  </div>
                                  <div className="text-gray-600">
                                    {formatDate(match.date_start)} – {formatDate(match.date_end)}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="text-xs text-gray-500">
                            Совпадений по датам не найдено
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-4 border-t border-gray-100 mt-4">
                      <span className="text-xs sm:text-sm text-gray-500">
                        Открыть детали
                      </span>
                      <button
                        className="btn btn-primary text-xs sm:text-sm px-3 py-2"
                        onClick={(e) => {
                          e.preventDefault();
                          navigate(`/matches/${r.id}`);
                        }}
                      >
                        Детали
                        <HiArrowRight className="w-4 h-4 ml-1" />
                      </button>
                    </div>
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
