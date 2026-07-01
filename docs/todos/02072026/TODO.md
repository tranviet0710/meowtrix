0. Đăng ký tài khoản: https://temporal.io/get-cloud/payment-information

1. Giao thức Tìm kiếm Leo thang (Escalating Search Protocol):
    * Đây là một tính năng nổi bật được lên kế hoạch sử dụng Temporal (dịch vụ cho các
        tác vụ nền).
    * Thông báo có độ trễ: Sau khi một "Overlord" được báo mất 1 giờ, hệ thống sẽ tự
        động gửi thông báo cho những người dùng ở gần.
    * Tự động tạo tờ rơi: Nếu không tìm thấy sau 6 giờ, hệ thống sẽ tự động tạo một
        file PDF "tờ rơi tìm mèo" có thể in được.
    * Ghi chú: Mặc dù đã có thư mục `temporal` trong source code, nhưng logic cụ thể 
        cho giao thức này có thể chưa hoàn chỉnh.

2. Tích hợp Bảo mật với Aikido:
    * Kế hoạch đề cập đến việc tích hợp dịch vụ Aikido Security để quét các lỗ hổng bảo
        mật trong mã nguồn và các thư viện sử dụng. Đây là một hạng mục về kỹ thuật và
        bảo mật, không phải tính năng người dùng trực tiếp nhìn thấy.