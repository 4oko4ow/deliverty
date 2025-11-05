# Проверка всех событий PostHog

Этот документ содержит проверку всех событий PostHog в приложении.

## ✅ Исправленные события

### 1. `publish_page_viewed` ✅
- **Файл**: `frontend/src/pages/PublishPage.tsx`
- **Статус**: ✅ Исправлено
- **Исправления**:
  - Использует `usePostHog()` напрямую
  - Проверка `if (posthog)` перед отправкой
  - Логирование для отладки
  - Правильные зависимости `[posthog, searchParams]`

### 2. `browse_page_viewed` ✅
- **Файл**: `frontend/src/pages/BrowsePage.tsx`
- **Статус**: ✅ Исправлено
- **Исправления**:
  - Использует `usePostHog()` напрямую
  - Проверка `if (posthog)` перед отправкой
  - Логирование для отладки
  - Правильные зависимости `[posthog]`

### 3. `auth_page_viewed` ✅
- **Файл**: `frontend/src/pages/AuthPage.tsx`
- **Статус**: ✅ Исправлено
- **Исправления**:
  - Использует `usePostHog()` напрямую
  - Проверка `if (posthog)` перед отправкой
  - Логирование для отладки
  - Правильные зависимости `[posthog, searchParams]`

### 4. `auth_success` ✅
- **Файл**: `frontend/src/pages/AuthPage.tsx`
- **Статус**: ✅ Исправлено
- **Исправления**:
  - Использует функцию `track` с проверкой `if (posthog)`
  - Логирование для отладки

### 5. `search_completed` ✅
- **Файл**: `frontend/src/pages/BrowsePage.tsx`
- **Статус**: ✅ Исправлено
- **Исправления**:
  - Использует функцию `track` с проверкой `if (posthog)`
  - Логирование для отладки
  - Отправляется в двух местах:
    - В функции `search()` (строка 170)
    - В функции `performRestoredSearch()` (строка 87)

### 6. `search_results_viewed` ✅
- **Файл**: `frontend/src/pages/BrowsePage.tsx`
- **Статус**: ✅ Проверено и исправлено
- **Логика**:
  - Отправляется только когда `result.length > 0`
  - Вызывается сразу после `search_completed`
  - Отправляется в двух местах:
    - В функции `search()` (строка 179)
    - В функции `performRestoredSearch()` (строка 96)
- **Исправления**:
  - Использует функцию `track` с проверкой `if (posthog)`
  - Логирование для отладки

### 7. `airport_selected` ✅
- **Файл**: `frontend/src/components/AirportInput.tsx`
- **Статус**: ✅ Исправлено
- **Исправления**:
  - Заменен `usePostHogAnalytics()` на `usePostHog()` напрямую
  - Добавлена функция `track` с проверкой `if (posthog)`
  - Логирование для отладки

### 8. `deal_started` ✅
- **Файл**: `frontend/src/pages/BrowsePage.tsx`
- **Статус**: ✅ Проверено
- **Исправления**:
  - Использует функцию `track` с проверкой `if (posthog)`
  - Логирование для отладки

### 9. `deal_created` ✅
- **Файл**: `frontend/src/pages/BrowsePage.tsx`
- **Статус**: ✅ Проверено
- **Исправления**:
  - Использует функцию `track` с проверкой `if (posthog)`
  - Логирование для отладки
  - Отправляется в двух местах (для разных типов публикаций)

## 📋 Все события по категориям

### Общие события
- ✅ `$pageview` - автоматически отслеживается PostHog
- ✅ `navigation_clicked` - в `main.tsx`
- ✅ `bottom_nav_clicked` - в `main.tsx`

### Авторизация
- ✅ `auth_page_viewed` - исправлено
- ✅ `auth_success` - исправлено
- ✅ `auth_error` - использует `track`
- ✅ `telegram_bot_link_clicked` - использует `track`

### Создание публикации
- ✅ `publish_page_viewed` - исправлено
- ✅ `publish_kind_changed` - использует `track`
- ✅ `publish_started` - использует `track`
- ✅ `publish_completed` - использует `track`
- ✅ `publish_error` - использует `track`
- ✅ `publish_attempted_not_authenticated` - использует `track`
- ✅ `create_publication_from_profile` - использует `track`

### Поиск и просмотр
- ✅ `browse_page_viewed` - исправлено
- ✅ `filter_changed` - использует `track`
- ✅ `airport_selected` - исправлено
- ✅ `search_started` - использует `track`
- ✅ `search_completed` - исправлено
- ✅ `search_results_viewed` - проверено и работает правильно
- ✅ `search_error` - использует `track`
- ✅ `search_cleared` - использует `track`
- ✅ `navigate_to_publish` - использует `track`
- ✅ `request_contacts_clicked` - использует `track`
- ✅ `telegram_link_clicked` - использует `track`

### Сделки
- ✅ `deal_started` - проверено
- ✅ `deal_created` - проверено
- ✅ `deal_error` - использует `track`
- ✅ `deal_attempted_not_authenticated` - использует `track`

### Профиль
- ✅ `profile_page_viewed` - использует `track` (отправляется в `loadData`)
- ✅ `publication_status_toggled` - использует `track`
- ✅ `publication_updated` - использует `track`
- ✅ `publication_update_error` - использует `track`
- ✅ `profile_error` - использует `track`

## 🔍 Как проверить события

### В консоли браузера (DEV режим)
Все события теперь логируются в консоль:
- ✅ `[PostHog] Tracked: event_name` - событие отправлено
- ⚠️ `[PostHog] Skipped: event_name (PostHog not ready)` - PostHog не готов

### В PostHog UI
1. Перейдите в **Events** → **Live events**
2. Выполните действие в приложении
3. Событие должно появиться в реальном времени

### В DevTools Network
1. Откройте DevTools (F12) → **Network**
2. Отфильтруйте по "posthog" или "e"
3. Выполните действие
4. Должен появиться запрос с событием

## ✅ Итоговая проверка

Все события проверены и исправлены:
- ✅ Все события используют правильную проверку `if (posthog)`
- ✅ Все события имеют логирование для отладки
- ✅ Все события просмотра страниц используют `usePostHog()` напрямую
- ✅ Все остальные события используют функцию `track` с проверкой

## 🎯 Особое внимание

### `search_results_viewed`
- ✅ Отправляется только когда `result.length > 0` (правильно)
- ✅ Отправляется сразу после `search_completed` (правильно)
- ✅ Имеет правильные свойства: `from_iata`, `to_iata`, `kind_filter`, `results_count`
- ✅ Работает в обоих местах: обычный поиск и восстановленный поиск

### `search_completed`
- ✅ Отправляется всегда после успешного поиска (даже если результатов нет)
- ✅ Имеет правильные свойства
- ✅ Работает в обоих местах: обычный поиск и восстановленный поиск

## 📝 Рекомендации

1. **Все события работают правильно** - можно использовать для воронок
2. **Логирование включено** - в DEV режиме видно все события в консоли
3. **Проверка PostHog** - все события проверяют готовность PostHog перед отправкой

## 🚀 Готово к использованию

Все события готовы для построения воронок в PostHog. Используйте документацию `POSTHOG_FUNNELS.md` для настройки воронок.

