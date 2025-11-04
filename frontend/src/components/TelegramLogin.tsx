import React, { useEffect, useRef } from "react";

interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

interface TelegramLoginProps {
  botName: string;
  authUrl: string;
  onAuth: (user: TelegramUser) => void;
  buttonSize?: "large" | "medium" | "small";
}

/**
 * Telegram Login Widget component
 * Uses redirect mode (data-auth-url) - Telegram sends notification automatically
 * See: https://core.telegram.org/widgets/login
 * 
 * Note: Telegram only sends login notifications in redirect mode when domain is set via /setdomain
 */
export default function TelegramLogin({
  botName,
  authUrl,
  onAuth,
  buttonSize = "large",
}: TelegramLoginProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Clear container
    if (containerRef.current) {
      containerRef.current.innerHTML = "";
    }

    // Load Telegram widget script
    // Using redirect mode (data-auth-url) so Telegram sends notification automatically
    const script = document.createElement("script");
    script.async = true;
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.setAttribute("data-telegram-login", botName);
    script.setAttribute("data-size", buttonSize);
    script.setAttribute("data-auth-url", authUrl);
    script.setAttribute("data-request-access", "write");
    script.setAttribute("data-userpic", "true");

    if (containerRef.current) {
      containerRef.current.appendChild(script);
    }

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
    };
  }, [botName, authUrl, buttonSize, onAuth]);

  return <div ref={containerRef} />;
}

