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
RUN apk add --no-cache su-exec
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh && mkdir -p /data && chown node:node /data
EXPOSE 8000
# Hosted volumes (Render disk, Railway volume) mount as root: the entrypoint makes DATA_DIR writable, then
# runs the app as the unprivileged `node` user. Configuration comes from the environment — see .env.example.
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "dist/index.js"]
