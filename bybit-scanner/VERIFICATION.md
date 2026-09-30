# Trạng thái kiểm tra

- Node syntax app.js/core.js/sw.js: đạt.
- 10 kiểm tra đơn vị: đạt (Wilder, rearm, ngưỡng tùy chọn, nến đóng, timer, ranking, step và leverage).
- 1 kiểm tra tích hợp app bằng DOM và Bybit API mô phỏng: đạt. 50 hợp đồng, max leverage filter, lịch sử không trùng qua quét tay, đổi preset, lưu localStorage, thông báo thử.
- Dữ liệu thử chỉ nằm trong tests, không đưa vào app live hoặc artifact Pages.
- Trình duyệt thật/ảnh desktop và mobile: chưa xác nhận, do Chromium không tải được và preview browser không truy cập địa chỉ local.
- Bybit live từ môi trường kiểm tra: endpoint api.bybit.com trả HTML Site Unavailable, api.bytick.com trả403. Chưa xác nhận CORS/live trên mạng thiết bị người dùng. Trang không dùng dữ liệu giả khi lỗi.
- Đích triển khai: ggTinGagg/okx-rsi-scanner, main, thư mục bybit-scanner. Giữ nguyên các file OKX hiện có. Trạng thái build và URL cần kiểm tra sau commit.
