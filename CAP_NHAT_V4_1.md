# CẬP NHẬT LÊN v4.1 STABLE

Bạn chỉ cần thay 2 file trong repository hiện tại.

## 1. Thay file Python

Mở `rsi_alert.py`, nhấn biểu tượng bút chì, xóa nội dung cũ và dán nội dung file mới. Sau đó chọn **Commit changes**.

## 2. Thay workflow

Mở `.github/workflows/okx-rsi-alert.yml`, nhấn biểu tượng bút chì, xóa nội dung cũ và dán nội dung file `okx-rsi-alert.yml` trong gói này. Sau đó chọn **Commit changes**.

Không cần tạo lại Telegram Bot và không cần sửa hai GitHub Secrets.

## 3. Kiểm tra

Vào:

**Actions → OKX RSI Telegram Alert v4.1 Stable → Run workflow**

Chọn `test_telegram`, rồi nhấn **Run workflow**.

Telegram phải nhận tin nhắn xác nhận v4.1 Stable.

Bạn có thể chọn `force_scan` để ép quét ngay một lần.

## Cơ chế chống trùng

- GitHub gọi workflow mỗi 5 phút.
- Bot lấy ID nến 15 phút mới nhất đã xác nhận từ OKX.
- ID nến được dùng làm khóa cache.
- Nếu khóa đã tồn tại, bot bỏ qua.
- Nếu khóa chưa tồn tại, bot quét top 50 coin rồi đánh dấu nến đã xử lý.
- Mỗi nến 15 phút vì vậy chỉ được xử lý một lần.

GitHub Actions miễn phí vẫn có thể khởi động trễ vài phút, nhưng cơ chế này tránh xử lý trùng và không còn phụ thuộc vào đúng phút 00/15/30/45.
