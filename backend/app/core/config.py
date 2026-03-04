"""
Backend configuration module.
"""
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings."""

    # Serial port configuration
    serial_port: str = "COM3"
    serial_baudrate: int = 9600
    serial_bytesize: int = 8
    serial_parity: str = "N"
    serial_stopbits: int = 1

    # Database
    database_url: str = "sqlite:///./ecu_scanner.db"

    # API
    api_host: str = "0.0.0.0"
    api_port: int = 8000

    # WebSocket
    ws_host: str = "0.0.0.0"
    ws_port: int = 8001

    # CORS
    cors_origins: str = "*"  # Comma-separated list of allowed origins

    class Config:
        env_file = ".env"

    @property
    def cors_origins_list(self) -> list[str]:
        """Parse CORS origins from comma-separated string."""
        if self.cors_origins == "*":
            return ["*"]
        return [origin.strip() for origin in self.cors_origins.split(",")]


settings = Settings()
