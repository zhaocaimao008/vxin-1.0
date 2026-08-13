FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN apk add --no-cache vips-dev fftw-dev build-base python3 \
    && addgroup -S vxin && adduser -S vxin -G vxin

COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts \
    && npm rebuild sharp \
    && npm cache clean --force

COPY --from=builder /app/dist ./dist

RUN mkdir -p uploads && chown -R vxin:vxin /app
USER vxin

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s \
  CMD wget -qO- http://localhost:3000/api/v1/health || exit 1

CMD ["node", "dist/main"]
