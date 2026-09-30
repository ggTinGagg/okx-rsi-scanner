# Bybit RSI Radar

Web tĩnh tiếng Việt cho GitHub Pages, không cần backend hay API key trong cấu hình mặc định. Chỉ quét khi trang mở; không tự đặt lệnh.

## Tính năng

- Chọn Top 50 **USDT linear perpetual đang Trading** theo turnover24h (giá trị giao dịch tính bằng USDT), loại prelisting. Danh sách cập nhật mỗi lượt quét.
- RSI Wilder(14), 500 nến làm dữ liệu khởi tạo. Chỉ tính nến đã đóng, RSI không được nối qua một đoạn thiếu nến.
- Khung M1, M3, M5, M15, M30, H1, H2, H4, H6, H12, D1.
- Ngưỡng quá mua/quá bán tùy chọn; mặc định 70/30. Mốc nạp lại mặc định 60/40, có thể chỉnh riêng. Khi chọn 80/20 thì mặc định nạp lại 70/30.
- Quá mua: đã có RSI ≤ mốc nạp quá mua, sau đó **lần đầu** prev RSI ≤ ngưỡng và current RSI > ngưỡng. Vượt lại sau khi chỉ về65 với cấu hình70/60 sẽ không xuất hiện.
- Quá bán đối xứng: đã có RSI ≥ mốc nạp quá bán, lần đầu prev RSI ≥ ngưỡng và current RSI < ngưỡng.
- Danh sách hiện tại chỉ nhận tín hiệu trên **nến vừa đóng**, không liệt kê tất cả mã đang nằm ngoài ngưỡng. Mở trang giữa nến: quét nến gần nhất đã đóng. Không thông báo lại một sự kiện đã lưu, không hồi cứu tất cả tín hiệu trong quá khứ.
- SL% = lớn nhất của |Close−Open| trong10 nến bao gồm nến tín hiệu / Close tín hiệu ×100. Đòn bẩy =10/SL%, không làm tròn trước khi lọc. Trần mặc định30×, có thể chọn số khác hoặc bỏ lọc. Đây là giá trị công thức, không phải xác nhận giới hạn hợp đồng hay mức đòn bẩy sàn cho phép.
- Tự quét sau mốc đóng nến khoảng2 giây, đồng bộ giờ Bybit. Chờ và thử lại khi Bybit chưa trả nến vừa đóng. 5 tác vụ song song, khoảng cách yêu cầu120ms. Có nút quét tay, tiến độ, lỗi từng mã.
- Lịch sử lưu localStorage riêng từng thiết bị (1.000 sự kiện, hiển thị200 gần nhất); không đồng bộ qua tài khoản.
- Toast + âm thanh ba nốt, nút bật và kiểm tra cảnh báo. Notification hệ thống được dùng khi trình duyệt cho phép; serviceworker chỉ phục vụ notification, không lưu cache giá.

## Chạy và kiểm tra

Cần Node22+ để chạy kiểm thử, Python hoặc máy chủ tĩnh để xem web:

```bash
npm test
python -m http.server 8080
```

Mở http://localhost:8080. Không mở index.html bằng file:// vì ES modules và serviceworker cần origin HTTP/HTTPS.

Các kiểm thử: Wilder chuẩn, nến đóng/đang chạy, thời điểm quét, tín hiệu nạp lại/không nạp đủ, đối xứng, ngưỡng tùy chọn, công thức step, lọc đòn bẩy, ranking theo turnover. app-flow.test.js kiểm tra tích hợp bằng DOM/API/notification mô phỏng; không phải thử dữ liệu live hay render trình duyệt thật. browser-check.cjs dành cho môi trường có Playwright Chromium, không chạy mặc định và không được xác nhận đã chạy ở lần bàn giao này.

## GitHub Pages

Bản này được đặt trong `bybit-scanner/` của repo `ggTinGagg/okx-rsi-scanner`, nhánh `main`. GitHub Pages hiện có triển khai từ nhánh; các file của trang OKX được giữ nguyên.

URL: https://ggTinGagg.github.io/okx-rsi-scanner/bybit-scanner/

Chạy test từ thư mục `bybit-scanner`: `npm test`. Cập nhật file trong thư mục này rồi commit lên main để Pages triển khai lại. Không cần thêm workflow Pages riêng.

## Cảnh báo và giới hạn thực tế

Lần đầu bấm **Bật cảnh báo** hoặc **Kiểm tra thông báo**, cho phép notification nếu muốn. Trình duyệt cần thao tác người dùng để phát âm thanh. Nếu notification hệ thống không được hỗ trợ, toast vẫn hoạt động. Khi điện thoại khóa màn hình/tab bị đóng băng thì quét có thể dừng; khi quay lại web, nó tự quét lại. Đây không phải background push24/24. Safari iOS có điều kiện riêng cho notification; cài thành ứng dụng web nếu trình duyệt yêu cầu. Không thể bảo đảm notification trên mọi thiết bị.

Bybit có giới hạn truy cập theo vùng và mạng. API base mặc định thử api.bybit.com rồi api.bytick.com, hai endpoint chính thức. API live trong môi trường xây dựng trả trang unavailable/403 nên **chưa xác nhận dữ liệu live hoặc CORS trên thiết bị sử dụng**. Web báo lỗi rõ và không thay bằng dữ liệu giả. Website có thể truy cập rộng rãi qua Pages, nhưng không bảo đảm Bybit API truy cập được ở mọi quốc gia.

Nếu origin Pages bị lỗi CORS, optional-gateway/worker.js là gateway GET-only cho bốn endpoint market, cần triển khai riêng và đặt ALLOWED_ORIGIN đúng origin Pages (không có đường dẫn repo). Sau đó cập nhật config.js apiBase thành URL gateway tin cậy. Gateway không chứa API key, không nhận URL đích tùy ý, không đặt lệnh và không bảo đảm khả năng truy cập từ vùng bị Bybit hạn chế. Mặc định gateway không được sử dụng.

## Nguồn chính thức

- https://bybit-exchange.github.io/docs/v5/market/kline
- https://bybit-exchange.github.io/docs/v5/market/tickers
- https://bybit-exchange.github.io/docs/v5/market/instrument
- https://bybit-exchange.github.io/docs/v5/guide
- https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API/Using_the_Notifications_API
- https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay
- https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages
