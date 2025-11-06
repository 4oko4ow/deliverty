import { useState, useEffect } from "react";
import AirportInput from "../components/AirportInput";
import UserRating from "../components/UserRating";
import { api, isAuthenticated } from "../lib/api";
import { useNavigate } from "react-router-dom";
import { HiOutlineSearch, HiOutlineLocationMarker, HiOutlineCalendar, HiOutlineCube, HiArrowRight, HiOutlineExclamationCircle, HiOutlineCheckCircle } from "react-icons/hi";
import { HiOutlineTruck, HiOutlineGift } from "react-icons/hi2";
import { FaTelegram } from "react-icons/fa";
import { formatItem, formatWeight } from "../lib/translations";
import { usePostHog } from "posthog-js/react";

export default function BrowsePage() {
  const navigate = useNavigate();
  const posthog = usePostHog();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [kindFilter, setKindFilter] = useState<"request" | "trip">("request");
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState<number | null>(null);
  const [telegramLink, setTelegramLink] = useState<string | null>(null);

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
      posthog.capture("browse_page_viewed");
    }
  }, [posthog]); // Track when PostHog is ready

  // Restore search state after login
  useEffect(() => {
    const savedState = localStorage.getItem("browse_search_state");
    if (savedState) {
      try {
        const searchState = JSON.parse(savedState);
        const restoredFrom = searchState.from || "";
        const restoredTo = searchState.to || "";
        const restoredKindFilter = searchState.kindFilter || "request";

        setFrom(restoredFrom);
        setTo(restoredTo);
        setKindFilter(restoredKindFilter);
        setSearched(searchState.searched || false);

        // Clear saved state after restoring
        localStorage.removeItem("browse_search_state");

        // If there was a search, restore results by re-running search with restored values
        if (searchState.searched && restoredFrom && restoredTo) {
          // Use a separate function to perform search with specific values
          const performRestoredSearch = async () => {
            setError(null);
            setLoading(true);
            setSearched(true);

            track("search_started", {
              from_iata: restoredFrom,
              to_iata: restoredTo,
              kind_filter: restoredKindFilter,
            });

            try {
              let searchKind: string | undefined;
              if (restoredKindFilter === "request") {
                searchKind = "trip";
              } else if (restoredKindFilter === "trip") {
                searchKind = "request";
              }

              const result: any = await api.listPubs(restoredFrom, restoredTo, searchKind);
              if (Array.isArray(result)) {
                setRows(result);
                track("search_completed", {
                  from_iata: restoredFrom,
                  to_iata: restoredTo,
                  kind_filter: restoredKindFilter,
                  results_count: result.length,
                });

                // Track when results are displayed
                if (result.length > 0) {
                  track("search_results_viewed", {
                    from_iata: restoredFrom,
                    to_iata: restoredTo,
                    kind_filter: restoredKindFilter,
                    results_count: result.length,
                  });
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
              track("search_error", {
                from_iata: restoredFrom,
                to_iata: restoredTo,
                kind_filter: restoredKindFilter,
                error: String(err),
              });
            } finally {
              setLoading(false);
            }
          };

          // Trigger search after a short delay to ensure state is set
          setTimeout(performRestoredSearch, 100);
        }
      } catch (e) {
        console.error("Failed to restore search state:", e);
        localStorage.removeItem("browse_search_state");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // track is stable, no need to include it

  async function search() {
    if (!from || !to) {
      setError("Выберите аэропорты отправления и назначения");
      track("search_error", { reason: "missing_airports" });
      return;
    }
    setError(null);
    setLoading(true);
    setSearched(true);

    track("search_started", {
      from_iata: from,
      to_iata: to,
      kind_filter: kindFilter,
    });

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
        // Debug: log first result to check description
        if (result.length > 0) {
          console.log("First result:", result[0]);
          console.log("Description:", result[0].description);
        }
        setRows(result);

        track("search_completed", {
          from_iata: from,
          to_iata: to,
          kind_filter: kindFilter,
          results_count: result.length,
        });

        // Track when results are displayed
        if (result.length > 0) {
          track("search_results_viewed", {
            from_iata: from,
            to_iata: to,
            kind_filter: kindFilter,
            results_count: result.length,
          });
        }

        // Не загружаем совпадения на странице поиска - они будут показаны на странице детального просмотра
      } else if (result && typeof result === "object" && "error" in result) {
        setError(result.error || "Ошибка при поиске");
        setRows([]);
      } else {
        setRows([]);
      }
    } catch (err) {
      setError("Произошла ошибка при поиске. Попробуйте еще раз.");
      setRows([]);
      track("search_error", {
        from_iata: from,
        to_iata: to,
        kind_filter: kindFilter,
        error: String(err),
      });
    } finally {
      setLoading(false);
    }
  }

  async function makeDeal(resultPub: any) {
    // Check authentication
    if (!isAuthenticated()) {
      track("deal_attempted_not_authenticated", {
        pub_id: resultPub.id,
        pub_kind: resultPub.kind,
      });
      // Save search state to localStorage before redirect
      const searchState = {
        from,
        to,
        kindFilter,
        rows: rows.map(r => ({ id: r.id, kind: r.kind, from_iata: r.from_iata, to_iata: r.to_iata })), // Save minimal data
        searched,
      };
      localStorage.setItem("browse_search_state", JSON.stringify(searchState));
      navigate(`/auth?return=${encodeURIComponent(window.location.pathname + window.location.search)}`);
      return;
    }

    setCreating(resultPub.id);
    setError(null);

    track("deal_started", {
      pub_id: resultPub.id,
      pub_kind: resultPub.kind,
      from_iata: resultPub.from_iata,
      to_iata: resultPub.to_iata,
      user_filter_kind: kindFilter,
    });

    try {
      // If user searches "Я ищу" (request), they see "trip" results
      // To create deal, we need user's request publication
      if (kindFilter === "request") {
        // Try to find user's own request first on this route
        let myRequests: any = await api.listMyPubs(resultPub.from_iata, resultPub.to_iata, "request");

        let myRequestId: number;

        if (Array.isArray(myRequests) && myRequests.length > 0) {
          // User has own request on this route, use it
          myRequestId = myRequests[0].id;
        } else {
          // Try to find any request publication by user (maybe on different route)
          const allMyRequests: any = await api.listMyPubs(undefined, undefined, "request");
          if (Array.isArray(allMyRequests) && allMyRequests.length > 0) {
            // Use any existing request publication
            myRequestId = allMyRequests[0].id;
          } else {
            // No own request found, create minimal one automatically
            const newPub: any = await api.createPub({
              kind: "request",
              from_iata: resultPub.from_iata,
              to_iata: resultPub.to_iata,
              date_start: resultPub.date_start || resultPub.date,
              date_end: resultPub.date_end || resultPub.date,
              item: resultPub.item || "documents",
              weight: resultPub.weight || "envelope",
              description: ""
            });

            if (newPub.error || !newPub.id) {
              // Check if error is about publication limit
              if (newPub.error && newPub.error.includes("лимит 5 активных публикаций")) {
                // Load all user publications to show them
                const allMyPubs: any = await api.listMyPubs();
                if (Array.isArray(allMyPubs) && allMyPubs.length > 0) {
                  const pubsList = allMyPubs.map((p: any) =>
                    `${p.from_iata} → ${p.to_iata} (${p.kind === "request" ? "Ищу" : "Лечу"})`
                  ).join(", ");
                  setError(`У вас уже 5 активных публикаций: ${pubsList}. Пожалуйста, деактивируйте одну из них, чтобы создать новую.`);
                } else {
                  setError("У вас уже 5 активных публикаций. Пожалуйста, деактивируйте одну из существующих публикаций.");
                }
              } else {
                setError(newPub.error || "Не удалось создать объявление");
              }
              setCreating(null);
              track("deal_error", {
                pub_id: resultPub.id,
                error: "failed_to_create_publication",
                user_filter_kind: kindFilter,
              });
              return;
            }

            myRequestId = newPub.id;
          }
        }

        // Create deal with automatically created or existing request
        const res = await api.createDeal(myRequestId, resultPub.id);

        if (res.error) {
          setError(res.error || "Не удалось создать сделку");
          setCreating(null);
          track("deal_error", {
            pub_id: resultPub.id,
            error: res.error,
            user_filter_kind: kindFilter,
          });
          return;
        }

        if (res.id) {
          // Get Telegram link and open it
          const link = await api.dealLink(res.id);
          if (link.url) {
            const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
            let telegramUrl = link.url;

            if (isMobile) {
              const urlObj = new URL(link.url);
              const startParam = urlObj.searchParams.get('start');
              if (startParam) {
                telegramUrl = `tg://resolve?domain=${link.url.split('t.me/')[1].split('?')[0]}&start=${startParam}`;
              }
            }

            window.open(telegramUrl, "_blank");
            setCreating(null);

            track("deal_created", {
              deal_id: res.id,
              pub_id: resultPub.id,
              pub_kind: resultPub.kind,
              from_iata: resultPub.from_iata,
              to_iata: resultPub.to_iata,
              user_filter_kind: kindFilter,
            });

            // Show success message briefly
            setTimeout(() => {
              setError(null);
            }, 2000);
            return;
          } else {
            setError(link.error || "Не удалось получить ссылку на чат");
            setCreating(null);
            track("deal_error", {
              pub_id: resultPub.id,
              error: "no_telegram_link",
              user_filter_kind: kindFilter,
            });
            return;
          }
        }
      }

      // If user searches "Я лечу" (trip), they see "request" results
      // To create deal, we need user's trip publication
      if (kindFilter === "trip") {
        // Try to find user's own trip first on this route
        let myTrips: any = await api.listMyPubs(resultPub.from_iata, resultPub.to_iata, "trip");

        let myTripId: number;

        if (Array.isArray(myTrips) && myTrips.length > 0) {
          // User has own trip on this route, use it
          myTripId = myTrips[0].id;
        } else {
          // Try to find any trip publication by user (maybe on different route)
          const allMyTrips: any = await api.listMyPubs(undefined, undefined, "trip");
          if (Array.isArray(allMyTrips) && allMyTrips.length > 0) {
            // Use any existing trip publication
            myTripId = allMyTrips[0].id;
          } else {
            // No own trip found, create minimal one automatically
            const newPub: any = await api.createPub({
              kind: "trip",
              from_iata: resultPub.from_iata,
              to_iata: resultPub.to_iata,
              date: resultPub.date || resultPub.date_start,
              item: resultPub.item || "documents",
              weight: resultPub.weight || "envelope",
              description: ""
            });

            if (newPub.error || !newPub.id) {
              // Check if error is about publication limit
              if (newPub.error && newPub.error.includes("лимит 5 активных публикаций")) {
                // Load all user publications to show them
                const allMyPubs: any = await api.listMyPubs();
                if (Array.isArray(allMyPubs) && allMyPubs.length > 0) {
                  const pubsList = allMyPubs.map((p: any) =>
                    `${p.from_iata} → ${p.to_iata} (${p.kind === "request" ? "Ищу" : "Лечу"})`
                  ).join(", ");
                  setError(`У вас уже 5 активных публикаций: ${pubsList}. Пожалуйста, деактивируйте одну из них, чтобы создать новую.`);
                } else {
                  setError("У вас уже 5 активных публикаций. Пожалуйста, деактивируйте одну из существующих публикаций.");
                }
              } else {
                setError(newPub.error || "Не удалось создать объявление");
              }
              setCreating(null);
              return;
            }

            myTripId = newPub.id;
          }
        }

        // Create deal with automatically created or existing trip
        const res = await api.createDeal(resultPub.id, myTripId);

        if (res.error) {
          setError(res.error || "Не удалось создать сделку");
          setCreating(null);
          return;
        }

        if (res.id) {
          // Get Telegram link and open it
          const link = await api.dealLink(res.id);
          if (link.url) {
            const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
            let telegramUrl = link.url;

            if (isMobile) {
              const urlObj = new URL(link.url);
              const startParam = urlObj.searchParams.get('start');
              if (startParam) {
                telegramUrl = `tg://resolve?domain=${link.url.split('t.me/')[1].split('?')[0]}&start=${startParam}`;
              }
            }

            window.open(telegramUrl, "_blank");
            setCreating(null);

            track("deal_created", {
              deal_id: res.id,
              pub_id: resultPub.id,
              pub_kind: resultPub.kind,
              from_iata: resultPub.from_iata,
              to_iata: resultPub.to_iata,
              user_filter_kind: kindFilter,
            });

            // Show success message briefly
            setTimeout(() => {
              setError(null);
            }, 2000);
            return;
          } else {
            setError(link.error || "Не удалось получить ссылку на чат");
            setCreating(null);
            track("deal_error", {
              pub_id: resultPub.id,
              error: "no_telegram_link",
              user_filter_kind: kindFilter,
            });
            return;
          }
        }
      }
    } catch (err) {
      console.error("[BrowsePage] makeDeal error", err);
      setError("Произошла ошибка. Попробуйте еще раз.");
      setCreating(null);
      track("deal_error", {
        pub_id: resultPub.id,
        error: String(err),
        user_filter_kind: kindFilter,
      });
    }
  }


  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return date.toLocaleDateString("ru-RU", { month: "short", day: "numeric", year: "numeric" });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="text-center space-y-2">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Поиск</h1>
      </div>

      <div className="card p-4 sm:p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <AirportInput label="Откуда" value={from} onChange={setFrom} />
          <AirportInput label="Куда" value={to} onChange={setTo} />
        </div>

        {/* Filter by kind */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2.5">
            Я
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => {
                track("filter_changed", { filter: "request", from_iata: from, to_iata: to });
                setKindFilter("request");
              }}
              className={`px-4 py-4 rounded-lg border-2 transition-all text-base flex items-center justify-center gap-2 touch-manipulation min-h-[56px] ${kindFilter === "request"
                ? "border-primary-500 bg-primary-50 text-primary-900 font-semibold"
                : "border-gray-200 hover:border-gray-300 active:bg-gray-50 text-gray-700"
                }`}
            >
              <HiOutlineGift className="w-5 h-5 flex-shrink-0" />
              <span>ищу</span>
            </button>
            <button
              type="button"
              onClick={() => {
                track("filter_changed", { filter: "trip", from_iata: from, to_iata: to });
                setKindFilter("trip");
              }}
              className={`px-4 py-4 rounded-lg border-2 transition-all text-base flex items-center justify-center gap-2 touch-manipulation min-h-[56px] ${kindFilter === "trip"
                ? "border-primary-500 bg-primary-50 text-primary-900 font-semibold"
                : "border-gray-200 hover:border-gray-300 active:bg-gray-50 text-gray-700"
                }`}
            >
              <HiOutlineTruck className="w-5 h-5 flex-shrink-0" />
              <span>лечу</span>
            </button>
          </div>
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
          <div className={`flex items-start gap-2 p-4 border rounded-lg ${error.includes("Контакты создателя") || error.includes("Создатель объявления получил")
            ? "bg-green-50 border-green-200"
            : "bg-red-50 border-red-200"
            }`}>
            {error.includes("Контакты создателя") || error.includes("Создатель объявления получил") ? (
              <HiOutlineCheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            ) : (
              <HiOutlineExclamationCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <p className={`text-sm whitespace-pre-line ${error.includes("Контакты создателя") || error.includes("Создатель объявления получил")
                ? "text-green-700"
                : "text-red-700"
                }`}>{error}</p>
              {telegramLink && (
                <a
                  href={telegramLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-[#0088cc] text-white text-sm font-medium rounded-lg hover:bg-[#0077b5] transition-colors"
                  onClick={() => {
                    track("telegram_link_clicked", { link: telegramLink });
                  }}
                >
                  <FaTelegram className="w-5 h-5" />
                  Открыть в Telegram
                </a>
              )}
            </div>
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
                  ? "Пока нет запросов на доставку по этому маршруту. Создайте свое объявление или попробуйте изменить критерии поиска."
                  : "Пока нет путешественников по этому маршруту. Создайте свое объявление или попробуйте изменить критерии поиска."}
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={() => {
                    track("search_cleared", { from_iata: from, to_iata: to, kind_filter: kindFilter });
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
                  onClick={() => {
                    track("navigate_to_publish", {
                      from_search: true,
                      kind: kindFilter === "request" ? "request" : "trip",
                      from_iata: from,
                      to_iata: to,
                    });
                    navigate(`/publish?kind=${kindFilter === "request" ? "request" : "trip"}&from=${from}&to=${to}`);
                  }}
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
                  <div
                    key={r.id}
                    className="card-hover p-5 animate-slide-up touch-manipulation"
                    style={{ animationDelay: `${idx * 50}ms` }}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        {r.kind === "request" ? (
                          <span className="badge-primary">
                            <HiOutlineGift className="w-3 h-3 sm:w-3 sm:h-3" />
                            <span className="text-xs sm:text-xs">Ищу кто летит</span>
                          </span>
                        ) : (
                          <span className="badge-success">
                            <HiOutlineTruck className="w-3 h-3 sm:w-3 sm:h-3" />
                            <span className="text-xs sm:text-xs">Лечу</span>
                          </span>
                        )}
                        <UserRating rating={r.user_rating || 0} />
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
                        <span className="break-words">
                          {r.kind === "trip" && r.date
                            ? formatDate(r.date)
                            : r.date_start && r.date_end
                              ? `${formatDate(r.date_start)} – ${formatDate(r.date_end)}`
                              : ""}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <HiOutlineCube className="w-4 h-4 sm:w-4 sm:h-4 flex-shrink-0" />
                        <span>{formatItem(r.item)}</span>
                        <span className="text-gray-400">•</span>
                        <span>{formatWeight(r.weight)}</span>
                      </div>
                    </div>

                    {(() => {
                      const desc = r.description || r.desc || "";
                      if (desc && String(desc).trim()) {
                        return (
                          <div className="mb-4 pt-3 border-t border-gray-100">
                            <p className="text-sm text-gray-700 whitespace-pre-wrap line-clamp-3">{String(desc)}</p>
                          </div>
                        );
                      }
                      return null;
                    })()}

                    <div className="flex items-center justify-end pt-4 border-t border-gray-100">
                      <button
                        className="btn btn-primary"
                        onClick={async () => {
                          track("request_contacts_clicked", {
                            pub_id: r.id,
                            pub_kind: r.kind,
                            from_iata: r.from_iata,
                            to_iata: r.to_iata,
                          });

                          try {
                            const result: any = await api.requestContacts(r.id);
                            console.log("[BrowsePage] requestContacts result:", result);
                            if (result.error) {
                              setError(result.error || "Не удалось запросить контакты");
                              setTelegramLink(null);
                            } else {
                              // Show contacts
                              let contactsMsg = "✅ Контакты создателя объявления:\n\n";
                              const username = result.username;
                              let link = "";

                              if (username && typeof username === 'string' && username.trim()) {
                                contactsMsg += `Telegram: @${username}`;
                                link = `https://t.me/${username}`;
                              } else if (result.tg_user_id) {
                                contactsMsg += `ID пользователя: ${result.tg_user_id}`;
                                link = `tg://user?id=${result.tg_user_id}`;
                              } else {
                                contactsMsg += "Контакты не указаны (пользователь не указал username в Telegram)";
                              }
                              contactsMsg += "\n\nСоздатель объявления получил уведомление о запросе.";

                              // Show success message with contacts
                              const originalError = error;
                              const originalLink = telegramLink;
                              setError(contactsMsg);
                              setTelegramLink(link || null);

                              setTimeout(() => {
                                setError(originalError);
                                setTelegramLink(originalLink);
                              }, 8000);
                            }
                          } catch (err) {
                            console.error("[BrowsePage] requestContacts error:", err);
                            setError("Произошла ошибка при запросе контактов");
                            setTelegramLink(null);
                          }
                        }}
                      >
                        Показать контакты
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
