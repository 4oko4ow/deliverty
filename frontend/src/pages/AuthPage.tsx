import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import SEO from "../components/SEO";
import Logo from "../components/Logo";
import TelegramLogin from "../components/TelegramLogin";
import { HiOutlineCheckCircle, HiOutlineX } from "react-icons/hi";
import { usePostHog } from "posthog-js/react";

const TG_BOT = import.meta.env.VITE_TG_BOT || "your_bot";
const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8080/api";

interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

export default function AuthPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const posthog = usePostHog();
  const [showSuccess, setShowSuccess] = useState(false);
  const [showBotLink, setShowBotLink] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      posthog.capture("auth_page_viewed", {
        return_url: searchParams.get("return") || null,
      });
      if (import.meta.env.DEV) {
        console.log("[PostHog] Tracked: auth_page_viewed", {
          return_url: searchParams.get("return") || null,
        });
      }
    } else if (import.meta.env.DEV) {
      console.warn("[PostHog] Skipped: auth_page_viewed (PostHog not ready)");
    }
  }, [posthog, searchParams]); // Track when PostHog is ready and searchParams change

  // Check if we're returning from Telegram auth (redirect mode fallback)
  useEffect(() => {
    const authSuccess = searchParams.get("auth_success");
    const userId = searchParams.get("user_id");
    const errorParam = searchParams.get("error");

    if (authSuccess === "1" && userId) {
      // Save user ID to localStorage
      localStorage.setItem("tg_uid", userId);

      track("auth_success", {
        user_id: userId,
        return_url: searchParams.get("return") || "/",
      });

      // Show success notification
      setShowSuccess(true);
      setShowBotLink(true);
      // Auto-hide after 5 seconds
      setTimeout(() => {
        setShowSuccess(false);
        // Redirect to return URL or home
        const returnUrl = searchParams.get("return");
        navigate(returnUrl || "/");
      }, 5000);
    } else if (errorParam) {
      setError("Ошибка авторизации. Попробуйте еще раз.");
      track("auth_error", { error: errorParam });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, navigate]); // track function is stable, posthog is checked inside

  // Check if already authenticated
  useEffect(() => {
    const saved = localStorage.getItem("tg_uid");
    if (saved) {
      navigate("/");
    }
  }, [navigate]);

  const authUrl = `${API_BASE}/auth/telegram`;

  return (
    <>
      <SEO
        title="Вход"
        description="Войдите в Deliverty через Telegram, чтобы начать использовать сервис передачи посылок через попутчиков."
        path="/auth"
      />
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-primary-500 to-primary-600 rounded-2xl shadow-lg mb-4 p-3">
            <Logo size="lg" />
          </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Добро пожаловать в Deliverty
            </h1>
            <p className="text-gray-600">
              Войдите через Telegram, чтобы использовать приложение
            </p>
          </div>

          <div className="card p-6">
            <div className="text-center mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Вход через Telegram
              </h2>
              <p className="text-sm text-gray-600">
                Нажмите на кнопку ниже, чтобы авторизоваться
              </p>
            </div>

            <div className="flex justify-center">
              <TelegramLogin
                botName={TG_BOT}
                authUrl={authUrl}
                buttonSize="large"
                onAuth={(user) => {
                  // Save user ID to localStorage
                  localStorage.setItem("tg_uid", String(user.id));
                  track("auth_success", {
                    user_id: user.id,
                    return_url: searchParams.get("return") || "/",
                  });
                  // Redirect to return URL or home
                  const returnUrl = searchParams.get("return");
                  navigate(returnUrl || "/");
                }}
              />
            </div>

            <div className="mt-6 pt-6 border-t border-gray-200">
              <p className="text-xs text-gray-500 text-center">
                Нажимая кнопку, вы соглашаетесь с обработкой данных через Telegram
              </p>
            </div>
          </div>

          {showSuccess && (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-start gap-3">
                <HiOutlineCheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-green-800 mb-2">
                    ✅ Авторизация успешна! Вы вошли в систему Deliverty.
                  </p>
                  {showBotLink && (
                    <div className="mt-3 pt-3 border-t border-green-200">
                      <p className="text-xs text-green-700 mb-2">
                        Чтобы получать уведомления о совпадениях и сделках в Telegram:
                      </p>
                      <a
                        href={`https://t.me/${TG_BOT}?start=connect`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
                        onClick={() => {
                          track("telegram_bot_link_clicked", {
                            source: "auth_success",
                          });
                        }}
                      >
                        Открыть бота в Telegram
                      </a>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => {
                    setShowSuccess(false);
                    const returnUrl = searchParams.get("return");
                    navigate(returnUrl || "/");
                  }}
                  className="text-green-600 hover:text-green-800 flex-shrink-0"
                >
                  <HiOutlineX className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}

          {(error || searchParams.get("error")) && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">
                {error || "Ошибка авторизации. Попробуйте еще раз."}
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

