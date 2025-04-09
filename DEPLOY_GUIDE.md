# Hướng dẫn Triển khai Ứng dụng Lên Vercel

Đây là các bước để triển khai ứng dụng "Design Quality Checker" lên Vercel để có thể truy cập online.

## Điều kiện tiên quyết

1.  **Tài khoản Vercel:** Đăng ký miễn phí tại [vercel.com](https://vercel.com/) (có thể dùng tài khoản GitHub/GitLab/Bitbucket).
2.  **Mã nguồn trên Git:** Dự án của bạn đã được đưa lên một kho lưu trữ Git (ví dụ: GitHub).

## Các Bước Thực Hiện

**Bước 1: Chuẩn bị Dự án và Đưa lên GitHub**

1.  **Khởi tạo Git (Nếu chưa):** Mở terminal trong thư mục gốc, chạy `git init`.
2.  **Tạo file `.gitignore`:** Đảm bảo file `.gitignore` tồn tại trong thư mục gốc với nội dung ít nhất như sau để bỏ qua các file không cần thiết:
    ```gitignore
    # Dependencies
    node_modules/

    # Build artifacts
    *.exe
    *-win.exe
    *-macos
    *-linux

    # Environment variables (if you use a .env file later)
    .env

    # OS generated files
    .DS_Store
    Thumbs.db
    ```
3.  **Commit mã nguồn:**
    ```bash
    git add .
    git commit -m "Prepare for Vercel deployment"
    ```
4.  **Tạo Repository trên GitHub:** Tạo một kho lưu trữ mới trên GitHub (ví dụ: `design-quality-checker`).
5.  **Liên kết và Đẩy mã nguồn lên GitHub:** (Thay URL bằng URL repo của bạn)
    ```bash
    git remote add origin https://github.com/your-username/design-quality-checker.git
    git branch -M main
    git push -u origin main
    ```
    *(Nếu đã có remote `origin`, bạn chỉ cần `git push origin main`)*

**Bước 2: Tạo file cấu hình `vercel.json`**

1.  Tạo file mới tên là `vercel.json` trong thư mục gốc dự án với nội dung:
    ```json
    {
      "version": 2,
      "builds": [
        {
          "src": "app.js",
          "use": "@vercel/node"
        }
      ],
      "routes": [
        {
          "src": "/(.*)",
          "dest": "/app.js"
        }
      ]
    }
    ```
2.  **Commit file `vercel.json`:**
    ```bash
    git add vercel.json
    git commit -m "Add vercel.json configuration"
    git push origin main
    ```

**Bước 3: Import và Triển khai trên Vercel**

1.  **Đăng nhập Vercel:** Truy cập [vercel.com](https://vercel.com/).
2.  **Import Project:** Nhấp "Add New..." -> "Project". Chọn kho lưu trữ GitHub của bạn và nhấp "Import".
3.  **Configure Project:**
    *   **Framework Preset:** Để Vercel tự nhận diện (thường là "Node.js" hoặc "Other").
    *   **Build and Output Settings:** Giữ nguyên cài đặt mặc định.
    *   **Environment Variables:** Bạn có thể bỏ qua bước này nếu đang sử dụng giá trị mặc định trong code.
    *   Nhấp **"Deploy"**.
4.  **Chờ Triển khai:** Vercel sẽ build và deploy ứng dụng.
5.  **Truy cập Ứng dụng:** Sau khi hoàn tất, Vercel sẽ cung cấp một URL công khai. Nhấp vào URL đó để xem ứng dụng của bạn online.

**Lưu ý:** Mỗi khi bạn đẩy code mới lên nhánh `main` trên GitHub, Vercel sẽ tự động triển khai lại phiên bản mới nhất. 