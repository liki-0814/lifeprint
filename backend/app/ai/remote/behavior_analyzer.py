import json
from typing import Optional

from app.ai.remote.llm_client import get_llm_client

BEHAVIOR_PROMPT = """分析这组连续帧中孩子的行为。请以 JSON 格式返回，包含以下字段：
{
  "activities": [
    {
      "type": "行为类型（sport/learning/art/music/social/independent/rest）",
      "description": "具体行为描述",
      "confidence": 0.0-1.0,
      "duration_pct": 0.0-1.0
    }
  ],
  "environment": "场景描述（室内/室外/学校等）",
  "interaction_mode": "互动模式（独处/与同伴/与成人）"
}
只返回 JSON，不要其他文字。"""

FALLBACK_RESULT = {
    "activities": [{"type": "unknown", "description": "分析失败", "confidence": 0.0, "duration_pct": 1.0}],
    "environment": "unknown",
    "interaction_mode": "unknown",
}


async def analyze_behavior(
    keyframe_paths: list[str],
    llm_provider: Optional[str] = None,
    llm_api_key: Optional[str] = None,
    llm_base_url: Optional[str] = None,
    llm_vision_model: Optional[str] = None,
) -> dict:
    """
    使用大模型多模态视觉能力分析关键帧中孩子的行为。
    支持 OpenAI 和 Anthropic 两种 API 格式。

    Args:
        keyframe_paths: 关键帧图片路径列表
        llm_provider: 用户级 LLM 提供商覆盖
        llm_api_key: 用户级 API Key 覆盖
        llm_base_url: 用户级 Base URL 覆盖
        llm_vision_model: 用户级视觉模型覆盖

    Returns:
        行为分析结果，包含 activities 列表
    """
    client = get_llm_client(
        llm_provider=llm_provider,
        llm_api_key=llm_api_key,
        llm_base_url=llm_base_url,
        llm_vision_model=llm_vision_model,
    )

    try:
        raw_content = await client.vision(
            prompt=BEHAVIOR_PROMPT,
            image_paths=keyframe_paths[:8],
        )
        content = raw_content.strip()
        if content.startswith("```"):
            content = content.split("\n", 1)[1].rsplit("```", 1)[0]
        return json.loads(content)
    except Exception:
        return FALLBACK_RESULT
