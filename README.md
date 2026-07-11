# OKX RSI Scanner — bản miễn phí

Trang web tĩnh dành cho điện thoại/PC:

- Lấy danh sách hợp đồng `SWAP` từ API công khai của OKX.
- Chỉ giữ hợp đồng USDT perpetual (`*-USDT-SWAP`).
- Ước tính khối lượng giao dịch 24 giờ và chọn 30 hợp đồng lớn nhất.
- Lấy nến đã xác nhận, tính RSI Wilder chu kỳ 14.
- Mặc định lọc RSI khung 15 phút lớn hơn 70.
- Không cần API key, không đăng nhập OKX và không thể đặt lệnh.

## Cách dùng nhanh trên máy tính

Mở `index.html` bằng Chrome/Edge. Nếu trình duyệt chặn yêu cầu khi mở file cục bộ, hãy đưa thư mục lên GitHub Pages theo hướng dẫn dưới đây.

## Đưa lên GitHub Pages miễn phí

1. Đăng nhập GitHub và tạo repository mới, ví dụ `okx-rsi-scanner`.
2. Tải lên bốn file:
   - `index.html`
   - `manifest.webmanifest`
   - `service-worker.js`
   - `icon.svg`
3. Mở **Settings → Pages**.
4. Tại **Build and deployment**, chọn:
   - Source: **Deploy from a branch**
   - Branch: **main**
   - Folder: **/(root)**
5. Nhấn **Save**. Sau khi GitHub xuất bản, mở địa chỉ Pages được hiển thị.

## Thêm vào màn hình chính Android

1. Mở trang GitHub Pages bằng Chrome.
2. Nhấn menu ⋮.
3. Chọn **Thêm vào màn hình chính** hoặc **Cài đặt ứng dụng**.

## Lưu ý

- Trang gọi trực tiếp API công khai của OKX nên cần kết nối Internet.
- Một số nhà mạng, VPN, DNS hoặc trình chặn quảng cáo có thể chặn tên miền API.
- “Khối lượng 24h” trên giao diện là giá trị ước tính dùng để xếp hạng thanh khoản.
- RSI là chỉ báo kỹ thuật, không phải tín hiệu chắc chắn và không phải khuyến nghị đầu tư.
