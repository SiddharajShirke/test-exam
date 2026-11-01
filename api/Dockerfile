# ─── Stage 1: Build ───────────────────────────────────────────────────────────
FROM node:20-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

# ─── Stage 2: Runtime ─────────────────────────────────────────────────────────
FROM node:20-slim AS runtime

# OCI labels
ARG GIT_SHA=unknown
LABEL org.opencontainers.image.revision="${GIT_SHA}"
LABEL org.opencontainers.image.title="assess-api"
LABEL org.opencontainers.image.description="AI Candidate Assessment Platform API"

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080
ENV GIT_SHA=${GIT_SHA}

# Install only production dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy built JS and SQL migration files
COPY --from=build /app/dist ./dist
COPY src/migrations ./src/migrations

# Run as non-root user
RUN addgroup --system appgroup && adduser --system --ingroup appgroup appuser
USER appuser

EXPOSE 8080

CMD ["node", "dist/server.js"]

