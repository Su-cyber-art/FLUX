package service

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"testing"
	"time"
)

func TestGlobalTrafficManagerRemoveServicesDropsCachedEntries(t *testing.T) {
	m := &GlobalTrafficManager{serviceTraffic: map[string]*ServiceTraffic{
		"svc-a": {ServiceName: "svc-a"},
		"svc-b": {ServiceName: "svc-b"},
	}}

	m.RemoveServices("svc-a")

	if _, ok := m.serviceTraffic["svc-a"]; ok {
		t.Fatalf("expected svc-a traffic entry to be removed")
	}
	if _, ok := m.serviceTraffic["svc-b"]; !ok {
		t.Fatalf("expected svc-b traffic entry to remain")
	}
}

func TestGlobalTrafficManagerRetainsUnacknowledgedBatchAndSeparatesNewTraffic(t *testing.T) {
	origDo, origURL, origCrypto := reportDo, httpReportURL, httpAESCrypto
	origPreferred := loadPreferredURL(&preferredUploadURL)
	t.Cleanup(func() {
		reportDo, httpReportURL, httpAESCrypto = origDo, origURL, origCrypto
		reportURLPreferenceMutex.Lock()
		preferredUploadURL = origPreferred
		reportURLPreferenceMutex.Unlock()
	})
	httpReportURL, httpAESCrypto = "http://panel.test/flow/upload", nil
	var bodies, identities []string
	accepted := make(map[string]bool)
	var billed int64
	reportDo = func(_ context.Context, req *http.Request, _ time.Duration) (*http.Response, error) {
		body, _ := io.ReadAll(req.Body)
		identity := req.Header.Get("X-Flux-Flow-Producer") + ":" + req.Header.Get("X-Flux-Flow-Sequence")
		if identity == ":" {
			t.Fatal("batch has no identity")
		}
		bodies, identities = append(bodies, string(body)), append(identities, identity)
		if !accepted[identity] {
			var items []TrafficReportItem
			if err := json.Unmarshal(body, &items); err != nil {
				t.Fatal(err)
			}
			for _, item := range items {
				billed += item.U + item.D
			}
			accepted[identity] = true
		}
		if len(bodies) == 1 {
			// The panel committed, but its acknowledgement never reached the agent.
			return nil, io.ErrUnexpectedEOF
		}
		return &http.Response{StatusCode: http.StatusOK, Header: http.Header{"X-Flux-Flow-Ack": {identity}}, Body: io.NopCloser(strings.NewReader("ok"))}, nil
	}
	m := &GlobalTrafficManager{ctx: context.Background(), serviceTraffic: map[string]*ServiceTraffic{
		"retired-service": {ServiceName: "retired-service", UpBytes: 10, DownBytes: 20},
	}}
	m.collectAndReport()
	if len(m.pending) != 1 {
		t.Fatal("unacknowledged batch was discarded")
	}
	m.serviceTraffic["new-service"] = &ServiceTraffic{ServiceName: "new-service", UpBytes: 3, DownBytes: 4}
	m.collectAndReport()
	if bodies[0] != bodies[1] || identities[0] != identities[1] || len(m.pending) != 0 {
		t.Fatalf("retry changed the frozen batch: bodies=%v identities=%v", bodies, identities)
	}
	m.collectAndReport()
	if len(bodies) != 3 || identities[2] == identities[1] || !strings.HasSuffix(identities[2], ":2") || billed != 37 {
		t.Fatalf("new traffic must use the next batch without double accounting: identities=%v billed=%d", identities, billed)
	}
}

func TestGlobalTrafficManagerBoundsBatchSizeForLegacyPanels(t *testing.T) {
	origDo, origURL, origCrypto := reportDo, httpReportURL, httpAESCrypto
	t.Cleanup(func() { reportDo, httpReportURL, httpAESCrypto = origDo, origURL, origCrypto })
	httpReportURL, httpAESCrypto = "http://panel.test/flow/upload", nil
	var reported int
	reportDo = func(_ context.Context, req *http.Request, _ time.Duration) (*http.Response, error) {
		var items []TrafficReportItem
		if err := json.NewDecoder(req.Body).Decode(&items); err != nil {
			t.Fatal(err)
		}
		if len(items) > 500 {
			t.Fatalf("oversized batch: %d", len(items))
		}
		reported += len(items)
		// Older panels acknowledge the unchanged array body without receipt headers.
		return &http.Response{StatusCode: http.StatusOK, Body: io.NopCloser(strings.NewReader("ok"))}, nil
	}
	m := &GlobalTrafficManager{ctx: context.Background(), serviceTraffic: make(map[string]*ServiceTraffic)}
	for i := range 1001 {
		name := fmt.Sprintf("service-%d", i)
		m.serviceTraffic[name] = &ServiceTraffic{ServiceName: name, UpBytes: 1}
	}
	for range 3 {
		m.collectAndReport()
	}
	if reported != 1001 || len(m.serviceTraffic) != 0 || len(m.pending) != 0 {
		t.Fatalf("reported=%d active=%d pending=%d", reported, len(m.serviceTraffic), len(m.pending))
	}
}

