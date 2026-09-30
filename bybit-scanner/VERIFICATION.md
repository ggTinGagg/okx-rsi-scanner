# Trạng thái kiểm tra

- Node syntax app.js/core.js/sw.js: đạt.
- 10 kiểm tra đơn vị: đạt (Wilder, rearm, ngưỡng tùy chọn, nến đóng, timer, ranking, step và leverage).
- 1 kiểm tra tích hợp app bằng DOM và Bybit API mô phỏng: đạt. 50 hợp đồng, max leverage filter, lịch sử không trùng qua quét tay, đổi preset, lưu localStorage, thông báo thử.
- Dữ liệu thử chỉ nằm trong tests, không đưa vào app live hoặc artifact Pages.
- Trình duyệt thật/ảnh desktop và mobile: chưa xác nhận, do Chromium không tải được và preview browser không truy cập địa chỉ local.
- Bybit live từ môi trường kiểm tra: endpoint api.bybit.com trả HTML Site Unavailable, api.bytick.com trả403. Chưa xác nhận CORS/live trên mạng thiết bị người dùng. Trang không dùng dữ liệu giả khi lỗi.
- Đích triển khai: ggTinGagg/okx-rsi-scanner, main, thư mục bybit-scanner. Giữ nguyên các file OKX hiện có. Trạng thái build và URL cần kiểm tra sau commit.

- Kiểm tra tích hợp mở rộng: lúc mở với tự quét tắt không gọi API thị trường; quét tay hoạt động; nến WebSocket xác nhận đóng gọi một lượt quét nền, gửi notification, bỏ sự kiện lặp/sai topic và đóng stream khi tắt tự quét: đạt. Các hành vi này được mô phỏng trong Node, chưa xác nhận vận hành tab nền trên thiết bị người dùng.
