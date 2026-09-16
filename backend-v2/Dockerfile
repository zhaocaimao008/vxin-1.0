FROM node:22-bookworm-slim

WORKDIR /app

COPY package*.json ./
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && npm ci --omit=dev \
    && apt-get purge -y --auto-remove python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY src ./src

EXPOSE 3002

CMD ["node", "src/server.js"]
