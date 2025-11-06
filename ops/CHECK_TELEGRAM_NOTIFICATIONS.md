# 🔍 Диагностика: Почему не приходят уведомления от Telegram Login Widget

## ⚠️ Важно понять:

Telegram Login Widget отправляет уведомления **автоматически** только при определенных условиях. Это не то же самое, что отправка сообщений через бота.

## ✅ Чек-лист для проверки:

### 1. Домен настроен в BotFather
```
✅ Откройте @BotFather
✅ Отправьте /setdomain
✅ Выберите вашего бота
✅ Проверьте, что домен указан правильно
```

**Важно:** Домен должен быть **точно** таким же, как домен, где размещен виджет (без https://, без trailing slash).

### 2. Виджет использует redirect mode
Проверьте в DevTools (F12) → Network, что виджет делает запрос:
- URL должен быть: `https://api.telegram.org/widget/login?` или похожий
- Затем должен быть редирект на ваш `data-auth-url`

### 3. Проверьте код виджета
В DevTools → Elements найдите скрипт виджета:
```html
<script async src="https://telegram.org/js/telegram-widget.js?22"
  data-telegram-login="YOUR_BOT_NAME"
  data-auth-url="YOUR_BACKEND_URL/api/auth/telegram"
  data-request-access="write">
</script>
```

Убедитесь, что:
- ✅ `data-telegram-login` = имя вашего бота (без @)
- ✅ `data-auth-url` = ваш backend URL
- ✅ НЕТ `data-onauth` (это отключает уведомления)

### 4. Проверьте редирект
После авторизации должно быть:
1. Редирект на `data-auth-url` с параметрами (id, hash, auth_date, etc.)
2. Backend обрабатывает и редиректит обратно на frontend
3. Frontend показывает успешную авторизацию

### 5. Важные моменты:

**Telegram отправляет уведомления только если:**
- ✅ Домен настроен через /setdomain
- ✅ Используется redirect mode (data-auth-url)
- ✅ Пользователь авторизуется в первый раз **или** прошло много времени с последней авторизации
- ✅ Виджет размещен на правильном домене (совпадает с /setdomain)

**Telegram НЕ отправляет уведомления если:**
- ❌ Используется callback mode (data-onauth)
- ❌ Домен не настроен или не совпадает
- ❌ Пользователь авторизуется слишком часто (спам-защита)
- ❌ Виджет на localhost (без ngrok)

## 🔧 Как проверить вручную:

1. **Откройте DevTools (F12) → Console**
2. **Найдите виджет в DOM:**
   ```javascript
   document.querySelector('script[data-telegram-login]')
   ```
3. **Проверьте атрибуты:**
   ```javascript
   const script = document.querySelector('script[data-telegram-login]');
   console.log('Bot:', script.getAttribute('data-telegram-login'));
   console.log('Auth URL:', script.getAttribute('data-auth-url'));
   console.log('Has onauth:', script.hasAttribute('data-onauth'));
   ```

4. **Проверьте сетевые запросы:**
   - DevTools → Network
   - Отфильтруйте по "telegram" или "auth"
   - Авторизуйтесь и проверьте запросы

## 🐛 Возможные проблемы:

### Проблема 1: Домен не совпадает
```
Виджет на: https://myapp.vercel.app
В /setdomain: myapp.vercel.app ✅

Но если:
Виджет на: https://www.myapp.com
В /setdomain: myapp.com ❌
```

### Проблема 2: Используется callback mode
Если в коде есть `data-onauth`, уведомления не придут.

### Проблема 3: Частые авторизации
Telegram может не отправлять уведомления, если пользователь авторизуется слишком часто (защита от спама).

### Проблема 4: Backend редиректит неправильно
Backend должен редиректить на frontend URL, а не на backend URL.

## 💡 Решение:

Если ничего не помогает, можно **отправлять уведомления вручную через бота** после успешной авторизации:

1. Проверить, что пользователь начал диалог с ботом
2. Отправить уведомление через Bot API

Но это требует, чтобы пользователь сначала написал боту `/start`.



