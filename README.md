# OKX RSI Scanner v5.0.1 Stable

Bản sửa lỗi JavaScript của v5.0.

## Đã sửa

- Đổi tên hàm `top()` gây xung đột với `window.top` của trình duyệt.
- Khai báo rõ hàm chọn nhiều phần tử thay vì tạo biến toàn cục.
- Giữ nguyên toàn bộ giao diện và tính năng thông báo.
- Cập nhật cache PWA để trình duyệt tải mã mới.

## Cập nhật GitHub Pages

Tải đè 4 file sau:

- `index.html`
- `manifest.webmanifest`
- `service-worker.js`
- `icon.svg`

Sau khi GitHub Pages deploy xong, mở trang và nhấn `Ctrl + F5` trên máy tính. Trên Android, đóng hẳn PWA/tab rồi mở lại; nếu vẫn thấy v5.0, xóa dữ liệu trang hoặc gỡ biểu tượng PWA cũ và cài lại.
