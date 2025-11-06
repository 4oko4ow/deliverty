package httpx

import "strings"

var banned = []string{
	"weapon", "drugs", "narcotic", "steroid", "explosive", "vape", "alcohol", "cash", "currency",
	"biological", "hazard", "credit card", "sim card",
}

func hasBannedItem(desc string) bool {
	d := strings.ToLower(desc)
	for _, w := range banned {
		if strings.Contains(d, w) {
			return true
		}
	}
	return false
}


