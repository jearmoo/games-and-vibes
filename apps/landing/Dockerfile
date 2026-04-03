# Multi-stage build for landing page
# Build context must be the monorepo root (~/games/)
# Landing page is a static SPA served by a simple Node server

FROM node:20-alpine AS build
RUN npm install -g pnpm
WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY packages/client-core/package.json packages/client-core/
COPY apps/landing/package.json apps/landing/

RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

COPY packages/client-core/ packages/client-core/
COPY apps/landing/ apps/landing/

ARG GA_MEASUREMENT_ID
ENV VITE_GA_ID=$GA_MEASUREMENT_ID
RUN pnpm --filter @games/landing build

# Stage 2: Serve with lightweight static server
FROM node:20-alpine
ARG GIT_COMMIT=unknown
LABEL org.opencontainers.image.revision=$GIT_COMMIT
RUN --mount=type=cache,target=/root/.npm \
    npm install -g serve
COPY --from=build /app/apps/landing/dist /app/dist

ENV PORT=3000
EXPOSE 3000
CMD ["serve", "-s", "/app/dist", "-l", "3000"]
