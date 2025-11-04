import React, { useState } from "react";
import AirportInput from "../components/AirportInput";
import { api } from "../lib/api";
import { Link } from "react-router-dom";
import { HiOutlineSearch, HiOutlineLocationMarker, HiOutlineCalendar, HiOutlineCube, HiArrowRight, HiOutlineExclamationCircle } from "react-icons/hi";
import { HiOutlineTruck, HiOutlineGift } from "react-icons/hi2";
import { formatItem, formatWeight } from "../lib/translations";

export default function BrowsePage() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [kind, setKind] = useState<"" | "request" | "trip">("");
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function search() {
    if (!from || !to) {
      setError("Выберите аэропорты отправления и назначения");
      return;
    }
    setError(null);
    setLoading(true);
    setSearched(true);
    try {
      const result = await api.listPubs(from, to, kind || undefined);
      if (Array.isArray(result)) {
        setRows(result);
      } else if (result.error) {
        setError(result.error || "Ошибка при поиске");
        setRows([]);
      } else {
        setRows([]);
      }
    } catch (err) {
      setError("Произошла ошибка при поиске. Попробуйте еще раз.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return date.toLocaleDateString("ru-RU", { month: "short", day: "numeric", year: "numeric" });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-gray-900">Найдите подходящий вариант</h1>
        <p className="text-gray-600">Поиск людей, которые летят по пути и могут взять что-то с собой</p>
      </div>

      <div className="card p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <AirportInput label="Откуда" value={from} onChange={setFrom} />
          <AirportInput label="Куда" value={to} onChange={setTo} />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Тип</label>
          <div className="flex gap-2">
            <button
              onClick={() => setKind("")}
              className={`flex-1 btn ${kind === "" ? "btn-primary" : "btn-secondary"}`}
            >
              Все
            </button>
            <button
              onClick={() => setKind("request")}
              className={`flex-1 btn ${kind === "request" ? "btn-primary" : "btn-secondary"} flex items-center justify-center gap-2`}
            >
              <HiOutlineGift className="w-4 h-4" />
              Запросы
            </button>
            <button
              onClick={() => setKind("trip")}
              className={`flex-1 btn ${kind === "trip" ? "btn-primary" : "btn-secondary"} flex items-center justify-center gap-2`}
            >
              <HiOutlineTruck className="w-4 h-4" />
              Поездки
            </button>
          </div>
        </div>

        <button
          className="btn btn-primary w-full"
          onClick={search}
          disabled={loading || !from || !to}
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Поиск...
            </>
          ) : (
            <>
              <HiOutlineSearch className="w-5 h-5" />
              Найти
            </>
          )}
        </button>
        
        {error && (
          <div className="flex items-start gap-2 p-4 bg-red-50 border border-red-200 rounded-lg">
            <HiOutlineExclamationCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}
      </div>

      {searched && (
        <div className="space-y-3">
          {loading ? (
            <div className="card p-12 text-center">
              <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto mb-4" />
              <p className="text-gray-600">Поиск совпадений...</p>
            </div>
          ) : rows.length === 0 ? (
            <div className="card p-12 text-center">
              <HiOutlineSearch className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Результаты не найдены</h3>
              <p className="text-gray-600 mb-4">Пока нет людей, которые летят по этому маршруту. Попробуйте изменить критерии поиска или даты, или создайте свое объявление</p>
              <button
                onClick={() => {
                  setFrom("");
                  setTo("");
                  setKind("");
                  setSearched(false);
                  setRows([]);
                }}
                className="btn btn-secondary"
              >
                Очистить поиск
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">
                  {rows.length} {rows.length === 1 ? "результат" : rows.length < 5 ? "результата" : "результатов"}
                </h2>
              </div>
              <div className="grid gap-4">
                {rows.map((r, idx) => (
                  <Link
                    key={r.id}
                    to={`/matches/${r.id}`}
                    className="card-hover p-5 animate-slide-up"
                    style={{ animationDelay: `${idx * 50}ms` }}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        {r.kind === "request" ? (
                          <span className="badge-primary">
                            <HiOutlineGift className="w-3 h-3" />
                            Запрос
                          </span>
                        ) : (
                          <span className="badge-success">
                            <HiOutlineTruck className="w-3 h-3" />
                            Поездка
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3 mb-4">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-primary-50 rounded-lg">
                          <HiOutlineLocationMarker className="w-4 h-4 text-primary-600" />
                        </div>
                        <span className="font-semibold text-gray-900">{r.from_iata}</span>
                      </div>
                      <HiArrowRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-primary-50 rounded-lg">
                          <HiOutlineLocationMarker className="w-4 h-4 text-primary-600" />
                        </div>
                        <span className="font-semibold text-gray-900">{r.to_iata}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 mb-4">
                      <div className="flex items-center gap-1.5">
                        <HiOutlineCalendar className="w-4 h-4" />
                        <span>{formatDate(r.date_start)} – {formatDate(r.date_end)}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <HiOutlineCube className="w-4 h-4" />
                        <span>{formatItem(r.item)}</span>
                        <span className="text-gray-400">•</span>
                        <span>{formatWeight(r.weight)}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                      <span className="text-sm text-gray-500">Нажмите, чтобы просмотреть совпадения</span>
                      <HiArrowRight className="w-5 h-5 text-primary-600" />
                    </div>
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
