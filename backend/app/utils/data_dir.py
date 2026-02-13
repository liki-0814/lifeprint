import os

from app.config import settings


def ensure_data_dirs() -> None:
    """
    确保数据目录结构存在。
    所有产生的数据文件（上传、临时、导出、模型缓存）都存放在 DATA_DIR 下。
    """
    subdirs = [
        "",
        "uploads",
        "temp",
        "exports",
        "models",
        "postgres",
        "redis",
        "minio",
    ]
    for subdir in subdirs:
        path = os.path.join(settings.DATA_DIR, subdir)
        os.makedirs(path, exist_ok=True)
