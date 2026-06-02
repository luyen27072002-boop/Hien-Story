# Hiền Story Auth - Web app viết truyện có đăng nhập

## Chức năng đã thêm
- Tạo tài khoản.
- Đăng nhập bằng tên đăng nhập hoặc email.
- Ghi nhớ đăng nhập cho lần sau.
- Đăng xuất.
- Mỗi tài khoản có kho truyện riêng.
- Viết truyện, tự lưu nháp, đăng bài, đọc truyện.
- Sao lưu/nhập truyện bằng JSON.
- PWA có manifest + service worker.
- Giao diện hồng kem.
- Có chọn kiểu chữ: Chữ mềm, Hiện đại, Tiểu thuyết, Dễ thương.

## Cách chạy
```bash
cd story_writer_pwa_auth
python -m http.server 5500
```

Mở:
```text
http://localhost:5500
```

## Mở bằng điện thoại cùng Wi-Fi
```bash
python -m http.server 5500 --bind 0.0.0.0
```

Xem IP máy tính:
```bash
ipconfig
```

Trên điện thoại mở:
```text
http://IP_MAY_TINH:5500
```

Ví dụ:
```text
http://192.168.1.8:5500
```

## Lưu ý bảo mật
Bản này là frontend-only. Tài khoản và truyện lưu trong localStorage của trình duyệt.
- Không dùng mật khẩu thật.
- Không dùng cho website public thật.
- Nếu muốn deploy thật, nên đổi phần đăng nhập sang Firebase Authentication, Supabase Auth, hoặc backend riêng.
