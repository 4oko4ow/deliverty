import React from "react";
import { HiOutlineExclamationCircle } from "react-icons/hi";
import { FaTelegram } from "react-icons/fa";

interface SupportBannerProps {
  message?: string;
  telegramUsername?: string;
}

export default function SupportBanner({ 
  message = "Что-то не работает или есть вопросы?",
  telegramUsername 
}: SupportBannerProps) {
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
    <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
      <HiOutlineExclamationCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-amber-800 mb-2">{message}</p>
        <a
          href={telegramLink}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#0088cc] text-white text-sm font-medium rounded-lg hover:bg-[#0077b5] transition-colors"
        >
          <FaTelegram className="w-4 h-4" />
          Написать в Telegram
        </a>
      </div>
    </div>
  );
}

