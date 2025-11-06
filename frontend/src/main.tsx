import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Link, useLocation } from "react-router-dom";
import { HiOutlinePaperAirplane, HiOutlinePlusCircle, HiOutlineSearch, HiOutlineUser } from "react-icons/hi";
import { PostHogProvider, usePostHog } from "posthog-js/react";
import "./index.css";
import PublishPage from "./pages/PublishPage";
import BrowsePage from "./pages/BrowsePage";
import AuthPage from "./pages/AuthPage";
import ProfilePage from "./pages/ProfilePage";
import PolicyFooter from "./components/PolicyFooter";
import SupportBanner from "./components/SupportBanner";

const POSTHOG_KEY = import.meta.env.VITE_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = import.meta.env.VITE_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com';

// Track pageviews on route changes
function PostHogPageView() {
  const location = useLocation();
  const posthog = usePostHog();

  useEffect(() => {
    if (posthog) {
      posthog.capture('$pageview', {
        $current_url: window.location.href,
      });
    }
  }, [location, posthog]);

  return null;
}

function Header() {
  const location = useLocation();
  const posthog = usePostHog();

  const trackNav = (destination: string) => {
    if (posthog) {
      posthog.capture("navigation_clicked", {
        destination,
        from: location.pathname,
      });
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-gray-200 shadow-sm">
      <div className="max-w-4xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <Link to="/" onClick={() => trackNav("/")} className="flex items-center gap-2 group">
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
              onClick={() => trackNav("/")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${location.pathname === "/"
                ? "bg-primary-50 text-primary-700"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                }`}
            >
              Поиск
            </Link>
            <Link
              to="/publish"
              onClick={() => trackNav("/publish")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${location.pathname === "/publish"
                ? "bg-primary-50 text-primary-700"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                }`}
            >
              Создать
            </Link>
            <Link
              to="/profile"
              onClick={() => trackNav("/profile")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${location.pathname === "/profile"
                ? "bg-primary-50 text-primary-700"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                }`}
            >
              <HiOutlineUser className="w-4 h-4 inline mr-1" />
              Профиль
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}

function BottomNav() {
  const location = useLocation();
  const posthog = usePostHog();

  const trackNav = (destination: string) => {
    if (posthog) {
      posthog.capture("bottom_nav_clicked", {
        destination,
        from: location.pathname,
      });
    }
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-lg border-t border-gray-200 sm:hidden">
      <div className="flex items-center justify-around h-16">
        <Link
          to="/"
          onClick={() => trackNav("/")}
          className={`flex flex-col items-center justify-center gap-1 px-4 py-2 rounded-lg transition-all ${location.pathname === "/"
            ? "text-primary-600"
            : "text-gray-500"
            }`}
        >
          <HiOutlineSearch className="w-6 h-6" />
          <span className="text-xs font-medium">Поиск</span>
        </Link>
        <Link
          to="/publish"
          onClick={() => trackNav("/publish")}
          className={`flex flex-col items-center justify-center gap-1 px-4 py-2 rounded-lg transition-all ${location.pathname === "/publish"
            ? "text-primary-600"
            : "text-gray-500"
            }`}
        >
          <HiOutlinePlusCircle className="w-6 h-6" />
          <span className="text-xs font-medium">Создать</span>
        </Link>
        <Link
          to="/profile"
          onClick={() => trackNav("/profile")}
          className={`flex flex-col items-center justify-center gap-1 px-4 py-2 rounded-lg transition-all ${location.pathname === "/profile"
            ? "text-primary-600"
            : "text-gray-500"
            }`}
        >
          <HiOutlineUser className="w-6 h-6" />
          <span className="text-xs font-medium">Профиль</span>
        </Link>
      </div>
    </nav>
  );
}

function App() {
  return (
    <BrowserRouter>
      {POSTHOG_KEY && <PostHogPageView />}
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
                  <Route path="/profile" element={<ProfilePage />} />
                </Routes>
                <div className="mt-8">
                  <SupportBanner />
                </div>
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

const options = {
  api_host: POSTHOG_HOST,
} as const;

const root = createRoot(document.getElementById("root")!);

// Wrap app with PostHogProvider if API key is provided
if (POSTHOG_KEY) {
  root.render(
    <StrictMode>
      <PostHogProvider apiKey={POSTHOG_KEY} options={options}>
        <App />
      </PostHogProvider>
    </StrictMode>
  );
} else {
  if (import.meta.env.DEV) {
    console.warn('⚠️ PostHog key not found. Analytics will be disabled.');
  }
  root.render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}
