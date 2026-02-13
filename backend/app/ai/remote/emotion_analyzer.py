import json
from typing import Optional

from app.ai.remote.llm_client import get_llm_client

FALLBACK_RESULT = {
    "dominant": "calm",
    "scores": {"happy": 0.5, "calm": 0.5, "sad": 0.0, "angry": 0.0, "excited": 0.0, "anxious": 0.0, "focused": 0.0},
    "expression_description": "分析失败",
    "emotional_stability": 0.5,
}


async def analyze_emotion(
    keyframe_paths: list[str],
    transcription_text: str = "",
    llm_provider: Optional[str] = None,
    llm_api_key: Optional[str] = None,
    llm_base_url: Optional[str] = None,
    llm_vision_model: Optional[str] = None,
) -> dict:
    """
    使用大模型多模态视觉能力分析孩子的情绪状态。
    支持 OpenAI 和 Anthropic 两种 API 格式。

    Args:
        keyframe_paths: 包含孩子面部的关键帧路径
        transcription_text: 语音转写文本（辅助分析）
        llm_provider: 用户级 LLM 提供商覆盖
        llm_api_key: 用户级 API Key 覆盖
        llm_base_url: 用户级 Base URL 覆盖
        llm_vision_model: 用户级视觉模型覆盖

    Returns:
        情感分析结果
    """
    text_context = ""
    if transcription_text:
        text_context = f"\n孩子的语音内容：「{transcription_text[:500]}」"

    prompt = f"""分析图片中孩子的情绪状态。{text_context}

请以 JSON 格式返回：
{{
  "dominant": "主要情绪（happy/sad/angry/calm/excited/anxious/focused）",
  "scores": {{
    "happy": 0.0-1.0,
    "sad": 0.0-1.0,
    "angry": 0.0-1.0,
    "calm": 0.0-1.0,
    "excited": 0.0-1.0,
    "anxious": 0.0-1.0,
    "focused": 0.0-1.0
  }},
  "expression_description": "表情描述",
  "emotional_stability": 0.0-1.0
}}
只返回 JSON，不要其他文字。"""

    client = get_llm_client(
        llm_provider=llm_provider,
        llm_api_key=llm_api_key,
        llm_base_url=llm_base_url,
        llm_vision_model=llm_vision_model,
    )

    try:
        raw_content = await client.vision(
            prompt=prompt,
            image_paths=keyframe_paths[:4],
        )
        content = raw_content.strip()
        if content.startswith("```"):
            content = content.split("\n", 1)[1].rsplit("```", 1)[0]
        return json.loads(content)
    except Exception:
        return FALLBACK_RESULT
