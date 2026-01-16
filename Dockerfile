FROM node:18-alpine

WORKDIR /app

# Install system dependencies for Puppeteer (WhatsApp Web)
# Note: google-chrome-stable is large, but necessary for reliable rendering
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    nodejs \
    yarn \
    git

# Tell Puppeteer to skip installing Chrome. We'll be using the installed package.
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

COPY package*.json ./
RUN npm install

COPY . .

# Build Client
WORKDIR /app/client
RUN npm install
RUN npm run build
WORKDIR /app

EXPOSE 5000

# Optimize Node.js memory usage for 512MB container
ENV NODE_OPTIONS="--max-old-space-size=256"

CMD ["node", "src/server.js"]
