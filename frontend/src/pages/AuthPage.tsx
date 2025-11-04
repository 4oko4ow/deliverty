import React, { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import TelegramLogin from "../components/TelegramLogin";
import { HiOutlinePaperAirplane } from "react-icons/hi";

const TG_BOT = import.meta.env.VITE_TG_BOT || "your_bot";
const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8080/api";

export default function AuthPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Check if we're returning from Telegram auth
  useEffect(() => {
    const authSuccess = searchParams.get("auth_success");
    const userId = searchParams.get("user_id");
    const error = searchParams.get("error");

    if (authSuccess === "1" && userId) {
      // Save user ID to localStorage
      localStorage.setItem("tg_uid", userId);
      // Redirect to home
      navigate("/");
    } else if (error) {
      console.error("Auth error:", error);
    }
  }, [searchParams, navigate]);

  // Check if already authenticated
  useEffect(() => {
    const saved = localStorage.getItem("tg_uid");
    if (saved) {
      navigate("/");
    }
  }, [navigate]);

  const authUrl = `${API_BASE}/auth/telegram`;

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-primary-500 to-primary-600 rounded-2xl shadow-lg mb-4">
            <HiOutlinePaperAirplane className="w-8 h-8 text-white" />
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
            />
          </div>

          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-xs text-gray-500 text-center">
              Нажимая кнопку, вы соглашаетесь с обработкой данных через Telegram
            </p>
          </div>
        </div>

        {searchParams.get("error") && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">
              Ошибка авторизации. Попробуйте еще раз.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

