import asyncio
import logging
import os
import shutil
import tempfile
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.local.scene_detector import scene_detector
from app.ai.local.face_engine import face_engine
from app.ai.local.whisper_engine import whisper_engine
from app.ai.remote.behavior_analyzer import analyze_behavior
from app.ai.remote.emotion_analyzer import analyze_emotion
from app.models.analysis import AnalysisResult, AnalysisTask
from app.models.media import MediaFile
from app.services.media_service import minio_service

logger = logging.getLogger(__name__)


async def run_preprocess_pipeline(db: AsyncSession, media_id: str) -> dict:
    """
    视频预处理流水线：关键帧提取 + 音频提取 + 语音转写。

    Args:
        db: 数据库会话
        media_id: 媒体文件 ID

    Returns:
        预处理结果，包含 keyframes, audio_path, transcription
    """
    from sqlalchemy import select
    result = await db.execute(select(MediaFile).where(MediaFile.id == media_id))
    media_file = result.scalar_one_or_none()
    if not media_file:
        raise ValueError(f"媒体文件不存在: {media_id}")

    media_file.analysis_status = "processing"
    await db.flush()

    work_dir = tempfile.mkdtemp(prefix=f"lifeprint_{media_id}_")
    local_video_path = os.path.join(work_dir, "source_video")

    try:
        logger.info("📥 [预处理] 从 MinIO 下载文件: %s", media_file.storage_path)
        file_bytes = minio_service.get_file_bytes(media_file.storage_path)
        with open(local_video_path, "wb") as f:
            f.write(file_bytes)
        logger.info("📥 [预处理] 文件下载完成，大小=%.1fMB", len(file_bytes) / 1024 / 1024)

        keyframes_dir = os.path.join(work_dir, "keyframes")
        logger.info("🎬 [预处理] 开始提取关键帧...")
        keyframes = scene_detector.extract_keyframes(local_video_path, keyframes_dir)
        logger.info("🎬 [预处理] 提取到 %d 个关键帧", len(keyframes))

        transcription = {}
        if media_file.file_type == "video":
            logger.info("🎤 [预处理] 开始提取音频并转写...")
            audio_path = scene_detector.extract_audio(
                local_video_path, os.path.join(work_dir, "audio.wav")
            )
            transcription = whisper_engine.transcribe(audio_path)
            logger.info("🎤 [预处理] 语音转写完成，文本长度=%d", len(transcription.get("text", "")))
            speech_analysis = whisper_engine.analyze_speech(transcription)

            from app.models.media import MediaChild
            child_ids_result = await db.execute(
                select(MediaChild.child_id).where(MediaChild.media_id == media_id)
            )
            associated_child_ids = [row[0] for row in child_ids_result.all()]
            primary_child_id = associated_child_ids[0] if associated_child_ids else ""

            cognition_result = AnalysisResult(
                media_id=media_id,
                child_id=primary_child_id,
                analysis_type="cognition",
                result_data={
                    "transcription": transcription["text"],
                    "vocabulary_richness": speech_analysis["vocabulary_richness"],
                    "sentence_complexity": speech_analysis["sentence_complexity"],
                    "word_count": speech_analysis["word_count"],
                    "unique_word_count": speech_analysis["unique_word_count"],
                },
                confidence_score=0.85,
                analyzed_at=datetime.utcnow(),
            )
            db.add(cognition_result)
        else:
            from app.models.media import MediaChild
            child_ids_result = await db.execute(
                select(MediaChild.child_id).where(MediaChild.media_id == media_id)
            )
            associated_child_ids = [row[0] for row in child_ids_result.all()]
            primary_child_id = associated_child_ids[0] if associated_child_ids else ""

        keyframe_paths = [kf["image_path"] for kf in keyframes]
        for keyframe_path in keyframe_paths:
            matched_children = face_engine.identify_child(keyframe_path)
            if matched_children:
                face_result = AnalysisResult(
                    media_id=media_id,
                    child_id=matched_children[0],
                    analysis_type="face",
                    result_data={
                        "keyframe": os.path.basename(keyframe_path),
                        "matched_children": matched_children,
                    },
                    confidence_score=0.9,
                    analyzed_at=datetime.utcnow(),
                )
                db.add(face_result)

        await db.flush()

        return {
            "keyframe_paths": keyframe_paths,
            "transcription": transcription,
            "work_dir": work_dir,
        }

    except Exception as error:
        media_file.analysis_status = "failed"
        await db.flush()
        logger.error("预处理失败: %s", error)
        raise


async def run_analysis_pipeline(
    db: AsyncSession, media_id: str, preprocess_result: dict
) -> None:
    """
    AI 深度分析流水线：行为识别 + 情感分析。

    Args:
        db: 数据库会话
        media_id: 媒体文件 ID
        preprocess_result: 预处理结果
    """
    keyframe_paths = preprocess_result.get("keyframe_paths", [])
    transcription = preprocess_result.get("transcription", {})
    work_dir = preprocess_result.get("work_dir", "")

    try:
        logger.info("🧠 [深度分析] 开始并行执行行为识别 + 情感分析，关键帧数=%d", len(keyframe_paths))
        behavior_result, emotion_result = await asyncio.gather(
            analyze_behavior(keyframe_paths),
            analyze_emotion(keyframe_paths, transcription.get("text", "")),
        )
        logger.info("🧠 [深度分析] 行为识别结果: %s", str(behavior_result)[:300])
        logger.info("🧠 [深度分析] 情感分析结果: %s", str(emotion_result)[:300])

        from app.models.media import MediaChild
        child_ids_result = await db.execute(
            select(MediaChild.child_id).where(MediaChild.media_id == media_id)
        )
        associated_child_ids = [row[0] for row in child_ids_result.all()]
        primary_child_id = associated_child_ids[0] if associated_child_ids else ""

        behavior_analysis = AnalysisResult(
            media_id=media_id,
            child_id=primary_child_id,
            analysis_type="behavior",
            result_data=behavior_result,
            confidence_score=0.8,
            analyzed_at=datetime.utcnow(),
        )
        db.add(behavior_analysis)

        emotion_analysis = AnalysisResult(
            media_id=media_id,
            child_id=primary_child_id,
            analysis_type="emotion",
            result_data=emotion_result,
            confidence_score=0.75,
            analyzed_at=datetime.utcnow(),
        )
        db.add(emotion_analysis)

        from sqlalchemy import select
        result = await db.execute(select(MediaFile).where(MediaFile.id == media_id))
        media_file = result.scalar_one_or_none()
        if media_file:
            media_file.analysis_status = "completed"

        await db.flush()
        logger.info("✅ [深度分析] AI 分析全部完成: media_id=%s", media_id)

    except Exception as error:
        from sqlalchemy import select
        result = await db.execute(select(MediaFile).where(MediaFile.id == media_id))
        media_file = result.scalar_one_or_none()
        if media_file:
            media_file.analysis_status = "failed"
        await db.flush()
        logger.error("AI 分析失败: %s", error)
        raise

    finally:
        if work_dir and os.path.exists(work_dir):
            shutil.rmtree(work_dir, ignore_errors=True)
