FROM oven/bun:1.3.11-alpine AS build

WORKDIR /app

COPY package.json bun.lock tsconfig.json ./
RUN bun install --frozen-lockfile

COPY src ./src
COPY scripts ./scripts
COPY mcp-bridge-plugin ./mcp-bridge-plugin

RUN bun run build

FROM oven/bun:1.3.11-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

COPY --from=build /app/dist ./dist

EXPOSE 3000

CMD ["bun", "dist/index.js", "start"]
