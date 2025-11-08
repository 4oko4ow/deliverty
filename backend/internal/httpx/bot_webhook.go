package httpx

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/sol/deliverty/backend/internal/bot"
	"github.com/sol/deliverty/backend/internal/posthog"
)

// buildProfileText builds a profile text with username and rating
func buildProfileText(username string, rating int) string {
	var namePart string
	if username != "" {
		namePart = fmt.Sprintf("👤 @%s\n", username)
	} else {
		namePart = "👤 Пользователь\n"
	}

	stars := "⭐"
	if rating > 0 {
		starCount := rating
		if starCount > 5 {
			starCount = 5
		}
		stars = strings.Repeat("⭐", starCount) // Show max 5 stars visually
		if rating > 5 {
			stars += fmt.Sprintf(" (+%d)", rating-5)
		}
	} else {
		stars = "⭐ (нет оценок)"
	}

	return fmt.Sprintf("%s📊 Рейтинг: %s (%d)", namePart, stars, rating)
}

// buildDealStatusKeyboard builds an inline keyboard based on the current deal status
func buildDealStatusKeyboard(status string, dealID int64) gin.H {
	var buttons [][]gin.H

	// Add status buttons based on current status
	if status == "new" || status == "" {
		// Show all status buttons for new deals
		buttons = append(buttons, []gin.H{
			{
				"text":          "✅ Согласовать",
				"callback_data": "deal_status:agreed",
			},
		})
		buttons = append(buttons, []gin.H{
			{
				"text":          "✅ Передача завершена",
				"callback_data": "deal_status:handoff_done",
			},
		})
		buttons = append(buttons, []gin.H{
			{
				"text":          "❌ Отменить",
				"callback_data": "deal_status:cancelled",
			},
		})
	} else if status == "agreed" {
		// Show "Передача завершена" and "Отменить" buttons
		buttons = append(buttons, []gin.H{
			{
				"text":          "✅ Передача завершена",
				"callback_data": "deal_status:handoff_done",
			},
		})
		buttons = append(buttons, []gin.H{
			{
				"text":          "❌ Отменить",
				"callback_data": "deal_status:cancelled",
			},
		})
	} else if status == "handoff_done" {
		// Deal is complete, no status buttons needed
		// But we can show rating button if not already rated
		// (This is handled separately in the callback handler)
	} else if status == "cancelled" {
		// Deal is cancelled, no buttons
	}

	return gin.H{
		"inline_keyboard": buttons,
	}
}

// Telegram Update (trimmed)
type Update struct {
	Message *struct {
		MessageID int64  `json:"message_id"`
		Text      string `json:"text"`
		From      struct {
			ID int64 `json:"id"`
		} `json:"from"`
		Chat struct {
			ID int64 `json:"id"`
		} `json:"chat"`
	} `json:"message"`
	CallbackQuery *struct {
		ID   string `json:"id"`
		From struct {
			ID int64 `json:"id"`
		} `json:"from"`
		Message struct {
			MessageID int64 `json:"message_id"`
			Chat      struct {
				ID int64 `json:"id"`
			} `json:"chat"`
		} `json:"message"`
		Data string `json:"data"`
	} `json:"callback_query"`
}

