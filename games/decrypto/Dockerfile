# Multi-stage build for Decrypto
# Build context must be the monorepo root

# Stage 1: Install dependencies and build
FROM node:20-alpine AS build
RUN npm install -g pnpm
WORKDIR /app

# Copy workspace config
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./

# Copy all package.jsons for workspace resolution
COPY packages/server-core/package.json packages/server-core/
COPY packages/client-core/package.json packages/client-core/
COPY packages/test-utils/package.json packages/test-utils/
COPY games/decrypto/shared/package.json games/decrypto/shared/
COPY games/decrypto/server/package.json games/decrypto/server/
COPY games/decrypto/client/package.json games/decrypto/client/

RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# Copy source
COPY packages/ packages/
COPY games/decrypto/ games/decrypto/

# Build in dependency order
RUN pnpm --filter @games/server-core build
RUN pnpm --filter @games/decrypto-shared build
RUN pnpm --filter @games/decrypto-server build

ARG GA_MEASUREMENT_ID
ENV VITE_GA_ID=$GA_MEASUREMENT_ID
RUN pnpm --filter @games/decrypto-client build

# Stage 2: Production
FROM node:20-alpine
ARG GIT_COMMIT=unknown
LABEL org.opencontainers.image.revision=$GIT_COMMIT
RUN npm install -g pnpm
WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/server-core/package.json packages/server-core/
COPY games/decrypto/shared/package.json games/decrypto/shared/
COPY games/decrypto/server/package.json games/decrypto/server/

RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --prod

# Copy built artifacts
COPY --from=build /app/packages/server-core/dist packages/server-core/dist
COPY --from=build /app/games/decrypto/shared/dist games/decrypto/shared/dist
COPY --from=build /app/games/decrypto/server/dist games/decrypto/server/dist
COPY --from=build /app/games/decrypto/client/dist games/decrypto/server/public

ENV NODE_ENV=production
ENV PORT=4090
EXPOSE 4090
WORKDIR /app/games/decrypto/server
CMD ["node", "dist/index.js"]
