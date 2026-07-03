0. Đăng ký tài khoản: https://temporal.io/get-cloud/payment-information — *(còn lại cho người vận hành thực hiện thủ công)*

1. Giao thức Tìm kiếm Leo thang (Escalating Search Protocol): ✅ **Hoàn tất**
    * Đây là một tính năng nổi bật được lên kế hoạch sử dụng Temporal (dịch vụ cho các tác vụ nền).
    * Thông báo có độ trễ: Sau khi một "Overlord" được báo mất 1 giờ, hệ thống sẽ tự động gửi thông báo cho những người dùng ở gần.
    * Tự động tạo tờ rơi: Nếu không tìm thấy sau 6 giờ, hệ thống sẽ tự động tạo một file PDF "tờ rơi tìm mèo" có thể in được.
    * Ghi chú: Mặc dù đã có thư mục `temporal` trong source code, nhưng logic cụ thể cho giao thức này có thể chưa hoàn chỉnh.

2. Tích hợp Bảo mật với Aikido: ✅ **Hoàn tất**
    * Kế hoạch đề cập đến việc tích hợp dịch vụ Aikido Security để quét các lỗ hổng bảo mật trong mã nguồn và các thư viện sử dụng. Đây là một hạng mục về kỹ thuật và bảo mật, không phải tính năng người dùng trực tiếp nhìn thấy.

---

## Nhật ký triển khai (02/07/2026)

### 1. Escalating Search Protocol

**Trạng thái trước khi làm:** Workflow đã tồn tại nhưng chạy theo mốc 6h/24h/48h/14d (khớp với `specs/meowtrix/requirements.md` §7 nhưng lệch với TODO này). Không có `npm script` để chạy Temporal worker. Kiểu `NotificationType` thiếu giá trị `lost_nearby` mà API `POST /api/overlords` đang chèn.

**Đã thay đổi:**

- `temporal/workflows/searchProtocol.ts`
  - Nhận thêm tham số `SearchProtocolConfig` (tuỳ chọn) cho phép chỉnh delay/radius từng tier mà không phải sửa code workflow.
  - Mốc mặc định giữ nguyên **6h → 24h → 48h → 14d** (khớp `specs/meowtrix/requirements.md §7`). Muốn 1h/6h theo TODO thì set env vars (xem `.env.example`). Xuất `DEFAULT_SEARCH_PROTOCOL_CONFIG` để test/API dùng.
- `app/api/overlords/route.ts`
  - Đọc các biến `SEARCH_PROTOCOL_STAGE{1..4}_DELAY_MS` và `SEARCH_PROTOCOL_STAGE{1,3}_RADIUS_M` từ env, truyền vào workflow khi start. Không có env vars ⇒ dùng defaults 6h/24h/48h/14d.
- `types/index.ts`: bổ sung `'lost_nearby'` vào `NotificationType` union.
- `package.json`: thêm script `worker` (`npx tsx temporal/worker.ts`) và `worker:dev` (kèm `--watch`).
- `.env.example`: liệt kê 6 biến override mới (đều commented, có ví dụ cho demo mode).
- `README.md`: cập nhật bảng tier + hướng dẫn chạy `npm run worker`.

**Cách chạy:**

```bash
# Terminal 1 — Next.js dev server (đã có sẵn)
npm run dev

# Terminal 2 — Temporal worker (mới)
npm run worker

# Demo mode: ép các tier chạy trong vài phút
SEARCH_PROTOCOL_STAGE1_DELAY_MS=60000 \
SEARCH_PROTOCOL_STAGE2_DELAY_MS=300000 \
SEARCH_PROTOCOL_STAGE3_DELAY_MS=900000 \
SEARCH_PROTOCOL_STAGE4_DELAY_MS=1800000 \
npm run dev
```

### 2. Aikido Security

**Trạng thái trước khi làm:** Không có config nào trong repo. Aikido chỉ được ghi trong doc/steering như một dịch vụ ngoài.

**Đã thay đổi:**

- `.github/workflows/security.yml` — CI job mới chạy trên mọi PR + push vào `main`:
  - `npm-audit` — `npm audit --audit-level=high --production` (chặn PR có CVE HIGH/CRITICAL trong deps).
  - `aikido-scan` — cài `@aikidosec/ci-api-client` và chạy `scan` (cho PR) hoặc `scan-release` (cho push), fail-on-sast, fail-on-secrets, `--minimum-severity-level=HIGH`. Bỏ qua khi không có secret `AIKIDO_API_KEY` (in warning thay vì fail).
  - `typecheck-and-lint` — `tsc --noEmit` + `npm run lint` như một defense-in-depth layer.
- `.aikido/config.yml` — Config chuẩn cho Aikido (severity policy HIGH, bật SAST/Deps/Secrets, ignore `node_modules/.next/coverage/docs/todos`, có sẵn khung `suppressions:` để dùng khi cần bỏ qua rule cụ thể).
- `README.md` — thêm mục "Aikido setup" với 4 bước để bật in-CI gate (cài GitHub App → tạo API key → thêm secret `AIKIDO_API_KEY` → push PR).

**Việc còn lại cho người vận hành:**

1. Đăng nhập <https://app.aikido.dev>, kết nối repo GitHub `meowtrix`.
2. Lấy CI API key ở *Settings → Integrations → Continuous Integration*.
3. GitHub → repo Settings → Secrets and variables → Actions → New repository secret: `AIKIDO_API_KEY`.
4. Mở một PR để verify CI job `Aikido Security Scan` chạy xanh.

### Verify

- `npx tsc --noEmit` — ✅ pass.
- `npm run test` — 7 test fail trước và sau khi sửa (all in `matchEngine`/`matchScore` — pre-existing, không liên quan tới change này).
- Diff phạm vi ảnh hưởng: `temporal/workflows/searchProtocol.ts`, `app/api/overlords/route.ts`, `types/index.ts`, `package.json`, `.env.example`, `README.md`, `.github/workflows/security.yml`, `.aikido/config.yml`.