func registerBotRoutes(r *gin.Engine, pool *pgxpool.Pool) {
	r.POST("/bot/webhook", func(c *gin.Context) {
		log.Printf("[BOT] Webhook called - received request")

		var up Update
		if err := c.ShouldBindJSON(&up); err != nil {
			log.Printf("[BOT] Failed to parse JSON: %v", err)
			c.Status(http.StatusOK)
			return
		}

		tg := bot.New()

		// Handle callback query (button clicks)
		if up.CallbackQuery != nil {
			log.Printf("[BOT] Received callback query from user %d: %q", up.CallbackQuery.From.ID, up.CallbackQuery.Data)

			// Handle start_deal callback
			if strings.HasPrefix(up.CallbackQuery.Data, "start_deal:") {
				startParam := strings.TrimPrefix(up.CallbackQuery.Data, "start_deal:")
				log.Printf("[BOT] Processing callback as /start command: %q", startParam)

				// Answer callback to remove loading state
				_, _ = tg.API("answerCallbackQuery", gin.H{
					"callback_query_id": up.CallbackQuery.ID,
				})

				// Process the start command directly
				processStartDeal(c.Request.Context(), pool, tg, up.CallbackQuery.From.ID, up.CallbackQuery.Message.Chat.ID, startParam)
				c.Status(http.StatusOK)
				return
			}

			// Handle deal status callbacks
			if strings.HasPrefix(up.CallbackQuery.Data, "deal_status:") {
				parts := strings.SplitN(up.CallbackQuery.Data, ":", 2)
				if len(parts) == 2 {
					status := parts[1]
					if status == "agreed" || status == "handoff_done" || status == "cancelled" {
						// Answer callback first
						_, _ = tg.API("answerCallbackQuery", gin.H{
							"callback_query_id": up.CallbackQuery.ID,
						})

						setStatus(c, pool, tg, up.CallbackQuery.From.ID, up.CallbackQuery.Message.Chat.ID, status)

						// Find the deal and get counterpart info to rebuild the message
						var dealID int64
						var counterpartRating int
						var counterpartUsername string
						var currentStatus string
						_ = pool.QueryRow(c, `
							SELECT 
								d.id,
								d.status,
								CASE WHEN ur.tg_user_id=$1 THEN ut.rating_small ELSE ur.rating_small END AS counterpart_rating,
								CASE WHEN ur.tg_user_id=$1 THEN COALESCE(ut.tg_username, '') ELSE COALESCE(ur.tg_username, '') END AS counterpart_username
							FROM deal d
							JOIN publication pr ON pr.id=d.request_pub_id
							JOIN app_user ur ON ur.id=pr.user_id
							JOIN publication pt ON pt.id=d.trip_pub_id
							JOIN app_user ut ON ut.id=pt.user_id
							WHERE (ur.tg_user_id=$1 OR ut.tg_user_id=$1)
							ORDER BY d.last_message_at DESC LIMIT 1
						`, up.CallbackQuery.From.ID).Scan(&dealID, &currentStatus, &counterpartRating, &counterpartUsername)

						if dealID > 0 {
							counterpartInfo := buildProfileText(counterpartUsername, counterpartRating)

							// Build message text with status info
							statusText := map[string]string{
								"agreed":       "✅ Согласовано",
								"handoff_done": "✅ Передача завершена",
								"cancelled":    "❌ Отменено",
							}

							statusInfo := ""
							if currentStatus != "new" {
								statusInfo = fmt.Sprintf("\n\n📊 Статус: %s", statusText[currentStatus])
							}

							messageText := fmt.Sprintf("✅ Подключено к сделке!%s\n\n👤 Участник:\n%s\n\nОтправляйте сообщения сюда для пересылки. Используйте кнопки ниже для управления сделкой.", statusInfo, counterpartInfo)

							// Build keyboard based on current status
							keyboard := buildDealStatusKeyboard(currentStatus, dealID)

							// Update message with keyboard preserved
							_, _ = tg.API("editMessageText", gin.H{
								"chat_id":      up.CallbackQuery.Message.Chat.ID,
								"message_id":   up.CallbackQuery.Message.MessageID,
								"text":         messageText,
								"reply_markup": keyboard,
							})

							// If status is handoff_done, show rating button
							if status == "handoff_done" {
								var alreadyRated bool
								_ = pool.QueryRow(c, `
									SELECT EXISTS(SELECT 1 FROM rating_log WHERE deal_id=$1 AND rater_tg=$2)
								`, dealID, up.CallbackQuery.From.ID).Scan(&alreadyRated)

								if !alreadyRated {
									ratingKeyboard := gin.H{
										"inline_keyboard": [][]gin.H{
											{
												{
													"text":          "⭐ Оценить участника",
													"callback_data": fmt.Sprintf("rate_deal:%d", dealID),
												},
											},
										},
									}

									_, _ = tg.API("sendMessage", gin.H{
										"chat_id":      up.CallbackQuery.Message.Chat.ID,
										"text":         "Пожалуйста, оцените участника сделки.",
										"reply_markup": ratingKeyboard,
									})
								}
							}
						}

						c.Status(http.StatusOK)
						return
					}
				}
			}

			// Handle contact request callbacks
			if strings.HasPrefix(up.CallbackQuery.Data, "contact_agreed:") {
				contactRequestIDStr := strings.TrimPrefix(up.CallbackQuery.Data, "contact_agreed:")
				contactRequestID, err := strconv.ParseInt(contactRequestIDStr, 10, 64)

				if err == nil {
					// Answer callback first
					_, _ = tg.API("answerCallbackQuery", gin.H{
						"callback_query_id": up.CallbackQuery.ID,
						"text":              "✅ Спасибо! Объявление скрыто с поиска.",
					})

					// Update contact request status
					var pubID int64
					err = pool.QueryRow(c, `
						UPDATE contact_request 
						SET status='agreed', updated_at=now()
						WHERE id=$1
						RETURNING publication_id
					`, contactRequestID).Scan(&pubID)

					if err == nil && pubID > 0 {
						var (
							requesterUserID int64
							ownerUserID     int64
							pubKind         string
							fromIATA        string
							toIATA          string
						)
						if detErr := pool.QueryRow(c, `
							SELECT cr.requester_user_id, p.user_id, p.kind, p.from_iata, p.to_iata
							FROM contact_request cr
							JOIN publication p ON p.id = cr.publication_id
							WHERE cr.id=$1
						`, contactRequestID).Scan(&requesterUserID, &ownerUserID, &pubKind, &fromIATA, &toIATA); detErr == nil {
							props := map[string]any{
								"pub_id":             pubID,
								"pub_kind":           pubKind,
								"from_iata":          fromIATA,
								"to_iata":            toIATA,
								"contact_request_id": contactRequestID,
								"owner_user_id":      ownerUserID,
								"requester_user_id":  requesterUserID,
								"trigger":            "telegram_contact_agreed",
							}
							posthog.Capture("deal_created", strconv.FormatInt(requesterUserID, 10), props)
						}

						// Hide publication from search
						_, _ = pool.Exec(c, `UPDATE publication SET is_active=false WHERE id=$1`, pubID)

						// Update message to show it's been agreed
						_, _ = tg.API("editMessageText", gin.H{
							"chat_id":    up.CallbackQuery.Message.Chat.ID,
							"message_id": up.CallbackQuery.Message.MessageID,
							"text":       "✅ Договорились! Объявление скрыто с поиска.",
						})
					}
				}

				c.Status(http.StatusOK)
				return
			}

			if strings.HasPrefix(up.CallbackQuery.Data, "contact_declined:") {
				contactRequestIDStr := strings.TrimPrefix(up.CallbackQuery.Data, "contact_declined:")
				contactRequestID, err := strconv.ParseInt(contactRequestIDStr, 10, 64)

				if err == nil {
					// Answer callback first
					_, _ = tg.API("answerCallbackQuery", gin.H{
						"callback_query_id": up.CallbackQuery.ID,
						"text":              "Объявление остается активным.",
					})

					// Update contact request status
					_, _ = pool.Exec(c, `
						UPDATE contact_request 
						SET status='declined', updated_at=now()
						WHERE id=$1
					`, contactRequestID)

					var (
						requesterUserID int64
						ownerUserID     int64
						pubID           int64
						pubKind         string
						fromIATA        string
						toIATA          string
					)
					if detErr := pool.QueryRow(c, `
						SELECT cr.requester_user_id, p.user_id, cr.publication_id, p.kind, p.from_iata, p.to_iata
						FROM contact_request cr
						JOIN publication p ON p.id = cr.publication_id
						WHERE cr.id=$1
					`, contactRequestID).Scan(&requesterUserID, &ownerUserID, &pubID, &pubKind, &fromIATA, &toIATA); detErr == nil {
						props := map[string]any{
							"pub_id":             pubID,
							"pub_kind":           pubKind,
							"from_iata":          fromIATA,
							"to_iata":            toIATA,
							"contact_request_id": contactRequestID,
							"owner_user_id":      ownerUserID,
							"requester_user_id":  requesterUserID,
							"trigger":            "telegram_contact_declined",
						}
						posthog.Capture("deal_error", strconv.FormatInt(requesterUserID, 10), props)
					}

					// Update message
					_, _ = tg.API("editMessageText", gin.H{
						"chat_id":    up.CallbackQuery.Message.Chat.ID,
						"message_id": up.CallbackQuery.Message.MessageID,
						"text":       "❌ Не договорились. Объявление остается активным.",
					})
				}

				c.Status(http.StatusOK)
				return
			}

			// Handle rating callback
			if strings.HasPrefix(up.CallbackQuery.Data, "rate_deal:") {
				dealIDStr := strings.TrimPrefix(up.CallbackQuery.Data, "rate_deal:")
				dealID, err := strconv.ParseInt(dealIDStr, 10, 64)

				if err == nil {
					// Answer callback first
					_, _ = tg.API("answerCallbackQuery", gin.H{
						"callback_query_id": up.CallbackQuery.ID,
						"text":              "Спасибо за оценку!",
					})

					// Rate the deal (increment counterpart's rating)
					uid := strconv.FormatInt(up.CallbackQuery.From.ID, 10)
					_, _ = pool.Exec(c, `
						WITH d AS (
							SELECT d.id, ur.id AS req_user_id, ut.id AS trip_user_id,
							       CASE WHEN ur.tg_user_id=$2::text::bigint THEN ut.id
							            WHEN ut.tg_user_id=$2::text::bigint THEN ur.id END AS target_user_id
							FROM deal d
							JOIN publication pr ON pr.id=d.request_pub_id
							JOIN app_user ur ON ur.id=pr.user_id
							JOIN publication pt ON pt.id=d.trip_pub_id
							JOIN app_user ut ON ut.id=pt.user_id
							WHERE d.id=$1
						), once AS (
							INSERT INTO rating_log(deal_id, rater_tg, target_user_id)
							SELECT d.id, $2::text::bigint, d.target_user_id FROM d
							ON CONFLICT DO NOTHING RETURNING 1
						)
						UPDATE app_user u SET rating_small = rating_small + 1
						WHERE u.id = (SELECT target_user_id FROM d)
							AND EXISTS (SELECT 1 FROM once)
					`, dealID, uid)

					// Update the button message to show it's been rated
					_, _ = tg.API("editMessageText", gin.H{
						"chat_id":    up.CallbackQuery.Message.Chat.ID,
						"message_id": up.CallbackQuery.Message.MessageID,
						"text":       "✅ Спасибо! Вы оценили участника сделки.",
					})
				}

				c.Status(http.StatusOK)
				return
			}

			// Answer callback for any unhandled callbacks
			_, _ = tg.API("answerCallbackQuery", gin.H{
				"callback_query_id": up.CallbackQuery.ID,
			})

			c.Status(http.StatusOK)
			return
		}

		if up.Message == nil {
			log.Printf("[BOT] Update received but Message is nil (might be callback_query, edited_message, etc.)")
			c.Status(http.StatusOK)
			return
		}

		text := strings.TrimSpace(up.Message.Text)

		log.Printf("[BOT] Received message from user %d (chat %d): %q", up.Message.From.ID, up.Message.Chat.ID, text)

		// Handle /start command
		if strings.HasPrefix(text, "/start") {
			// /start connect - user connecting from web
			if text == "/start connect" {
				// Check if user exists in database
				var exists bool
				var rating int
				var username string
				_ = pool.QueryRow(c, `
					SELECT EXISTS(SELECT 1 FROM app_user WHERE tg_user_id=$1),
					       COALESCE((SELECT rating_small FROM app_user WHERE tg_user_id=$1), 0),
					       COALESCE((SELECT tg_username FROM app_user WHERE tg_user_id=$1), '')
				`, up.Message.From.ID).Scan(&exists, &rating, &username)

				if exists {
					profileText := buildProfileText(username, rating)
					_, _ = tg.API("sendMessage", gin.H{
						"chat_id": up.Message.Chat.ID,
						"text":    "✅ Отлично! Бот подключен. Теперь вы будете получать уведомления о совпадениях и сделках в Telegram.\n\n" + profileText + "\n\nИспользуйте веб-сайт для поиска и создания объявлений, а здесь вы будете получать уведомления и можете общаться с другими участниками сделок.",
					})
				} else {
					_, _ = tg.API("sendMessage", gin.H{
						"chat_id": up.Message.Chat.ID,
						"text":    "Привет! Сначала авторизуйтесь на веб-сайте Deliverty, а затем вернитесь сюда.",
					})
				}
				c.Status(http.StatusOK)
				return
			}

			// /start deal:<id>:<sig> (or URL-encoded)
			if strings.HasPrefix(text, "/start ") {
				startParam := strings.TrimPrefix(text, "/start ")
				processStartDeal(c.Request.Context(), pool, tg, up.Message.From.ID, up.Message.Chat.ID, startParam)
				c.Status(http.StatusOK)
				return
			}

			// Plain /start - show welcome message with profile
			var rating int
			var username string
			_ = pool.QueryRow(c, `
				SELECT COALESCE(rating_small, 0), COALESCE(tg_username, '')
				FROM app_user WHERE tg_user_id=$1
			`, up.Message.From.ID).Scan(&rating, &username)

			profileText := buildProfileText(username, rating)
			_, _ = tg.API("sendMessage", gin.H{
				"chat_id": up.Message.Chat.ID,
				"text":    "Привет! Это бот Deliverty.\n\n" + profileText + "\n\nИспользуйте веб-сайт для поиска и создания объявлений. Здесь вы будете получать уведомления о совпадениях и сделках.\n\nКоманды:\n/profile - ваш профиль",
			})
			c.Status(http.StatusOK)
			return
		}

		// Handle /profile command
		if text == "/profile" {
			var rating int
			var username string
			err := pool.QueryRow(c, `
				SELECT COALESCE(rating_small, 0), COALESCE(tg_username, '')
				FROM app_user WHERE tg_user_id=$1
			`, up.Message.From.ID).Scan(&rating, &username)

			if err != nil {
				_, _ = tg.API("sendMessage", gin.H{
					"chat_id": up.Message.Chat.ID,
					"text":    "Вы не авторизованы. Пожалуйста, сначала авторизуйтесь на веб-сайте.",
				})
			} else {
				profileText := buildProfileText(username, rating)
				_, _ = tg.API("sendMessage", gin.H{
					"chat_id": up.Message.Chat.ID,
					"text":    "📊 Ваш профиль\n\n" + profileText,
				})
			}
			c.Status(http.StatusOK)
			return
		}

		// Commands update deal status (keep for backward compatibility, but prefer buttons)
		switch text {
		case "/agree":
			setStatus(c, pool, tg, up.Message.From.ID, up.Message.Chat.ID, "agreed")
		case "/done":
			setStatus(c, pool, tg, up.Message.From.ID, up.Message.Chat.ID, "handoff_done")
		case "/cancel":
			setStatus(c, pool, tg, up.Message.From.ID, up.Message.Chat.ID, "cancelled")
		default:
			relayMessage(c, pool, tg, up.Message.From.ID, text)
		}

		c.Status(http.StatusOK)
	})
}

