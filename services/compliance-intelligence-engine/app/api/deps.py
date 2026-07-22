from fastapi import Request

from app.service import ComplianceEvaluationService
from app.wiring import Container


def get_container(request: Request) -> Container:
    return request.app.state.container


def get_evaluation_service(request: Request) -> ComplianceEvaluationService:
    return get_container(request).evaluation_service
