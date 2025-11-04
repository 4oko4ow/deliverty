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
 * Uses callback mode (data-onauth) instead of redirect mode to avoid infinite loading
 * See: https://core.telegram.org/widgets/login
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

    // Create callback function on window object
    // This function will be called by Telegram widget after successful auth
    const callbackName = `onTelegramAuth_${botName.replace(/[^a-zA-Z0-9]/g, '_')}`;
    (window as any)[callbackName] = (user: TelegramUser) => {
      onAuth(user);
    };

    // Load Telegram widget script
    const script = document.createElement("script");
    script.async = true;
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.setAttribute("data-telegram-login", botName);
    script.setAttribute("data-size", buttonSize);
    script.setAttribute("data-onauth", callbackName + "(user)");
    script.setAttribute("data-request-access", "write");
    script.setAttribute("data-userpic", "true");

    if (containerRef.current) {
      containerRef.current.appendChild(script);
    }

    return () => {
      // Cleanup: remove callback function
      if ((window as any)[callbackName]) {
        delete (window as any)[callbackName];
      }
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
    };
  }, [botName, authUrl, buttonSize, onAuth]);

  return <div ref={containerRef} />;
}

