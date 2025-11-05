import React, { useEffect, useState, useRef } from "react";
import { api } from "../lib/api";
import { HiOutlineLocationMarker, HiOutlineSearch, HiOutlineX } from "react-icons/hi";

export default function AirportInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [q, setQ] = useState("");
  const [opts, setOpts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Don't search if value is already set and q matches the selected format (IATA — Name)
    // This prevents searching after selection
    if (value && q.includes(" — ")) {
      setOpts([]);
      setShowDropdown(false);
      return;
    }
    
    if (q.length < 2) {
      setOpts([]);
      setShowDropdown(false);
      return;
    }
    setLoading(true);
    let a = true;
    api.airports(q).then((x) => {
      if (a) {
        setOpts(Array.isArray(x) ? x : []);
        setShowDropdown(true);
        setLoading(false);
      }
    }).catch(() => {
      if (a) {
        setOpts([]);
        setShowDropdown(false);
        setLoading(false);
      }
    });
    return () => {
      a = false;
      setLoading(false);
    };
  }, [q, value]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (iata: string, name: string) => {
    onChange(iata);
    // Set the display text but don't trigger search again
    setQ(`${iata} — ${name}`);
    setShowDropdown(false);
    setOpts([]); // Clear options to prevent showing dropdown again
  };

  const clearSelection = () => {
    onChange("");
    setQ("");
    setShowDropdown(false);
  };

  return (
    <div ref={wrapperRef} className="relative">
      <label className="block text-sm sm:text-sm font-medium text-gray-700 mb-2">
        {label}
      </label>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 sm:pl-3 flex items-center pointer-events-none">
          <HiOutlineLocationMarker className="w-5 h-5 sm:w-5 sm:h-5 text-gray-400" />
        </div>
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            // If user starts typing, clear the value to allow new search
            if (value && !e.target.value.includes(" — ")) {
              onChange("");
            }
          }}
          onFocus={() => {
            // Only show dropdown if we have search results and not already selected
            if (q.length >= 2 && opts.length > 0 && !q.includes(" — ")) {
              setShowDropdown(true);
            }
          }}
          placeholder="Начните вводить название или код аэропорта"
          className="input pl-10 sm:pl-10 pr-10 sm:pr-10"
        />
        {value && (
          <button
            onClick={clearSelection}
            className="absolute inset-y-0 right-0 pr-3 sm:pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors touch-manipulation"
            aria-label="Очистить"
          >
            <HiOutlineX className="w-5 h-5 sm:w-5 sm:h-5" />
          </button>
        )}
      </div>
      
      {showDropdown && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-strong max-h-60 sm:max-h-60 overflow-auto">
          {loading ? (
            <div className="p-4 text-center">
              <div className="w-5 h-5 sm:w-5 sm:h-5 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto" />
            </div>
          ) : opts.length === 0 ? (
            <div className="p-4 text-center text-sm sm:text-sm text-gray-500">
              Аэропорты не найдены
            </div>
          ) : (
            opts.map((a) => (
              <button
                key={a.IATA}
                className="w-full text-left px-4 py-3.5 sm:py-3 hover:bg-primary-50 active:bg-primary-100 transition-colors border-b border-gray-50 last:border-0 touch-manipulation"
                onClick={() => handleSelect(a.IATA, a.Name)}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-gray-900 text-base sm:text-sm truncate">{a.IATA}</div>
                    <div className="text-sm sm:text-sm text-gray-600 truncate">{a.Name}</div>
                  </div>
                  <HiOutlineSearch className="w-4 h-4 sm:w-4 sm:h-4 text-gray-400 flex-shrink-0" />
                </div>
              </button>
            ))
          )}
        </div>
      )}
      
      {value && !q && (
        <div className="mt-2 flex items-center gap-2 text-sm sm:text-sm">
          <span className="badge-primary">
            <HiOutlineLocationMarker className="w-3 h-3 sm:w-3 sm:h-3" />
            {value}
          </span>
        </div>
      )}
    </div>
  );
}
