package socket

import (
	"errors"
	"github.com/go-gost/x/config"
	"testing"
)

func TestRetiredNodeRejectsStaleCommandsAndAcknowledgesRetry(t *testing.T) {
	old := config.Global()
	defer config.Set(old)
	config.Set(&config.Config{})
	reporter := NewWebSocketReporter("ws://localhost", "test-secret")
	defer reporter.Stop()
	cleanups, finishes := 0, 0
	reporter.SetRetirementHandlers(func() error { cleanups++; return nil }, func() { finishes++ })
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
	if finishes != 1 {
		t.Fatal("cleaned agent did not exit after panel confirmation")
	}
}

func TestFailedRetirementCannotFinalizeAndCanRetry(t *testing.T) {
	reporter := NewWebSocketReporter("ws://localhost", "test-secret")
	defer reporter.Stop()
	failure := true
	reporter.SetRetirementHandlers(func() error {
		if failure {
			return errors.New("disk failure")
		}
		return nil
	}, func() { t.Fatal("failed cleanup finalized") })
	reporter.routeCommand(CommandMessage{Type: "RetireNode"})
	reporter.routeCommand(CommandMessage{Type: "FinalizeNodeDeletion"})
	if reporter.retired.Load() {
		t.Fatal("failure counted as cleaned")
	}
	failure = false
	reporter.routeCommand(CommandMessage{Type: "RetireNode"})
	if !reporter.retired.Load() {
		t.Fatal("retry failed")
	}
}
