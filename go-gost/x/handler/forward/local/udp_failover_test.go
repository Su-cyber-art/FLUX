package local

import (
	"context"
	"fmt"
	"net"
	"testing"
	"time"

	"github.com/go-gost/core/chain"
	"github.com/go-gost/core/handler"
	"github.com/go-gost/core/selector"
	xhop "github.com/go-gost/x/hop"
	xudp "github.com/go-gost/x/internal/net/udp"
	xlogger "github.com/go-gost/x/logger"
	xselector "github.com/go-gost/x/selector"
)

// startUDPEcho runs a UDP echo server and returns its address.
func startUDPEcho(t *testing.T) string {
	t.Helper()
	pc, err := net.ListenPacket("udp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen echo: %v", err)
	}
	t.Cleanup(func() { _ = pc.Close() })
	go func() {
		buf := make([]byte, 2048)
		for {
			n, addr, err := pc.ReadFrom(buf)
			if err != nil {
				return
			}
			_, _ = pc.WriteTo(buf[:n], addr)
		}
	}()
	return pc.LocalAddr().String()
}

// udpRoundTrip sends payload from a fresh client socket and waits for the echo.
func udpRoundTrip(t *testing.T, addr, payload string) {
	t.Helper()
	c, err := net.Dial("udp", addr)
	if err != nil {
		t.Fatalf("dial entry: %v", err)
	}
	defer c.Close()
	if _, err := c.Write([]byte(payload)); err != nil {
		t.Fatalf("write %q: %v", payload, err)
	}
	_ = c.SetReadDeadline(time.Now().Add(2 * time.Second))
	buf := make([]byte, 2048)
	n, err := c.Read(buf)
	if err != nil {
		t.Fatalf("read echo for %q: %v", payload, err)
	}
	if got := string(buf[:n]); got != payload {
		t.Fatalf("echo mismatch: got %q, want %q", got, payload)
	}
}

// serveUDPForward runs the forward handler behind a real UDP listener with the
// selector settings the panel uses (maxFails 1, failTimeout 600s) and a short
// idle TTL. It returns the entry address and a channel of Handle results.
func serveUDPForward(t *testing.T, strategy selector.Strategy[*chain.Node], targets []*chain.Node) (string, <-chan error) {
	t.Helper()
	h := NewHandler(
		handler.RouterOption(proxyProtocolTestRouter{}),
		handler.LoggerOption(xlogger.Nop()),
	)
	h.(handler.Forwarder).Forward(xhop.NewHop(
		xhop.NodeOption(targets...),
		xhop.SelectorOption(xselector.NewSelector(
			strategy,
			xselector.FailFilter[*chain.Node](1, 600*time.Second),
		)),
		xhop.LoggerOption(xlogger.Nop()),
	))
	if err := h.Init(nil); err != nil {
		t.Fatalf("init handler: %v", err)
	}

	pc, err := net.ListenPacket("udp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen entry: %v", err)
	}
	ln := xudp.NewListener(pc, &xudp.ListenConfig{
		Backlog:        8,
		ReadQueueSize:  8,
		ReadBufferSize: 2048,
		TTL:            100 * time.Millisecond,
		Keepalive:      true,
		Logger:         xlogger.Nop(),
	})
	t.Cleanup(func() { _ = ln.Close() })

	handled := make(chan error, 8)
	go func() {
		for {
			conn, err := ln.Accept()
			if err != nil {
				return
			}
			go func() { handled <- h.Handle(context.Background(), conn) }()
		}
	}()
	return ln.Addr().String(), handled
}

func waitHandled(t *testing.T, handled <-chan error, what string) error {
	t.Helper()
	select {
	case err := <-handled:
		return err
	case <-time.After(2 * time.Second):
		t.Fatalf("%s: handler did not return", what)
		return nil
	}
}

// Sessions that the UDP listener closes after its idle TTL are a normal end of
// a flow, not a target failure. Counting them as failures eventually filters
// out every target of a multi-target rule and new sessions fail with
// "node not available".
func TestUDPIdleSessionDoesNotMarkTargetFailed(t *testing.T) {
	targets := make([]*chain.Node, 0, 2)
	for i := 0; i < 2; i++ {
		targets = append(targets, chain.NewNode(fmt.Sprintf("node_%d", i+1), startUDPEcho(t)))
	}
	addr, handled := serveUDPForward(t, xselector.RoundRobinStrategy[*chain.Node](), targets)

	// Round robin sends one session to each target; both then idle out.
	for i := 0; i < len(targets); i++ {
		udpRoundTrip(t, addr, fmt.Sprintf("session-%d", i))
		if err := waitHandled(t, handled, fmt.Sprintf("session %d", i)); err != nil {
			t.Errorf("session %d: idle close reported as error: %v", i, err)
		}
	}

	for _, node := range targets {
		if count := node.Marker().Count(); count != 0 {
			t.Errorf("target %s marked failed %d time(s) after an idle close", node.Name, count)
		}
	}

	// New sessions must still be forwarded once earlier ones have idled out.
	udpRoundTrip(t, addr, "after-idle")
}

// A target that actively refuses datagrams is still a failure: it is marked
// and later sessions fail over to the healthy target.
func TestUDPRefusedTargetStillFailsOver(t *testing.T) {
	closed, err := net.ListenPacket("udp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("reserve closed port: %v", err)
	}
	deadAddr := closed.LocalAddr().String()
	_ = closed.Close()

	dead := chain.NewNode("dead", deadAddr)
	live := chain.NewNode("live", startUDPEcho(t))
	addr, handled := serveUDPForward(t, xselector.FIFOStrategy[*chain.Node](), []*chain.Node{dead, live})

	c, err := net.Dial("udp", addr)
	if err != nil {
		t.Fatalf("dial entry: %v", err)
	}
	if _, err := c.Write([]byte("to-dead")); err != nil {
		t.Fatalf("write: %v", err)
	}
	if err := waitHandled(t, handled, "session to refused target"); err == nil {
		t.Fatal("expected the refused target to end the session with an error")
	}
	_ = c.Close()

	if count := dead.Marker().Count(); count == 0 {
		t.Fatal("refused target was not marked failed")
	}
	udpRoundTrip(t, addr, "to-live")
}
