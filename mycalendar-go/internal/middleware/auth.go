package middleware

import (
	"encoding/json"
	"mycalendar/internal/session"
	"net/http"
)

// RequireAuth is a middleware that requires authentication
func RequireAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !session.IsAuthenticated(r) {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusUnauthorized)
			json.NewEncoder(w).Encode(map[string]string{
				"error": "Not logged in",
			})
			return
		}

		next.ServeHTTP(w, r)
	})
}
