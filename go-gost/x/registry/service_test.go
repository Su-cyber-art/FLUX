package registry

import (
	"errors"
	"net"
	"testing"
)

type cleanupService struct {
	closes int
	err    error
}

func (s *cleanupService) Addr() net.Addr { return nil }
func (s *cleanupService) Serve() error   { return nil }
func (s *cleanupService) Close() error {
	s.closes++
	return s.err
}

func TestUnregisterServiceClosesOnceAndRetainsFailuresForRetry(t *testing.T) {
	const name = "retirement-cleanup-test"
	failure := errors.New("listener cleanup failed")
	srv := &cleanupService{err: failure}
	if err := ServiceRegistry().Register(name, srv); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { ServiceRegistry().Unregister(name) })
	if err := UnregisterService(name); !errors.Is(err, failure) {
		t.Fatalf("cleanup failure lost: %v", err)
	}
	if ServiceRegistry().Get(name) != srv || srv.closes != 1 {
		t.Fatal("failed cleanup was discarded or closed repeatedly")
	}
	srv.err = nil
	if err := UnregisterService(name); err != nil {
		t.Fatal(err)
	}
	if ServiceRegistry().Get(name) != nil || srv.closes != 2 {
		t.Fatal("cleanup retry did not unregister the service exactly once")
	}
	if err := UnregisterService(name); err != nil || srv.closes != 2 {
		t.Fatal("already removed service was closed again")
	}
}