func processStartDeal(ctx context.Context, pool *pgxpool.Pool, tg *bot.TG, userID, chatID int64, startParam string) {
	log.Printf("[BOT] Processing deep-link (raw): %q", startParam)

	// Try to URL-decode in case Telegram didn't decode it automatically
	decoded, err := url.QueryUnescape(startParam)
	if err == nil && decoded != startParam {
		log.Printf("[BOT] URL-decoded parameter: %q -> %q", startParam, decoded)
		startParam = decoded
	}

	log.Printf("[BOT] Processing deep-link (after decode): %q", startParam)

	parts := strings.Split(startParam, ":")
	log.Printf("[BOT] Split parts: %v (len=%d)", parts, len(parts))

	if len(parts) != 3 {
		log.Printf("[BOT] Invalid parts count: expected 3, got %d", len(parts))
		_, _ = tg.API("sendMessage", gin.H{"chat_id": chatID, "text": "Неверная ссылка: неверный формат"})
		return
	}

	if parts[0] != "deal" {
		log.Printf("[BOT] Invalid prefix: expected 'deal', got %q", parts[0])
		_, _ = tg.API("sendMessage", gin.H{"chat_id": chatID, "text": "Неверная ссылка: неверный тип"})
		return
	}

	payload := parts[0] + ":" + parts[1]
	sig := parts[2]
	isValid := bot.Verify(payload, sig)
	log.Printf("[BOT] Verifying signature: payload=%q, sig=%q, valid=%v", payload, sig, isValid)

	if !isValid {
		log.Printf("[BOT] Signature verification failed")
		_, _ = tg.API("sendMessage", gin.H{"chat_id": chatID, "text": "Неверная ссылка: подпись неверна"})
		return
	}

	dealID := parts[1]
	log.Printf("[BOT] Checking if user %d is participant of deal %s", userID, dealID)

	// Ensure participant belongs to deal
	var ok bool
	err = pool.QueryRow(ctx, `
	  SELECT EXISTS(
	    SELECT 1 FROM deal d
	      JOIN publication pr ON pr.id=d.request_pub_id
	      JOIN app_user ur ON ur.id=pr.user_id
	      JOIN publication pt ON pt.id=d.trip_pub_id
	      JOIN app_user ut ON ut.id=pt.user_id
	    WHERE d.id=$1 AND (ur.tg_user_id=$2 OR ut.tg_user_id=$2)
	  )`, dealID, userID).Scan(&ok)

	if err != nil {
		log.Printf("[BOT] Database error checking participant: %v", err)
		_, _ = tg.API("sendMessage", gin.H{"chat_id": chatID, "text": "Ошибка при проверке участника"})
		return
	}

	log.Printf("[BOT] User %d is participant: %v", userID, ok)

	if !ok {
		log.Printf("[BOT] User %d is not a participant of deal %s", userID, dealID)
		_, _ = tg.API("sendMessage", gin.H{"chat_id": chatID, "text": "Вы не являетесь участником"})
		return
	}

	log.Printf("[BOT] Successfully connected user %d to deal %s", userID, dealID)

	// Get counterpart info and rating
	var counterpartRating int
	var counterpartUsername string
	var currentUserRating int
	var currentUsername string
	_ = pool.QueryRow(ctx, `
		SELECT 
			CASE WHEN ur.tg_user_id=$2 THEN ut.rating_small ELSE ur.rating_small END AS counterpart_rating,
			CASE WHEN ur.tg_user_id=$2 THEN COALESCE(ut.tg_username, '') ELSE COALESCE(ur.tg_username, '') END AS counterpart_username,
			CASE WHEN ur.tg_user_id=$2 THEN ur.rating_small ELSE ut.rating_small END AS current_rating,
			CASE WHEN ur.tg_user_id=$2 THEN COALESCE(ur.tg_username, '') ELSE COALESCE(ut.tg_username, '') END AS current_username
		FROM deal d
		JOIN publication pr ON pr.id=d.request_pub_id
		JOIN app_user ur ON ur.id=pr.user_id
		JOIN publication pt ON pt.id=d.trip_pub_id
		JOIN app_user ut ON ut.id=pt.user_id
		WHERE d.id=$1
	`, dealID, userID).Scan(&counterpartRating, &counterpartUsername, &currentUserRating, &currentUsername)

	counterpartInfo := buildProfileText(counterpartUsername, counterpartRating)

	// Get current deal status
	var currentStatus string
	dealIDInt, _ := strconv.ParseInt(dealID, 10, 64)
	_ = pool.QueryRow(ctx, `SELECT status FROM deal WHERE id=$1`, dealID).Scan(&currentStatus)

	// Create inline keyboard with status buttons based on current status
	keyboard := buildDealStatusKeyboard(currentStatus, dealIDInt)

	// Build message text with status info
	statusText := map[string]string{
		"agreed":       "✅ Согласовано",
		"handoff_done": "✅ Передача завершена",
		"cancelled":    "❌ Отменено",
	}

	statusInfo := ""
	if currentStatus != "new" && currentStatus != "" {
		statusInfo = fmt.Sprintf("\n\n📊 Статус: %s", statusText[currentStatus])
	}

	text := fmt.Sprintf("✅ Подключено к сделке!%s\n\n👤 Участник:\n%s\n\nОтправляйте сообщения сюда для пересылки. Используйте кнопки ниже для управления сделкой.", statusInfo, counterpartInfo)
	_, _ = tg.API("sendMessage", gin.H{
		"chat_id":      chatID,
		"text":         text,
		"reply_markup": keyboard,
	})
}

