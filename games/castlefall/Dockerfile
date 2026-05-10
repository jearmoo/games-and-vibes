# Multi-stage build for Castlefall
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
COPY games/castlefall/shared/package.json games/castlefall/shared/
COPY games/castlefall/server/package.json games/castlefall/server/
COPY games/castlefall/client/package.json games/castlefall/client/

RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# Copy source
COPY packages/ packages/
COPY games/castlefall/ games/castlefall/

# Build in dependency order
RUN pnpm --filter @games/server-core build
RUN pnpm --filter @games/castlefall-shared build
RUN pnpm --filter @games/castlefall-server build

ARG GA_MEASUREMENT_ID
ENV VITE_GA_ID=$GA_MEASUREMENT_ID
RUN pnpm --filter @games/castlefall-client build

# Stage 2: Production
FROM node:20-alpine
ARG GIT_COMMIT=unknown
LABEL org.opencontainers.image.revision=$GIT_COMMIT
RUN npm install -g pnpm
WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/server-core/package.json packages/server-core/
COPY games/castlefall/shared/package.json games/castlefall/shared/
COPY games/castlefall/server/package.json games/castlefall/server/

RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --prod

# Copy built artifacts + wordbank (loaded at runtime from server/data/)
COPY --from=build /app/packages/server-core/dist packages/server-core/dist
COPY --from=build /app/games/castlefall/shared/dist games/castlefall/shared/dist
COPY --from=build /app/games/castlefall/server/dist games/castlefall/server/dist
COPY --from=build /app/games/castlefall/server/data games/castlefall/server/data
COPY --from=build /app/games/castlefall/client/dist games/castlefall/server/public

ENV NODE_ENV=production
ENV PORT=4070
EXPOSE 4070
WORKDIR /app/games/castlefall/server
CMD ["node", "dist/index.js"]
