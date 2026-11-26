FROM node:24-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app/online-service
COPY online-service/package.json online-service/package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY online-service/src ./src
COPY online-service/migrations ./migrations
COPY online-service/static ./static
COPY server/usage-stats-features.mjs server/usage-stats-characters.mjs /app/server/
COPY beta-data/axis-format.mjs beta-data/shared-axis.mjs /app/beta-data/
COPY LICENSE /app/LICENSE
USER node
EXPOSE 8080
CMD ["node", "src/main.mjs"]
