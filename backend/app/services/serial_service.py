"""
Serial port listener service.
"""
import threading
import serial
import logging
from typing import Optional, Callable
from app.core.config import settings

logger = logging.getLogger(__name__)


class SerialListener:
    """Serial port listener for barcode scanner."""

    def __init__(self, on_data_callback: Callable[[str], None], on_status_change: Optional[Callable[[bool], None]] = None):
        self.on_data_callback = on_data_callback
        self.on_status_change = on_status_change
        self.serial_port: Optional[serial.Serial] = None
        self.running = False
        self.thread: Optional[threading.Thread] = None
        self._connected = False

    def connect(self) -> bool:
        """Connect to serial port."""
        try:
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
            # Notify status change
            if self.on_status_change:
                self.on_status_change(True)
            return True
        except serial.SerialException as e:
            logger.error(f"Failed to connect to serial port: {e}")
            self._connected = False
            # Notify status change
            if self.on_status_change:
                self.on_status_change(False)
            return False

    def disconnect(self):
        """Disconnect from serial port."""
        self.running = False
        if self.thread and self.thread.is_alive():
            self.thread.join(timeout=2)
        if self.serial_port and self.serial_port.is_open:
            self.serial_port.close()
        self._connected = False
        logger.info("Disconnected from serial port")
        # Notify status change
        if self.on_status_change:
            self.on_status_change(False)

    def start(self):
        """Start listening to serial port."""
        if not self._connected:
            if not self.connect():
                return False

        self.running = True
        self.thread = threading.Thread(target=self._read_loop, daemon=True)
        self.thread.start()
        logger.info("Serial listener started")
        return True

    def _read_loop(self):
        """Read data from serial port in loop."""
        buffer = ""

        while self.running:
            try:
                if self.serial_port and self.serial_port.in_waiting > 0:
                    data = self.serial_port.read(self.serial_port.in_waiting)
                    buffer += data.decode("utf-8", errors="ignore")

                    # Check for complete barcode (ending with newline)
                    while "\n" in buffer:
                        line, buffer = buffer.split("\n", 1)
                        barcode = line.strip("\r\n")

                        if barcode:
                            logger.info(f"Received barcode: {barcode}")
                            if self.on_data_callback:
                                self.on_data_callback(barcode)

                # Heartbeat check
                self._check_connection()

            except serial.SerialException as e:
                logger.error(f"Serial error: {e}")
                self._connected = False
                break
            except Exception as e:
                logger.error(f"Unexpected error: {e}")
                break

    def _check_connection(self):
        """Check if serial port is still connected."""
        if self.serial_port and not self.serial_port.is_open:
            if self._connected:  # Only notify if was previously connected
                self._connected = False
                logger.warning("Serial port disconnected")
                if self.on_status_change:
                    self.on_status_change(False)

    def is_connected(self) -> bool:
        """Check if connected to serial port."""
        return self._connected

    def stop(self):
        """Stop the serial listener."""
        self.running = False
        if self.thread and self.thread.is_alive():
            self.thread.join(timeout=2)
        self.disconnect()
        logger.info("Serial listener stopped")

    def get_status(self) -> dict:
        """Get connection status."""
        return {
            "connected": self._connected,
            "port": settings.serial_port,
            "baudrate": settings.serial_baudrate,
        }
