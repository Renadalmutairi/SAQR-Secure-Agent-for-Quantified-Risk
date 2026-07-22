from fastapi import Request

from app.profile.service import BehavioralDnaService
from app.token_station.service import TokenStationService
from app.wiring import Container


def get_container(request: Request) -> Container:
    return request.app.state.container


def get_service(request: Request) -> BehavioralDnaService:
    return get_container(request).service


def get_token_service(request: Request) -> TokenStationService:
    return get_container(request).token_station
