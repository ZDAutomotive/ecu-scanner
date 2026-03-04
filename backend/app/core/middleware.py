"""
Middleware for standardized API responses.
"""
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response
from fastapi import Request
import json


class ResponseWrapperMiddleware(BaseHTTPMiddleware):
    """
    Middleware to wrap all API responses in standardized format.
    """

    # Paths to exclude from wrapping (e.g., WebSocket, static files)
    EXCLUDE_PATHS = ['/ws', '/docs', '/openapi.json', '/redoc']

    async def dispatch(self, request: Request, call_next):
        # Skip non-API routes
        if not request.url.path.startswith('/api') or any(
            request.url.path.startswith(exclude) for exclude in self.EXCLUDE_PATHS
        ):
            return await call_next(request)

        response = await call_next(request)

        # Only process JSON responses
        if response.media_type != 'application/json':
            return response

        # Read response body
        body = b''
        async for chunk in response.body_iterator:
            body += chunk

        # Parse and wrap
        try:
            data = json.loads(body)

            # If already wrapped, return as-is
            if isinstance(data, dict) and 'code' in data:
                return Response(
                    content=body,
                    status_code=response.status_code,
                    media_type=response.media_type,
                    headers=dict(response.headers),
                )

            # Wrap in standard format
            wrapped = {
                "code": 0,
                "data": data,
                "message": "Success"
            }

            return Response(
                content=json.dumps(wrapped),
                status_code=response.status_code,
                media_type=response.media_type,
                headers=dict(response.headers),
            )
        except (json.JSONDecodeError, Exception):
            # If not JSON or error, return original
            return Response(
                content=body,
                status_code=response.status_code,
                media_type=response.media_type,
                headers=dict(response.headers),
            )
