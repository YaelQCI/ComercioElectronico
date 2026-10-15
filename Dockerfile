FROM node:24.12.0-bookworm-slim AS tools
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY . .
RUN npm run postinstall

FROM tools AS build
RUN npm run build

FROM node:24.12.0-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production NITRO_HOST=0.0.0.0 NITRO_PORT=3000
COPY --from=build --chown=node:node /app/.output ./.output
RUN mkdir -p /app/catalog-uploads && chown node:node /app/catalog-uploads
USER node
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
