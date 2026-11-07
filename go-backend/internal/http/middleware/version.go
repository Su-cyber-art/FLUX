package middleware

import "net/http"

// VersionHeader carries the backend release on every response so an open
// dashboard can tell it is running against an upgraded panel.
const VersionHeader = "X-Flux-Version"

func Version(version string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set(VersionHeader, version)
			next.ServeHTTP(w, r)
		})
	}
}
