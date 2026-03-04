"""
ECU Scanner Backend - Main Application
"""
from contextlib import asynccontextmanager
import asyncio
import threading
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.middleware import ResponseWrapperMiddleware
from app.api import routes
from app.services.serial_service import SerialListener
from app.services.validation_service import ValidationService
from app.models.database import SessionLocal

# Global serial listener instance
serial_listener: SerialListener = None


def create_serial_listener():
    """Create and configure serial listener."""
    global serial_listener

    def on_barcode_received(barcode: str):
        """Handle barcode data received from scanner."""
        print(f"Received barcode: {barcode}")

        # Process the barcode
        db = SessionLocal()
        try:
            validation_service = ValidationService(db)
            is_valid, result = validation_service.process_scan(barcode)

            # Broadcast to all connected WebSocket clients (thread-safe)
            broadcast_scan_result(result)

        except Exception as e:
            print(f"Error processing barcode: {e}")
        finally:
            db.close()

    def on_scanner_status_changed(connected: bool):
        """Handle scanner connection status change."""
        print(f"Scanner status changed: {'connected' if connected else 'disconnected'}")
        broadcast_scanner_status(connected)

    serial_listener = SerialListener(on_barcode_received, on_scanner_status_changed)
    return serial_listener


# WebSocket connection manager
class ConnectionManager:
    """WebSocket connection manager."""

    def __init__(self):
        self.active_connections: list[WebSocket] = []
        self._lock = threading.Lock()
        # Queue for thread-safe message broadcasting
        self._message_queue: asyncio.Queue = None
        self._broadcast_task: asyncio.Task = None

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        with self._lock:
            self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        with self._lock:
            if websocket in self.active_connections:
                self.active_connections.remove(websocket)

    async def send_message(self, message: dict):
        # Create a copy of connections to avoid modification during iteration
        with self._lock:
            connections = self.active_connections.copy()

        # Disconnect any closed connections
        disconnected = []
        for connection in connections:
            try:
                await connection.send_json(message)
            except Exception as e:
                print(f"Error sending WebSocket message: {e}")
                disconnected.append(connection)

        # Remove disconnected connections
        with self._lock:
            for ws in disconnected:
                if ws in self.active_connections:
                    self.active_connections.remove(ws)


manager = ConnectionManager()


def broadcast_scan_result(result: dict):
    """Broadcast scan result to all connected clients (thread-safe)."""
    try:
        # Try to get the running event loop
        loop = asyncio.get_running_loop()
        # Schedule the broadcast on the existing event loop
        asyncio.run_coroutine_threadsafe(manager.send_message(result), loop)
    except RuntimeError:
        # No running loop - this shouldn't happen in FastAPI but handle it gracefully
        # Log warning but don't crash
        print("Warning: No running event loop for WebSocket broadcast")


def broadcast_scanner_status(connected: bool):
    """Broadcast scanner connection status to all connected clients (thread-safe)."""
    message = {
        "type": "scanner_status",
        "connected": connected,
        "port": settings.serial_port,
        "baudrate": settings.serial_baudrate,
    }
    try:
        # Try to get existing event loop
        loop = asyncio.get_running_loop()
        # Schedule the broadcast on the existing event loop
        asyncio.run_coroutine_threadsafe(manager.send_message(message), loop)
    except RuntimeError:
        # No running loop - create a task to run when loop is available
        # This handles the startup case when lifespan hasn't yielded yet
        def _broadcast_later():
            try:
                asyncio.run(manager.send_message(message))
            except Exception as e:
                print(f"Failed to broadcast scanner status: {e}")

        # Schedule in a new thread to avoid blocking
        thread = threading.Thread(target=_broadcast_later, daemon=True)
        thread.start()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager."""
    # Startup: initialize serial listener
    global serial_listener
    serial_listener = create_serial_listener()

    # Try to start serial listener
    if serial_listener.start():
        print(f"Serial listener started on {settings.serial_port}")
    else:
        print(f"Failed to start serial listener on {settings.serial_port}")

    yield

    # Shutdown: stop serial listener
    if serial_listener:
        serial_listener.stop()
        print("Serial listener stopped")


app = FastAPI(title="ECU Scanner API", version="1.0.0", lifespan=lifespan)

# CORS configuration
# Note: allow_credentials=True cannot be used with allow_origins=["*"]
# If you need credentials, specify explicit origins in CORS_ORIGINS env variable
cors_origins = settings.cors_origins_list
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=len(cors_origins) != 1 or cors_origins[0] != "*",
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add response wrapper middleware for standardized API responses
app.add_middleware(ResponseWrapperMiddleware)

# Include API routes
app.include_router(routes.router, prefix="/api")


@app.get("/")
async def root():
    """Health check endpoint."""
    return {"status": "ok", "message": "ECU Scanner API is running"}


# WebSocket endpoint for real-time scan results
@app.websocket("/ws/scan")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time scan results."""
    await manager.connect(websocket)
    try:
        while True:
            # Keep connection alive, wait for messages
            data = await websocket.receive_text()
            # Handle any incoming messages if needed
            print(f"WebSocket received: {data}")
    except WebSocketDisconnect:
        manager.disconnect(websocket)
        print("WebSocket disconnected")


# Serial control endpoints
@app.get("/api/serial/status")
async def get_serial_status():
    """Get serial port connection status."""
    if serial_listener:
        return {
            "connected": serial_listener.is_connected(),
            "port": settings.serial_port,
            "baudrate": settings.serial_baudrate,
        }
    return {"connected": False, "port": settings.serial_port, "baudrate": settings.serial_baudrate}


@app.post("/api/serial/connect")
async def connect_serial():
    """Connect to serial port."""
    global serial_listener
    if serial_listener is None:
        serial_listener = create_serial_listener()

    success = serial_listener.start()
    return {"success": success, "message": "Connected" if success else "Failed to connect"}


@app.post("/api/serial/disconnect")
async def disconnect_serial():
    """Disconnect from serial port."""
    global serial_listener
    if serial_listener:
        serial_listener.stop()
    return {"success": True, "message": "Disconnected"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=settings.api_host, port=settings.api_port)
