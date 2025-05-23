
<h1 align="center">
  Park Scan
</h1>

<h4 align="center">Hệ thống nhận diện biển số xe và quản lý bãi đỗ thông minh</h4>

<p align="center">
  <a href="https://github.com/sleepifoxx/park-scan">
    <img src="https://img.shields.io/badge/GitHub-%23121011.svg?logo=github&logoColor=white">
  </a>
  <a href="https://hub.docker.com/r/sleepifoxx/backend">
    <img src="https://img.shields.io/badge/backend-docker-blue?logo=docker">
  </a>
  <a href="https://hub.docker.com/r/sleepifoxx/services">
    <img src="https://img.shields.io/badge/services-docker-blue?logo=docker">
  </a>
  <a href="https://hub.docker.com/r/sleepifoxx/frontend">
    <img src="https://img.shields.io/badge/frontend-docker-blue?logo=docker">
  </a>
</p>

<p align="center">
  <a href="#mô-tả-dự-án"> Mô tả dự án</a> •
  <a href="#tính-năng">Tính năng</a> •
  <a href="#hướng-dẫn-cài-đặt">Hướng dẫn cài đặt</a> •
  <a href="#link">Link</a> •
  <a href="#cấu-trúc-dự-án">Cấu trúc dự án</a> •
  <a href="#đóng-góp">Đóng góp</a> •
  <a href="#thành-viên-phát-triển">Thành viên phát triển</a>
</p>

---

## Mô tả dự án

Muốn xem tài liệu chi tiết, vui lòng [`Truy cập thư mục Drive chung dự án`](https://drive.google.com/drive/folders/1da-UDeKuevoj0gaFQTeX-L56_8uN1YkI?usp=sharing)

### Tóm tắt chung

Park Scan là hệ thống nhận diện biển số xe tự động sử dụng AI, phục vụ cho việc quản lý bãi đỗ xe thông minh. Hệ thống gồm 3 thành phần chính:
- **Backend (FastAPI + SQLite)**: Xử lý API, quản lý dữ liệu người dùng, phiên gửi xe, cấu hình bãi đỗ.
- **Services (YOLOv5 + FastAPI)**: Nhận diện biển số xe thời gian thực từ luồng camera người dùng, sử dụng mô hình AI.
- **Frontend (NextJS)**: Giao diện web cho người dùng và quản trị viên.

Các thành phần giao tiếp với nhau qua API và WebSocket, hỗ trợ triển khai nhanh chóng bằng Docker.

---

## Tính năng

- Nhận diện biển số xe thời gian thực bằng AI (YOLOv5).
- Quản lý phiên gửi xe, cấu hình bãi đỗ, người dùng.
- Giao diện web trực quan cho người dùng và quản trị viên.
- Hỗ trợ xem camera trực tiếp hoặc luồng server.
- Tích hợp WebSocket cho truyền dữ liệu camera và kết quả nhận diện.
- Dễ dàng triển khai với Docker Compose.

---

## Hướng dẫn cài đặt

### 1. Yêu cầu

- [Docker](https://www.docker.com/products/docker-desktop) và [Docker Compose](https://docs.docker.com/compose/).

### 2. Tải docker-compose.yml

#### a. docker-compose.yml cho CPU (`khuyên dùng`)

Tải file tại: [`docker-compose.yml (CPU)`](https://drive.google.com/file/d/1rZZQPijKJqN1nZomDq778mTEALTqXwAQ/view?usp=sharing)
- **Chú ý**:
  - Bản docker-compose.yml trên hỗ trợ cho cả **CPU** từ Intel (AMD64) và Apple Silicon (ARM64), có thể tải về và chạy hệ thống ngay lập tức. Bản này chính là bản được sử dụng tại `git` dự án.

#### b. docker-compose.yml cho GPU
Tải file tại [`docker-compose.yml (GPU)`](https://drive.google.com/file/d/103uJEOW0FOY5q6XpoJ7pPcQoSS9wCm4F/view?usp=sharing)
- **Chú ý**:
  - Bản docker-compose.yml trên chỉ hỗ trợ cho **GPU Nvidia**, nếu  máy bạn có GPU Nvidia, hãy cấu hình Docker Desktop dựa trên [`hướng dẫn từ Docker`](https://docs.docker.com/desktop/features/gpu/), tải về docker-compose.yml này và sử dụng.
  - Sự cấu hình này chỉ đến từ phía Docker Desktop máy của người dùng (không phải đến từ image dự án).
  - Nếu máy bạn không có **GPU Nvidia**, xin hãy sử dụng bản cho **CPU** phía trên.
  


### 3. Chạy hệ thống

```bash
cd [Thư mục chứa docker-compose.yml]
docker-compose up -d
```
Hướng dẫn sử dụng website (vui lòng đọc kĩ trước khi sử dụng): [`Tài liệu hướng dẫn sử dụng`]() 

Truy cập các phần của website:
- **Website chính (Frontend)**: http://localhost
- **Backend API Documentation**: http://localhost:8000/docs
- **Services (AI) API Documentation**: http://localhost:8001/docs

---

## Link
### a. DockerHub
- Backend: [`sleepifoxx/backend`](https://hub.docker.com/r/sleepifoxx/backend)
- Services: [`sleepifoxx/services`](https://hub.docker.com/r/sleepifoxx/services)
- Frontend: [`sleepifoxx/frontend`](https://hub.docker.com/r/sleepifoxx/frontend)
### b. GitHub
- GitHub dự án: [`GitHub dự án`](https://github.com/sleepifoxx/park-scan)
---

## Cấu trúc dự án

```
park-scan/
├── backend/
│   └── database/
├── docker-compose.yml
├── frontend/
├── services/
└── README.md
```
---
## Đóng góp
- Đóng góp hoặc báo lỗi: [`Đến trang issues`](https://github.com/sleepifoxx/park-scan/issues)
---

## Thành viên phát triển
- Nguyễn Minh Quân
- Vũ Văn Tới
- Mai Phan Anh Tùng
- Nguyễn Năng Thịnh
- Nguyễn Văn Linh
---
> © 2025 Park Scan Team
