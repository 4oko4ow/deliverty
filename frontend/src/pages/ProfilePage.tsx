import { useState, useEffect } from "react";
import { api, isAuthenticated } from "../lib/api";
import { useNavigate } from "react-router-dom";
import {
  HiOutlineLocationMarker,
  HiOutlineCalendar,
  HiOutlineCube,
  HiOutlineExclamationCircle,
  HiOutlineCheckCircle,
  HiOutlineXCircle
} from "react-icons/hi";
import { HiOutlineGift, HiOutlineTruck } from "react-icons/hi2";
import { formatItem, formatWeight } from "../lib/translations";
import { usePostHogAnalytics } from "../lib/posthog";

export default function ProfilePage() {
  const navigate = useNavigate();
  const { track } = usePostHogAnalytics();
  const [publications, setPublications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!isAuthenticated()) {
      navigate(`/auth?return=${encodeURIComponent("/profile")}`);
      return;
    }

    loadData();
  }, [navigate]);

  async function loadData() {
    setLoading(true);
    setError(null);

    try {
      const pubsData = await api.listMyPubs();

      if (pubsData.error) {
        setError(pubsData.error || "Ошибка при загрузке объявлений");
        setLoading(false);
        return;
      }

      const pubs = Array.isArray(pubsData) ? pubsData : [];

      // Debug: log to see what we're getting
      console.log("[ProfilePage] Loaded publications:", pubs.map((p: any) => ({
        id: p.id,
        is_active: p.is_active,
        is_active_type: typeof p.is_active
      })));

      setPublications(pubs);

      track("profile_page_viewed", {
        publications_count: pubs.length,
      });
    } catch (err) {
      setError("Произошла ошибка. Попробуйте еще раз.");
      track("profile_error", { error: String(err) });
    } finally {
      setLoading(false);
    }
  }

  async function togglePublicationStatus(pubId: number, currentStatus: boolean) {
    setUpdating(prev => new Set(prev).add(pubId));
    setError(null);

    const newStatus = !currentStatus;
    console.log("[ProfilePage] Toggling publication", { pubId, currentStatus, newStatus });

    track("publication_status_toggled", {
      pub_id: pubId,
      new_status: newStatus,
    });

    try {
      const result = await api.updatePub(pubId, newStatus);

      if (result.error) {
        setError(result.error || "Ошибка при обновлении объявления");
        track("publication_update_error", {
          pub_id: pubId,
          error: result.error,
        });
      } else {
        // Reload all publications to get fresh data from server
        console.log("[ProfilePage] Update successful, reloading data...");
        await loadData();
        track("publication_updated", {
          pub_id: pubId,
          is_active: newStatus,
        });
      }
    } catch (err) {
      setError("Произошла ошибка. Попробуйте еще раз.");
      track("publication_update_error", {
        pub_id: pubId,
        error: String(err),
      });
    } finally {
      setUpdating(prev => {
        const newSet = new Set(prev);
        newSet.delete(pubId);
        return newSet;
      });
    }
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return date.toLocaleDateString("ru-RU", { month: "short", day: "numeric", year: "numeric" });
  };


  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="card p-12 text-center">
          <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Загрузка профиля...</p>
        </div>
      </div>
    );
  }


  return (
    <div className="space-y-6 animate-fade-in">
      <div className="text-center space-y-2">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Мои объявления</h1>
      </div>

      {/* Publications List */}
      {error && (
        <div className="flex items-start gap-2 p-4 bg-red-50 border border-red-200 rounded-lg">
          <HiOutlineExclamationCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {publications.length === 0 ? (
        <div className="card p-6 sm:p-12 text-center">
          <HiOutlineExclamationCircle className="w-12 h-12 sm:w-16 sm:h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">
            У вас пока нет объявлений
          </h3>
          <p className="text-sm sm:text-base text-gray-600 mb-4">
            Создайте первое объявление, чтобы начать пользоваться сервисом
          </p>
          <button
            onClick={() => {
              track("create_publication_from_profile");
              navigate("/publish");
            }}
            className="btn btn-primary"
          >
            Создать объявление
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {publications.map((pub) => (
            <div
              key={pub.id}
              className={`card p-4 sm:p-5 ${!pub.is_active ? "opacity-60" : ""
                }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2 flex-wrap">
                  {pub.kind === "request" ? (
                    <span className="badge-primary">
                      <HiOutlineGift className="w-3 h-3" />
                      <span className="text-xs">Ищу кто летит</span>
                    </span>
                  ) : (
                    <span className="badge-success">
                      <HiOutlineTruck className="w-3 h-3" />
                      <span className="text-xs">Лечу</span>
                    </span>
                  )}
                  {pub.is_active === true ? (
                    <span className="badge bg-green-100 text-green-700">
                      <HiOutlineCheckCircle className="w-3 h-3" />
                      <span className="text-xs">Активно</span>
                    </span>
                  ) : (
                    <span className="badge bg-gray-100 text-gray-600">
                      <HiOutlineXCircle className="w-3 h-3" />
                      <span className="text-xs">Неактивно</span>
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 sm:gap-3 mb-4">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <div className="p-1.5 bg-primary-50 rounded-lg">
                    <HiOutlineLocationMarker className="w-4 h-4 text-primary-600" />
                  </div>
                  <span className="font-semibold text-gray-900 text-sm sm:text-base">
                    {pub.from_iata}
                  </span>
                </div>
                <span className="text-gray-400">→</span>
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <div className="p-1.5 bg-primary-50 rounded-lg">
                    <HiOutlineLocationMarker className="w-4 h-4 text-primary-600" />
                  </div>
                  <span className="font-semibold text-gray-900 text-sm sm:text-base">
                    {pub.to_iata}
                  </span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center gap-2 sm:gap-4 text-xs sm:text-sm text-gray-600 mb-4">
                <div className="flex items-center gap-1.5">
                  <HiOutlineCalendar className="w-4 h-4 flex-shrink-0" />
                  <span className="break-words">
                    {formatDate(pub.date_start)} – {formatDate(pub.date_end)}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <HiOutlineCube className="w-4 h-4 flex-shrink-0" />
                  <span>{formatItem(pub.item)}</span>
                  <span className="text-gray-400">•</span>
                  <span>{formatWeight(pub.weight)}</span>
                </div>
              </div>

              {pub.description && (
                <div className="mb-4 pt-3 border-t border-gray-100">
                  <p className="text-sm text-gray-700 whitespace-pre-wrap line-clamp-3">
                    {pub.description}
                  </p>
                </div>
              )}

              <div className="flex items-center gap-2 pt-4 border-t border-gray-100">
                <button
                  onClick={() => togglePublicationStatus(pub.id, pub.is_active)}
                  className={`btn flex-1 text-xs sm:text-sm ${pub.is_active ? "btn-secondary" : "btn-primary"
                    }`}
                  disabled={updating.has(pub.id)}
                >
                  {updating.has(pub.id) ? (
                    <>
                      <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      Обновление...
                    </>
                  ) : pub.is_active ? (
                    <>
                      <HiOutlineXCircle className="w-4 h-4" />
                      Деактивировать
                    </>
                  ) : (
                    <>
                      <HiOutlineCheckCircle className="w-4 h-4" />
                      Активировать
                    </>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}

