// Command devops-server is the HTTP entrypoint for the internal
// DevOps operator. It wires config → Coolify client → service → router
// with structured logging, panic recovery, and shared-secret auth.
package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/rshb/svoe-rodnoe-calendar/devops/internal/devops/client"
	"github.com/rshb/svoe-rodnoe-calendar/devops/internal/devops/config"
	"github.com/rshb/svoe-rodnoe-calendar/devops/internal/devops/handlers"
	"github.com/rshb/svoe-rodnoe-calendar/devops/internal/devops/middleware"
	"github.com/rshb/svoe-rodnoe-calendar/devops/internal/devops/services"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		// stderr only — slog isn't configured yet, and we don't want
		// to ship a half-initialised logger.
		_, _ = os.Stderr.WriteString("[devops] config error: " + err.Error() + "\n")
		os.Exit(2)
	}

	log := newLogger(cfg.LogLevel)
	log.Info("starting devops operator",
		slog.String("bind", cfg.BindAddr+":"+cfg.Port),
		slog.String("coolify_url", cfg.CoolifyURL),
		slog.Int("allowlist_size", len(cfg.AllowedApps)),
	)
	if len(cfg.AllowedApps) == 0 {
		log.Warn("DEVOPS_ALLOWED_APPS is empty — every deploy / status / logs / restart call will be rejected")
	}

	coolify := client.New(cfg.CoolifyURL, cfg.CoolifyToken, cfg.CoolifyTimeout, log)
	deploySvc := services.NewDeploy(cfg, coolify, log)

	gin.SetMode(gin.ReleaseMode)
	r := gin.New()
	r.Use(
		middleware.Recovery(log),
		middleware.RequestLogger(log),
	)
	handlers.Register(r, middleware.InternalAuth(cfg.InternalToken), &handlers.Deps{
		Deploy: deploySvc,
	})

	srv := &http.Server{
		Addr:              cfg.BindAddr + ":" + cfg.Port,
		Handler:           r,
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      60 * time.Second,
		IdleTimeout:       120 * time.Second,
	}

	// Graceful shutdown on SIGINT / SIGTERM.
	errCh := make(chan error, 1)
	go func() {
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			errCh <- err
		}
	}()

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)

	select {
	case err := <-errCh:
		log.Error("server error", slog.String("err", err.Error()))
		os.Exit(1)
	case sig := <-sigCh:
		log.Info("shutting down", slog.String("signal", sig.String()))
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()
		if err := srv.Shutdown(ctx); err != nil {
			log.Error("graceful shutdown failed", slog.String("err", err.Error()))
			os.Exit(1)
		}
	}
}

func newLogger(level string) *slog.Logger {
	var lvl slog.Level
	switch strings.ToLower(level) {
	case "debug":
		lvl = slog.LevelDebug
	case "warn":
		lvl = slog.LevelWarn
	case "error":
		lvl = slog.LevelError
	default:
		lvl = slog.LevelInfo
	}
	h := slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: lvl})
	return slog.New(h)
}
