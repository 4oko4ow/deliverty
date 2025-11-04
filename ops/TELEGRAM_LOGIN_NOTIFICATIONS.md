# 🔔 Telegram Login Widget - Уведомления о входе

## Почему уведомления не приходят?

Telegram Login Widget **автоматически** отправляет уведомления в Telegram **только в redirect mode** (`data-auth-url`), когда домен правильно настроен.

## ✅ Что нужно настроить:

### 1. Настроить домен через BotFather

**Это критически важно!** Без этого уведомления не будут приходить.

1. Откройте [@BotFather](https://t.me/BotFather) в Telegram
2. Отправьте команду `/setdomain`
3. Выберите вашего бота
4. Укажите ваш **frontend домен** (где размещен виджет):
   - Для Vercel: `your-project.vercel.app` (или ваш custom domain)
   - Для других хостингов: ваш домен (например, `your-domain.com`)
   - ⚠️ **Важно**: Используйте **frontend URL**, НЕ backend URL!

### 2. Проверить настройки виджета

Виджет должен использовать **redirect mode** (`data-auth-url`), а не callback mode (`data-onauth`).

Текущая реализация использует redirect mode:
```html
<script async src="https://telegram.org/js/telegram-widget.js?22"
  data-telegram-login="your_bot"
  data-auth-url="https://your-backend.com/api/auth/telegram"
  data-request-access="write">
</script>
```

### 3. Проверить, что домен совпадает

- Домен в `/setdomain` должен **точно совпадать** с доменом, где размещен виджет
- Если виджет на `https://myapp.vercel.app`, то в `/setdomain` должно быть `myapp.vercel.app`
- Поддомены считаются разными доменами!

## 🔍 Как проверить:

1. **Проверьте настройки домена в BotFather:**
   ```
   /setdomain → выберите бота → проверьте текущий домен
   ```

2. **Проверьте, что виджет работает:**
   - Откройте страницу авторизации
   - Нажмите на кнопку "Login with Telegram"
   - Должно появиться окно подтверждения в Telegram
   - После подтверждения должно прийти уведомление

3. **Проверьте логи backend:**
   - Убедитесь, что запросы приходят на `/api/auth/telegram`
   - Проверьте, что редирект происходит корректно

## ❌ Почему может не работать:

1. **Домен не настроен** - самое частая причина!
2. **Домен не совпадает** - домен в `/setdomain` отличается от реального домена сайта
3. **Используется callback mode** - уведомления не приходят в callback mode
4. **Виджет на localhost** - Telegram не отправляет уведомления для localhost (нужен ngrok или реальный домен)

## 📝 Пример правильной настройки:

```
1. Frontend: https://deliverty.vercel.app
2. Backend: https://deliverty-api.onrender.com
3. Bot: @deliverty_bot

В BotFather:
/setdomain → deliverty_bot → deliverty.vercel.app

В виджете:
data-telegram-login="deliverty_bot"
data-auth-url="https://deliverty-api.onrender.com/api/auth/telegram"
```

## 🔄 Если уведомления не приходят:

1. Проверьте настройки домена в BotFather
2. Убедитесь, что используете redirect mode (data-auth-url)
3. Проверьте, что домен совпадает с реальным доменом сайта
4. Попробуйте сбросить и заново настроить домен через `/setdomain`

## 💡 Важно:

- Уведомления приходят **автоматически** от Telegram, не нужно отправлять их вручную
- Уведомления работают только в **redirect mode**, не в callback mode
- Домен должен быть настроен через `/setdomain` в BotFather

