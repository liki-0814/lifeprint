import os
import tempfile
from typing import Optional

from scenedetect import open_video, SceneManager
from scenedetect.detectors import ContentDetector


class SceneDetectorEngine:
    """基于 PySceneDetect 的视频关键帧提取引擎"""

    def __init__(self, threshold: float = 27.0, min_scene_len: int = 15):
        self.threshold = threshold
        self.min_scene_len = min_scene_len

    def extract_keyframes(
        self, video_path: str, output_dir: Optional[str] = None
    ) -> list[dict]:
        """
        从视频中提取关键帧。

        Args:
            video_path: 视频文件路径
            output_dir: 关键帧图片输出目录，为 None 时使用临时目录

        Returns:
            关键帧信息列表，每项包含 frame_number, timestamp_sec, image_path
        """
        if output_dir is None:
            output_dir = tempfile.mkdtemp(prefix="lifeprint_keyframes_")
        os.makedirs(output_dir, exist_ok=True)

        video = open_video(video_path)
        scene_manager = SceneManager()
        scene_manager.add_detector(
            ContentDetector(threshold=self.threshold, min_scene_len=self.min_scene_len)
        )
        scene_manager.detect_scenes(video)
        scene_list = scene_manager.get_scene_list()

        keyframes = []
        import cv2
        cap = cv2.VideoCapture(video_path)
        fps = cap.get(cv2.CAP_PROP_FPS) or 30.0

        for idx, (start, end) in enumerate(scene_list):
            mid_frame = (start.get_frames() + end.get_frames()) // 2
            cap.set(cv2.CAP_PROP_POS_FRAMES, mid_frame)
            ret, frame = cap.read()
            if ret:
                image_path = os.path.join(output_dir, f"keyframe_{idx:04d}.jpg")
                cv2.imwrite(image_path, frame)
                keyframes.append({
                    "frame_number": mid_frame,
                    "timestamp_sec": round(mid_frame / fps, 2),
                    "image_path": image_path,
                    "scene_index": idx,
                })

        if not scene_list:
            total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            sample_interval = max(int(fps * 2), 1)
            frame_idx = 0
            sample_idx = 0
            while frame_idx < total_frames:
                cap.set(cv2.CAP_PROP_POS_FRAMES, frame_idx)
                ret, frame = cap.read()
                if ret:
                    image_path = os.path.join(output_dir, f"keyframe_{sample_idx:04d}.jpg")
                    cv2.imwrite(image_path, frame)
                    keyframes.append({
                        "frame_number": frame_idx,
                        "timestamp_sec": round(frame_idx / fps, 2),
                        "image_path": image_path,
                        "scene_index": sample_idx,
                    })
                    sample_idx += 1
                frame_idx += sample_interval

        cap.release()
        return keyframes

    def extract_audio(self, video_path: str, output_path: Optional[str] = None) -> str:
        """从视频中提取音频为 WAV 文件"""
        if output_path is None:
            output_path = tempfile.mktemp(suffix=".wav", prefix="lifeprint_audio_")

        import ffmpeg
        (
            ffmpeg
            .input(video_path)
            .output(output_path, acodec="pcm_s16le", ac=1, ar="16000")
            .overwrite_output()
            .run(quiet=True)
        )
        return output_path


scene_detector = SceneDetectorEngine()
