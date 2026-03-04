"""
Database models.
"""
from sqlalchemy import Column, Integer, String, DateTime, Enum
from datetime import datetime, timezone
import enum
from app.models.database import Base


def utc_now():
    """Return current UTC time as timezone-aware datetime."""
    return datetime.now(timezone.utc)


class ControlDomain(str, enum.Enum):
    """Control domain enumeration."""
    PT = "PT"  # Power Train - 动力域
    CHASSIS = "Chassis"  # 底盘域
    BODY = "Body"  # 车身域
    INFOTAINMENT = "Infotainment"  # 信息娱乐域
    ADAS = "ADAS"  # 高级驾驶辅助系统域


class ScanStatus(str, enum.Enum):
    """Scan status enumeration."""
    PENDING = "pending"
    SUCCESS = "success"
    FAILED = "failed"
    DUPLICATE = "duplicate"


class ControlDomainConfig(Base):
    """Control domain configuration table."""
    __tablename__ = "control_domain_config"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)
    domain_code = Column(String, nullable=False)
    description = Column(String, nullable=True)
    created_at = Column(DateTime, default=utc_now)


class HardwareConfig(Base):
    """Hardware configuration table - compliant HW IDs."""
    __tablename__ = "hardware_config"

    id = Column(Integer, primary_key=True, index=True)
    part_number = Column(String, nullable=False)  # PN
    hardware_id = Column(String, nullable=False)  # HW ID
    control_domain = Column(String, nullable=False)
    description = Column(String, nullable=True)
    is_active = Column(Integer, default=1)
    created_at = Column(DateTime, default=utc_now)


class ScanRecord(Base):
    """Scan record table - all scan events."""
    __tablename__ = "scan_records"

    id = Column(Integer, primary_key=True, index=True)
    barcode = Column(String, nullable=False)
    part_number = Column(String, nullable=True)
    hardware_id = Column(String, nullable=True)
    serial_number = Column(String, nullable=True)
    control_domain = Column(String, nullable=True)
    status = Column(String, default=ScanStatus.PENDING.value)
    error_message = Column(String, nullable=True)
    scanned_at = Column(DateTime, default=utc_now)


class FlashRecord(Base):
    """Flash record table - final binding of SN and flash result."""
    __tablename__ = "flash_records"

    id = Column(Integer, primary_key=True, index=True)
    serial_number = Column(String, nullable=False, index=True)
    part_number = Column(String, nullable=False)
    hardware_id = Column(String, nullable=False)
    control_domain = Column(String, nullable=False)
    flash_status = Column(String, nullable=False)
    flash_result = Column(String, nullable=True)
    flashed_at = Column(DateTime, default=utc_now)