func TestIdentifiedTrafficReportFallbackKeepsIdentityAndChecksAcknowledgement(t *testing.T) {
	for _, mismatch := range []bool{false, true} {
		t.Run(fmt.Sprintf("mismatched_ack=%v", mismatch), func(t *testing.T) {
			origDo, origURL, origCrypto := reportDo, httpReportURL, httpAESCrypto
			origPreferred := loadPreferredURL(&preferredUploadURL)
			t.Cleanup(func() {
				reportDo, httpReportURL, httpAESCrypto = origDo, origURL, origCrypto
				reportURLPreferenceMutex.Lock()
				preferredUploadURL = origPreferred
				reportURLPreferenceMutex.Unlock()
			})
			httpReportURL, httpAESCrypto = "https://first.test/flow/upload,http://second.test/flow/upload", nil
			var calls int
			reportDo = func(_ context.Context, req *http.Request, _ time.Duration) (*http.Response, error) {
				calls++
				identity := req.Header.Get("X-Flux-Flow-Producer") + ":" + req.Header.Get("X-Flux-Flow-Sequence")
				if identity != "process-a:4" {
					t.Fatalf("fallback changed identity: %s", identity)
				}
				if calls == 1 {
					return nil, io.ErrUnexpectedEOF
				}
				if mismatch {
					identity = "another-process:4"
				}
				return &http.Response{StatusCode: http.StatusOK, Header: http.Header{"X-Flux-Flow-Ack": {identity}}, Body: io.NopCloser(strings.NewReader("ok"))}, nil
			}
			ok, err := sendIdentifiedBatchTrafficReport(context.Background(), []TrafficReportItem{{N: "service", U: 1}}, "process-a", 4)
			if calls != 2 || ok == mismatch || (err != nil) != mismatch {
				t.Fatalf("calls=%d ok=%v err=%v", calls, ok, err)
			}
		})
	}
}

func TestGlobalTrafficManagerRetainServicesDropsStaleEntries(t *testing.T) {
	m := &GlobalTrafficManager{serviceTraffic: map[string]*ServiceTraffic{
		"svc-a": {ServiceName: "svc-a"},
		"svc-b": {ServiceName: "svc-b"},
	}}

	m.RetainServices(map[string]struct{}{"svc-b": {}})

	if _, ok := m.serviceTraffic["svc-a"]; ok {
		t.Fatalf("expected stale svc-a traffic entry to be removed")
	}
	if _, ok := m.serviceTraffic["svc-b"]; !ok {
		t.Fatalf("expected active svc-b traffic entry to remain")
	}
}

func TestGlobalTrafficManagerAddTrafficIgnoresUnregisteredService(t *testing.T) {
	m := &GlobalTrafficManager{serviceTraffic: make(map[string]*ServiceTraffic)}

	m.AddTraffic("deleted-service", 10, 20)

	if _, ok := m.serviceTraffic["deleted-service"]; ok {
		t.Fatalf("expected unregistered service traffic to be ignored")
	}
}

func TestGlobalTrafficManagerCollectAndReportDropsStaleEntriesAfterReporting(t *testing.T) {
	origReportDo := reportDo
	origReportURL := httpReportURL
	origAESCrypto := httpAESCrypto
	defer func() {
		reportDo = origReportDo
		httpReportURL = origReportURL
		httpAESCrypto = origAESCrypto
	}()

	httpReportURL = "http://panel.example.com/flow/upload?secret=abc"
	httpAESCrypto = nil

	var requestBody string
	reportDo = func(_ context.Context, req *http.Request, _ time.Duration) (*http.Response, error) {
		body, err := io.ReadAll(req.Body)
		if err != nil {
			t.Fatalf("read request body: %v", err)
		}
		requestBody = string(body)
		return &http.Response{
			StatusCode: http.StatusOK,
			Body:       io.NopCloser(strings.NewReader("ok")),
		}, nil
	}

	m := &GlobalTrafficManager{
		serviceTraffic: map[string]*ServiceTraffic{
			"stale-service": {ServiceName: "stale-service", UpBytes: 10, DownBytes: 20},
		},
		ctx: context.Background(),
	}

	m.collectAndReport()

	if !strings.Contains(requestBody, "stale-service") {
		t.Fatalf("expected pending stale traffic to be reported first, body=%s", requestBody)
	}
	if _, ok := m.serviceTraffic["stale-service"]; ok {
		t.Fatalf("expected stale traffic entry to be removed after report collection")
	}
}
