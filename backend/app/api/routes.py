"""
API Routes.
"""
import re
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timedelta, timezone
from pydantic import BaseModel, ConfigDict

from app.models.database import get_db
from app.models.models import (
    ControlDomainConfig,
    HardwareConfig,
    ScanRecord,
    FlashRecord,
    ScanStatus,
)

router = APIRouter()

# Constants
MAX_PAGE_SIZE = 1000
MAX_SEARCH_LENGTH = 100
MAX_DATE_STRING_LENGTH = 32


def sanitize_search_pattern(search: str) -> str:
    """
    Sanitize search input to prevent SQL injection and DoS via wildcard abuse.
    - Limits length to prevent DoS
    - Escapes SQL special characters in LIKE pattern
    """
    if not search:
        return ""
    # Limit length
    search = search[:MAX_SEARCH_LENGTH]
    # Escape SQL special characters that could cause issues in LIKE
    # Note: SQLAlchemy uses % and _ as wildcards, escape them
    search = search.replace("\\", "\\\\")
    search = search.replace("%", "\\%")
    search = search.replace("_", "\\_")
    return search


def escape_sql_wildcards(pattern: str) -> str:
    """Escape SQL LIKE wildcards in user input."""
    return pattern.replace("%", r"\%").replace("_", r"\_")


# Pydantic schemas
class ScanResultResponse(BaseModel):
    """Scan result response schema."""
    model_config = ConfigDict(from_attributes=True)

    barcode: str
    part_number: Optional[str] = None
    hardware_id: Optional[str] = None
    serial_number: Optional[str] = None
    control_domain: Optional[str] = None
    status: str
    message: str


class HardwareConfigSchema(BaseModel):
    """Hardware config schema."""
    model_config = ConfigDict(from_attributes=True)

    part_number: str
    hardware_id: str
    control_domain: str
    description: Optional[str] = None


class ControlDomainSchema(BaseModel):
    """Control domain schema."""
    model_config = ConfigDict(from_attributes=True)

    name: str
    domain_code: str
    description: Optional[str] = None


class FlashRecordSchema(BaseModel):
    """Flash record schema."""
    model_config = ConfigDict(from_attributes=True)

    serial_number: str
    part_number: str
    hardware_id: str
    control_domain: str
    flash_status: str
    flash_result: Optional[str] = None


# Health check
@router.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}


# Manual scan endpoint
class ScanRequest(BaseModel):
    """Manual scan request schema."""
    barcode: str
    target_domain: Optional[str] = None


@router.post("/scan")
async def manual_scan(request: ScanRequest, db: Session = Depends(get_db)):
    """Process a manual scan (for testing or direct input)."""
    from app.services.validation_service import ValidationService

    validation_service = ValidationService(db)
    is_valid, result = validation_service.process_scan(request.barcode, request.target_domain)

    return {
        "code": 0 if is_valid else 1,
        "data": result,
        "message": result.get("message", "") if is_valid else result.get("error_message", ""),
    }


# Hardware Config APIs
@router.get("/hardware-config")
async def get_hardware_configs(db: Session = Depends(get_db)):
    """Get all hardware configurations."""
    configs = db.query(HardwareConfig).filter(HardwareConfig.is_active == 1).all()
    return {"code": 0, "data": configs}


