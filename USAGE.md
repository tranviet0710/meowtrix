# 🐾 MEOWTRIX — Hướng dẫn Cài đặt & Chạy dự án

> Hướng dẫn chi tiết từ đầu đến cuối để thiết lập và chạy dự án MEOWTRIX trên máy local.

---

## 📋 Yêu cầu hệ thống

| Công cụ | Phiên bản tối thiểu | Kiểm tra |
|---------|---------------------|----------|
| Node.js | ≥ 18.0.0 | `node --version` |
| npm | ≥ 9.0.0 | `npm --version` |
| Git | Bất kỳ | `git --version` |
| Supabase CLI | Mới nhất | `npx supabase --version` |
| Temporal CLI | Mới nhất (tuỳ chọn) | `temporal --version` |

---

## 1️⃣ Clone và cài đặt dependencies

```bash
git clone <your-repo-url>
cd meowtrix
npm install
```

---

## 2️⃣ Tạo Supabase Project

### Bước 1: Đăng ký / Đăng nhập Supabase

1. Truy cập [https://supabase.com](https://supabase.com)
2. Click **"Start your project"** hoặc **"Sign In"**
3. Đăng nhập bằng GitHub account

### Bước 2: Tạo Project mới

1. Click **"New Project"**
2. Chọn Organization (hoặc tạo mới)
3. Điền thông tin:
   - **Name:** `meowtrix` (hoặc tên tuỳ chọn)
   - **Database Password:** Tạo password mạnh (lưu lại để dùng sau nếu cần)
   - **Region:** Chọn region gần bạn nhất (ví dụ: `Southeast Asia (Singapore)`)
4. Click **"Create new project"**
5. Đợi ~2 phút để project được provision

### Bước 3: Lấy Credentials

Sau khi project tạo xong, vào **Settings → API**:

| Key | Vị trí | Mô tả |
|-----|--------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL | URL dạng `https://xxxxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Project API Keys → `anon` `public` | Key cho client-side |
| `SUPABASE_SERVICE_ROLE_KEY` | Project API Keys → `service_role` `secret` | Key cho server-side (KHÔNG expose ra client) |

⚠️ **QUAN TRỌNG:** `SUPABASE_SERVICE_ROLE_KEY` có toàn quyền bypass RLS. KHÔNG BAO GIỜ đưa vào client code.

---

## 3️⃣ Lấy Gemini API Key

### Bước 1: Truy cập Google AI Studio

1. Truy cập [https://aistudio.google.com/apikey](https://aistudio.google.com/apikey)
2. Đăng nhập bằng Google Account

### Bước 2: Tạo API Key

1. Click **"Create API Key"**
2. Chọn Google Cloud project (hoặc để mặc định tạo mới)
3. Copy API key được tạo ra

| Key | Giá trị |
|-----|---------|
| `GEMINI_API_KEY` | Key vừa copy (ví dụ: `your-gemini-api-key`) |

> 💡 **Lưu ý:** Free tier của Gemini API cho phép 60 requests/phút — đủ cho development.

---

## 4️⃣ Thiết lập Temporal (Escalating Search Protocol)

Temporal dùng cho workflow tìm kiếm leo thang (6h → 24h → 48h).

### Option A: Temporal CLI (Development — Khuyến nghị)

```bash
# Cài đặt Temporal CLI
brew install temporal

# Khởi động Temporal dev server
temporal server start-dev
```

Server sẽ chạy tại `localhost:7233`. UI tại `http://localhost:8233`.

### Option B: Docker Compose

```bash
# Clone Temporal docker-compose
git clone https://github.com/temporalio/docker-compose.git temporal-docker
cd temporal-docker

# Khởi động
docker compose up -d
```

### Option C: Temporal Cloud (Production)

1. Đăng ký tại [https://cloud.temporal.io](https://cloud.temporal.io)
2. Tạo Namespace
3. Lấy address dạng `<namespace>.<account>.tmprl.cloud:7233`

| Key | Giá trị mặc định (local dev) |
|-----|------------------------------|
| `TEMPORAL_ADDRESS` | `localhost:7233` |
| `TEMPORAL_NAMESPACE` | `default` |
| `TEMPORAL_TASK_QUEUE` | `meowtrix-search-protocol` |

---

## 5️⃣ Cấu hình Environment Variables

Copy file `.env.example` thành `.env.local`:

```bash
cp .env.example .env.local
```

Mở `.env.local` và điền các giá trị:

```env
# --- Supabase ---
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# --- Gemini AI Vision ---
GEMINI_API_KEY=your-gemini-api-key

# --- Temporal ---
TEMPORAL_ADDRESS=localhost:7233
TEMPORAL_NAMESPACE=default
TEMPORAL_TASK_QUEUE=meowtrix-search-protocol

# --- Seed Data ---
SEED_DATA=false
SEED_CLEANUP=false
```

---

## 6️⃣ Thiết lập Database Schema

### Chạy Migration

Dự án đã có file migration tại `supabase/migrations/00001_initial_schema.sql`. Bạn có 2 cách:

#### Cách 1: Dùng Supabase CLI (Khuyến nghị)

```bash
# Liên kết với project Supabase (cần đăng nhập CLI trước)
npx supabase login
npx supabase link --project-ref <your-project-ref>

# Chạy migration
npx supabase db push
```

> `project-ref` lấy từ URL project: `https://supabase.com/dashboard/project/<project-ref>`

#### Cách 2: Chạy SQL thủ công

1. Vào **Supabase Dashboard → SQL Editor**
2. Copy toàn bộ nội dung file `supabase/migrations/00001_initial_schema.sql`
3. Paste vào SQL Editor và click **"Run"**

### Kiểm tra

Sau khi chạy migration, vào **Table Editor** để xác nhận các table đã được tạo:
- `informants`
- `overlords`
- `agents`
- `match_suggestions`
- `claims`
- `notifications`

Và 2 Storage Buckets:
- `cat-photos`
- `posters`

---

## 7️⃣ Thiết lập Supabase Auth

### Cấu hình Email Auth (mặc định)

1. Vào **Supabase Dashboard → Authentication → Providers**
2. Đảm bảo **Email** provider đã được bật
3. (Tuỳ chọn) Tắt **Confirm email** nếu muốn dev nhanh hơn:
   - **Authentication → Settings → Auth Settings**
   - Tắt "Enable email confirmations" (chỉ cho development)

### Cấu hình Redirect URLs

1. Vào **Authentication → URL Configuration**
2. Thêm vào **Redirect URLs**:
   - `http://localhost:3000/api/auth/callback`
   - `http://localhost:3000/dashboard`

---

## 8️⃣ Seed Data (Tuỳ chọn)

Nạp dữ liệu mẫu để test:

```bash
npm run seed
```

Xoá dữ liệu seed:

```bash
npm run seed:cleanup
```

---

## 9️⃣ Chạy dự án

### Terminal 1: Next.js Development Server

```bash
npm run dev
```

App chạy tại: [http://localhost:3000](http://localhost:3000)

### Terminal 2: Temporal Worker (nếu cần test workflow)

```bash
npx tsx temporal/worker.ts
```

### Terminal 3: Temporal Server (nếu dùng Temporal CLI)

```bash
temporal server start-dev
```

---

## 🧪 Chạy Tests

```bash
# Chạy toàn bộ test suite
npm run test

# Chạy với coverage report
npm run test:coverage

# Chạy ở watch mode (development)
npm run test:watch
```

---

## 🏗️ Build Production

```bash
npm run build
npm run start
```

---

## 🚀 Deploy lên Vercel

### Bước 1: Import Project

1. Truy cập [https://vercel.com](https://vercel.com)
2. Click **"Add New Project"**
3. Import từ GitHub repo

### Bước 2: Cấu hình Environment Variables

Thêm các biến môi trường trong Vercel Dashboard → Settings → Environment Variables:

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL Supabase project |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key |
| `GEMINI_API_KEY` | Gemini API key |
| `TEMPORAL_ADDRESS` | Temporal Cloud address |
| `TEMPORAL_NAMESPACE` | Namespace name |
| `TEMPORAL_TASK_QUEUE` | `meowtrix-search-protocol` |

### Bước 3: Cập nhật Redirect URLs

Thêm production URL vào Supabase Auth Redirect URLs:
- `https://your-app.vercel.app/api/auth/callback`

### Bước 4: Deploy

Click **"Deploy"** — Vercel sẽ tự động build và deploy.

---

## 🛠️ Troubleshooting

### Lỗi phổ biến

| Lỗi | Nguyên nhân | Giải pháp |
|-----|-------------|-----------|
| `NEXT_PUBLIC_SUPABASE_URL is not defined` | Chưa tạo `.env.local` | Copy từ `.env.example` và điền giá trị |
| `relation "informants" does not exist` | Chưa chạy migration | Chạy `npx supabase db push` hoặc run SQL thủ công |
| `RLS policy violation` | User không có quyền | Kiểm tra RLS policies đã được apply đúng |
| `Temporal connection refused` | Temporal server chưa chạy | Khởi động `temporal server start-dev` |
| `Gemini API 429 rate limit` | Vượt quá free tier limit | Đợi 1 phút hoặc upgrade plan |
| Leaflet map không hiển thị | SSR conflict | Đảm bảo component được import với `dynamic` và `ssr: false` |

### Reset Database

Nếu cần reset toàn bộ database:

```bash
# Xoá seed data
npm run seed:cleanup

# Hoặc reset hoàn toàn qua Supabase CLI
npx supabase db reset
```

---

## 📁 Cấu trúc dự án

```
meowtrix/
├── app/
│   ├── (auth)/             # Đăng nhập & Đăng ký
│   ├── (protected)/        # Dashboard, Map, Reports, Leaderboard
│   └── api/                # API Routes (server-side)
├── components/             # React components
│   ├── ui/                 # shadcn/ui primitives
│   ├── map/                # Leaflet map components
│   ├── forms/              # Report & claim forms
│   └── leaderboard/        # Bảng xếp hạng
├── hooks/                  # Custom React hooks
├── lib/                    # Utilities & algorithms
├── temporal/               # Temporal workflows & activities
│   ├── activities/         # Temporal activities
│   ├── workflows/          # Workflow definitions
│   └── worker.ts           # Worker entry point
├── types/                  # TypeScript interfaces
├── scripts/                # Seed scripts
├── supabase/
│   └── migrations/         # SQL migrations
└── tests/                  # Test files
```

---

## 🔑 Tóm tắt tất cả Credentials cần lấy

| # | Service | Key | Cách lấy |
|---|---------|-----|----------|
| 1 | Supabase | `NEXT_PUBLIC_SUPABASE_URL` | Dashboard → Settings → API → Project URL |
| 2 | Supabase | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Dashboard → Settings → API → anon public |
| 3 | Supabase | `SUPABASE_SERVICE_ROLE_KEY` | Dashboard → Settings → API → service_role secret |
| 4 | Google | `GEMINI_API_KEY` | [AI Studio](https://aistudio.google.com/apikey) → Create API Key |
| 5 | Temporal | `TEMPORAL_ADDRESS` | Local: `localhost:7233` / Cloud: từ Temporal dashboard |
| 6 | Temporal | `TEMPORAL_NAMESPACE` | Local: `default` / Cloud: tên namespace bạn tạo |
| 7 | Temporal | `TEMPORAL_TASK_QUEUE` | Cố định: `meowtrix-search-protocol` |

---

## ✅ Checklist khởi chạy

- [ ] Clone repo & `npm install`
- [ ] Tạo Supabase project & lấy 3 keys
- [ ] Tạo Gemini API key
- [ ] Tạo file `.env.local` với đầy đủ credentials
- [ ] Chạy database migration
- [ ] Cấu hình Supabase Auth redirect URLs
- [ ] (Tuỳ chọn) Cài Temporal CLI & khởi động server
- [ ] (Tuỳ chọn) Seed data mẫu
- [ ] `npm run dev` → Mở http://localhost:3000
- [ ] Đăng ký account mới & test các tính năng

---

> 🟢 **Hệ thống online. Chúc bạn triển khai thành công!**
