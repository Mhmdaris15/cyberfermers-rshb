package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"reflect"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog/log"
)

// =====================================================================
//   /api/farmers/:id/stream — Server-Sent Events.
//
//   Pushes diff events to the FE for two streams the UX cares about:
//     1. "plan"           — kanban state per farmer
//     2. "suggestions"    — calendar suggestions / scores
//
//   v1 implementation: server-side polling at a fixed tick. We send a
//   snapshot only when it differs from the previous tick (cheap deep
//   equality on the JSON-marshalled bytes).
//
//   v2 upgrade path (commented inline): replace the ticker with a
//   persistent WS connection to SurrealDB and forward LIVE SELECT
//   diffs. The wire protocol the FE consumes (`event: foo\ndata: ...`)
//   doesn't change, so this is purely a backend swap.
// =====================================================================

const streamTick = 1500 * time.Millisecond

func (d *Deps) Stream(c *gin.Context) {
	farmerID := c.Param("id")

	c.Writer.Header().Set("Content-Type", "text/event-stream")
	c.Writer.Header().Set("Cache-Control", "no-cache")
	c.Writer.Header().Set("Connection", "keep-alive")
	c.Writer.Header().Set("X-Accel-Buffering", "no") // disable nginx buffering
	c.Writer.WriteHeader(200)
	c.Writer.Flush()

	flusher, ok := c.Writer.(http.Flusher)
	if !ok {
		// Gin's writer is always a Flusher in practice; defensive guard.
		log.Warn().Msg("response writer is not a Flusher; SSE will not stream")
		return
	}

	emit := func(event string, payload any) bool {
		body, err := json.Marshal(payload)
		if err != nil {
			return true
		}
		if _, err := fmt.Fprintf(c.Writer, "event: %s\ndata: %s\n\n", event, body); err != nil {
			return false
		}
		flusher.Flush()
		return true
	}

	// Initial hello — lets the FE confirm the channel opened.
	if !emit("hello", map[string]any{"farmer_id": farmerID, "ts": time.Now().Unix()}) {
		return
	}

	tick := time.NewTicker(streamTick)
	defer tick.Stop()

	var lastPlan, lastSugs []byte

	ctx := c.Request.Context()
	for {
		select {
		case <-ctx.Done():
			return
		case <-tick.C:
			// --- plan board diff ---
			if board, err := d.Plan.Board(farmerID); err == nil {
				if b, _ := json.Marshal(board); !equalBytes(b, lastPlan) {
					lastPlan = b
					if !emit("plan", json.RawMessage(b)) {
						return
					}
				}
			}
			// --- suggestion list diff (cheap projection only) ---
			from := time.Now()
			to := from.AddDate(0, 1, 0)
			if sugs, err := d.Repo.ListSuggestionsForFarmer(farmerID, from, to); err == nil {
				slim := make([]map[string]any, 0, len(sugs))
				for _, s := range sugs {
					slim = append(slim, map[string]any{
						"id":            s.ID,
						"event_id":      s.EventID,
						"status":        s.Status,
						"score":         s.Score,
						"orders_delta":  s.PredictedLift.OrdersDelta,
						"revenue_delta": s.PredictedLift.RevenueDelta,
					})
				}
				if b, _ := json.Marshal(slim); !equalBytes(b, lastSugs) {
					lastSugs = b
					if !emit("suggestions", json.RawMessage(b)) {
						return
					}
				}
			}
		}
	}
}

// equalBytes compares two byte slices; used to suppress no-op SSE pushes.
func equalBytes(a, b []byte) bool {
	if len(a) != len(b) {
		return false
	}
	return reflect.DeepEqual(a, b)
}

