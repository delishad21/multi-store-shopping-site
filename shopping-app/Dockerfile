# ---- Build stage ----
FROM node:20-alpine AS build
WORKDIR /app

# Install deps
COPY package*.json ./
RUN npm ci

# Copy source
COPY . .

# Optional: let us choose vite build mode (defaults to production)
ARG VITE_BUILD_MODE=production
ENV VITE_BUILD_MODE=${VITE_BUILD_MODE}

# Build production (or dev) bundle
# - If VITE_BUILD_MODE=production -> reads .env.production (VITE_USE_PROXY=true)
# - If VITE_BUILD_MODE=development -> reads .env.development (your direct GAS URL)
RUN npm run build -- --mode ${VITE_BUILD_MODE}

# ---- Runtime stage (Nginx serving static files) ----
FROM nginx:1.27-alpine

# Copy built app
COPY --from=build /app/dist /usr/share/nginx/html

# Static nginx for SPA + /stores/ caching rules
RUN printf '%s\n' \
  'server {' \
  '  listen 80;' \
  '  server_name _;' \
  '  root /usr/share/nginx/html;' \
  '  index index.html;' \
  '' \
  '  location /assets/ {' \
  '    access_log off;' \
  '    expires 1y;' \
  '    add_header Cache-Control "public, max-age=31536000, immutable";' \
  '  }' \
  '  location ^~ /stores/ {' \
  '    default_type application/json;' \
  '    add_header Cache-Control "no-cache, max-age=30";' \
  '    try_files $uri =404;' \
  '  }' \
  '  location ^~ /img/ {' \
  '    access_log off;' \
  '    expires 1h;' \
  '    add_header Cache-Control "public, max-age=3600";' \
  '    try_files $uri =404;' \
  '  }' \
  '  location / {' \
  '    try_files $uri $uri/ /index.html;' \
  '  }' \
  '}' \
  > /etc/nginx/conf.d/default.conf

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
