# Stage 1: Build Studio frontend
FROM node:20-alpine AS builder

WORKDIR /app/studio

# Copy package definition files
COPY studio/package*.json ./

# Fail with a clear message if studio/package.json does not contain a "build" script
RUN node -e "const pkg = require('./package.json'); if (!pkg.scripts || !pkg.scripts.build) { console.error('\n*** BUILD ERROR: studio/package.json does not contain a \"build\" script. ***\n'); process.exit(1); }"

# Copy studio source files and build
COPY studio/ ./

# Ensure clean build from source
RUN rm -rf node_modules dist && \
    npm ci && \
    npm run build -- --base=/studio/

# Stage 2: NGINX Web Gateway
FROM nginx:alpine

# Copy built studio distribution
COPY --from=builder /app/studio/dist /usr/share/nginx/html/studio

# Copy custom nginx configuration
COPY web/nginx.conf /etc/nginx/nginx.conf

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]

