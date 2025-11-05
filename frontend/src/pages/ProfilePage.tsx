import { useState, useEffect } from "react";
import { api, isAuthenticated } from "../lib/api";
import { useNavigate } from "react-router-dom";
import { 
  HiOutlineUser, 
  HiOutlineLocationMarker, 
  HiOutlineCalendar, 
  HiOutlineCube,
  HiOutlineExclamationCircle,
  HiOutlineCheckCircle,
  HiOutlineXCircle,
  HiOutlinePencil,
  HiOutlineEye
} from "react-icons/hi";
import { HiOutlineGift, HiOutlineTruck } from "react-icons/hi2";
import UserRating from "../components/UserRating";
import { formatItem, formatWeight } from "../lib/translations";
import { usePostHogAnalytics } from "../lib/posthog";

export default function ProfilePage() {
  const navigate = useNavigate();
  const { track } = usePostHogAnalytics();
  const [profile, setProfile] = useState<any>(null);
  const [publications, setPublications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState<Set<number>>(new Set());
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("all");

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
      const [profileData, pubsData] = await Promise.all([
        api.getProfile(),
        api.listMyPubs()
      ]);

      if (profileData.error) {
        setError(profileData.error || "Ошибка при загрузке профиля");
        setLoading(false);
        return;
      }

      if (pubsData.error) {
        setError(pubsData.error || "Ошибка при загрузке объявлений");
        setLoading(false);
        return;
      }

      setProfile(profileData);
      setPublications(Array.isArray(pubsData) ? pubsData : []);
      
      track("profile_page_viewed", {
        publications_count: Array.isArray(pubsData) ? pubsData.length : 0,
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

    track("publication_status_toggled", {
      pub_id: pubId,
      new_status: !currentStatus,
    });

    try {
      const result = await api.updatePub(pubId, !currentStatus);
      
      if (result.error) {
        setError(result.error || "Ошибка при обновлении объявления");
        track("publication_update_error", {
          pub_id: pubId,
          error: result.error,
        });
      } else {
        // Update local state
        setPublications(prev => 
          prev.map(p => p.id === pubId ? { ...p, is_active: !currentStatus } : p)
        );
        track("publication_updated", {
          pub_id: pubId,
          is_active: !currentStatus,
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

  const filteredPublications = publications.filter(pub => {
    if (filter === "active") return pub.is_active;
    if (filter === "inactive") return !pub.is_active;
    return true;
  });

  const activeCount = publications.filter(p => p.is_active).length;
  const inactiveCount = publications.filter(p => !p.is_active).length;

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

  if (error && !profile) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="card p-6 text-center">
          <HiOutlineExclamationCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Ошибка</h3>
          <p className="text-sm text-gray-600 mb-4">{error}</p>
          <button onClick={loadData} className="btn btn-primary">
            Попробовать снова
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="text-center space-y-2">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Мой профиль</h1>
        <p className="text-sm sm:text-base text-gray-600">Управление вашими объявлениями</p>
      </div>

      {/* Profile Info */}
      <div className="card p-4 sm:p-6">
        <div className="flex items-center gap-4 mb-4">
          <div className="p-3 bg-primary-100 rounded-full">
            <HiOutlineUser className="w-6 h-6 text-primary-600" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-gray-900">
              {profile?.username ? `@${profile.username}` : "Пользователь"}
            </h2>
            <div className="mt-1">
              <UserRating rating={profile?.rating || 0} />
            </div>
          </div>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-gray-900">{publications.length}</div>
          <div className="text-xs text-gray-600 mt-1">Всего</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-green-600">{activeCount}</div>
          <div className="text-xs text-gray-600 mt-1">Активных</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-gray-400">{inactiveCount}</div>
          <div className="text-xs text-gray-600 mt-1">Неактивных</div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => {
            setFilter("all");
            track("profile_filter_changed", { filter: "all" });
          }}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            filter === "all"
              ? "border-primary-500 text-primary-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          Все ({publications.length})
        </button>
        <button
          onClick={() => {
            setFilter("active");
            track("profile_filter_changed", { filter: "active" });
          }}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            filter === "active"
              ? "border-primary-500 text-primary-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          Активные ({activeCount})
        </button>
        <button
          onClick={() => {
            setFilter("inactive");
            track("profile_filter_changed", { filter: "inactive" });
          }}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            filter === "inactive"
              ? "border-primary-500 text-primary-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          Неактивные ({inactiveCount})
        </button>
      </div>

      {/* Publications List */}
      {error && (
        <div className="flex items-start gap-2 p-4 bg-red-50 border border-red-200 rounded-lg">
          <HiOutlineExclamationCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {filteredPublications.length === 0 ? (
        <div className="card p-6 sm:p-12 text-center">
          <HiOutlineExclamationCircle className="w-12 h-12 sm:w-16 sm:h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">
            {filter === "all" 
              ? "У вас пока нет объявлений"
              : filter === "active"
              ? "Нет активных объявлений"
              : "Нет неактивных объявлений"}
          </h3>
          <p className="text-sm sm:text-base text-gray-600 mb-4">
            {filter === "all"
              ? "Создайте первое объявление, чтобы начать пользоваться сервисом"
              : "Создайте новое объявление или активируйте существующее"}
          </p>
          {filter === "all" && (
            <button
              onClick={() => {
                track("create_publication_from_profile");
                navigate("/publish");
              }}
              className="btn btn-primary"
            >
              Создать объявление
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredPublications.map((pub) => (
            <div
              key={pub.id}
              className={`card p-4 sm:p-5 ${
                !pub.is_active ? "opacity-60" : ""
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
                  {pub.is_active ? (
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
                  onClick={() => {
                    track("view_publication_from_profile", { pub_id: pub.id });
                    navigate(`/matches/${pub.id}`);
                  }}
                  className="btn btn-secondary flex-1 text-xs sm:text-sm"
                  disabled={updating.has(pub.id)}
                >
                  <HiOutlineEye className="w-4 h-4" />
                  Просмотр
                </button>
                <button
                  onClick={() => togglePublicationStatus(pub.id, pub.is_active)}
                  className={`btn flex-1 text-xs sm:text-sm ${
                    pub.is_active ? "btn-secondary" : "btn-primary"
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

      {/* Create New Publication Button */}
      <div className="card p-4 bg-primary-50 border border-primary-200">
        <div className="text-center">
          <p className="text-sm text-gray-700 mb-3">
            Хотите создать новое объявление?
          </p>
          <button
            onClick={() => {
              track("create_publication_from_profile_bottom");
              navigate("/publish");
            }}
            className="btn btn-primary"
          >
            Создать объявление
          </button>
        </div>
      </div>
    </div>
  );
}

