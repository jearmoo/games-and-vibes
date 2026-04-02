# Multi-stage build for Odes for Cave Men
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
COPY games/odes-for-cave-men/shared/package.json games/odes-for-cave-men/shared/
COPY games/odes-for-cave-men/server/package.json games/odes-for-cave-men/server/
COPY games/odes-for-cave-men/client/package.json games/odes-for-cave-men/client/

RUN pnpm install --frozen-lockfile

# Copy source
COPY packages/ packages/
COPY games/odes-for-cave-men/ games/odes-for-cave-men/

# Build in dependency order
RUN pnpm --filter @games/server-core build
RUN pnpm --filter @games/odes-for-cave-men-shared build
RUN pnpm --filter @games/odes-for-cave-men-server build

ARG GA_MEASUREMENT_ID
ENV VITE_GA_ID=$GA_MEASUREMENT_ID
RUN pnpm --filter @games/odes-for-cave-men-client build

# Stage 2: Production
FROM node:20-alpine
ARG GIT_COMMIT=unknown
LABEL org.opencontainers.image.revision=$GIT_COMMIT
RUN npm install -g pnpm
WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/server-core/package.json packages/server-core/
COPY games/odes-for-cave-men/shared/package.json games/odes-for-cave-men/shared/
COPY games/odes-for-cave-men/server/package.json games/odes-for-cave-men/server/

RUN pnpm install --frozen-lockfile --prod

# Copy built artifacts
COPY --from=build /app/packages/server-core/dist packages/server-core/dist
COPY --from=build /app/games/odes-for-cave-men/shared/dist games/odes-for-cave-men/shared/dist
COPY --from=build /app/games/odes-for-cave-men/server/dist games/odes-for-cave-men/server/dist
COPY --from=build /app/games/odes-for-cave-men/client/dist games/odes-for-cave-men/server/public

ENV NODE_ENV=production
ENV PORT=4060
EXPOSE 4060
WORKDIR /app/games/odes-for-cave-men/server
CMD ["node", "dist/index.js"]
