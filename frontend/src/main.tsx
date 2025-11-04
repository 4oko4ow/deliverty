import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Link, useLocation } from "react-router-dom";
import { HiOutlinePaperAirplane, HiOutlinePlusCircle, HiOutlineSearch } from "react-icons/hi";
import "./index.css";
import PublishPage from "./pages/PublishPage";
import BrowsePage from "./pages/BrowsePage";
import MatchesPage from "./pages/MatchesPage";
import AuthPage from "./pages/AuthPage";
import PolicyFooter from "./components/PolicyFooter";

function Header() {
  const location = useLocation();
  
  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-gray-200 shadow-sm">
      <div className="max-w-4xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="p-2 bg-gradient-to-br from-primary-500 to-primary-600 rounded-lg shadow-lg group-hover:shadow-xl transition-shadow">
              <HiOutlinePaperAirplane className="w-5 h-5 text-white" />
            </div>
            <span className="text-2xl font-bold bg-gradient-to-r from-primary-600 to-primary-700 bg-clip-text text-transparent">
              Deliverty
            </span>
          </Link>
          <nav className="hidden sm:flex gap-1">
            <Link
              to="/"
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                location.pathname === "/"
                  ? "bg-primary-50 text-primary-700"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
              }`}
            >
              Поиск
            </Link>
            <Link
              to="/publish"
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                location.pathname === "/publish"
                  ? "bg-primary-50 text-primary-700"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
              }`}
            >
              Создать
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}

function BottomNav() {
  const location = useLocation();
  
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-lg border-t border-gray-200 sm:hidden">
      <div className="flex items-center justify-around h-16">
        <Link
          to="/"
          className={`flex flex-col items-center justify-center gap-1 px-4 py-2 rounded-lg transition-all ${
            location.pathname === "/"
              ? "text-primary-600"
              : "text-gray-500"
          }`}
        >
          <HiOutlineSearch className="w-6 h-6" />
          <span className="text-xs font-medium">Поиск</span>
        </Link>
        <Link
          to="/publish"
          className={`flex flex-col items-center justify-center gap-1 px-4 py-2 rounded-lg transition-all ${
            location.pathname === "/publish"
              ? "text-primary-600"
              : "text-gray-500"
          }`}
        >
          <HiOutlinePlusCircle className="w-6 h-6" />
          <span className="text-xs font-medium">Создать</span>
        </Link>
      </div>
    </nav>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/auth" element={<AuthPage />} />
        <Route
          path="/*"
          element={
            <div className="min-h-screen pb-20 sm:pb-0">
              <Header />
              <main className="max-w-4xl mx-auto px-4 py-6 sm:py-8">
                <Routes>
                  <Route path="/" element={<BrowsePage />} />
                  <Route path="/publish" element={<PublishPage />} />
                  <Route path="/matches/:pubId" element={<MatchesPage />} />
                </Routes>
              </main>
              <PolicyFooter />
              <BottomNav />
            </div>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
