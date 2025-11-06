import React, { useState } from "react";
import { HiOutlineInformationCircle, HiOutlineShieldCheck, HiOutlineX } from "react-icons/hi";

export default function PolicyFooter() {
  const [show, setShow] = useState(false);

  const policyText = `Разрешено: документы, мелкие законные предметы. Запрещено: наличные, алкоголь, вейпы, наркотики, оружие, опасные/биологические материалы, SIM/кредитные карты или что-либо незаконное. Передача только в публичных зонах аэропорта. Сервис является платформой объявлений, а не перевозчиком.`;

  return (
    <footer className="max-w-4xl mx-auto w-full px-4 pt-6 pb-20 sm:pb-6 border-t border-gray-200 mt-auto">
      <button
        onClick={() => setShow(!show)}
        className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
      >
        {show ? (
          <>
            <HiOutlineX className="w-4 h-4" />
            Скрыть политику контента
          </>
        ) : (
          <>
            <HiOutlineShieldCheck className="w-4 h-4" />
            Показать политику контента
          </>
        )}
      </button>
      {show && (
        <div className="mt-4 p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100 text-sm text-gray-700 animate-slide-up">
          <div className="flex items-start gap-3">
            <HiOutlineInformationCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <p className="leading-relaxed">{policyText}</p>
          </div>
        </div>
      )}
      <div className="mt-4 text-xs text-gray-500 text-center">
        © {new Date().getFullYear()} Deliverty. Объединяем путешественников по всему миру.
      </div>
    </footer>
  );
}
