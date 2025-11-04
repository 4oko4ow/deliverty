# 🤖 Быстрая настройка Telegram бота

## Что нужно настроить помимо токена?

### ✅ Обязательные шаги:

1. **Переменные окружения** (в Render или локально):
   ```bash
   TG_BOT_TOKEN=123456:ABC-your-bot-token        # Токен от @BotFather
   TG_BOT_NAME=deliverty_bot                      # Имя бота (без @)
   TG_DEEPLINK_SECRET=your-random-secret-string  # Секрет для deep links
   ```

2. **Настроить Telegram Webhook** ⚠️ **КРИТИЧНО!**
   
   Без этого бот не будет получать сообщения!
   
   ```bash
   # Быстрый способ (используя скрипт):
   export TG_BOT_TOKEN=your-bot-token
   ./ops/setup_webhook.sh https://your-backend-url.onrender.com
   
   # Или вручную:
   curl -X POST "https://api.telegram.org/bot$TG_BOT_TOKEN/setWebhook" \
     -H "Content-Type: application/json" \
     -d '{"url":"https://your-backend-url.onrender.com/bot/webhook"}'
   ```

3. **Настроить домен для Login Widget** (для веб-авторизации):
   
   Отправьте `/setdomain` боту @BotFather и укажите ваш **frontend URL** (не backend!)
   - Vercel: `your-project.vercel.app`
   - Custom domain: `your-domain.com`

### 🔍 Проверка

**Проверить, что webhook настроен:**
```bash
curl "https://api.telegram.org/bot$TG_BOT_TOKEN/getWebhookInfo"
```

Должно вернуть:
```json
{
  "ok": true,
  "result": {
    "url": "https://your-backend-url.onrender.com/bot/webhook",
    "has_custom_certificate": false,
    "pending_update_count": 0
  }
}
```

**Протестировать бота:**
1. Откройте вашего бота в Telegram
2. Отправьте `/start`
3. Бот должен ответить приветственным сообщением

### ❌ Частые проблемы

**Бот не отвечает:**
- ✅ Проверьте, что webhook настроен (`getWebhookInfo`)
- ✅ Проверьте, что backend доступен публично
- ✅ Проверьте логи backend на наличие ошибок
- ✅ Убедитесь, что `TG_BOT_TOKEN` правильный

**Login Widget не работает:**
- ✅ Проверьте, что домен настроен через `/setdomain` в @BotFather
- ✅ Используйте frontend URL, не backend!
- ✅ Убедитесь, что `VITE_TG_BOT` в frontend совпадает с именем бота

### 📝 Генерация секрета для TG_DEEPLINK_SECRET

```bash
openssl rand -hex 16
```

Или любой другой случайный строковый ключ (минимум 16 символов).

