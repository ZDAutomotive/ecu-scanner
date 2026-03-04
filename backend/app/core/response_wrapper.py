"""
Response wrapper decorator for standardized API responses.
"""
from functools import wraps
from typing import Any, Callable, Dict
from fastapi import HTTPException


def api_response(func: Callable) -> Callable:
    """
    Decorator to wrap endpoint responses in standardized format.
    Handles both sync and async functions.
    """
    @wraps(func)
    async def async_wrapper(*args, **kwargs):
        result = await func(*args, **kwargs)

        # If already wrapped, return as-is
        if isinstance(result, dict) and 'code' in result:
            return result

        # Wrap in standard format
        return {
            "code": 0,
            "data": result,
            "message": "Success"
        }

    @wraps(func)
    def sync_wrapper(*args, **kwargs):
        result = func(*args, **kwargs)

        # If already wrapped, return as-is
        if isinstance(result, dict) and 'code' in result:
            return result

        # Wrap in standard format
        return {
            "code": 0,
            "data": result,
            "message": "Success"
        }

    # Return appropriate wrapper based on function type
    import asyncio
    if asyncio.iscoroutinefunction(func):
        return async_wrapper
    return sync_wrapper


# Alternative: A simple helper function to create standardized responses
def success_response(data: Any, message: str = "Success") -> Dict:
    """Create a standardized success response."""
    return {
        "code": 0,
        "data": data,
        "message": message
    }


def error_response(message: str, code: int = 1) -> Dict:
    """Create a standardized error response."""
    return {
        "code": code,
        "data": None,
        "message": message
    }
