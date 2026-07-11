# CẬP NHẬT v4.1.1 STABLE

Bản này sửa lỗi cú pháp YAML của v4.1.

## Thay hai file

### 1. `rsi_alert.py`

Mở file `rsi_alert.py` trong repository, nhấn biểu tượng bút chì, xóa toàn bộ nội dung cũ và dán nội dung file mới.

### 2. `.github/workflows/okx-rsi-alert.yml`

Mở workflow cũ, nhấn biểu tượng bút chì, xóa toàn bộ nội dung và dán nội dung file `okx-rsi-alert.yml` trong gói này.

Sau mỗi file, chọn **Commit changes**.

Không cần tạo lại Telegram Bot và không cần sửa GitHub Secrets.

## Kiểm tra

Vào:

Actions → OKX RSI Telegram Alert v4.1.1 Stable → Run workflow

Chọn `test_telegram`.

Telegram phải nhận tin nhắn xác nhận v4.1.1.

## Cơ chế hoạt động

- GitHub gọi workflow mỗi 5 phút.
- Bot lấy ID nến 15 phút mới nhất đã xác nhận.
- GitHub cache dùng ID nến làm khóa.
- Nến đã xử lý thì bỏ qua.
- Nến mới thì quét top 50 coin.
- Telegram chỉ báo giao cắt mới qua 70 hoặc 30.
