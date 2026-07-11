# Cài đặt OKX RSI Scanner 3.0 trên GitHub bằng Android

## A. Tải toàn bộ gói lên repository

1. Giải nén `OKX_RSI_Scanner_v3.zip`.
2. Mở repository GitHub hiện tại.
3. Chọn **Add file → Upload files**.
4. Tải các file và thư mục trong gói lên repository.
5. Xác nhận các mục sau xuất hiện:
   - `index.html`
   - `manifest.webmanifest`
   - `service-worker.js`
   - `icon.svg`
   - `rsi_alert.py`
   - `.github/workflows/okx-rsi-alert.yml`
6. Chọn **Commit changes**.

Lưu ý: GitHub Pages chỉ cần các file website ở thư mục gốc. File workflow phải đúng đường dẫn `.github/workflows/okx-rsi-alert.yml`.

## B. Tạo bot Telegram

1. Trong Telegram, tìm tài khoản chính thức `@BotFather`.
2. Gửi `/newbot`.
3. Làm theo hướng dẫn để đặt tên và username.
4. Sao chép token BotFather cung cấp.
5. Mở bot vừa tạo, nhấn **Start** và gửi một tin nhắn bất kỳ.

## C. Lấy Chat ID

Mở trình duyệt với địa chỉ:

`https://api.telegram.org/botTOKEN_CUA_BAN/getUpdates`

Thay `TOKEN_CUA_BAN` bằng token thật. Tìm:

`"chat":{"id":123456789,...}`

Dãy số là Chat ID.

## D. Thêm GitHub Secrets

Trong repository:

1. **Settings → Secrets and variables → Actions**
2. Chọn **New repository secret**
3. Tạo:
   - Name: `TELEGRAM_BOT_TOKEN`
   - Secret: token từ BotFather
4. Tạo tiếp:
   - Name: `TELEGRAM_CHAT_ID`
   - Secret: Chat ID

Không đưa token vào mã nguồn công khai.

## E. Kiểm tra bot

1. Vào tab **Actions**
2. Chọn **OKX RSI Telegram Alert**
3. Chọn **Run workflow**
4. Giữ `test_only` bật
5. Chọn **Run workflow**

Telegram sẽ nhận tin nhắn kết nối.

## F. Hoạt động tự động

Workflow chạy vào phút 02, 17, 32 và 47 mỗi giờ, tức khoảng hai phút sau khi nến 15 phút đóng. Bot chỉ gửi khi RSI vừa cắt lên 70 hoặc vừa cắt xuống 30.
