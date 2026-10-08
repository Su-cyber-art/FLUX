package socket

import (
	"errors"
	"testing"
	"time"

	"github.com/go-gost/x/config"
)

func TestRetiredNodeRejectsStaleCommandsAndAcknowledgesRetry(t *testing.T) {
	old := config.Global()
	defer config.Set(old)
	config.Set(&config.Config{})
	reporter := NewWebSocketReporter("ws://localhost", "test-secret")
	defer reporter.Stop()
	cleanups := 0
	finished := make(chan struct{})
	reporter.SetRetirementHandlers(func() error { cleanups++; return nil }, func() { close(finished) })
	reporter.routeCommand(CommandMessage{Type: "RetireNode"})
	reporter.routeCommand(CommandMessage{Type: "RetireNode"})
	if cleanups != 1 || !reporter.retired.Load() {
		t.Fatal("cleanup retry is not idempotent")
	}
	reporter.routeCommand(CommandMessage{Type: "AddLimiters", Data: map[string]interface{}{"name": "stale-limiter", "limits": []string{"$ 100 100"}}})
	if len(config.Global().Limiters) != 0 {
		t.Fatal("queued mutation resurrected config")
	}
	reporter.routeCommand(CommandMessage{Type: "FinalizeNodeDeletion"})
	select {
	case <-finished:
	case <-time.After(time.Second):
		t.Fatal("cleaned agent did not exit after panel confirmation")
	}
}

func TestFailedRetirementCannotFinalizeAndCanRetry(t *testing.T) {
	reporter := NewWebSocketReporter("ws://localhost", "test-secret")
	defer reporter.Stop()
	failure := true
	finished := make(chan struct{}, 1)
	reporter.SetRetirementHandlers(func() error {
		if failure {
			return errors.New("disk failure")
		}
		return nil
	}, func() { finished <- struct{}{} })
	reporter.routeCommand(CommandMessage{Type: "RetireNode"})
	reporter.routeCommand(CommandMessage{Type: "FinalizeNodeDeletion"})
	if reporter.retired.Load() {
		t.Fatal("failure counted as cleaned")
	}
	select {
	case <-finished:
		t.Fatal("failed cleanup finalized")
	case <-time.After(30 * time.Millisecond):
	}
	failure = false
	reporter.routeCommand(CommandMessage{Type: "RetireNode"})
	if !reporter.retired.Load() {
		t.Fatal("retry failed")
	}
}
