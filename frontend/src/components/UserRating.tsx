import React from "react";
import { HiOutlineStar } from "react-icons/hi";

interface UserRatingProps {
  rating: number;
  username?: string;
  className?: string;
  showUsername?: boolean; // Показывать username только если явно указано
}

export default function UserRating({ rating, username, className = "", showUsername = false }: UserRatingProps) {
  if (rating === 0 && !username) {
    return null;
  }

  const stars = Math.min(rating, 5);
  const extra = rating > 5 ? ` +${rating - 5}` : "";

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      {showUsername && username && (
        <span className="text-xs text-gray-600">@{username}</span>
      )}
      <div className="flex items-center gap-0.5">
        {Array.from({ length: stars }).map((_, i) => (
          <HiOutlineStar key={i} className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
        ))}
        {rating > 0 && (
          <span className="text-xs font-medium text-gray-700 ml-0.5">
            {rating}{extra}
          </span>
        )}
      </div>
    </div>
  );
}

