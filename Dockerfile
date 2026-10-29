# Stage 1: Build
FROM oven/bun:1.4.4-alpine AS bun
FROM node:26-alpine AS builder

COPY --from=bun /usr/local/bin/bun /usr/local/bin/bunx /usr/local/bin/

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src

RUN bunx nest build

# Stage 2: Production
FROM node:26-alpine

WORKDIR /app

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY package.json bun.lock ./
COPY --from=bun /usr/local/bin/bun /usr/local/bin/bunx /usr/local/bin/
RUN bun install --frozen-lockfile --production

COPY --from=builder /app/dist ./dist

RUN chown -R appuser:appgroup /app

USER appuser

EXPOSE 3000

CMD ["node", "dist/main"]
