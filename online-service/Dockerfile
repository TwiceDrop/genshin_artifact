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
COPY beta-data/buff-rule-registry.mjs beta-data/buff-rule-schema.mjs beta-data/character-elements.mjs beta-data/direct-reaction-scope.mjs beta-data/dsl-segment-source.mjs beta-data/dsl-segment-target.mjs beta-data/dsl-tokens.mjs beta-data/effect-rule-engine.mjs beta-data/traveler-model.mjs beta-data/dsl-skill-names.json /app/beta-data/
COPY src/algorithms/dsl-generator.mjs src/algorithms/dsl-library.mjs src/algorithms/reaction-labels.mjs /app/src/algorithms/
COPY src/assets/_gen_character.js src/assets/_gen_weapon.js src/assets/_gen_buff.js /app/src/assets/
COPY src/import/character-summary.mjs src/import/character-talents.mjs /app/src/import/
COPY LICENSE /app/LICENSE
USER node
EXPOSE 8080
CMD ["node", "src/main.mjs"]
