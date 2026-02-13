from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import engine, Base


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期：启动时自动创建数据库表"""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield


app = FastAPI(
    title="LifePrint API",
    description="儿童成长记录与 AI 分析平台",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from app.api.v1 import auth, families, children, media, analysis, reports, autonomy, export, settings as settings_router
from app.utils.data_dir import ensure_data_dirs

ensure_data_dirs()

app.include_router(auth.router, prefix="/api/v1/auth", tags=["认证"])
app.include_router(families.router, prefix="/api/v1/families", tags=["家庭管理"])
app.include_router(children.router, prefix="/api/v1/children", tags=["孩子管理"])
app.include_router(media.router, prefix="/api/v1/media", tags=["媒体管理"])
app.include_router(analysis.router, prefix="/api/v1/analysis", tags=["AI分析"])
app.include_router(reports.router, prefix="/api/v1/reports", tags=["月度报告"])
app.include_router(autonomy.router, prefix="/api/v1/autonomy", tags=["自主性追踪"])
app.include_router(export.router, prefix="/api/v1/export", tags=["数据导出"])
app.include_router(settings_router.router, prefix="/api/v1/settings", tags=["用户设置"])


@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "LifePrint API", "version": "1.0.0"}
