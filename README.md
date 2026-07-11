# OKX RSI Scanner 2.0

## Tính năng

- Website quét top **50** hợp đồng OKX USDT perpetual theo khối lượng 24 giờ ước tính.
- RSI Wilder 14, mặc định khung 15 phút.
- GitHub Actions chạy sau mỗi lần nến 15 phút đóng.
- Telegram chỉ báo khi:
  - RSI vừa cắt lên 70.
  - RSI vừa cắt xuống 30.
- Không cần OKX API key và không thể đặt lệnh.

## Cập nhật repository hiện tại

Tải toàn bộ nội dung gói này lên repository và chọn **Commit changes**. Hai mục quan trọng phải đúng:

- File `index.html` ở thư mục gốc.
- File `rsi_alert.py` ở thư mục gốc.
- Workflow ở đúng đường dẫn `.github/workflows/okx-rsi-alert.yml`.

GitHub Pages sẽ tự cập nhật giao diện sau khi commit.

## Thiết lập Telegram

### 1. Tạo bot và lấy token

1. Mở Telegram, tìm tài khoản chính thức `@BotFather`.
2. Gửi `/newbot`.
3. Đặt tên và username theo hướng dẫn.
4. BotFather trả về token. Không đăng token lên repository hoặc gửi công khai.

### 2. Lấy Chat ID

1. Mở bot vừa tạo và nhấn **Start**, hoặc gửi một tin nhắn bất kỳ.
2. Mở trình duyệt với địa chỉ sau, thay `TOKEN_CUA_BAN` bằng token:

   `https://api.telegram.org/botTOKEN_CUA_BAN/getUpdates`

3. Tìm đoạn `"chat":{"id":123456789,...}`. Dãy số đó là Chat ID.
4. Nếu `result` rỗng, gửi thêm một tin nhắn cho bot rồi tải lại trang.

### 3. Thêm GitHub Secrets

Trong repository:

1. Vào **Settings**.
2. Chọn **Secrets and variables → Actions**.
3. Chọn **New repository secret**.
4. Tạo hai secret:

| Name | Secret |
|---|---|
| `TELEGRAM_BOT_TOKEN` | Token do BotFather cấp |
| `TELEGRAM_CHAT_ID` | Dãy Chat ID vừa lấy |

Không thêm dấu ngoặc kép hoặc khoảng trắng thừa.

### 4. Gửi tin nhắn kiểm tra

1. Mở tab **Actions**.
2. Chọn workflow **OKX RSI Telegram Alert**.
3. Chọn **Run workflow**.
4. Giữ `test_only` được bật.
5. Chọn nút xanh **Run workflow**.

Sau khoảng một phút, Telegram sẽ nhận tin nhắn “đã kết nối”.

## Cách hoạt động

Lịch chạy là phút 02, 17, 32 và 47 mỗi giờ UTC. Đây là khoảng hai phút sau các thời điểm đóng nến 15 phút. Bot so sánh RSI của hai nến đã đóng gần nhất nên:

- Không báo lặp lại ba lần trong cùng một nến.
- Không dùng RSI của nến đang chạy.
- Không cần lưu trạng thái hay commit dữ liệu liên tục.

GitHub có thể trì hoãn workflow theo lịch trong thời gian hệ thống đông tải. Đây không phải hệ thống cảnh báo thời gian thực tuyệt đối.

## Bảo mật

- Repository có thể công khai, nhưng hai secret Telegram vẫn được GitHub che giấu.
- Không đưa token vào `index.html`, README, ảnh chụp màn hình hoặc phần Issues.
- Nếu token bị lộ, vào BotFather thu hồi token và tạo token mới.
