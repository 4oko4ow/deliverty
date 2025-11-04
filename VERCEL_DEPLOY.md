# Гайд по деплою на Vercel через UI

Этот гайд описывает процесс деплоя frontend приложения Deliverty на Vercel через веб-интерфейс.

## Предварительные требования

1. Аккаунт на [Vercel](https://vercel.com) (можно создать через GitHub)
2. Проект должен быть загружен в Git репозиторий (GitHub, GitLab, Bitbucket)
3. Backend API должен быть развернут и доступен по публичному URL

## Шаг 1: Подготовка репозитория

Убедитесь, что ваш код находится в Git репозитории:

```bash
git add .
git commit -m "Prepare for Vercel deployment"
git push origin main
```

## Шаг 2: Вход в Vercel

1. Откройте [vercel.com](https://vercel.com)
2. Нажмите **"Sign Up"** или **"Log In"**
3. Войдите через GitHub, GitLab или email

## Шаг 3: Создание нового проекта

1. На главной странице Vercel нажмите **"Add New..."** → **"Project"**
2. Выберите ваш Git репозиторий (GitHub/GitLab/Bitbucket)
3. Если репозиторий не виден, нажмите **"Adjust GitHub App Permissions"** и предоставьте доступ

## Шаг 4: Настройка проекта

### 4.1. Основные настройки

В разделе **"Configure Project"**:

- **Project Name**: `deliverty-web` (или другое название)
- **Framework Preset**: выберите **"Vite"** (Vercel автоматически определит, но проверьте)
- **Root Directory**: оставьте пустым (если проект в корне) или укажите `frontend/`

### 4.2. Build Settings

Если проект находится в подпапке `frontend/`:

- **Root Directory**: `frontend`
- **Build Command**: `npm run build` (будет автоматически определен)
- **Output Directory**: `dist` (стандартная папка для Vite)
- **Install Command**: `npm install`

Если проект в корне репозитория, настройки будут автоматически определены.

### 4.3. Environment Variables (Переменные окружения)

Нажмите **"Environment Variables"** и добавьте:

1. **`VITE_API_BASE`**
   - **Value**: URL вашего backend API (например, `https://api.yourdomain.com/api`)
   - **Environment**: выберите `Production`, `Preview`, `Development` (или все три)

2. **`VITE_TG_BOT`**
   - **Value**: имя вашего Telegram бота (например, `deliverty_bot`)
   - **Environment**: выберите `Production`, `Preview`, `Development` (или все три)

Пример:
```
VITE_API_BASE = https://api.deliverty.com/api
VITE_TG_BOT = deliverty_bot
```

⚠️ **Важно**: 
- Переменные, начинающиеся с `VITE_`, доступны в коде клиента
- Не храните секретные ключи в переменных `VITE_*`
- После добавления переменных окружения нужно будет пересобрать проект

## Шаг 5: Деплой

1. После настройки всех параметров нажмите **"Deploy"**
2. Дождитесь завершения сборки (обычно 1-3 минуты)
3. Vercel автоматически:
   - Установит зависимости (`npm install`)
   - Соберет проект (`npm run build`)
   - Задеплоит на CDN

## Шаг 6: Проверка деплоя

1. После успешного деплоя вы увидите:
   - ✅ Status: "Ready"
   - 🔗 URL вашего приложения (например, `deliverty-web.vercel.app`)

2. Откройте URL и проверьте:
   - Приложение загружается
   - API запросы работают (проверьте в DevTools → Network)
   - Нет ошибок в консоли браузера

## Шаг 7: Настройка домена (опционально)

### 7.1. Добавление кастомного домена

1. В настройках проекта перейдите в **"Settings"** → **"Domains"**
2. Введите ваш домен (например, `deliverty.com`)
3. Следуйте инструкциям для настройки DNS:
   - Добавьте CNAME запись: `www` → `cname.vercel-dns.com`
   - Или A-запись: `@` → IP адрес Vercel (будет указан)

### 7.2. Настройка SSL

Vercel автоматически предоставляет SSL сертификаты через Let's Encrypt для всех доменов.

## Шаг 8: Обновление деплоя

При каждом push в основную ветку (например, `main`):

1. Vercel автоматически создаст новый деплой
2. Вы получите уведомление о статусе деплоя
3. После успешной сборки изменения будут применены

### Предварительные деплои (Preview)

Для каждого pull request Vercel автоматически создает preview деплой:
- URL будет выглядеть как `deliverty-web-git-<branch>-<username>.vercel.app`
- Полезно для тестирования изменений перед мерджем

## Настройка для монорепо

Если ваш проект — монорепо с frontend в подпапке:

### Вариант 1: Root Directory (рекомендуется)

В настройках проекта:
- **Root Directory**: `frontend`
- Остальные настройки оставьте по умолчанию

### Вариант 2: Использование vercel.json

Создайте файл `vercel.json` в корне репозитория:

```json
{
  "buildCommand": "cd frontend && npm run build",
  "outputDirectory": "frontend/dist",
  "installCommand": "cd frontend && npm install",
  "framework": "vite"
}
```

## Troubleshooting (Решение проблем)

### Ошибка: "Build Command Not Found"

**Решение**: Убедитесь, что:
- Указан правильный Root Directory
- В `package.json` есть скрипт `build`
- Команда `npm run build` работает локально

### Ошибка: "Environment Variables Not Found"

**Решение**:
- Проверьте, что переменные добавлены в настройках проекта
- Убедитесь, что переменные начинаются с `VITE_`
- После добавления переменных пересоберите проект

### Ошибка: "API requests failing"

**Решение**:
- Проверьте значение `VITE_API_BASE` в Environment Variables
- Убедитесь, что backend API доступен и имеет CORS настроен правильно
- Проверьте в DevTools → Network, какой URL используется для запросов

### Ошибка: "404 на роутах"

**Решение**: Добавьте `vercel.json` в папку `frontend/`:

```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

Это необходимо для SPA (Single Page Application) с React Router.

## Полезные ссылки

- [Vercel Documentation](https://vercel.com/docs)
- [Vite Deployment Guide](https://vitejs.dev/guide/static-deploy.html#vercel)
- [Environment Variables в Vercel](https://vercel.com/docs/environment-variables)

## Дальнейшие шаги

1. Настройте автоматические деплои для разных веток
2. Добавьте интеграции (например, для уведомлений в Slack/Telegram)
3. Настройте мониторинг и аналитику
4. Оптимизируйте производительность через Vercel Analytics

---

**Примечание**: Backend (Go API) нужно деплоить отдельно, например, на Railway, Fly.io, или собственный сервер. Vercel предназначен для frontend приложений.

