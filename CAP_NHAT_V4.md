# Cập nhật lên OKX RSI Scanner 4.0

Bạn giữ nguyên hai GitHub Secrets hiện có.

## Tải đè các file ở thư mục gốc

- index.html
- manifest.webmanifest
- service-worker.js
- icon.svg
- rsi_alert.py

## Cập nhật workflow

Mở `.github/workflows/okx-rsi-alert.yml`, nhấn biểu tượng bút chì, xóa nội dung cũ và dán toàn bộ nội dung của file `okx-rsi-alert.yml` trong gói này. Sau đó Commit changes.

## Kiểm tra

Vào Actions → OKX RSI Telegram Alert v4 → Run workflow, giữ `test_only = true`. Telegram phải nhận thông báo phiên bản 4.0.

## Lịch chạy

`1,16,31,46 * * * *`

Workflow được yêu cầu chạy khoảng một phút sau mỗi thời điểm đóng nến 15 phút. GitHub Actions có thể chạy trễ vài phút khi đông tải. Bot luôn lọc `confirm = 1`, nên không dùng nến đang chạy.

## Logic cảnh báo

- RSI hai nến đã đóng gần nhất từ <=70 sang >70: báo cắt lên 70.
- RSI từ >=30 sang <30: báo cắt xuống 30.
- Nếu RSI tiếp tục nằm ngoài ngưỡng, bot không báo lặp.
- Log hiển thị số coin quét, số coin đang quá mua/quá bán và số giao cắt mới.
