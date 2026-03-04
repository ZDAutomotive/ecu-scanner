"""
Standardized API response format and utilities.
"""
from typing import TypeVar, Generic, Optional
from pydantic import BaseModel

T = TypeVar('T')


class ApiResponse(BaseModel, Generic[T]):
    """Standardized API response format."""
    code: int = 0
    data: Optional[T] = None
    message: str = ""

    @classmethod
    def success(cls, data: T, message: str = "Success"):
        return cls(code=0, data=data, message=message)

    @classmethod
    def error(cls, message: str, code: int = 1):
        return cls(code=code, data=None, message=message)
