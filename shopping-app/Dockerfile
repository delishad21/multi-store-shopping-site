# ---- Build stage ----
FROM node:20-alpine AS build
WORKDIR /app

# Install deps
COPY package*.json ./
RUN npm ci

# Copy source
COPY . .

# Build-time envs (example: Apps Script URL)
ARG VITE_APPS_SCRIPT_URL
ENV VITE_APPS_SCRIPT_URL=${VITE_APPS_SCRIPT_URL}

# Build production bundle
RUN npm run build

# ---- Runtime stage (Nginx serving static files) ----
FROM nginx:1.27-alpine

# Copy built app into Nginx web root
COPY --from=build /app/dist /usr/share/nginx/html

# Nginx config:
# - SPA fallback (so client routes work)
# - Strong cache for /assets/
# - Light/short cache for /stores/*.json so edits show up quickly
# - Don’t aggressively cache other JSON by default
RUN printf '%s\n' \
  'server {' \
  '  listen 80;' \
  '  server_name _;' \
  '  root /usr/share/nginx/html;' \
  '  index index.html;' \
  '' \
  '  # App static assets from Vite' \
  '  location /assets/ {' \
  '    access_log off;' \
  '    expires 1y;' \
  '    add_header Cache-Control "public, max-age=31536000, immutable";' \
  '  }' \
  '' \
  '  # Runtime-editable content' \
  '  location ^~ /stores/ {' \
  '    default_type application/json;' \
  '    add_header Cache-Control "no-cache, max-age=30";' \
  '    try_files $uri =404;' \
  '  }' \
  '' \
  '  # Runtime-editable images' \
  '  location ^~ /img/ {' \
  '    access_log off;' \
  '    expires 1h;' \
  '    add_header Cache-Control "public, max-age=3600";' \
  '    try_files $uri =404;' \
  '  }' \
  '' \
  '  location / {' \
  '    try_files $uri $uri/ /index.html;' \
  '  }' \
  '}' \
  > /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
