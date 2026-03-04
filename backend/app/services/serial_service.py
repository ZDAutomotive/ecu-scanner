"""
Serial port listener service.
"""
import threading
import time
import serial
import logging
from typing import Optional, Callable
from app.core.config import settings

logger = logging.getLogger(__name__)

DEFAULT_RECONNECT_INTERVAL = 5  # seconds


class SerialListener:
    """Serial port listener for barcode scanner."""

    def __init__(
        self,
        on_data_callback: Callable[[str], None],
        on_status_change: Optional[Callable[[bool], None]] = None,
        reconnect_interval: int = DEFAULT_RECONNECT_INTERVAL,
    ):
        self.on_data_callback = on_data_callback
        self.on_status_change = on_status_change
        self.serial_port: Optional[serial.Serial] = None
        self.running = False
        self.thread: Optional[threading.Thread] = None
        self._connected = False
        self.reconnect_interval = reconnect_interval
        self._should_stop = False

    def connect(self) -> bool:
        """Connect to serial port."""
        try:
            # Close existing port if any
            if self.serial_port and self.serial_port.is_open:
                self.serial_port.close()

            self.serial_port = serial.Serial(
                port=settings.serial_port,
                baudrate=settings.serial_baudrate,
                bytesize=settings.serial_bytesize,
                parity=settings.serial_parity,
                stopbits=settings.serial_stopbits,
                timeout=1,
            )
            self._connected = True
            logger.info(f"Connected to serial port {settings.serial_port}")
            if self.on_status_change:
                self.on_status_change(True)
            return True
        except serial.SerialException as e:
            logger.error(f"Failed to connect to serial port: {e}")
            if self.on_status_change and self._connected is True:
                self.on_status_change(False)
            self._connected = False
            return False

    def disconnect(self):
        """Disconnect from serial port."""
        self._should_stop = True
        self.running = False
        if self.thread and self.thread.is_alive():
            self.thread.join(timeout=2)
        if self.serial_port and self.serial_port.is_open:
            self.serial_port.close()
        self._connected = False
        logger.info("Disconnected from serial port")
        if self.on_status_change:
            self.on_status_change(False)

    def start(self) -> bool:
        """Start listening to serial port."""
        if not self._connected:
            if not self.connect():
                # Start background reconnection thread
                logger.info("Starting background reconnection...")
                reconnect_thread = threading.Thread(
                    target=self._reconnect_loop,
                    daemon=True,
                    name="SerialReconnect"
                )
                reconnect_thread.start()
                return False

        self.running = True
        self._should_stop = False
        self.thread = threading.Thread(
            target=self._read_loop, daemon=True, name="SerialRead")
        self.thread.start()
        logger.info("Serial listener started")
        return True

    def _read_loop(self):
        """Read data from serial port in loop."""
        buffer = ""

        while self.running and not self._should_stop:
            try:
                if self.serial_port and self.serial_port.in_waiting > 0:
                    data = self.serial_port.read(self.serial_port.in_waiting)
                    buffer += data.decode("utf-8", errors="ignore")

                    while "\n" in buffer:
                        line, buffer = buffer.split("\n", 1)
                        barcode = line.strip("\r\n")

                        if barcode:
                            logger.info(f"Received barcode: {barcode}")
                            if self.on_data_callback:
                                self.on_data_callback(barcode)

                # Check connection status
                if self.serial_port and not self.serial_port.is_open:
                    if self._connected:
                        self._connected = False
                        logger.warning("Serial port disconnected")
                        if self.on_status_change:
                            self.on_status_change(False)
                        # Trigger reconnection
                        self._start_reconnect()
                        break

                # Small sleep to prevent CPU spinning
                time.sleep(0.1)

            except serial.SerialException as e:
                logger.error(f"Serial error: {e}")
                self._connected = False
                if self.on_status_change:
                    self.on_status_change(False)
                self._start_reconnect()
                break
            except Exception as e:
                logger.error(f"Unexpected error: {e}")
                break

    def _start_reconnect(self):
        """Start reconnection in background."""
        if self._should_stop:
            return
        logger.info("Starting reconnection...")
        reconnect_thread = threading.Thread(
            target=self._reconnect_loop,
            daemon=True,
            name="SerialReconnect"
        )
        reconnect_thread.start()

    def _reconnect_loop(self):
        """Background reconnection loop."""
        while not self._should_stop and not self._connected:
            logger.info(
                f"Attempting to reconnect (interval: {self.reconnect_interval}s)...")
            time.sleep(self.reconnect_interval)

            if self._should_stop:
                break

            if self.connect():
                logger.info("Reconnection successful, starting read loop")
                self.running = True
                read_thread = threading.Thread(
                    target=self._read_loop,
                    daemon=True,
                    name="SerialRead"
                )
                read_thread.start()
                read_thread.join()
                # If we exit here, connection was lost again
                if not self._connected:
                    logger.info("Connection lost again, will retry...")

        logger.info("Reconnection loop ended")

    def is_connected(self) -> bool:
        """Check if connected to serial port."""
        return self._connected

    def stop(self):
        """Stop the serial listener."""
        self._should_stop = True
        self.running = False
        if self.thread and self.thread.is_alive():
            self.thread.join(timeout=2)
        if self.serial_port and self.serial_port.is_open:
            self.serial_port.close()
        self._connected = False
        logger.info("Serial listener stopped")
        if self.on_status_change:
            self.on_status_change(False)

    def get_status(self) -> dict:
        """Get connection status."""
        return {
            "connected": self._connected,
            "port": settings.serial_port,
            "baudrate": settings.serial_baudrate,
        }
