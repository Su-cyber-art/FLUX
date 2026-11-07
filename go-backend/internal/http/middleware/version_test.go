package middleware

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestVersionHeaderIsSetAndExposedCrossOrigin(t *testing.T) {
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusUnauthorized) })
	rr := httptest.NewRecorder()
	CORS(Version("3.3.0")(next)).ServeHTTP(rr, httptest.NewRequest(http.MethodPost, "/api/v1/user/list", nil))

	if got := rr.Header().Get(VersionHeader); got != "3.3.0" {
		t.Fatalf("version header = %q", got)
	}
	if !strings.Contains(rr.Header().Get("Access-Control-Expose-Headers"), VersionHeader) {
		t.Fatal("browsers on another origin cannot read the version header")
	}
}
