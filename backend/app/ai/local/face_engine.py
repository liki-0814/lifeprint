import os
import numpy as np
from typing import Optional


class FaceEngine:
    """基于 InsightFace 的人脸检测与识别引擎"""

    def __init__(self):
        self._app = None
        self._registered_faces: dict[str, np.ndarray] = {}

    def _ensure_model(self):
        """延迟加载模型，避免启动时占用 GPU"""
        if self._app is None:
            from insightface.app import FaceAnalysis
            self._app = FaceAnalysis(
                name="buffalo_l",
                providers=["CUDAExecutionProvider", "CPUExecutionProvider"],
            )
            self._app.prepare(ctx_id=0, det_size=(640, 640))

    def register_face(self, child_id: str, image_path: str) -> bool:
        """
        注册孩子的人脸特征向量。

        Args:
            child_id: 孩子 ID
            image_path: 包含孩子人脸的照片路径

        Returns:
            是否注册成功
        """
        self._ensure_model()
        import cv2
        image = cv2.imread(image_path)
        if image is None:
            return False

        faces = self._app.get(image)
        if not faces:
            return False

        largest_face = max(faces, key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]))
        self._registered_faces[child_id] = largest_face.embedding
        return True

    def detect_faces(self, image_path: str) -> list[dict]:
        """
        检测图片中的所有人脸。

        Returns:
            人脸信息列表，包含 bbox, age, gender
        """
        self._ensure_model()
        import cv2
        image = cv2.imread(image_path)
        if image is None:
            return []

        faces = self._app.get(image)
        return [
            {
                "bbox": face.bbox.tolist(),
                "age": int(face.age) if hasattr(face, "age") else None,
                "gender": "male" if getattr(face, "gender", 0) == 1 else "female",
                "embedding": face.embedding,
            }
            for face in faces
        ]

    def identify_child(self, image_path: str, threshold: float = 0.4) -> list[str]:
        """
        识别图片中出现的已注册孩子。

        Args:
            image_path: 图片路径
            threshold: 相似度阈值（余弦距离）

        Returns:
            匹配到的 child_id 列表
        """
        if not self._registered_faces:
            return []

        detected = self.detect_faces(image_path)
        matched_children = []

        for face_info in detected:
            face_embedding = face_info["embedding"]
            for child_id, registered_embedding in self._registered_faces.items():
                similarity = np.dot(face_embedding, registered_embedding) / (
                    np.linalg.norm(face_embedding) * np.linalg.norm(registered_embedding)
                )
                if similarity >= threshold:
                    matched_children.append(child_id)

        return list(set(matched_children))


face_engine = FaceEngine()
