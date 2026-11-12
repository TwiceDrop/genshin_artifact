FROM node:24-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app/online-service
COPY online-service/package.json online-service/package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY online-service/src ./src
COPY online-service/migrations ./migrations
COPY online-service/static ./static
COPY server/hoyolab.mjs server/mys.mjs server/cookie.mjs server/device-fp.mjs server/usage-stats-features.mjs /app/server/
COPY server/vendor/twicedrop/mihoyo-api.mjs server/vendor/twicedrop/LICENSE /app/server/vendor/twicedrop/
COPY LICENSE /app/LICENSE
USER node
EXPOSE 8080
CMD ["node", "src/main.mjs"]
