FROM node:20-bookworm-slim

# Cài đặt Chromium, FFmpeg, fonts hỗ trợ tiếng Việt + Emoji, và công cụ build C++ cho better-sqlite3
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    ffmpeg \
    fonts-liberation \
    fonts-noto-color-emoji \
    fonts-dejavu-core \
    fontconfig \
    python3 \
    make \
    g++ \
    && fc-cache -f -v \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Biến môi trường hệ thống
ENV PORT=3000 \
    CHROME_PATH=/usr/bin/chromium \
    FFMPEG_PATH=/usr/bin/ffmpeg \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

# Copy package specs và cài đặt toàn bộ dependencies (kể cả devDependencies để build)
COPY package*.json ./
RUN npm install --include=dev

# Copy source code
COPY . .

# Tạo sẵn các thư mục data & upload nếu chưa có
RUN mkdir -p /app/data /app/public/images /app/public/videos /app/public/audio

# Build ứng dụng Next.js
RUN npm run build

# Thiết lập production mode sau khi đã build xong
ENV NODE_ENV=production

# Expose port Next.js
EXPOSE 3000

# Khởi chạy Next.js
CMD ["npm", "run", "start"]
