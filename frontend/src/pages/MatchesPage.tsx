import React, { useEffect, useState } from "react";
import { api, isAuthenticated } from "../lib/api";
import { useParams, useNavigate } from "react-router-dom";
import { HiOutlineLocationMarker, HiOutlineCalendar, HiOutlineCube, HiOutlineArrowLeft, HiOutlineSparkles, HiOutlinePaperAirplane, HiOutlineExclamationCircle } from "react-icons/hi";
import { HiOutlineGift, HiOutlineTruck, HiOutlineCheckCircle } from "react-icons/hi2";
import { formatItem, formatWeight } from "../lib/translations";

export default function MatchesPage() {
  const { pubId } = useParams();
  const navigate = useNavigate();
  const [pub, setPub] = useState<any | null>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState<number | null>(null);
  const [createdDeals, setCreatedDeals] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let a = true;
    setLoading(true);
    setError(null);
    
    // Fetch both publication and matches in parallel
    Promise.all([
      api.getPub(pubId!),
      api.matches(pubId!)
    ]).then(([pubData, matchesData]) => {
      if (a) {
        let hasPubError = false;
        
        // Handle publication
        if (pubData.error) {
          setError(pubData.error || "Объявление не найдено");
          hasPubError = true;
        } else {
          setPub(pubData);
        }
        
        // Handle matches
        if (Array.isArray(matchesData)) {
          setRows(matchesData);
        } else if (matchesData.error) {
          if (!hasPubError) { // Don't override publication error
            setError(matchesData.error || "Ошибка при поиске совпадений");
          }
          setRows([]);
        } else {
          setRows([]);
        }
        setLoading(false);
      }
    }).catch(() => {
      if (a) {
        setError("Произошла ошибка при загрузке данных");
        setLoading(false);
      }
    });
    return () => {
      a = false;
    };
  }, [pubId]);

  async function makeDeal(otherPubId: number, otherKind: string) {
    // Check authentication before creating deal
    if (!isAuthenticated()) {
      // Save current URL to return after auth
      const returnUrl = `/matches/${pubId}`;
      navigate(`/auth?return=${encodeURIComponent(returnUrl)}`);
      return;
    }

    setCreating(otherPubId);
    setError(null);
    try {
      const reqId = otherKind === "trip" ? Number(pubId) : otherPubId;
      const tripId = otherKind === "trip" ? otherPubId : Number(pubId);
      const res = await api.createDeal(reqId, tripId);
      if (res.error) {
        setError(res.error || "Ошибка при создании сделки");
        setCreating(null);
      } else if (res.id) {
        const link = await api.dealLink(res.id);
        if (link.url) {
          // Mark this deal as created
          setCreatedDeals(prev => new Set(prev).add(otherPubId));
          // Open Telegram link
          window.open(link.url, "_blank");
          // Show success message briefly
          setTimeout(() => {
            setCreating(null);
          }, 1000);
        } else {
          setError("Не удалось получить ссылку на чат");
          setCreating(null);
        }
      } else {
        setError("Не удалось создать сделку");
        setCreating(null);
      }
    } catch (err) {
      setError("Произошла ошибка. Попробуйте еще раз.");
      setCreating(null);
    }
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return date.toLocaleDateString("ru-RU", { month: "short", day: "numeric", year: "numeric" });
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-emerald-600 bg-emerald-50";
    if (score >= 60) return "text-blue-600 bg-blue-50";
    if (score >= 40) return "text-amber-600 bg-amber-50";
    return "text-gray-600 bg-gray-50";
  };

  const sortedRows = [...rows].sort((a, b) => b.score - a.score);

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 active:text-gray-700 transition-colors touch-manipulation min-h-[48px]"
      >
        <HiOutlineArrowLeft className="w-5 h-5 sm:w-5 sm:h-5" />
        <span className="text-sm sm:text-sm font-medium">Назад</span>
      </button>

      <div className="text-center space-y-2">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Найденные совпадения</h1>
        <p className="text-sm sm:text-base text-gray-600">Найдены объявления, которые совпадают с вашим маршрутом</p>
      </div>

      {loading ? (
        <div className="card p-6 sm:p-12 text-center">
          <div className="w-10 h-10 sm:w-12 sm:h-12 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm sm:text-base text-gray-600">Загрузка...</p>
        </div>
      ) : pub ? (
        <>
          {/* Show original publication */}
          <div className="card p-4 sm:p-6">
            <div className="flex items-center gap-2 mb-4">
              {pub.kind === "request" ? (
                <span className="badge-primary">
                  <HiOutlineGift className="w-3 h-3 sm:w-3 sm:h-3" />
                  <span className="text-xs sm:text-xs">Нужна доставка</span>
                </span>
              ) : (
                <span className="badge-success">
                  <HiOutlineTruck className="w-3 h-3 sm:w-3 sm:h-3" />
                  <span className="text-xs sm:text-xs">Могу доставить</span>
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 sm:gap-3 mb-4">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <div className="p-1.5 bg-primary-50 rounded-lg">
                  <HiOutlineLocationMarker className="w-4 h-4 sm:w-4 sm:h-4 text-primary-600" />
                </div>
                <span className="font-semibold text-gray-900 text-sm sm:text-base">{pub.from_iata}</span>
              </div>
              <HiOutlinePaperAirplane className="w-4 h-4 sm:w-5 sm:h-5 text-primary-500 flex-shrink-0" />
              <div className="flex items-center gap-1.5 sm:gap-2">
                <div className="p-1.5 bg-primary-50 rounded-lg">
                  <HiOutlineLocationMarker className="w-4 h-4 sm:w-4 sm:h-4 text-primary-600" />
                </div>
                <span className="font-semibold text-gray-900 text-sm sm:text-base">{pub.to_iata}</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center gap-2 sm:gap-4 text-xs sm:text-sm text-gray-600">
              <div className="flex items-center gap-1.5">
                <HiOutlineCalendar className="w-4 h-4 sm:w-4 sm:h-4 flex-shrink-0" />
                <span className="break-words">{formatDate(pub.date_start)} – {formatDate(pub.date_end)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <HiOutlineCube className="w-4 h-4 sm:w-4 sm:h-4 flex-shrink-0" />
                <span>{formatItem(pub.item)}</span>
                <span className="text-gray-400">•</span>
                <span>{formatWeight(pub.weight)}</span>
              </div>
            </div>
            {pub.description && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{pub.description}</p>
              </div>
            )}
          </div>

          {/* Show matches or no matches message */}
          {rows.length === 0 ? (
            <div className="card p-6 sm:p-12 text-center space-y-4">
              <HiOutlineSparkles className="w-12 h-12 sm:w-16 sm:h-16 text-gray-300 mx-auto" />
              <div>
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">Совпадения не найдены</h3>
                <p className="text-sm sm:text-base text-gray-600 mb-1">
                  Пока нет объявлений противоположного типа по этому маршруту с пересекающимися датами.
                </p>
                <p className="text-xs sm:text-sm text-gray-500 mb-4">
                  {pub.kind === "request" 
                    ? "Нет поездок, которые могут доставить ваш запрос." 
                    : "Нет запросов, которые можно доставить вашей поездкой."}
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={() => navigate("/")}
                  className="btn btn-secondary"
                >
                  Вернуться к поиску
                </button>
                <button
                  onClick={() => navigate("/publish")}
                  className="btn btn-primary"
                >
                  Создать новое объявление
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <p className="text-sm sm:text-sm text-gray-600">
                  Найдено <span className="font-semibold text-gray-900">{rows.length}</span> {rows.length === 1 ? "совпадение" : rows.length < 5 ? "совпадения" : "совпадений"}
                </p>
                <span className="text-xs sm:text-xs text-gray-500">Отсортировано по релевантности</span>
              </div>

              <div className="space-y-4">
                {sortedRows.map((r, idx) => (
                  <div
                    key={r.other_pub_id}
                    className="card p-4 sm:p-6 animate-slide-up"
                    style={{ animationDelay: `${idx * 50}ms` }}
                  >
                    <div className="flex flex-col sm:flex-row items-start sm:items-start justify-between gap-3 mb-4">
                      <div className="flex items-center gap-2">
                        {r.kind === "request" ? (
                          <span className="badge-primary">
                            <HiOutlineGift className="w-3 h-3 sm:w-3 sm:h-3" />
                            <span className="text-xs sm:text-xs">Нужна доставка</span>
                          </span>
                        ) : (
                          <span className="badge-success">
                            <HiOutlineTruck className="w-3 h-3 sm:w-3 sm:h-3" />
                            <span className="text-xs sm:text-xs">Могу доставить</span>
                          </span>
                        )}
                      </div>
                      <div className={`badge ${getScoreColor(r.score)} font-semibold`}>
                        <HiOutlineSparkles className="w-3 h-3 sm:w-3 sm:h-3" />
                        <span className="text-xs sm:text-xs">{r.score}% совпадение</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 sm:gap-3 mb-4">
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <div className="p-1.5 bg-primary-50 rounded-lg">
                          <HiOutlineLocationMarker className="w-4 h-4 sm:w-4 sm:h-4 text-primary-600" />
                        </div>
                        <span className="font-semibold text-gray-900 text-sm sm:text-base">{r.from_iata}</span>
                      </div>
                      <HiOutlinePaperAirplane className="w-4 h-4 sm:w-5 sm:h-5 text-primary-500 flex-shrink-0" />
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <div className="p-1.5 bg-primary-50 rounded-lg">
                          <HiOutlineLocationMarker className="w-4 h-4 sm:w-4 sm:h-4 text-primary-600" />
                        </div>
                        <span className="font-semibold text-gray-900 text-sm sm:text-base">{r.to_iata}</span>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center gap-2 sm:gap-4 text-xs sm:text-sm text-gray-600 mb-4 pb-4 border-b border-gray-100">
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

                    {createdDeals.has(r.other_pub_id) ? (
                      <div className="flex items-center justify-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                        <HiOutlineCheckCircle className="w-5 h-5 text-emerald-600" />
                        <span className="text-sm font-medium text-emerald-700">Чат создан, открыт в Telegram</span>
                      </div>
                    ) : (
                      <button
                        className="btn btn-primary w-full"
                        onClick={() => makeDeal(r.other_pub_id, r.kind)}
                        disabled={creating === r.other_pub_id}
                      >
                        {creating === r.other_pub_id ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            Создание чата...
                          </>
                        ) : (
                          <>
                            <HiOutlinePaperAirplane className="w-5 h-5 sm:w-5 sm:h-5" />
                            Открыть чат в Telegram
                          </>
                        )}
                      </button>
                    )}
                  </div>
                ))}
              </div>
              
              {error && (
                <div className="flex items-start gap-2 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <HiOutlineExclamationCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}
            </>
          )}
        </>
      ) : (
        <div className="card p-6 sm:p-12 text-center">
          <HiOutlineExclamationCircle className="w-12 h-12 sm:w-16 sm:h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">Объявление не найдено</h3>
          <p className="text-sm sm:text-base text-gray-600 mb-4">
            Не удалось загрузить информацию об объявлении
          </p>
          <button
            onClick={() => navigate("/")}
            className="btn btn-primary"
          >
            Вернуться к поиску
          </button>
        </div>
      )}
    </div>
  );
}
