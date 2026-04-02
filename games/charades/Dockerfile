# Multi-stage build for Charades
# Build context must be the monorepo root

# Stage 1: Install dependencies and build
FROM node:20-alpine AS build
RUN npm install -g pnpm
WORKDIR /app

# Copy workspace config
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./

# Copy all package.jsons for workspace resolution
COPY packages/word-providers/package.json packages/word-providers/
COPY packages/client-core/package.json packages/client-core/
COPY games/charades/server/package.json games/charades/server/
COPY games/charades/client/package.json games/charades/client/

RUN pnpm install --frozen-lockfile

# Copy source
COPY packages/ packages/
COPY games/charades/ games/charades/

# Build in dependency order
RUN pnpm --filter @games/word-providers build
RUN pnpm --filter @games/charades-server build
RUN pnpm --filter @games/charades-client build

# Stage 2: Production
FROM node:20-alpine
ARG GIT_COMMIT=unknown
LABEL org.opencontainers.image.revision=$GIT_COMMIT
RUN npm install -g pnpm
WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/word-providers/package.json packages/word-providers/
COPY games/charades/server/package.json games/charades/server/

RUN pnpm install --frozen-lockfile --prod

# Copy built artifacts
COPY --from=build /app/packages/word-providers/dist packages/word-providers/dist
COPY --from=build /app/games/charades/server/dist games/charades/server/dist
COPY --from=build /app/games/charades/client/dist games/charades/server/public

ENV NODE_ENV=production
ENV PORT=4050
EXPOSE 4050
WORKDIR /app/games/charades/server
CMD ["node", "dist/index.js"]
