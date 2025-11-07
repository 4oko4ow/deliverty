package match

import "time"

// Check date window overlap (inclusive)
func OverlapDays(aStart, aEnd, bStart, bEnd time.Time) int {
	if aEnd.Before(bStart) || bEnd.Before(aStart) {
		return 0
	}
	start := maxTime(aStart, bStart)
	end := minTime(aEnd, bEnd)
	return int(end.Sub(start).Hours()/24) + 1
}

func maxTime(a, b time.Time) time.Time {
	if a.After(b) {
		return a
	}
	return b
}

func minTime(a, b time.Time) time.Time {
	if a.Before(b) {
		return a
	}
	return b
}

// weight compatibility: trip capacity must be >= request weight
func WeightOK(req, trip string) bool {
	order := map[string]int{"envelope": 0, "le1kg": 1, "le3kg": 2}
	return order[trip] >= order[req]
}



