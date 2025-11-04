package bot

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"time"
)

// Minimal Telegram client
type TG struct {
	Token string
	http  *http.Client
}

func New() *TG {
	return &TG{
		Token: os.Getenv("TG_BOT_TOKEN"),
		http:  &http.Client{Timeout: 5 * time.Second},
	}
}

func (t *TG) API(method string, body any) (*http.Response, error) {
	u := fmt.Sprintf("https://api.telegram.org/bot%s/%s", t.Token, method)
	var buf bytes.Buffer
	_ = json.NewEncoder(&buf).Encode(body)
	req, _ := http.NewRequest("POST", u, &buf)
	req.Header.Set("Content-Type", "application/json")
	return t.http.Do(req)
}

// HMAC for deep-link payloads: deal:<id>
func Sign(payload string) string {
	secret := os.Getenv("TG_DEEPLINK_SECRET")
	m := hmac.New(sha256.New, []byte(secret))
	m.Write([]byte(payload))
	return hex.EncodeToString(m.Sum(nil))[:16]
}

func Verify(payload, sig string) bool {
	return Sign(payload) == sig
}
