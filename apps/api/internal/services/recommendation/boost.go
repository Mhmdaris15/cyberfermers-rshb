package recommendation

import (
	"math"

	"github.com/rshb/svoe-rodnoe-calendar/api/internal/models"
)

// =====================================================================
//   Score boosts — the graph + vector + memory layer.
//
//   The tag-overlap matcher gives a fast deterministic baseline. These
//   helpers compose on top of that:
//
//     • TrendBoost   — trend.strength × edge.strength capped 0..0.5
//     • MemoryBoost  — diminishing reward for events the farmer has
//                       accepted/launched in the past
//     • VectorBoost  — cosine(product, event) × 0.5 if both have vecs
//
//   Each lifts the score independently and we annotate the
//   MatchResult.Reasons so the FE can render them as chips.
// =====================================================================

// TrendInfluence maps event slug → cumulative influence weight in [0, 1].
type TrendInfluence map[string]float64

// MemoryBias maps event slug → memory-derived score bump (already in [0.1, 0.3]).
type MemoryBias map[string]float64

// ApplyBoosts re-ranks an existing MatchResult slice by adding the
// trend / memory / vector contributions. Mutates the slice in place and
// returns it sorted by the new score.
func ApplyBoosts(
	results []MatchResult,
	ev models.Event,
	trend TrendInfluence,
	memory MemoryBias,
) []MatchResult {
	tBoost := trend[ev.Slug]
	mBoost := memory[ev.Slug]
	hasEventVec := len(ev.Embedding) > 0

	for i := range results {
		p := results[i].Product
		// Trend influence: bump every product that already passed the matcher.
		if tBoost > 0 {
			results[i].Score += tBoost * 0.5
			results[i].Reasons = append(results[i].Reasons, "trend:"+fmtFloat(tBoost))
		}
		// Memory bias: only applied when memory is rich enough.
		if mBoost > 0 {
			results[i].Score += mBoost
			results[i].Reasons = append(results[i].Reasons, "memory:"+fmtFloat(mBoost))
		}
		// Vector similarity, per-product.
		if hasEventVec && len(p.Embedding) > 0 {
			sim := cosine(p.Embedding, ev.Embedding)
			if sim > 0.55 { // ignore weak signal
				results[i].Score += sim * 0.5
				results[i].Reasons = append(results[i].Reasons, "vector:"+fmtFloat(sim))
			}
		}
	}
	sortByScore(results)
	return results
}

func cosine(a, b []float64) float64 {
	if len(a) != len(b) || len(a) == 0 {
		return 0
	}
	var dot, na, nb float64
	for i := range a {
		dot += a[i] * b[i]
		na += a[i] * a[i]
		nb += b[i] * b[i]
	}
	if na == 0 || nb == 0 {
		return 0
	}
	return dot / (math.Sqrt(na) * math.Sqrt(nb))
}

func sortByScore(rs []MatchResult) {
	// insertion sort — slices are short (≤ a few dozen).
	for i := 1; i < len(rs); i++ {
		j := i
		for j > 0 && rs[j-1].Score < rs[j].Score {
			rs[j-1], rs[j] = rs[j], rs[j-1]
			j--
		}
	}
}

func fmtFloat(f float64) string {
	// 2 decimals, no trailing zero. ~5-byte string.
	if f < 0 {
		f = 0
	}
	if f >= 10 {
		return "9.99+"
	}
	r := int(f*100 + 0.5)
	a := r / 100
	b := r % 100
	if b == 0 {
		return digit(a) + ".00"
	}
	if b%10 == 0 {
		return digit(a) + "." + digit(b/10) + "0"
	}
	return digit(a) + "." + digit(b/10) + digit(b%10)
}
func digit(n int) string {
	if n < 0 || n > 9 {
		return "0"
	}
	return string(rune('0' + n))
}
