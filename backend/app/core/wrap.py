"""
Response wrapper middleware/dependency for standardized API responses.
"""
from typing import Any, Dict
from fastapi import Response
from fastapi.responses import JSONResponse


def wrap_response(data: Any, code: int = 0, message: str = "") -> JSONResponse:
    """Wrap any response data into standardized format."""
    return JSONResponse(
        status_code=200,
        content={
            "code": code,
            "data": data,
            "message": message
        }
    )
