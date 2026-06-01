# Multi-stage build for Two Rooms and a Boom
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
COPY games/two-rooms-and-a-boom/shared/package.json games/two-rooms-and-a-boom/shared/
COPY games/two-rooms-and-a-boom/server/package.json games/two-rooms-and-a-boom/server/
COPY games/two-rooms-and-a-boom/client/package.json games/two-rooms-and-a-boom/client/

RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# Copy source
COPY packages/ packages/
COPY games/two-rooms-and-a-boom/ games/two-rooms-and-a-boom/

# Build in dependency order
RUN pnpm --filter @games/server-core build
RUN pnpm --filter @games/two-rooms-and-a-boom-shared build
RUN pnpm --filter @games/two-rooms-and-a-boom-server build

ARG GA_MEASUREMENT_ID
ENV VITE_GA_ID=$GA_MEASUREMENT_ID
RUN pnpm --filter @games/two-rooms-and-a-boom-client build

# Stage 2: Production
FROM node:20-alpine
ARG GIT_COMMIT=unknown
LABEL org.opencontainers.image.revision=$GIT_COMMIT
RUN npm install -g pnpm
WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/server-core/package.json packages/server-core/
COPY games/two-rooms-and-a-boom/shared/package.json games/two-rooms-and-a-boom/shared/
COPY games/two-rooms-and-a-boom/server/package.json games/two-rooms-and-a-boom/server/

RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --prod

# Copy built artifacts
COPY --from=build /app/packages/server-core/dist packages/server-core/dist
COPY --from=build /app/games/two-rooms-and-a-boom/shared/dist games/two-rooms-and-a-boom/shared/dist
COPY --from=build /app/games/two-rooms-and-a-boom/server/dist games/two-rooms-and-a-boom/server/dist
COPY --from=build /app/games/two-rooms-and-a-boom/client/dist games/two-rooms-and-a-boom/server/public

ENV NODE_ENV=production
ENV PORT=4080
EXPOSE 4080
WORKDIR /app/games/two-rooms-and-a-boom/server
CMD ["node", "dist/index.js"]
