import React, { useEffect, useState, useRef, useMemo } from "react";
import { api } from "../lib/api";
import { HiOutlineLocationMarker, HiOutlineSearch, HiOutlineX } from "react-icons/hi";
import { usePostHog } from "posthog-js/react";

type Airport = {
  IATA: string;
  Name: string;
  City: string;
  Country: string;
  TZ: string;
};

type CityGroup = {
  city: string;
  country: string;
  airports: Airport[];
};

export default function AirportInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const posthog = usePostHog();
  
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
  const [q, setQ] = useState("");
  const [airports, setAirports] = useState<Airport[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  
  // Group airports by city
  const cityGroups = useMemo(() => {
    const groups = new Map<string, CityGroup>();
    airports.forEach((airport) => {
      const key = `${airport.City}|${airport.Country}`;
      if (!groups.has(key)) {
        groups.set(key, {
          city: airport.City,
          country: airport.Country,
          airports: [],
        });
      }
      groups.get(key)!.airports.push(airport);
    });
    // Sort airports within each city by IATA
    groups.forEach((group) => {
      group.airports.sort((a, b) => a.IATA.localeCompare(b.IATA));
    });
    return Array.from(groups.values()).sort((a, b) => a.city.localeCompare(b.city));
  }, [airports]);

  useEffect(() => {
    // Don't search if value is already set and q matches the selected format
    // This prevents searching after selection
    if (value && (q.includes(" — ") || q.includes(" (любой аэропорт)"))) {
      setAirports([]);
      setShowDropdown(false);
      return;
    }
    
    if (q.length < 2) {
      setAirports([]);
      setShowDropdown(false);
      return;
    }
    setLoading(true);
    let cancelled = false;
    api.airports(q).then((x) => {
      if (!cancelled) {
        setAirports(Array.isArray(x) ? x : []);
        setShowDropdown(true);
        setLoading(false);
      }
    }).catch(() => {
      if (!cancelled) {
        setAirports([]);
        setShowDropdown(false);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
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

  // Store city info for display when value is set but airports haven't loaded yet
  const [selectedCityInfo, setSelectedCityInfo] = useState<{city: string, isCity: boolean} | null>(null);
  
  // Get display text for current value
  const getDisplayText = () => {
    if (!value) return "";
    
    // If we have city info stored, use it
    if (selectedCityInfo && selectedCityInfo.isCity) {
      return `${selectedCityInfo.city} (любой аэропорт)`;
    }
    
    // Find airport by IATA
    const airport = airports.find(a => a.IATA === value);
    if (airport) {
      return `${airport.IATA} — ${airport.Name}`;
    }
    return value;
  };

  const handleSelectCity = (city: string, country: string, airports: Airport[]) => {
    // Use the first airport's IATA as the stored value
    // Backend will handle city-based matching
    const firstIata = airports[0].IATA;
    // Store IATA but we'll track that it's a city selection
    onChange(firstIata);
    setQ(`${city} (любой аэропорт)`);
    setSelectedCityInfo({ city: `${city}, ${country}`, isCity: true });
    setShowDropdown(false);
    setAirports([]);
    
    track("city_selected", {
      city,
      country,
      airports_count: airports.length,
      selected_iata: firstIata,
      field_label: label,
    });
  };

  const handleSelectAirport = (airport: Airport) => {
    onChange(airport.IATA);
    setQ(`${airport.IATA} — ${airport.Name}`);
    setSelectedCityInfo({ city: airport.City, isCity: false });
    setShowDropdown(false);
    setAirports([]);
    
    track("airport_selected", {
      iata: airport.IATA,
      airport_name: airport.Name,
      city: airport.City,
      field_label: label,
    });
  };

  const clearSelection = () => {
    onChange("");
    setQ("");
    setSelectedCityInfo(null);
    setShowDropdown(false);
    setAirports([]);
  };

  return (
    <div ref={wrapperRef} className="relative">
      <label className="block text-sm font-medium text-gray-700 mb-2.5">
        {label}
      </label>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <HiOutlineLocationMarker className="w-5 h-5 text-gray-400" />
        </div>
        <input
          value={q || getDisplayText()}
          onChange={(e) => {
            const newQ = e.target.value;
            setQ(newQ);
            // If user starts typing, clear the value to allow new search
            if (value && !newQ.includes(" — ") && !newQ.includes(" (любой аэропорт)")) {
              onChange("");
              setSelectedCityInfo(null);
            }
          }}
          onFocus={() => {
            // Show dropdown if we have search results and not already selected
            if (q.length >= 2 && airports.length > 0 && !q.includes(" — ") && !q.includes(" (любой аэропорт)")) {
              setShowDropdown(true);
            }
          }}
          placeholder="Начните вводить название города или аэропорта"
          className="input pl-11 pr-11"
        />
        {value && (
          <button
            onClick={clearSelection}
            className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600 active:text-gray-700 transition-colors touch-manipulation"
            aria-label="Очистить"
            style={{ minWidth: '44px' }}
          >
            <HiOutlineX className="w-5 h-5" />
          </button>
        )}
      </div>
      
      {showDropdown && (
        <div className="absolute z-50 w-full mt-2 bg-white border border-gray-200 rounded-lg shadow-strong max-h-[280px] overflow-auto">
          {loading ? (
            <div className="p-5 text-center">
              <div className="w-6 h-6 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto" />
            </div>
          ) : cityGroups.length === 0 ? (
            <div className="p-5 text-center text-sm text-gray-500">
              Аэропорты не найдены
            </div>
          ) : (
            cityGroups.map((group) => (
              <div key={`${group.city}|${group.country}`} className="border-b border-gray-100 last:border-0">
                {/* City option - show if multiple airports */}
                {group.airports.length > 1 && (
                  <button
                    className="w-full text-left px-4 py-4 hover:bg-primary-50 active:bg-primary-100 transition-colors border-b border-gray-50 touch-manipulation min-h-[56px]"
                    onClick={() => handleSelectCity(group.city, group.country, group.airports)}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-primary-700 text-base truncate">
                          {group.city}, {group.country}
                        </div>
                        <div className="text-xs text-primary-600 truncate mt-0.5">
                          Любой аэропорт ({group.airports.length} {group.airports.length === 1 ? 'аэропорт' : group.airports.length < 5 ? 'аэропорта' : 'аэропортов'})
                        </div>
                      </div>
                      <HiOutlineSearch className="w-5 h-5 text-primary-500 flex-shrink-0" />
                    </div>
                  </button>
                )}
                {/* Individual airports */}
                {group.airports.map((airport) => (
                  <button
                    key={airport.IATA}
                    className="w-full text-left px-4 py-4 hover:bg-gray-50 active:bg-gray-100 transition-colors border-b border-gray-50 last:border-0 touch-manipulation pl-8 min-h-[56px]"
                    onClick={() => handleSelectAirport(airport)}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-gray-900 text-base truncate">{airport.IATA}</div>
                        <div className="text-sm text-gray-600 truncate mt-0.5">{airport.Name}</div>
                      </div>
                      <HiOutlineSearch className="w-5 h-5 text-gray-400 flex-shrink-0" />
                    </div>
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      )}
      
      {value && !q && (
        <div className="mt-2.5 flex items-center gap-2">
          <span className="badge-primary">
            <HiOutlineLocationMarker className="w-3.5 h-3.5" />
            {value}
          </span>
        </div>
      )}
    </div>
  );
}
