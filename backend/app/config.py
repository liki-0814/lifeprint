from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    """应用全局配置，从环境变量或 .env 文件加载"""

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/life_print"

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # MinIO
    MINIO_ENDPOINT: str = "localhost:9000"
    MINIO_ACCESS_KEY: str = "minioadmin"
    MINIO_SECRET_KEY: str = "minioadmin"
    MINIO_BUCKET_NAME: str = "life-print"
    MINIO_SECURE: bool = False

    # JWT
    JWT_SECRET_KEY: str = "your-super-secret-key-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # LLM 大模型配置（支持 OpenAI 和 Anthropic 格式）
    LLM_PROVIDER: str = "openai"  # openai 或 anthropic
    LLM_API_KEY: str = ""
    LLM_BASE_URL: str = "https://api.openai.com/v1"  # OpenAI 兼容 API 地址
    LLM_MODEL: str = "gpt-4o"  # 文本模型
    LLM_VISION_MODEL: str = "gpt-4o"  # 视觉模型

    # 向后兼容旧配置
    DASHSCOPE_API_KEY: str = ""
    OPENAI_API_KEY: Optional[str] = None

    # Whisper（本地模型，不需要 API Key）
    WHISPER_MODEL_SIZE: str = "small"

    # 数据目录（所有产生的数据文件存放位置）
    DATA_DIR: str = "./data"

    # Celery
    CELERY_BROKER_URL: str = "redis://localhost:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/2"

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "case_sensitive": True,
    }


settings = Settings()
