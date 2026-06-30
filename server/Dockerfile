# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /build

# Build tools needed to compile bcrypt native bindings
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ── Stage 2: Production ───────────────────────────────────────────────────────
FROM node:22-alpine AS production
WORKDIR /app
ENV NODE_ENV=production

# Need build tools again to compile bcrypt in the clean stage
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci --omit=dev

# Remove build tools after native modules are compiled (saves ~60 MB)
RUN apk del python3 make g++

# Copy compiled JS from builder — no TypeScript compiler in final image
COPY --from=builder /build/dist ./dist

EXPOSE 3000
CMD ["node", "dist/index.js"]
