import React, { useState } from "react";
import { HiOutlineQuestionMarkCircle, HiOutlineX } from "react-icons/hi";
import { FaTelegram } from "react-icons/fa";
import { usePostHog } from "posthog-js/react";

interface SupportBannerProps {
  message?: string;
  telegramUsername?: string;
}

export default function SupportBanner({ 
  message = "Что-то не работает или есть вопросы?",
  telegramUsername 
}: SupportBannerProps) {
  const posthog = usePostHog();
  const [isOpen, setIsOpen] = useState(false);
  
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
  
  // Get Telegram username from env or prop
  const tgUsername = telegramUsername || import.meta.env.VITE_SUPPORT_TELEGRAM || "";
  
  if (!tgUsername) {
    return null; // Don't show if no username configured
  }

  const telegramUrl = `https://t.me/${tgUsername.replace('@', '')}`;
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  const telegramLink = isMobile 
    ? `tg://resolve?domain=${tgUsername.replace('@', '')}` 
    : telegramUrl;

  return (
    <div className="fixed bottom-20 right-4 sm:bottom-6 z-40">
      {/* Expanded card */}
      {isOpen && (
        <div className="mb-3 w-72 sm:w-80 bg-white rounded-lg shadow-lg border border-gray-200 p-4 animate-slide-up">
          <div className="flex items-start justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900">Поддержка</h3>
            <button
              onClick={() => {
                setIsOpen(false);
                track("support_banner_closed");
              }}
              className="text-gray-400 hover:text-gray-600 transition-colors touch-manipulation"
              aria-label="Закрыть"
            >
              <HiOutlineX className="w-5 h-5" />
            </button>
          </div>
          <p className="text-xs text-gray-600 mb-3">{message}</p>
          <a
            href={telegramLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-[#0088cc] text-white text-sm font-medium rounded-lg hover:bg-[#0077b5] transition-colors touch-manipulation"
            onClick={() => {
              track("support_telegram_link_clicked", {
                telegram_username: tgUsername,
                is_mobile: isMobile,
              });
              setIsOpen(false);
            }}
          >
            <FaTelegram className="w-4 h-4" />
            Написать в Telegram
          </a>
        </div>
      )}
      
      {/* Floating button */}
      <button
        onClick={() => {
          const newState = !isOpen;
          setIsOpen(newState);
          if (newState) {
            track("support_banner_opened");
          } else {
            track("support_banner_closed");
          }
        }}
        className="w-14 h-14 bg-gradient-to-br from-primary-500 to-primary-600 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center hover:scale-105 active:scale-95 touch-manipulation"
        aria-label="Поддержка"
      >
        {isOpen ? (
          <HiOutlineX className="w-6 h-6" />
        ) : (
          <HiOutlineQuestionMarkCircle className="w-6 h-6" />
        )}
      </button>
    </div>
  );
}

