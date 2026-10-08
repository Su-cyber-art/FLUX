package main

import (
	"context"
	"errors"
	"net"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/go-gost/core/auth"
	"github.com/go-gost/core/logger"
	"github.com/go-gost/core/service"
	api_service "github.com/go-gost/x/api/service"
	xauth "github.com/go-gost/x/auth"
	"github.com/go-gost/x/config"
	"github.com/go-gost/x/config/loader"
	auth_parser "github.com/go-gost/x/config/parsing/auth"
	"github.com/go-gost/x/config/parsing/parser"
	xmetrics "github.com/go-gost/x/metrics"
	metrics "github.com/go-gost/x/metrics/service"
	"github.com/go-gost/x/registry"
	xservice "github.com/go-gost/x/service"
	"github.com/go-gost/x/socket"
	"github.com/judwhite/go-svc"
)

type reporter interface {
	Stop()
}

type program struct {
	startReporter     func() reporter
	reporter          reporter
	srvApi            service.Service
	srvMetrics        service.Service
	srvProfiling      *http.Server
	profilingListener net.Listener

	cancel   context.CancelFunc
	stopped  bool
	retiring bool
}

func (p *program) Init(env svc.Environment) error {
	parser.Init(parser.Args{
		CfgFile:     cfgFile,
		Services:    services,
		Nodes:       nodes,
		Debug:       debug,
		Trace:       trace,
		ApiAddr:     apiAddr,
		MetricsAddr: metricsAddr,
	})

	return nil
}

func (p *program) Start() (err error) {
	unlock := config.LockMutation()
	defer unlock()
	p.stopped = false
	defer func() {
		if err != nil {
			p.stopRuntime()
		}
	}()
	cfg := &config.Config{}
	if _, statErr := os.Stat(".retiring"); statErr == nil {
		p.retiring = true
		config.DisablePersist()
	} else {
		cfg, err = parser.Parse()
		if err != nil {
			return err
		}
	}

	if outputFormat != "" {
		if err := cfg.Write(os.Stdout, outputFormat); err != nil {
			return err
		}
		os.Exit(0)
	}

	if err := loader.Load(cfg); err != nil {
		return err
	}

	if err := p.run(cfg); err != nil {
		return err
	}

	config.Set(cfg)
	if !p.retiring {
		socket.EnableConfigPersist()
	}

	ctx, cancel := context.WithCancel(context.Background())
	p.cancel = cancel
	c := make(chan os.Signal, 1)
	signal.Notify(c, syscall.SIGHUP)
	go p.reload(ctx, c)

	// A connected panel may immediately send commands. Only expose the agent
	// after initial config loading, runtime startup and persistence are ready.
	if p.startReporter != nil {
		p.reporter = p.startReporter()
	}

	go func() {
		select {
		case <-time.After(10 * time.Second):
			xservice.StartConfigReporter(ctx)
		case <-ctx.Done():
			return
		}
	}()

	return nil
}

// retire is called by the serialized RetireNode command while LockMutation is held.
// Keep the reporter alive until the panel acknowledges the completed cleanup.
func (p *program) retire() error {
	p.retiring = true
	config.DisablePersist()
	if p.cancel != nil {
		p.cancel()
	}
	if err := p.stopRuntime(); err != nil {
		return err
	}
	config.Set(&config.Config{})
	return loader.Load(&config.Config{})
}

func (p *program) run(cfg *config.Config) (err error) {
	defer func() {
		if err != nil {
			// Auxiliary listeners may occupy ports required by the rollback config.
			// Release all resources opened by this attempt before rebuilding it.
			p.stopRuntime()
		}
	}()
	for _, svc := range registry.ServiceRegistry().GetAll() {
		svc := svc
		go func() {
			svc.Serve()
		}()
	}

	if p.srvApi != nil {
		p.srvApi.Close()
		p.srvApi = nil
	}
	if cfg.API != nil {
		s, err := buildApiService(cfg.API)
		if err != nil {
			return err
		}

		p.srvApi = s

		go func() {
			defer s.Close()

			log := logger.Default().WithFields(map[string]any{"kind": "service", "service": "@api"})

			log.Info("listening on ", s.Addr())
			if err := s.Serve(); !errors.Is(err, http.ErrServerClosed) {
				log.Error(err)
			}
		}()
	}

	xmetrics.Enable(false)
	if p.srvMetrics != nil {
		p.srvMetrics.Close()
		p.srvMetrics = nil
	}
	if cfg.Metrics != nil && cfg.Metrics.Addr != "" {
		s, err := buildMetricsService(cfg.Metrics)
		if err != nil {
			return err
		}

		p.srvMetrics = s

		xmetrics.Enable(true)

		go func() {
			defer s.Close()

			log := logger.Default().WithFields(map[string]any{"kind": "service", "service": "@metrics"})

			log.Info("listening on ", s.Addr())
			if err := s.Serve(); !errors.Is(err, http.ErrServerClosed) {
				log.Error(err)
			}
		}()
	}

	if p.srvProfiling != nil {
		p.srvProfiling.Close()
		if p.profilingListener != nil {
			p.profilingListener.Close()
			p.profilingListener = nil
		}
		p.srvProfiling = nil
	}
	if cfg.Profiling != nil {
		addr := cfg.Profiling.Addr
		if addr == "" {
			addr = ":6060"
		}
		s := &http.Server{
			Addr: addr,
		}
		ln, err := net.Listen("tcp", addr)
		if err != nil {
			return err
		}
		p.srvProfiling = s
		p.profilingListener = ln

		go func() {
			defer s.Close()

			log := logger.Default().WithFields(map[string]any{"kind": "service", "service": "@profiling"})

			log.Info("listening on ", addr)
			if err := s.Serve(ln); !errors.Is(err, http.ErrServerClosed) {
				log.Error(err)
			}
		}()
	}

	return nil
}

