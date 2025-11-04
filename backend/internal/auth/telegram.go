package auth

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"os"
	"sort"
	"strconv"
	"strings"
	"time"
)

// ValidateTelegramAuth validates Telegram Login Widget authentication data
// Returns user ID if valid, error otherwise
func ValidateTelegramAuth(id, first_name, last_name, username, photo_url, auth_date, hash string) (int64, error) {
	// Parse user ID
	userID, err := strconv.ParseInt(id, 10, 64)
	if err != nil {
		return 0, fmt.Errorf("invalid user id: %w", err)
	}

	// Parse auth_date
	authDate, err := strconv.ParseInt(auth_date, 10, 64)
	if err != nil {
		return 0, fmt.Errorf("invalid auth_date: %w", err)
	}

	// Check if auth is too old (more than 24 hours)
	if time.Now().Unix()-authDate > 86400 {
		return 0, fmt.Errorf("auth data expired")
	}

	// Verify hash
	botToken := os.Getenv("TG_BOT_TOKEN")
	if botToken == "" {
		return 0, fmt.Errorf("TG_BOT_TOKEN not set")
	}

	// Build data check string
	// Format: key=value\n (sorted by key, excluding hash)
	data := []string{
		fmt.Sprintf("auth_date=%s", auth_date),
	}
	if id != "" {
		data = append(data, fmt.Sprintf("id=%s", id))
	}
	if first_name != "" {
		data = append(data, fmt.Sprintf("first_name=%s", first_name))
	}
	if last_name != "" {
		data = append(data, fmt.Sprintf("last_name=%s", last_name))
	}
	if username != "" {
		data = append(data, fmt.Sprintf("username=%s", username))
	}
	if photo_url != "" {
		data = append(data, fmt.Sprintf("photo_url=%s", photo_url))
	}

	// Sort and join (sorted by key, joined with newline)
	sort.Strings(data)
	dataStr := strings.Join(data, "\n")

	// Compute secret key: SHA256 of bot token
	tokenHash := sha256.Sum256([]byte(botToken))
	secretKey := tokenHash[:]

	// Compute HMAC-SHA256
	mac := hmac.New(sha256.New, secretKey)
	mac.Write([]byte(dataStr))
	expectedHash := hex.EncodeToString(mac.Sum(nil))

	// Compare hashes
	if hash != expectedHash {
		return 0, fmt.Errorf("invalid hash")
	}

	return userID, nil
}

