# Two stages: a Node build that produces the Next.js standalone server, and a
# distroless Node runtime that carries only that server, its static assets and
# the `65532:65532` (nonroot) user. Every base is pinned by index digest, so a
# moved tag cannot change what is built.
#
# `podman build --platform=linux/amd64` and `--platform=linux/arm64` cross-build
# the same file; the bases are multi-architecture indexes.

# 24-trixie-slim. The project builds with Bun but `next build` runs under Node,
# so the builder carries both: Node from this image, Bun copied from the next one.
FROM docker.io/library/node@sha256:6418e1ff99a5db6608cd55a020036dde6b7d18df9a0b7e44209b4ef5891766fb AS builder
# 1.4.4-debian. Same Bun release as the lockfile was written with.
COPY --from=docker.io/oven/bun@sha256:93d5032fe06d163427822dc1598f420363759bb18155c9cc90eb1be05a64a19e /usr/local/bin/bun /usr/local/bin/bun

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
FROM gcr.io/distroless/nodejs24-debian13@sha256:088a01637f22908632ba09018be2e0b516f2fa6f7869c191d29491139db43c78

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
# The distroless Node image's entrypoint is `node`; the command is the script.
CMD ["server.js"]