func setStatus(c *gin.Context, pool *pgxpool.Pool, tg *bot.TG, fromTG int64, chatID int64, status string) {
	// Update only deals where sender participates; no message logs kept
	rowsAffected, _ := pool.Exec(c, `
	  UPDATE deal SET status=$1, last_message_at=now()
	  WHERE id IN (
	    SELECT d.id FROM deal d
	      JOIN publication pr ON pr.id=d.request_pub_id
	      JOIN app_user ur ON ur.id=pr.user_id
	      JOIN publication pt ON pt.id=d.trip_pub_id
	      JOIN app_user ut ON ut.id=pt.user_id
	    WHERE ur.tg_user_id=$2 OR ut.tg_user_id=$2
	  )`, status, fromTG)

	// If called from command (not callback), send confirmation
	if tg != nil && rowsAffected.RowsAffected() > 0 {
		statusText := map[string]string{
			"agreed":       "✅ Согласовано",
			"handoff_done": "✅ Передача завершена",
			"cancelled":    "❌ Отменено",
		}

		_, _ = tg.API("sendMessage", gin.H{
			"chat_id": chatID,
			"text":    fmt.Sprintf("%s\n\nСтатус обновлен.", statusText[status]),
		})

		// If status is handoff_done, show rating button
		if status == "handoff_done" {
			var dealID int64
			_ = pool.QueryRow(c, `
				SELECT d.id FROM deal d
				JOIN publication pr ON pr.id=d.request_pub_id
				JOIN app_user ur ON ur.id=pr.user_id
				JOIN publication pt ON pt.id=d.trip_pub_id
				JOIN app_user ut ON ut.id=pt.user_id
				WHERE (ur.tg_user_id=$1 OR ut.tg_user_id=$1) AND d.status='handoff_done'
				ORDER BY d.last_message_at DESC LIMIT 1
			`, fromTG).Scan(&dealID)

			if dealID > 0 {
				var alreadyRated bool
				_ = pool.QueryRow(c, `
					SELECT EXISTS(SELECT 1 FROM rating_log WHERE deal_id=$1 AND rater_tg=$2)
				`, dealID, fromTG).Scan(&alreadyRated)

				if !alreadyRated {
					keyboard := gin.H{
						"inline_keyboard": [][]gin.H{
							{
								{
									"text":          "⭐ Оценить участника",
									"callback_data": fmt.Sprintf("rate_deal:%d", dealID),
								},
							},
						},
					}

					_, _ = tg.API("sendMessage", gin.H{
						"chat_id":      chatID,
						"text":         "Пожалуйста, оцените участника сделки.",
						"reply_markup": keyboard,
					})
				}
			}
		}
	}
}

