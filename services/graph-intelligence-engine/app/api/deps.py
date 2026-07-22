from fastapi import Request

from app.wiring import Container


def get_container(request: Request) -> Container:
    return request.app.state.container
