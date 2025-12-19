import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import SEO from "../components/SEO";
import UserRating from "../components/UserRating";
import { api, isAuthenticated } from "../lib/api";
import {
  HiOutlineLocationMarker,
  HiOutlineCalendar,
  HiOutlineCube,
  HiOutlineExclamationCircle,
  HiOutlineCheckCircle,
  HiOutlineArrowRight,
  HiArrowRight,
  HiOutlineShare,
  HiOutlineChatAlt2,
} from "react-icons/hi";
import { HiOutlineGift, HiOutlineTruck } from "react-icons/hi2";
import { FaTelegram } from "react-icons/fa";
import { formatItem, formatWeight } from "../lib/translations";
import { usePostHog } from "posthog-js/react";

export default function PublicationPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const posthog = usePostHog();
  const [publication, setPublication] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestingContacts, setRequestingContacts] = useState(false);
  const [telegramLink, setTelegramLink] = useState<string | null>(null);
  const [shareSuccess, setShareSuccess] = useState(false);

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

  useEffect(() => {
    if (!id) {
      setError("Неверный идентификатор объявления");
      setLoading(false);
      return;
    }

    loadPublication();
  }, [id]);

  async function loadPublication() {
    if (!id) return;

    setLoading(true);
    setError(null);

    try {
      const pubData = await api.getPub(id);

      if (pubData.error) {
        setError(pubData.error || "Объявление не найдено");
        setLoading(false);
        track("publication_view_error", {
          pub_id: id,
          error: pubData.error,
        });
        return;
      }

      setPublication(pubData);
      track("publication_viewed", {
        pub_id: id,
        pub_kind: pubData.kind,
        from_iata: pubData.from_iata,
        to_iata: pubData.to_iata,
      });
    } catch (err) {
      setError("Произошла ошибка при загрузке объявления");
      track("publication_load_error", {
        pub_id: id,
        error: String(err),
      });
    } finally {
      setLoading(false);
    }
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return date.toLocaleDateString("ru-RU", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  const handleShare = async () => {
    if (!publication) return;

    const shareUrl = `${window.location.origin}/publication/${publication.id}`;

    track("publication_share_clicked", {
      pub_id: publication.id,
      pub_kind: publication.kind,
    });

    // Try Web Share API first (mobile)
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Объявление: ${publication.from_iata} → ${publication.to_iata}`,
          text: publication.description || "",
          url: shareUrl,
        });
        setShareSuccess(true);
        setTimeout(() => setShareSuccess(false), 3000);
        track("publication_shared", {
          pub_id: publication.id,
          method: "native_share",
        });
        return;
      } catch (err: any) {
        // User cancelled or error, fall through to clipboard
        if (err.name !== "AbortError") {
          console.error("Share error:", err);
        }
      }
    }

    // Fallback to clipboard
    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareSuccess(true);
      setTimeout(() => setShareSuccess(false), 3000);
      track("publication_shared", {
        pub_id: publication.id,
        method: "clipboard",
      });
    } catch (err) {
      console.error("Failed to copy to clipboard:", err);
      setError("Не удалось скопировать ссылку");
    }
  };

  const handleRequestContacts = async () => {
    if (!publication || !isAuthenticated()) {
      track("request_contacts_attempted_not_authenticated", {
        pub_id: publication?.id,
      });
      navigate(`/auth?return=${encodeURIComponent(window.location.pathname)}`);
      return;
    }

    setRequestingContacts(true);
    setError(null);

    track("request_contacts_clicked", {
      pub_id: publication.id,
      pub_kind: publication.kind,
      from_iata: publication.from_iata,
      to_iata: publication.to_iata,
    });

    try {
      const result: any = await api.requestContacts(publication.id);
      console.log("[PublicationPage] requestContacts result:", result);
      if (result.error) {
        setError(result.error || "Не удалось запросить контакты");
        setTelegramLink(null);
      } else {
        // Show contacts
        let contactsMsg = "✅ Контакты создателя объявления:\n\n";
        const username = result.username;
        let link = "";

        if (username && typeof username === "string" && username.trim()) {
          contactsMsg += `Telegram: @${username}`;
          link = `https://t.me/${username}`;
        } else if (result.tg_user_id) {
          contactsMsg += `ID пользователя: ${result.tg_user_id}`;
          link = `tg://user?id=${result.tg_user_id}`;
        } else {
          contactsMsg += "Контакты не указаны (пользователь не указал username в Telegram)";
        }
        contactsMsg += "\n\nСоздатель объявления получил уведомление о запросе.";

        setError(contactsMsg);
        setTelegramLink(link || null);

        setTimeout(() => {
          setError(null);
          setTelegramLink(null);
        }, 8000);
      }
    } catch (err) {
      console.error("[PublicationPage] requestContacts error:", err);
      setError("Произошла ошибка при запросе контактов");
      setTelegramLink(null);
    } finally {
      setRequestingContacts(false);
    }
  };

  if (loading) {
    return (
      <>
        <SEO title="Загрузка..." path={`/publication/${id}`} />
        <div className="card p-12 text-center">
          <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Загрузка объявления...</p>
        </div>
      </>
    );
  }

  if (error && !publication) {
    return (
      <>
        <SEO title="Ошибка" path={`/publication/${id}`} />
        <div className="card p-6 sm:p-12 text-center">
          <HiOutlineExclamationCircle className="w-12 h-12 sm:w-16 sm:h-16 text-red-300 mx-auto mb-4" />
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">Ошибка</h3>
          <p className="text-sm sm:text-base text-gray-600 mb-4">{error}</p>
          <button onClick={() => navigate("/")} className="btn btn-primary">
            Вернуться на главную
          </button>
        </div>
      </>
    );
  }

  if (!publication) {
    return null;
  }

  return (
    <>
      <SEO
        title={`Объявление: ${publication.from_iata} → ${publication.to_iata}`}
        description={publication.description || `Объявление о доставке из ${publication.from_iata} в ${publication.to_iata}`}
        path={`/publication/${publication.id}`}
      />
      <div className="space-y-6 animate-fade-in">
        {/* Header with share button */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <HiOutlineArrowRight className="w-5 h-5 rotate-180" />
            <span className="text-sm font-medium">Назад</span>
          </button>
          <button
            onClick={handleShare}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700"
          >
            <HiOutlineShare className="w-5 h-5" />
            Поделиться
          </button>
        </div>

        {/* Share success message */}
        {shareSuccess && (
          <div className="card p-4 bg-green-50 border-green-200 flex items-center gap-2">
            <HiOutlineCheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
            <p className="text-sm text-green-700">Ссылка скопирована в буфер обмена!</p>
          </div>
        )}

        {/* Publication card */}
        <div className="card p-6 sm:p-8">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-2 flex-wrap">
              {publication.kind === "request" ? (
                <span className="badge-primary">
                  <HiOutlineGift className="w-4 h-4" />
                  <span className="text-sm">Ищу кто летит</span>
                </span>
              ) : (
                <span className="badge-success">
                  <HiOutlineTruck className="w-4 h-4" />
                  <span className="text-sm">Лечу</span>
                </span>
              )}
              <UserRating rating={publication.user_rating || 0} />
            </div>
          </div>

          {/* Route */}
          <div className="flex items-center gap-3 mb-6">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-primary-50 rounded-lg">
                <HiOutlineLocationMarker className="w-5 h-5 text-primary-600" />
              </div>
              <span className="font-bold text-lg text-gray-900">{publication.from_iata}</span>
            </div>
            <HiArrowRight className="w-6 h-6 text-gray-400 flex-shrink-0" />
            <div className="flex items-center gap-2">
              <div className="p-2 bg-primary-50 rounded-lg">
                <HiOutlineLocationMarker className="w-5 h-5 text-primary-600" />
              </div>
              <span className="font-bold text-lg text-gray-900">{publication.to_iata}</span>
            </div>
          </div>

          {/* Date */}
          <div className="flex items-center gap-2 text-sm text-gray-600 mb-4">
            <HiOutlineCalendar className="w-5 h-5 flex-shrink-0" />
            <span>
              {publication.kind === "trip" && publication.date
                ? formatDate(publication.date)
                : publication.date_start && publication.date_end
                  ? `${formatDate(publication.date_start)} – ${formatDate(publication.date_end)}`
                  : ""}
            </span>
          </div>

          {/* Item and weight */}
          <div className="flex items-center gap-2 text-sm text-gray-600 mb-4">
            <HiOutlineCube className="w-5 h-5 flex-shrink-0" />
            <span>
              {formatItem(publication.item)} • {formatWeight(publication.weight)}
            </span>
          </div>

          {/* Description */}
          {publication.description && (
            <div className="mb-6 pt-4 border-t border-gray-100">
              <p className="text-base text-gray-700 whitespace-pre-wrap">{publication.description}</p>
            </div>
          )}

          {/* Reward hint */}
          {publication.reward_hint && (
            <div className="mb-6 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-800">
                <span className="font-semibold">Награда:</span> {publication.reward_hint} (уточняется в чате)
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="pt-4 border-t border-gray-100">
            {error && (
              <div
                className={`mb-4 flex items-start gap-2 p-4 border rounded-lg ${error.includes("Контакты создателя") || error.includes("Создатель объявления получил")
                  ? "bg-green-50 border-green-200"
                  : "bg-red-50 border-red-200"
                  }`}
              >
                {error.includes("Контакты создателя") || error.includes("Создатель объявления получил") ? (
                  <HiOutlineCheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                ) : (
                  <HiOutlineExclamationCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <p
                    className={`text-sm whitespace-pre-line ${error.includes("Контакты создателя") || error.includes("Создатель объявления получил")
                      ? "text-green-700"
                      : "text-red-700"
                      }`}
                  >
                    {error}
                  </p>
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

            <button
              className="btn btn-primary w-full"
              onClick={handleRequestContacts}
              disabled={requestingContacts}
            >
              {requestingContacts ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Запрос контактов...
                </>
              ) : (
                <>
                  <HiOutlineChatAlt2 className="w-5 h-5" />
                  Показать контакты
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
