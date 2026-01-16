FROM node:18-alpine

WORKDIR /app

# Install system dependencies for Puppeteer (WhatsApp Web)
# Note: google-chrome-stable is large, but necessary for reliable rendering
RUN apk add --no-cache \
    nodejs \
    yarn \
    git

# Optimized for pure API usage
ENV NODE_ENV=production

COPY package*.json ./
RUN npm install

COPY . .

# Build Client
WORKDIR /app/client
RUN npm install --include=dev
RUN npm run build
WORKDIR /app

EXPOSE 5000

# Optimize Node.js memory usage for 512MB container
ENV NODE_OPTIONS="--max-old-space-size=256"

CMD ["node", "src/server.js"]
