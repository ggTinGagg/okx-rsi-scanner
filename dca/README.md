# OKX RSI DCA — web điện thoại

Nhập tổng equity USDT gồm cả vốn trong bot; thông số tính riêng mỗi bot 20% equity. Không đọc tài khoản, không giữ API key, không tạo lệnh.

Giữ M5 Wilder RSI14, 70/30 nạp 60/40; top50 USDT linear perpetual hiện tại, xếp bằng volCcy24h × last. Dữ liệu tối đa 500 nến có confirm=1; không tính qua nến thiếu. Hướng mặc định quá mua SHORT, quá bán LONG. Lọc raw leverage dưới1/vượt30/vượtinstrument; floor chẵn cho phép1. Step max thân10 gồm nến tín hiệu. 10 SO, nhân tiền1.1, nhân bước1, TP0.5step theo tỷ lệ giá đóng tín hiệu, SL11step. Chưa áp dụng thử nghiệm ATR1.5–4.

SO đầu khác entry: bằng1.1entry. Tiền trong bảng là ký quỹ USDT, không phải notional hay số coin. Hiển thị2 số tiền và4 số tỷ lệ phần trăm; ngân sách thực có thể lệch nhỏ do nhập/làm tròn sàn. Không có kiểm tra available, minSize hay liqPx: kiểm tra màn xem trước của OKX. TP native theo%giá vốn, không giữ khoảng giá tuyệt đối sau DCA. Quá5phút sau thời điểm tín hiệu, thông số đổi thành — để tránh dùng cũ.

Tự quét mỗi5phút khi trang đang mở, sau đóng nến2giây. Quét lại khi mở lại trang. Không bảo đảm thông báo khi khóa màn hình/đóng trang; âm thanh chỉ khi trình duyệt cho phép sau chạm nút. Mã lỗi và thiếu lịch sử được hiển thị; không coi mã lỗi là không có tín hiệu.

## Đưa lên GitHub Pages
1. Tạo repository public tên okx-dca-mobile trên tài khoản GitHub của bạn.
2. Upload các file trong thư mục này vào gốc repository, đặc biệt index.html/core.js/sizing.js/app.js/style.css. Không upload chỉ file ZIP.
3. Settings → Pages → Source: Deploy from a branch → main → /(root) → Save.
4. Mở URL Pages GitHub hiển thị trên điện thoại; có thể dùng Thêm vào màn hình chính.

Hướng dẫn nguồn: https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site
API nguồn: https://app.okx.com/docs-v5/en

Các URL tương đối hoạt động dưới đường dẫn repository. Dữ liệu gọi trực tiếp https://www.okx.com/api/v5/...; có thể bị CORS/khu vực/mạng chặn. Nếu bị chặn cần thêm proxy chỉ dữ liệu public; bản này không chứa proxy hoặc tự chuyển qua bên thứ ba. Chưa xác minh kết nối trên GitHub Pages/điện thoại thật. Không có service worker cache nên mỗi lần mở tải bản hiện tại.

Kiểm tra: npm test (Node). Gói đã chạy kiểm tra Wilder RSI/scanner và sizing; không gọi API riêng tư.

Validation: 16 Node tests passed, including DOM fixture scan, capital update and expiry. JS syntax checks passed. Visual browser QA could not run because browser installation was unavailable; OKX endpoint from this environment returned Site Unavailable, so live CORS and mobile connectivity remain unverified.
