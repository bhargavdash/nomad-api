# ── Stage 1: Build ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

ENV HUSKY=0

# Install dependencies first (layer-cached until package.json changes)
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci

# Generate Prisma client
RUN npx prisma generate

# Compile TypeScript
COPY tsconfig.json ./
COPY src ./src/
RUN npm run build

# ── Stage 2: Production ──────────────────────────────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app

ENV HUSKY=0

# Install production deps only
COPY package*.json ./
COPY prisma ./prisma/
RUN npm pkg delete scripts.prepare && npm ci --omit=dev

# Re-generate Prisma client against the production node_modules
RUN npx prisma generate

# Copy compiled output from builder
COPY --from=builder /app/dist ./dist/

# Copy entrypoint
COPY start.sh ./start.sh
RUN chmod +x ./start.sh

EXPOSE 3000

ENTRYPOINT ["./start.sh"]
