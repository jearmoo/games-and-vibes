# Multi-stage build for Adversarial Taboo
# Build context must be the monorepo root (~/games/)

# Stage 1: Install dependencies and build
FROM node:20-alpine AS build
RUN npm install -g pnpm
WORKDIR /app

# Copy workspace config
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./

# Copy all package.jsons for workspace resolution
COPY packages/shared-types/package.json packages/shared-types/
COPY packages/server-core/package.json packages/server-core/
COPY packages/client-core/package.json packages/client-core/
COPY games/adtaboo/shared/package.json games/adtaboo/shared/
COPY games/adtaboo/server/package.json games/adtaboo/server/
COPY games/adtaboo/client/package.json games/adtaboo/client/

RUN pnpm install --frozen-lockfile

# Copy source
COPY packages/ packages/
COPY games/adtaboo/ games/adtaboo/

# Build shared packages first, then taboo
RUN pnpm --filter @games/shared-types build
RUN pnpm --filter @games/adtaboo-shared build
RUN pnpm --filter @games/server-core build
RUN pnpm --filter @games/adtaboo-server build

ARG GA_MEASUREMENT_ID
ENV VITE_GA_ID=$GA_MEASUREMENT_ID
RUN pnpm --filter @games/adtaboo-client build

# Stage 2: Production
FROM node:20-alpine
ARG GIT_COMMIT=unknown
LABEL org.opencontainers.image.revision=$GIT_COMMIT
RUN npm install -g pnpm
WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/shared-types/package.json packages/shared-types/
COPY packages/server-core/package.json packages/server-core/
COPY games/adtaboo/shared/package.json games/adtaboo/shared/
COPY games/adtaboo/server/package.json games/adtaboo/server/

RUN pnpm install --frozen-lockfile --prod

# Copy built artifacts
COPY --from=build /app/packages/shared-types/dist packages/shared-types/dist
COPY --from=build /app/games/adtaboo/shared/dist games/adtaboo/shared/dist
COPY --from=build /app/packages/server-core/dist packages/server-core/dist
COPY --from=build /app/games/adtaboo/server/dist games/adtaboo/server/dist
COPY --from=build /app/games/adtaboo/client/dist games/adtaboo/server/public

ENV NODE_ENV=production
ENV PORT=4040
EXPOSE 4040
WORKDIR /app/games/adtaboo/server
CMD ["node", "dist/index.js"]
