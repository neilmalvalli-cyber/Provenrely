# Provenrely API. Build from the backend/ folder:  docker build -t provenrely-api .
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

FROM node:22-alpine
ENV NODE_ENV=production PORT=8000 DATA_DIR=/data
WORKDIR /app
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME ["/data"]
EXPOSE 8000
# Configuration (REGISTRY_ADDRESS, RELAYER_PK, CORS_ORIGIN, …) comes from the environment at run time — see .env.example
CMD ["node", "dist/index.js"]
