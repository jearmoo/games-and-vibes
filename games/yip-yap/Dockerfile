# Multi-stage build for Yip Yap
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
COPY games/yip-yap/shared/package.json games/yip-yap/shared/
COPY games/yip-yap/server/package.json games/yip-yap/server/
COPY games/yip-yap/client/package.json games/yip-yap/client/

RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# Copy source
COPY packages/ packages/
COPY games/yip-yap/ games/yip-yap/

# Build in dependency order
RUN pnpm --filter @games/server-core build
RUN pnpm --filter @games/yip-yap-shared build
RUN pnpm --filter @games/yip-yap-server build

ARG GA_MEASUREMENT_ID
ENV VITE_GA_ID=$GA_MEASUREMENT_ID
RUN pnpm --filter @games/yip-yap-client build

# Stage 2: Production
FROM node:20-alpine
ARG GIT_COMMIT=unknown
LABEL org.opencontainers.image.revision=$GIT_COMMIT
RUN npm install -g pnpm
WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/server-core/package.json packages/server-core/
COPY games/yip-yap/shared/package.json games/yip-yap/shared/
COPY games/yip-yap/server/package.json games/yip-yap/server/

RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --prod

# Copy built artifacts + wordbank (loaded at runtime from server/data/)
COPY --from=build /app/packages/server-core/dist packages/server-core/dist
COPY --from=build /app/games/yip-yap/shared/dist games/yip-yap/shared/dist
COPY --from=build /app/games/yip-yap/server/dist games/yip-yap/server/dist
COPY --from=build /app/games/yip-yap/server/data games/yip-yap/server/data
COPY --from=build /app/games/yip-yap/client/dist games/yip-yap/server/public

ENV NODE_ENV=production
ENV PORT=4070
EXPOSE 4070
WORKDIR /app/games/yip-yap/server
CMD ["node", "dist/index.js"]
