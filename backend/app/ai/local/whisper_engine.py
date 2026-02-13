import os
from typing import Optional

from app.config import settings


class WhisperEngine:
    """基于 OpenAI Whisper 的语音转文字引擎"""

    def __init__(self, model_size: Optional[str] = None):
        self.model_size = model_size or settings.WHISPER_MODEL_SIZE
        self._model = None

    def _ensure_model(self):
        """延迟加载模型"""
        if self._model is None:
            import whisper
            self._model = whisper.load_model(self.model_size)

    def transcribe(self, audio_path: str, language: str = "zh") -> dict:
        """
        将音频文件转为文字。

        Args:
            audio_path: 音频文件路径（WAV/MP3 等）
            language: 语言代码

        Returns:
            包含 text, segments, language 的字典
        """
        self._ensure_model()
        result = self._model.transcribe(
            audio_path,
            language=language,
            verbose=False,
        )
        return {
            "text": result["text"],
            "language": result.get("language", language),
            "segments": [
                {
                    "start": seg["start"],
                    "end": seg["end"],
                    "text": seg["text"],
                }
                for seg in result.get("segments", [])
            ],
        }

    def analyze_speech(self, transcription: dict) -> dict:
        """
        分析语音转写结果，提取语言特征。

        Returns:
            包含 word_count, unique_words, vocabulary_richness, avg_segment_length 的字典
        """
        text = transcription.get("text", "")
        segments = transcription.get("segments", [])

        import re
        words = re.findall(r"[\u4e00-\u9fff]|[a-zA-Z]+", text)
        unique_words = set(words)

        word_count = len(words)
        unique_count = len(unique_words)
        vocabulary_richness = unique_count / max(word_count, 1)

        segment_lengths = [len(seg["text"]) for seg in segments]
        avg_segment_length = sum(segment_lengths) / max(len(segment_lengths), 1)

        sentence_count = max(len(re.findall(r"[。！？.!?]", text)), 1)
        sentence_complexity = word_count / sentence_count

        return {
            "word_count": word_count,
            "unique_word_count": unique_count,
            "vocabulary_richness": round(vocabulary_richness, 3),
            "avg_segment_length": round(avg_segment_length, 1),
            "sentence_complexity": round(sentence_complexity, 2),
            "total_duration_sec": segments[-1]["end"] if segments else 0,
        }


whisper_engine = WhisperEngine()
