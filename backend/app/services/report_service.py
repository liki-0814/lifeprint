import logging
from datetime import date, timedelta
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_

from app.models.analysis import AnalysisResult, GrowthMetric
from app.models.media import MediaFile, MediaChild
from app.models.report import MonthlyReport
from app.config import settings

logger = logging.getLogger(__name__)


async def calculate_radar_data(
    db: AsyncSession, child_id: str, report_month: date
) -> dict:
    """计算月度雷达图数据，从 analysis_results 聚合各维度得分"""
    month_start = report_month.replace(day=1)
    if month_start.month == 12:
        next_month = month_start.replace(year=month_start.year + 1, month=1)
    else:
        next_month = month_start.replace(month=month_start.month + 1)

    radar_data = {
        "interest": {"sport": 0.0, "music": 0.0, "art": 0.0, "learning": 0.0, "social": 0.0},
        "talent": {"logic": 0.0, "spatial": 0.0, "language": 0.0, "motor": 0.0},
        "psychology": {"empathy": 0.0, "resilience": 0.0, "confidence": 0.0},
    }

    media_ids_result = await db.execute(
        select(MediaFile.id)
        .join(MediaChild, MediaChild.media_id == MediaFile.id)
        .where(
            MediaChild.child_id == child_id,
            MediaFile.uploaded_at >= month_start,
            MediaFile.uploaded_at < next_month,
        )
    )
    media_ids = [row[0] for row in media_ids_result.all()]

    if not media_ids:
        return radar_data

    behavior_results = await db.execute(
        select(AnalysisResult).where(
            AnalysisResult.media_id.in_(media_ids),
            AnalysisResult.analysis_type == "behavior",
        )
    )
    behaviors = list(behavior_results.scalars().all())

    activity_counts: dict[str, int] = {}
    for behavior in behaviors:
        activities = behavior.result_data.get("activities", [])
        for activity in activities:
            activity_type = activity.get("type", "unknown")
            activity_counts[activity_type] = activity_counts.get(activity_type, 0) + 1

    total = max(sum(activity_counts.values()), 1)
    radar_data["interest"]["sport"] = activity_counts.get("sport", 0) / total
    radar_data["interest"]["music"] = activity_counts.get("music", 0) / total
    radar_data["interest"]["art"] = activity_counts.get("art", 0) / total
    radar_data["interest"]["learning"] = activity_counts.get("learning", 0) / total
    radar_data["interest"]["social"] = activity_counts.get("social", 0) / total

    cognition_results = await db.execute(
        select(AnalysisResult).where(
            AnalysisResult.media_id.in_(media_ids),
            AnalysisResult.analysis_type == "cognition",
        )
    )
    cognitions = list(cognition_results.scalars().all())

    if cognitions:
        avg_vocabulary = sum(
            c.result_data.get("vocabulary_richness", 0) for c in cognitions
        ) / len(cognitions)
        avg_complexity = sum(
            c.result_data.get("sentence_complexity", 0) for c in cognitions
        ) / max(len(cognitions), 1)
        radar_data["talent"]["language"] = min(avg_vocabulary, 1.0)
        radar_data["talent"]["logic"] = min(avg_complexity / 5.0, 1.0)

    emotion_results = await db.execute(
        select(AnalysisResult).where(
            AnalysisResult.media_id.in_(media_ids),
            AnalysisResult.analysis_type == "emotion",
        )
    )
    emotions = list(emotion_results.scalars().all())

    if emotions:
        positive_count = sum(
            1 for e in emotions
            if e.result_data.get("dominant") in ("happy", "calm", "excited")
        )
        radar_data["psychology"]["confidence"] = positive_count / len(emotions)
        radar_data["psychology"]["resilience"] = min(len(emotions) / 30.0, 1.0)

    return radar_data


async def detect_spark_cards(db: AsyncSession, child_id: str) -> list[dict]:
    """检测连续 3 个月的高专注行为，生成火花卡片"""
    spark_cards = []

    metrics_result = await db.execute(
        select(GrowthMetric)
        .where(
            GrowthMetric.child_id == child_id,
            GrowthMetric.metric_type.in_(["focus_logic", "focus_spatial", "focus_language", "focus_motor"]),
        )
        .order_by(GrowthMetric.measured_at.desc())
        .limit(120)
    )
    metrics = list(metrics_result.scalars().all())

    metric_by_type: dict[str, list[GrowthMetric]] = {}
    for metric in metrics:
        metric_by_type.setdefault(metric.metric_type, []).append(metric)

    talent_names = {
        "focus_logic": "逻辑推理",
        "focus_spatial": "空间想象",
        "focus_language": "语言表达",
        "focus_motor": "运动协调",
    }

    for metric_type, metric_list in metric_by_type.items():
        high_focus_months = sum(1 for m in metric_list if m.metric_value >= 0.7)
        if high_focus_months >= 3:
            talent_name = talent_names.get(metric_type, metric_type)
            avg_score = sum(m.metric_value for m in metric_list) / len(metric_list)
            spark_cards.append({
                "talent": metric_type.replace("focus_", ""),
                "talent_name": talent_name,
                "confidence": round(avg_score, 2),
                "months_detected": high_focus_months,
                "suggestion": f"孩子在{talent_name}方面表现出持续的高专注度，建议提供更多相关的学习和探索机会。",
            })

    return spark_cards


