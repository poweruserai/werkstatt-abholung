# ── Stage 1: Bauen ─────────────────────────────────────────────
# Hier sind Python, make und g++ nötig um bcrypt und better-sqlite3
# zu kompilieren. Diese Tools bleiben NICHT im fertigen Image.
FROM node:20-alpine AS builder

RUN apk add --no-cache python3 make g++

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# ── Stage 2: Laufen ────────────────────────────────────────────
# Minimales Image – nur Node.js + die fertigen node_modules
FROM node:20-alpine

WORKDIR /app

# Nur die kompilierten node_modules aus Stage 1 übernehmen
COPY --from=builder /app/node_modules ./node_modules

# App-Code kopieren
COPY . .

RUN mkdir -p /data

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:3000/login',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "server.js"]
