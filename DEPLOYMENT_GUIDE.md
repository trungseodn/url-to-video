# Hướng Dẫn Deploy ZTTeam URL Fetcher & Video Studio Lên VPS Ubuntu/Debian

Hệ thống bao gồm các thành phần đặc thù:
- **Next.js 16 (App Router)**
- **Better-SQLite3** (Native C++ Addon)
- **Headless Chromium** (Render thẻ Card Breaking News)
- **FFmpeg** (Ghép ảnh slideshow, tạo hiệu ứng tuyết rơi, lồng nhạc nền MP4)

---

## 🖥️ 1. Yêu Cầu Cấu Hình VPS Khuyên Dùng

| Thông số | Tối thiểu (Minimum) | Đề xuất (Recommended) |
| :--- | :--- | :--- |
| **Hệ điều hành** | Ubuntu 22.04 LTS / 24.04 LTS | Ubuntu 22.04 LTS / 24.04 LTS |
| **CPU** | 2 Core | 2 - 4 Core |
| **RAM** | 2 GB (+ 2GB Swap) | 4 GB - 8 GB RAM |
| **Ổ cứng (SSD)** | 25 GB SSD | 40 GB+ NVMe SSD |

> ⚠️ **Lưu ý quan trọng về RAM**: FFmpeg và Chromium khi render video 1080p cần bộ nhớ tạm thời. Nếu VPS chỉ có 2GB RAM, **bắt buộc phải tạo thêm 2GB - 4GB Swap RAM** để tránh bị hệ thống Kill do tràn RAM (Out-Of-Memory).

---

## 🚀 PHƯƠNG ÁN 1: Triển Khai Bằng Docker & Docker Compose (Khuyên Dùng ⭐⭐⭐⭐⭐)

Đây là phương án **tốt nhất, chuẩn hóa và ít lỗi nhất** vì container Docker đã đóng gói sẵn Chromium, FFmpeg, các thư viện Font và build C++ cho `better-sqlite3`.

### Bước 1. Cài đặt Docker & Docker Compose trên VPS
Chạy các lệnh sau trên terminal VPS:
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git ufw

# Cài Docker chính thức
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Cài Docker Compose plugin
sudo apt install -y docker-compose-plugin
```

### Bước 2. Bật Swap RAM (Rất quan trọng nếu VPS 2GB RAM)
```bash
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### Bước 3. Tải Code lên VPS
```bash
cd /var/www
# Cách 1: Git clone nếu bạn có repo
git clone https://github.com/Devzota/ztteam-url-fetcher.git
cd ztteam-url-fetcher

# Hoặc Cách 2: Upload source code trực tiếp qua SCP / SFTP / MobaXterm
```

### Bước 4. Thiết lập biến môi trường `.env`
Tạo file `.env`:
```bash
nano .env
```
Nội dung file `.env`:
```env
PORT=3000
NODE_ENV=production
NEXT_PUBLIC_GEMINI_API_KEY=your_gemini_api_key_here

# WordPress Default Site (Nếu dùng)
WP_SITE_URL=https://news.example.com/
WP_USERNAME=your_username
WP_APP_PASSWORD=your_app_password

# Đã map sẵn trong Docker
CHROME_PATH=/usr/bin/chromium
FFMPEG_PATH=/usr/bin/ffmpeg
DB_PATH=/app/data/ztteam-pipeline.db
```
Nhấn `Ctrl + O` -> `Enter` để lưu, `Ctrl + X` để thoát.

### Bước 5. Khởi chạy với Docker Compose
```bash
# Build và chạy ngầm container
docker compose up -d --build

# Xem log tiến trình chạy
docker compose logs -f
```
Ứng dụng sẽ hoạt động tại cổng `http://<IP_VPS>:3000`.

---

## 🛠️ PHƯƠNG ÁN 2: Triển Khai Trực Tiếp Bằng PM2 + Nginx (Không Dùng Docker)

Dành cho bạn nếu muốn chạy trực tiếp trên hệ thống Ubuntu VPS.

### Bước 1. Cài đặt Node.js 20 LTS và các công cụ biên dịch
```bash
sudo apt update && sudo apt install -y curl git build-essential python3 make g++

# Cài Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Cài PM2 toàn cục
sudo npm install -g pm2
```

### Bước 2. Cài đặt Chromium, FFmpeg và Fonts hệ thống
```bash
sudo apt install -y chromium-browser ffmpeg fonts-liberation fonts-dejavu-core fonts-noto-color-emoji fontconfig
sudo fc-cache -f -v
```

### Bước 3. Cài đặt project & build Next.js
```bash
cd /var/www/ztteam-url-fetcher
npm install
npm run build
```

### Bước 4. Chạy ứng dụng bằng PM2
```bash
pm2 start npm --name "ztteam-pipeline" -- start
pm2 save
pm2 startup
```

---

## 🌐 3. Cấu Hình Nginx Reverse Proxy & Tên Miền (Domain + SSL)

Để truy cập web qua domain chính (ví dụ: `https://studio.domain.com`) thay vì qua port `3000`:

### Bước 1. Cài đặt Nginx & Certbot
```bash
sudo apt install -y nginx certbot python3-certbot-nginx
```

### Bước 2. Tạo file cấu hình Nginx
```bash
sudo nano /etc/nginx/sites-available/ztteam.conf
```

Dán cấu hình sau (thay `studio.yourdomain.com` thành tên miền của bạn):
```nginx
server {
    listen 80;
    server_name studio.yourdomain.com;

    # Tăng dung lượng upload tối đa cho ảnh & video (Quan trọng!)
    client_max_body_size 100M;

    # Tăng timeout cho tiến trình render video dài
    proxy_read_timeout 300s;
    proxy_connect_timeout 300s;
    proxy_send_timeout 300s;

    location / {
        proxy_pass http://127.0.0.1:3005;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Bước 3. Kích hoạt cấu hình và cấp chứng chỉ SSL miễn phí
```bash
sudo ln -s /etc/nginx/sites-available/ztteam.conf /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# Cấp SSL HTTPS tự động
sudo certbot --nginx -d studio.yourdomain.com
```

---

## 💾 4. Quản Lý Dữ Liệu & Bảo Trì Định Kỳ

1. **Dữ liệu SQLite**:
   - File cơ sở dữ liệu được lưu tại `data/ztteam-pipeline.db`.
   - Trong Docker, thư mục `./data` đã được ánh xạ (mount volume) ra thư mục host, nên dữ liệu không bao giờ bị mất khi container restart hoặc update.

2. **Dọn rác tự động (Cron job xóa video tạm sau 7 ngày)**:
   Mở cron job:
   ```bash
   crontab -e
   ```
   Thêm dòng sau để tự động dọn ảnh preview & video tạm cũ hơn 7 ngày lúc 3h sáng mỗi ngày:
   ```cron
   0 3 * * * find /var/www/ztteam-url-fetcher/public/images/preview/ -type f -mtime +7 -delete
   0 3 * * * find /var/www/ztteam-url-fetcher/public/videos/ -type f -mtime +7 -delete
   ```