async def generate_monthly_summary(
    radar_data: dict, spark_cards: list[dict]
) -> str:
    """使用统一 LLM client 生成月度成长总结"""
    from app.ai.remote.llm_client import get_llm_client

    prompt = f"""你是一位专业的儿童发展顾问。请根据以下数据，为家长撰写一份温暖、鼓励性的月度成长总结（200-300字）。

兴趣偏好分布：
- 运动: {radar_data['interest']['sport']:.0%}
- 音乐: {radar_data['interest']['music']:.0%}
- 艺术: {radar_data['interest']['art']:.0%}
- 学习: {radar_data['interest']['learning']:.0%}
- 社交: {radar_data['interest']['social']:.0%}

天赋指标：
- 逻辑推理: {radar_data['talent']['logic']:.0%}
- 空间想象: {radar_data['talent']['spatial']:.0%}
- 语言表达: {radar_data['talent']['language']:.0%}
- 运动协调: {radar_data['talent']['motor']:.0%}

心理特质：
- 同理心: {radar_data['psychology']['empathy']:.0%}
- 抗挫力: {radar_data['psychology']['resilience']:.0%}
- 自信心: {radar_data['psychology']['confidence']:.0%}

发现的天赋火花：{len(spark_cards)} 个
{chr(10).join(f"- {card['talent_name']}（置信度 {card['confidence']:.0%}）" for card in spark_cards) if spark_cards else "暂无"}

请用第二人称（"您的孩子"）撰写，语气温暖积极，突出进步和亮点。"""

    try:
        client = get_llm_client()
        return await client.chat(prompt=prompt)
    except Exception as error:
        logger.warning("LLM 生成月度总结失败: %s，使用默认文案", error)

    return "本月孩子表现良好，各方面都在稳步成长。继续保持对孩子的关注和陪伴，让成长的每一步都被温柔记录。"


def _flatten_radar_data(radar_data: dict) -> list[dict]:
    """将嵌套的 radar_data dict 转换为前端期望的 array 格式"""
    dimension_labels = {
        "interest": {
            "sport": "运动", "music": "音乐", "art": "艺术",
            "learning": "学习", "social": "社交",
        },
        "talent": {
            "logic": "逻辑推理", "spatial": "空间想象",
            "language": "语言表达", "motor": "运动协调",
        },
        "psychology": {
            "empathy": "同理心", "resilience": "抗挫力",
            "confidence": "自信心",
        },
    }
    flat_list = []
    for category, dimensions in dimension_labels.items():
        category_data = radar_data.get(category, {})
        for key, label in dimensions.items():
            score = category_data.get(key, 0.0)
            flat_list.append({
                "dimension": label,
                "score": round(score * 100, 1),
            })
    return flat_list


async def generate_report_sync(child_id: str, db: AsyncSession) -> None:
    """在无 Celery 环境下直接同步生成月度报告"""
    from app.models.child import Child
    from app.ai.remote.report_generator import generate_growth_narrative

    report_month = date.today().replace(day=1)

    child_result = await db.execute(
        select(Child).where(Child.id == child_id)
    )
    child = child_result.scalar_one_or_none()
    if not child:
        raise ValueError(f"孩子不存在: {child_id}")

    existing = await db.execute(
        select(MonthlyReport).where(
            MonthlyReport.child_id == child_id,
            MonthlyReport.report_month == report_month,
        )
    )
    if existing.scalar_one_or_none():
        logger.info("本月报告已存在: child_id=%s", child_id)
        return

    radar_data = await calculate_radar_data(db, child_id, report_month)
    spark_cards = await detect_spark_cards(db, child_id)

    age_months = (
        (report_month.year - child.birth_date.year) * 12
        + report_month.month - child.birth_date.month
    )

    narrative = await generate_growth_narrative(
        child_name=child.name,
        age_months=age_months,
        radar_data=radar_data,
        spark_cards=spark_cards,
        behavior_summary=[],
        emotion_summary={},
    )

    summary = await generate_monthly_summary(radar_data, spark_cards)

    report = MonthlyReport(
        child_id=child_id,
        report_month=report_month,
        summary_text=summary,
        radar_data=radar_data,
        spark_cards=spark_cards,
        narrative=narrative,
    )
    db.add(report)
    await db.commit()
