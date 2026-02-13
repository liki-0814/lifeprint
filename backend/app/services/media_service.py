import io
from minio import Minio
from minio.error import S3Error

from app.config import settings


class MinIOService:
    """MinIO 对象存储服务封装"""

    def __init__(self):
        self.client = Minio(
            endpoint=settings.MINIO_ENDPOINT,
            access_key=settings.MINIO_ACCESS_KEY,
            secret_key=settings.MINIO_SECRET_KEY,
            secure=settings.MINIO_SECURE,
        )
        self.bucket_name = settings.MINIO_BUCKET_NAME

    def ensure_bucket(self):
        """确保存储桶存在，不存在则创建"""
        if not self.client.bucket_exists(self.bucket_name):
            self.client.make_bucket(self.bucket_name)

    def upload_file(
        self, object_name: str, data: bytes, content_type: str = "application/octet-stream"
    ) -> str:
        """上传文件到 MinIO"""
        self.ensure_bucket()
        self.client.put_object(
            self.bucket_name,
            object_name,
            io.BytesIO(data),
            length=len(data),
            content_type=content_type,
        )
        return object_name

    def upload_file_from_path(self, object_name: str, file_path: str, content_type: str = "application/octet-stream") -> str:
        """从本地文件路径上传到 MinIO"""
        self.ensure_bucket()
        self.client.fput_object(
            self.bucket_name,
            object_name,
            file_path,
            content_type=content_type,
        )
        return object_name

    def get_presigned_url(self, object_name: str, expires: int = 3600) -> str:
        """生成预签名下载 URL"""
        from datetime import timedelta
        return self.client.presigned_get_object(
            self.bucket_name, object_name, expires=timedelta(seconds=expires)
        )

    def delete_file(self, object_name: str):
        """删除 MinIO 中的文件"""
        try:
            self.client.remove_object(self.bucket_name, object_name)
        except S3Error:
            pass

    def get_file_bytes(self, object_name: str) -> bytes:
        """下载文件内容为 bytes"""
        response = self.client.get_object(self.bucket_name, object_name)
        try:
            return response.read()
        finally:
            response.close()
            response.release_conn()


minio_service = MinIOService()
