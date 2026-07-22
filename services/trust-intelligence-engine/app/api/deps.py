from fastapi import Request

from app.fusion.service import TrustEvaluationService
from app.wiring import Container


def get_container(request: Request) -> Container:
    return request.app.state.container


def get_evaluation_service(request: Request) -> TrustEvaluationService:
    return get_container(request).evaluation_service
