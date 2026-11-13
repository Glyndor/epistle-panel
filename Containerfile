# Two stages: a Node build that produces the Next.js standalone server, and a
# distroless Node runtime that carries only that server, its static assets and
# the `65532:65532` (nonroot) user. Every base is pinned by index digest, so a
# moved tag cannot change what is built.
#
# `podman build --platform=linux/amd64` and `--platform=linux/arm64` cross-build
# the same file; the bases are multi-architecture indexes.

# Bun is its own stage, so that the pin is a `FROM <image>:<tag>@sha256:...` line:
# that is the form Dependabot's docker ecosystem reads and moves. The tag names
# the Bun release; scripts/consistency/check-bun-version.sh compares it with the
# workflows, so a tag that moves without them is caught. The project builds
# with Bun but `next build` runs under Node, so the builder carries both.
FROM docker.io/oven/bun:1.4.4-debian@sha256:93d5032fe06d163427822dc1598f420363759bb18155c9cc90eb1be05a64a19e AS bun

# 24-trixie-slim. Node comes from this image, Bun is copied in from the stage above.
FROM docker.io/library/node@sha256:6418e1ff99a5db6608cd55a020036dde6b7d18df9a0b7e44209b4ef5891766fb AS builder
COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun

WORKDIR /build
ENV NEXT_TELEMETRY_DISABLED=1

# Dependencies first, so a source-only change reuses this layer.
# `--frozen-lockfile` rejects a lockfile that has drifted from package.json.
COPY internal/package.json internal/bun.lock ./
RUN bun install --frozen-lockfile

COPY internal/ ./
RUN bun run build

# The standalone output is self-contained: server.js plus the traced subset of
# node_modules it needs. `.next/static` is not part of it and is copied beside.
# nodejs24-debian13:nonroot, uid:gid 65532:65532, no shell. To inspect the tag:
#   podman manifest inspect gcr.io/distroless/nodejs24-debian13:nonroot
# Bump the digest deliberately.
FROM gcr.io/distroless/nodejs24-debian13@sha256:d1c8c1be703f1dca243457ac656e7eee7c571a7136a6e681d17c4294e6fe7a6d

# OCI labels. `--label=...` on the `podman build` command line overrides them,
# so a release job can stamp the actual git revision without editing this file.
ARG VERSION=0.0.0
ARG REVISION=unknown
LABEL org.opencontainers.image.source="https://github.com/Glyndor/epistle-panel"
LABEL org.opencontainers.image.version="${VERSION}"
LABEL org.opencontainers.image.revision="${REVISION}"
# `registry` tells podman-auto-update(1) to look up the latest tag from the
# registry and re-pull when it changes.
LABEL io.containers.autoupdate="registry"

WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# The panel's own port: never 80 or 443, so the service is identifiable. TLS is
# the operator's proxy, not the panel's.
ENV HOSTNAME=0.0.0.0
ENV PORT=7587

COPY --from=builder --chown=65532:65532 /build/.next/standalone ./
COPY --from=builder --chown=65532:65532 /build/.next/static ./.next/static

USER 65532:65532
EXPOSE 7587
# No HEALTHCHECK on purpose: the distroless runtime has no shell, curl or wget,
# and a check would need a second binary in the image. The orchestrator probes
# the port instead (a TCP connect to 7587, or an HTTP GET of /, the sign-in page,
# which is public and answers 200 without a session).
# The distroless Node image's entrypoint is `node`; the command is the script.
CMD ["server.js"]
