import base64
import json
import logging
import time
from typing import Optional

from app.config import settings

logger = logging.getLogger(__name__)


class LLMClient:
    """
    统一的大模型客户端，支持 OpenAI 和 Anthropic 两种 API 格式。

    OpenAI 格式兼容：OpenAI、DashScope、DeepSeek、Groq、Together 等所有 OpenAI 兼容 API。
    Anthropic 格式兼容：Anthropic Claude 系列。
    """

    def __init__(
        self,
        provider: Optional[str] = None,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        model: Optional[str] = None,
        vision_model: Optional[str] = None,
    ):
        self.provider = provider or settings.LLM_PROVIDER
        self.api_key = api_key or settings.LLM_API_KEY
        self.base_url = base_url or settings.LLM_BASE_URL
        self.model = model or settings.LLM_MODEL
        self.vision_model = vision_model or settings.LLM_VISION_MODEL

    @classmethod
    def from_user_settings(
        cls,
        llm_provider: Optional[str] = None,
        llm_api_key: Optional[str] = None,
        llm_base_url: Optional[str] = None,
        llm_model: Optional[str] = None,
        llm_vision_model: Optional[str] = None,
    ) -> "LLMClient":
        """从用户级配置创建客户端，为空的字段回退到系统默认配置。"""
        return cls(
            provider=llm_provider or None,
            api_key=llm_api_key or None,
            base_url=llm_base_url or None,
            model=llm_model or None,
            vision_model=llm_vision_model or None,
        )

    async def chat(self, prompt: str, system_prompt: str = "") -> str:
        """纯文本对话，返回模型回复文本。"""
        if self.provider == "anthropic":
            return await self._anthropic_chat(prompt, system_prompt)
        return await self._openai_chat(prompt, system_prompt)

    async def vision(self, prompt: str, image_paths: list[str], system_prompt: str = "") -> str:
        """多模态视觉分析，传入图片路径列表，返回模型回复文本。"""
        if self.provider == "anthropic":
            return await self._anthropic_vision(prompt, image_paths, system_prompt)
        return await self._openai_vision(prompt, image_paths, system_prompt)

    async def _openai_chat(self, prompt: str, system_prompt: str = "") -> str:
        """OpenAI 格式的纯文本对话。"""
        from openai import AsyncOpenAI

        client = AsyncOpenAI(api_key=self.api_key, base_url=self.base_url)
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        logger.info("🤖 [LLM 请求] provider=openai, model=%s, base_url=%s", self.model, self.base_url)
        logger.info("📝 [LLM Prompt] (前500字): %s", prompt[:500])
        start_time = time.time()

        response = await client.chat.completions.create(
            model=self.model,
            messages=messages,
            timeout=120.0,
        )
        result = response.choices[0].message.content or ""
        elapsed = time.time() - start_time

        logger.info("✅ [LLM 回复] 耗时=%.1fs, 回复长度=%d字符", elapsed, len(result))
        logger.info("📄 [LLM 回复内容] (前500字): %s", result[:500])
        return result

    async def _openai_vision(self, prompt: str, image_paths: list[str], system_prompt: str = "") -> str:
        """OpenAI 格式的多模态视觉分析。"""
        from openai import AsyncOpenAI

        client = AsyncOpenAI(api_key=self.api_key, base_url=self.base_url)

        content: list[dict] = []
        for path in image_paths:
            with open(path, "rb") as f:
                encoded = base64.b64encode(f.read()).decode("utf-8")
            content.append({
                "type": "image_url",
                "image_url": {"url": f"data:image/jpeg;base64,{encoded}"},
            })
        content.append({"type": "text", "text": prompt})

        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": content})

        logger.info("🖼️ [LLM Vision 请求] provider=openai, model=%s, 图片数=%d", self.vision_model, len(image_paths))
        logger.info("📝 [Vision Prompt] (前500字): %s", prompt[:500])
        start_time = time.time()

        response = await client.chat.completions.create(
            model=self.vision_model,
            messages=messages,
            timeout=120.0,
        )
        result = response.choices[0].message.content or ""
        elapsed = time.time() - start_time

        logger.info("✅ [LLM Vision 回复] 耗时=%.1fs, 回复长度=%d字符", elapsed, len(result))
        logger.info("📄 [Vision 回复内容] (前500字): %s", result[:500])
        return result

    async def _anthropic_chat(self, prompt: str, system_prompt: str = "") -> str:
        """Anthropic 格式的纯文本对话。"""
        import anthropic

        client = anthropic.AsyncAnthropic(api_key=self.api_key, base_url=self.base_url)
        kwargs: dict = {
            "model": self.model,
            "max_tokens": 4096,
            "messages": [{"role": "user", "content": prompt}],
        }
        if system_prompt:
            kwargs["system"] = system_prompt

        logger.info("🤖 [LLM 请求] provider=anthropic, model=%s, base_url=%s", self.model, self.base_url)
        logger.info("📝 [LLM Prompt] (前500字): %s", prompt[:500])
        start_time = time.time()

        response = await client.messages.create(**kwargs)
        result = response.content[0].text if response.content else ""
        elapsed = time.time() - start_time

        logger.info("✅ [LLM 回复] 耗时=%.1fs, 回复长度=%d字符", elapsed, len(result))
        logger.info("📄 [LLM 回复内容] (前500字): %s", result[:500])
        return result

    async def _anthropic_vision(self, prompt: str, image_paths: list[str], system_prompt: str = "") -> str:
        """Anthropic 格式的多模态视觉分析。"""
        import anthropic

        client = anthropic.AsyncAnthropic(api_key=self.api_key, base_url=self.base_url)

        content: list[dict] = []
        for path in image_paths:
            with open(path, "rb") as f:
                encoded = base64.b64encode(f.read()).decode("utf-8")
            content.append({
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": "image/jpeg",
                    "data": encoded,
                },
            })
        content.append({"type": "text", "text": prompt})

        kwargs: dict = {
            "model": self.vision_model,
            "max_tokens": 4096,
            "messages": [{"role": "user", "content": content}],
        }
        if system_prompt:
            kwargs["system"] = system_prompt

        logger.info("🖼️ [LLM Vision 请求] provider=anthropic, model=%s, 图片数=%d", self.vision_model, len(image_paths))
        logger.info("📝 [Vision Prompt] (前500字): %s", prompt[:500])
        start_time = time.time()

        response = await client.messages.create(**kwargs)
        result = response.content[0].text if response.content else ""
        elapsed = time.time() - start_time

        logger.info("✅ [LLM Vision 回复] 耗时=%.1fs, 回复长度=%d字符", elapsed, len(result))
        logger.info("📄 [Vision 回复内容] (前500字): %s", result[:500])
        return result

    async def test_connection(self) -> dict:
        """测试 API 连通性，返回 {"success": bool, "message": str}。"""
        try:
            result = await self.chat("请回复：连接成功")
            if result:
                return {"success": True, "message": f"连接成功，模型回复：{result[:50]}"}
            return {"success": False, "message": "模型返回空内容"}
        except Exception as error:
            return {"success": False, "message": f"连接失败：{str(error)}"}


def get_llm_client(
    llm_provider: Optional[str] = None,
    llm_api_key: Optional[str] = None,
    llm_base_url: Optional[str] = None,
    llm_model: Optional[str] = None,
    llm_vision_model: Optional[str] = None,
) -> LLMClient:
    """获取 LLM 客户端实例，优先使用传入的用户级配置。"""
    return LLMClient.from_user_settings(
        llm_provider=llm_provider,
        llm_api_key=llm_api_key,
        llm_base_url=llm_base_url,
        llm_model=llm_model,
        llm_vision_model=llm_vision_model,
    )
