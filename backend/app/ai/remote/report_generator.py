import json
import logging
import time
from typing import Optional

from app.ai.remote.llm_client import get_llm_client

logger = logging.getLogger(__name__)


async def generate_growth_narrative(
    child_name: str,
    age_months: int,
    radar_data: dict,
    spark_cards: list[dict],
    behavior_summary: list[dict],
    emotion_summary: dict,
    llm_provider: Optional[str] = None,
    llm_api_key: Optional[str] = None,
    llm_base_url: Optional[str] = None,
    llm_model: Optional[str] = None,
) -> str:
    """
    使用大模型生成月度成长叙事报告。
    支持 OpenAI 和 Anthropic 两种 API 格式。

    Args:
        child_name: 孩子名字
        age_months: 孩子月龄
        radar_data: 雷达图数据
        spark_cards: 天赋火花卡片
        behavior_summary: 行为汇总
        emotion_summary: 情绪汇总
        llm_provider: 用户级 LLM 提供商覆盖
        llm_api_key: 用户级 API Key 覆盖
        llm_base_url: 用户级 Base URL 覆盖
        llm_model: 用户级文本模型覆盖

    Returns:
        Markdown 格式的成长叙事文本
    """
    prompt = f"""你是一位资深的儿童发展心理学专家，请为以下孩子撰写一份月度成长叙事报告。

## 孩子信息
- 名字：{child_name}
- 月龄：{age_months} 个月

## 兴趣偏好（0-1 分）
- 运动：{radar_data['interest']['sport']:.2f}
- 音乐：{radar_data['interest']['music']:.2f}
- 艺术：{radar_data['interest']['art']:.2f}
- 学习：{radar_data['interest']['learning']:.2f}
- 社交：{radar_data['interest']['social']:.2f}

## 天赋指标（0-1 分）
- 逻辑推理：{radar_data['talent']['logic']:.2f}
- 空间想象：{radar_data['talent']['spatial']:.2f}
- 语言表达：{radar_data['talent']['language']:.2f}
- 运动协调：{radar_data['talent']['motor']:.2f}

## 心理特质（0-1 分）
- 同理心：{radar_data['psychology']['empathy']:.2f}
- 抗挫力：{radar_data['psychology']['resilience']:.2f}
- 自信心：{radar_data['psychology']['confidence']:.2f}

## 天赋火花
{json.dumps(spark_cards, ensure_ascii=False, indent=2) if spark_cards else "暂未检测到明显天赋火花"}

## 本月行为概览
{json.dumps(behavior_summary[:5], ensure_ascii=False, indent=2) if behavior_summary else "暂无行为数据"}

## 情绪状态
{json.dumps(emotion_summary, ensure_ascii=False, indent=2) if emotion_summary else "暂无情绪数据"}

请按以下结构撰写报告（Markdown 格式，800-1200 字）：

### 本月成长亮点
（用温暖的语言描述孩子本月最突出的 2-3 个进步）

### 兴趣探索
（分析孩子的兴趣偏好变化，给出引导建议）

### 天赋发现
（如有火花卡片，重点描述；如无，鼓励继续观察）

### 情感世界
（分析情绪特征，给出亲子互动建议）

### 下月期待
（基于当前数据，给出 2-3 个具体的成长期待和建议）

语气要求：温暖、专业、鼓励性，用"您的孩子"或直接用孩子名字。"""

    client = get_llm_client(
        llm_provider=llm_provider,
        llm_api_key=llm_api_key,
        llm_base_url=llm_base_url,
        llm_model=llm_model,
    )

    try:
        logger.info("📊 [成长叙事] 开始为 %s（%d月龄）生成成长叙事报告...", child_name, age_months)
        start_time = time.time()
        result = await client.chat(prompt=prompt)
        elapsed = time.time() - start_time
        logger.info("📊 [成长叙事] 生成完成，耗时=%.1fs，内容长度=%d字符", elapsed, len(result))
        return result
    except Exception as error:
        logger.error("❌ [成长叙事] 生成失败: %s，使用默认文案", error, exc_info=True)
        return f"""### 本月成长亮点

{child_name}这个月继续保持着积极的成长态势，每一天都在用自己的方式探索这个世界。

### 兴趣探索

孩子在多个领域都展现出了好奇心，建议继续提供丰富多样的体验机会。

### 天赋发现

我们正在持续观察{child_name}的天赋特质，每个孩子都有独特的闪光点。

### 情感世界

{child_name}的情绪表达越来越丰富，建议家长多给予积极的情感回应。

### 下月期待

继续保持对{child_name}的关注和陪伴，让成长的每一步都被温柔记录。"""