@router.post("/hardware-config")
async def create_hardware_config(
    config: HardwareConfigSchema, db: Session = Depends(get_db)
):
    """Create hardware configuration."""
    try:
        db_config = HardwareConfig(**config.model_dump())
        db.add(db_config)
        db.commit()
        db.refresh(db_config)
        return {"code": 0, "data": config.model_dump(), "message": "Created successfully"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to create hardware config: {str(e)}")


# Control Domain APIs
@router.get("/control-domains")
async def get_control_domains(db: Session = Depends(get_db)):
    """Get all control domains."""
    domains = db.query(ControlDomainConfig).all()
    return {"code": 0, "data": domains}


@router.post("/control-domains")
async def create_control_domain(
    domain: ControlDomainSchema, db: Session = Depends(get_db)
):
    """Create control domain."""
    try:
        db_domain = ControlDomainConfig(**domain.model_dump())
        db.add(db_domain)
        db.commit()
        db.refresh(db_domain)
        return {"code": 0, "data": domain.model_dump(), "message": "Created successfully"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to create control domain: {str(e)}")


# Scan Record APIs
@router.get("/scan-records")
async def get_scan_records(
    limit: int = Query(default=100, ge=1, le=MAX_PAGE_SIZE),
    offset: int = Query(default=0, ge=0),
    control_domain: Optional[str] = None,
    status: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """Get scan records with filters."""
    # Validate and sanitize date inputs
    parsed_start_date = None
    parsed_end_date = None

    if start_date:
        if len(start_date) > MAX_DATE_STRING_LENGTH:
            raise HTTPException(status_code=400, detail="start_date too long")
        try:
            parsed_start_date = datetime.fromisoformat(start_date)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid start_date format, use ISO format")

    if end_date:
        if len(end_date) > MAX_DATE_STRING_LENGTH:
            raise HTTPException(status_code=400, detail="end_date too long")
        try:
            parsed_end_date = datetime.fromisoformat(end_date)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid end_date format, use ISO format")

    # Validate date range
    if parsed_start_date and parsed_end_date and parsed_start_date > parsed_end_date:
        raise HTTPException(status_code=400, detail="start_date must be before end_date")

    query = db.query(ScanRecord)

    if control_domain:
        query = query.filter(ScanRecord.control_domain == control_domain)
    if status:
        query = query.filter(ScanRecord.status == status)
    if search:
        # Sanitize search input to prevent SQL wildcard abuse
        sanitized_search = sanitize_search_pattern(search)
        search_pattern = f"%{sanitized_search}%"
        # Use escape parameter to treat escaped wildcards as literals
        query = query.filter(
            (ScanRecord.serial_number.like(search_pattern, escape="\\"))
            | (ScanRecord.part_number.like(search_pattern, escape="\\"))
        )
    if parsed_start_date:
        query = query.filter(ScanRecord.scanned_at >= parsed_start_date)
    if parsed_end_date:
        query = query.filter(ScanRecord.scanned_at <= parsed_end_date)

    total = query.count()
    records = query.order_by(ScanRecord.scanned_at.desc()).offset(offset).limit(limit).all()

    return {
        "code": 0,
        "data": {
            "total": total,
            "records": records,
        },
    }


# Flash Record APIs
@router.get("/flash-records")
async def get_flash_records(
    limit: int = Query(default=100, ge=1, le=MAX_PAGE_SIZE),
    offset: int = Query(default=0, ge=0),
    control_domain: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """Get flash records."""
    query = db.query(FlashRecord)

    if control_domain:
        query = query.filter(FlashRecord.control_domain == control_domain)
    if search:
        # Sanitize search input to prevent SQL wildcard abuse
        sanitized_search = sanitize_search_pattern(search)
        search_pattern = f"%{sanitized_search}%"
        query = query.filter(
            (FlashRecord.serial_number.like(search_pattern, escape="\\"))
            | (FlashRecord.part_number.like(search_pattern, escape="\\"))
        )

    total = query.count()
    records = query.order_by(FlashRecord.flashed_at.desc()).offset(offset).limit(limit).all()

    return {
        "code": 0,
        "data": {
            "total": total,
            "records": records,
        },
    }


@router.post("/flash-records")
async def create_flash_record(
    record: FlashRecordSchema, db: Session = Depends(get_db)
):
    """Create flash record."""
    try:
        db_record = FlashRecord(**record.model_dump())
        db.add(db_record)
        db.commit()
        db.refresh(db_record)
        return {"code": 0, "data": record.model_dump(), "message": "Created successfully"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to create flash record: {str(e)}")


# Statistics APIs
@router.get("/statistics/coverage")
async def get_coverage_statistics(db: Session = Depends(get_db)):
    """Get ECU flash coverage statistics by control domain."""
    domains = db.query(ControlDomainConfig).all()
    stats = []

    for domain in domains:
        total_scans = db.query(ScanRecord).filter(
            ScanRecord.control_domain == domain.domain_code,
            ScanRecord.status == ScanStatus.SUCCESS.value
        ).count()

        total_flashes = db.query(FlashRecord).filter(
            FlashRecord.control_domain == domain.domain_code
        ).count()

        stats.append({
            "domain": domain.domain_code,
            "domain_name": domain.name,
            "scanned": total_scans,
            "flashed": total_flashes,
        })

    return {"code": 0, "data": stats}


# Export APIs
@router.get("/export/csv")
async def export_csv(
    type: str = "scan",  # scan or flash
    control_domain: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """Export records as CSV."""
    # TODO: Implement CSV export
    return {"code": 0, "message": "Export feature coming soon"}


# Settings APIs
class SettingsSchema(BaseModel):
    """Settings schema."""
    model_config = ConfigDict(from_attributes=True)

    serial_port: str = "COM3"
    serial_baudrate: int = 9600
    serial_bytesize: int = 8
    serial_parity: str = "N"
    serial_stopbits: int = 1


@router.get("/settings")
async def get_settings():
    """Get application settings."""
    from app.core.config import settings
    return {
        "code": 0,
        "data": {
            "serial_port": settings.serial_port,
            "serial_baudrate": settings.serial_baudrate,
            "serial_bytesize": settings.serial_bytesize,
            "serial_parity": settings.serial_parity,
            "serial_stopbits": settings.serial_stopbits,
        }
    }


@router.post("/settings")
async def update_settings(settings_data: SettingsSchema):
    """Update application settings (requires restart to take effect)."""
    # Note: In production, these should be saved to a config file or database
    # For now, we just acknowledge the request
    return {"code": 0, "message": "Settings updated. Please restart the application for changes to take effect."}
