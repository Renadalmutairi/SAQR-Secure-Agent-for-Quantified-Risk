from fastapi import Request

from app.service import DecisionEvaluationService
from app.wiring import Container


def get_container(request: Request) -> Container:
    return request.app.state.container


def get_evaluation_service(request: Request) -> DecisionEvaluationService:
    return get_container(request).evaluation_service
