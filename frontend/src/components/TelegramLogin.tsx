import React, { useEffect, useRef } from "react";

interface TelegramLoginProps {
  botName: string;
  authUrl: string;
  onAuth?: (userId: number) => void;
  buttonSize?: "large" | "medium" | "small";
}

/**
 * Telegram Login Widget component
 * Embeds Telegram's login button that redirects to authUrl with user data
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
    const script = document.createElement("script");
    script.async = true;
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.setAttribute("data-telegram-login", botName);
    script.setAttribute("data-size", buttonSize);
    script.setAttribute("data-auth-url", authUrl);
    script.setAttribute("data-request-access", "write");
    script.setAttribute("data-userpic", "true");

    // Handle callback (if using iframe mode)
    if (onAuth) {
      script.onload = () => {
        // Widget will redirect to authUrl, so we need to handle it differently
        // The actual auth happens via redirect to authUrl
        window.addEventListener("message", (event) => {
          if (event.data?.type === "telegram-auth") {
            onAuth(event.data.user.id);
          }
        });
      };
    }

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

