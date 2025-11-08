package posthog

import (
	"bytes"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"sync"
	"time"
)

type client struct {
	apiKey     string
	host       string
	httpClient *http.Client
	enabled    bool
}

var (
	defaultClient *client
	initOnce      sync.Once
)

// InitFromEnv configures the global PostHog client using environment variables.
// POSTHOG_API_KEY is required; POSTHOG_HOST is optional (defaults to https://app.posthog.com).
func InitFromEnv() {
	initOnce.Do(func() {
		apiKey := os.Getenv("POSTHOG_API_KEY")
		host := os.Getenv("POSTHOG_HOST")
		if host == "" {
			host = "https://app.posthog.com"
		}

		if apiKey == "" {
			log.Println("[PostHog] POSTHOG_API_KEY not set – analytics disabled")
			defaultClient = &client{enabled: false}
			return
		}

		defaultClient = &client{
			apiKey: apiKey,
			host:   host,
			httpClient: &http.Client{
				Timeout: 3 * time.Second,
			},
			enabled: true,
		}
	})
}

// Capture sends an event to PostHog. If the client is not configured, it no-ops.
func Capture(event, distinctID string, properties map[string]any) {
	if defaultClient == nil {
		// Safeguard in case InitFromEnv wasn't called explicitly
		InitFromEnv()
	}

	if defaultClient == nil || !defaultClient.enabled {
		return
	}

	props := make(map[string]any, len(properties)+2)
	for k, v := range properties {
		props[k] = v
	}
	if _, ok := props["source"]; !ok {
		props["source"] = "backend"
	}

	payload := map[string]any{
		"api_key":     defaultClient.apiKey,
		"event":       event,
		"distinct_id": distinctID,
		"properties":  props,
		"timestamp":   time.Now().UTC(),
	}

	data, err := json.Marshal(payload)
	if err != nil {
		log.Printf("[PostHog] marshal error: %v", err)
		return
	}

	go func() {
		req, err := http.NewRequest(http.MethodPost, defaultClient.host+"/capture/", bytes.NewReader(data))
		if err != nil {
			log.Printf("[PostHog] request error: %v", err)
			return
		}
		req.Header.Set("Content-Type", "application/json")

		resp, err := defaultClient.httpClient.Do(req)
		if err != nil {
			log.Printf("[PostHog] send error: %v", err)
			return
		}
		defer resp.Body.Close()

		if resp.StatusCode >= 400 {
			log.Printf("[PostHog] capture failed: status=%d", resp.StatusCode)
		}
	}()
}