func (p *program) Stop() error {
	if p.cancel != nil {
		p.cancel()
	}

	if p.reporter != nil {
		p.reporter.Stop()
	}
	unlock := config.LockMutation()
	defer unlock()
	p.stopped = true
	return p.stopRuntime()
}

func (p *program) stopRuntime() error {
	var failures []error
	closed := func(err error) {
		if err != nil && !errors.Is(err, net.ErrClosed) && !errors.Is(err, http.ErrServerClosed) {
			failures = append(failures, err)
		}
	}
	for name := range registry.ServiceRegistry().GetAll() {
		closed(registry.UnregisterService(name))
		logger.Default().Debugf("service %s shutdown", name)
	}

	if p.srvApi != nil {
		closed(p.srvApi.Close())
		p.srvApi = nil
		logger.Default().Debug("service @api shutdown")
	}
	if p.srvMetrics != nil {
		closed(p.srvMetrics.Close())
		p.srvMetrics = nil
		logger.Default().Debug("service @metrics shutdown")
	}
	if p.srvProfiling != nil {
		closed(p.srvProfiling.Close())
		if p.profilingListener != nil {
			closed(p.profilingListener.Close())
			p.profilingListener = nil
		}
		p.srvProfiling = nil
		logger.Default().Debug("service @profiling shutdown")
	}
	return errors.Join(failures...)
}

func (p *program) reload(ctx context.Context, c chan os.Signal) {
	defer signal.Stop(c)

	for {
		select {
		case <-c:
			if err := p.reloadConfig(); err != nil {
				logger.Default().Error(err)
			} else {
				logger.Default().Info("config reloaded")
			}

		case <-ctx.Done():
			return
		}
	}
}

func (p *program) reloadConfig() error {
	unlock := config.LockMutation()
	defer unlock()
	if p.stopped {
		return errors.New("agent is shutting down")
	}
	if p.retiring {
		return errors.New("节点正在删除")
	}
	cfg, err := parser.Parse()
	if err != nil {
		return err
	}
	if err := loader.Reload(cfg, p.run); err != nil {
		return err
	}
	activeServices := make(map[string]struct{}, len(cfg.Services))
	for _, svc := range cfg.Services {
		if svc != nil {
			activeServices[svc.Name] = struct{}{}
		}
	}
	xservice.GetGlobalTrafficManager().RetainServices(activeServices)

	return nil
}

func buildApiService(cfg *config.APIConfig) (service.Service, error) {
	var authers []auth.Authenticator
	if auther := auth_parser.ParseAutherFromAuth(cfg.Auth); auther != nil {
		authers = append(authers, auther)
	}
	if cfg.Auther != "" {
		authers = append(authers, registry.AutherRegistry().Get(cfg.Auther))
	}

	var auther auth.Authenticator
	if len(authers) > 0 {
		auther = xauth.AuthenticatorGroup(authers...)
	}

	network := "tcp"
	addr := cfg.Addr
	if strings.HasPrefix(addr, "unix://") {
		network = "unix"
		addr = strings.TrimPrefix(addr, "unix://")
	}
	return api_service.NewService(
		network, addr,
		api_service.PathPrefixOption(cfg.PathPrefix),
		api_service.AccessLogOption(cfg.AccessLog),
		api_service.AutherOption(auther),
	)
}

func buildMetricsService(cfg *config.MetricsConfig) (service.Service, error) {
	auther := auth_parser.ParseAutherFromAuth(cfg.Auth)
	if cfg.Auther != "" {
		auther = registry.AutherRegistry().Get(cfg.Auther)
	}

	network := "tcp"
	addr := cfg.Addr
	if strings.HasPrefix(addr, "unix://") {
		network = "unix"
		addr = strings.TrimPrefix(addr, "unix://")
	}
	return metrics.NewService(
		network, addr,
		metrics.PathOption(cfg.Path),
		metrics.AutherOption(auther),
	)
}