func relayMessage(c *gin.Context, pool *pgxpool.Pool, tg *bot.TG, fromTG int64, text string) {
	// Find counterpart chat_id by tg_user_id; we don't store messages per policy
	type row struct {
		DealID int64
		ToTG   int64
	}

	rows, _ := pool.Query(c, `
	  SELECT d.id,
	    CASE WHEN ur.tg_user_id=$1 THEN ut.tg_user_id ELSE ur.tg_user_id END AS to_tg
	  FROM deal d
	    JOIN publication pr ON pr.id=d.request_pub_id
	    JOIN app_user ur ON ur.id=pr.user_id
	    JOIN publication pt ON pt.id=d.trip_pub_id
	    JOIN app_user ut ON ut.id=pt.user_id
	  WHERE (ur.tg_user_id=$1 OR ut.tg_user_id=$1) AND d.status!='cancelled'
	  ORDER BY d.created_at DESC LIMIT 1
	`, fromTG)
	defer rows.Close()

	var r row
	if rows.Next() {
		_ = rows.Scan(&r.DealID, &r.ToTG)
		_, _ = tg.API("sendMessage", gin.H{"chat_id": r.ToTG, "text": text})
		_, _ = pool.Exec(c, `UPDATE deal SET last_message_at=now() WHERE id=$1`, r.DealID)
	}
}

// build deep link: https://t.me/<botname>?start=deal:<id>:<sig>
func DealDeepLink(botName string, dealID int64) string {
	payload := fmt.Sprintf("deal:%d", dealID)
	return fmt.Sprintf("https://t.me/%s?start=%s:%s", botName, payload, bot.Sign(payload))
}
