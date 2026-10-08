package registry

import (
	"errors"
	"net"
	"net/http"

	"github.com/go-gost/core/service"
)

type serviceRegistry struct {
	registry[service.Service]
}

// UnregisterService closes a service once and reports cleanup failures. Keep a
// failed service registered so node retirement can retry before acknowledging it.
// Callers serialize runtime mutations with config.LockMutation.
func UnregisterService(name string) error {
	srv := serviceReg.Get(name)
	if srv == nil {
		return nil
	}
	if err := srv.Close(); err != nil && !errors.Is(err, net.ErrClosed) && !errors.Is(err, http.ErrServerClosed) {
		return err
	}
	serviceReg.m.Delete(name)
	return nil
}
