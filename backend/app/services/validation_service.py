"""
Validation service - business logic for scan validation.
"""
import re
import logging
from typing import Optional, Tuple
from sqlalchemy.orm import Session
from app.models.models import (
    HardwareConfig,
    ScanRecord,
    FlashRecord,
    ScanStatus,
)

logger = logging.getLogger(__name__)


class ValidationService:
    """Service for validating scan data."""

    # Barcode pattern rules (configurable)
    BARCODE_PATTERNS = {
        "standard": r"^[A-Z0-9]{8,20}$",  # Standard alphanumeric
        "dpm": r"^[A-Z0-9.\-+]{10,30}$",  # DPM code pattern
    }

    def __init__(self, db: Session):
        self.db = db

    def parse_barcode(self, barcode: str) -> dict:
        """
        Parse barcode string and extract fields.
        Expected format: [PN]-[HWID]-[SN] or similar pattern.
        """
        # Remove any prefix/suffix
        barcode = barcode.strip()

        # Try to parse common formats
        # Format 1: PN|HWID|SN
        parts = barcode.split("|")
        if len(parts) >= 3:
            return {
                "part_number": parts[0],
                "hardware_id": parts[1],
                "serial_number": parts[2],
            }

        # Format 2: PN-HWID-SN
        parts = barcode.split("-")
        if len(parts) >= 3:
            return {
                "part_number": parts[0],
                "hardware_id": parts[1],
                "serial_number": parts[2],
            }

        # Format 3: Just use the whole barcode as serial number
        return {
            "part_number": None,
            "hardware_id": None,
            "serial_number": barcode,
        }

    def validate_format(self, barcode: str) -> Tuple[bool, str]:
        """
        Validate barcode format against configured rules.
        """
        barcode = barcode.strip()

        # Check minimum length
        if len(barcode) < 6:
            return False, "Barcode too short (minimum 6 characters)"

        # Check maximum length
        if len(barcode) > 50:
            return False, "Barcode too long (maximum 50 characters)"

        # Check against patterns
        for pattern_name, pattern in self.BARCODE_PATTERNS.items():
            if re.match(pattern, barcode):
                return True, "Valid"

        # If no pattern matches, allow but warn
        return True, "Valid (non-standard format)"

    def check_duplicate(self, serial_number: str) -> Tuple[bool, Optional[ScanRecord]]:
        """
        Check if serial number already exists with success status.
        """
        if not serial_number:
            return False, None

        existing = (
            self.db.query(ScanRecord)
            .filter(
                ScanRecord.serial_number == serial_number,
                ScanRecord.status == ScanStatus.SUCCESS.value,
            )
            .first()
        )

        if existing:
            return True, existing

        return False, None

    def validate_hw_id(
        self, hardware_id: str, control_domain: str
    ) -> Tuple[bool, Optional[HardwareConfig]]:
        """
        Validate if hardware ID matches configured target for the control domain.
        """
        if not hardware_id:
            return False, None

        config = (
            self.db.query(HardwareConfig)
            .filter(
                HardwareConfig.hardware_id == hardware_id,
                HardwareConfig.control_domain == control_domain,
                HardwareConfig.is_active == 1,
            )
            .first()
        )

        if config:
            return True, config

        return False, None

    def determine_control_domain(self, barcode: str) -> Optional[str]:
        """
        Determine control domain based on barcode characteristics.
        """
        # Default implementation - can be customized based on rules
        # For example, certain prefixes might indicate different domains
        barcode = barcode.upper()

        # Example rules (should be configurable)
        if barcode.startswith("PT") or "PT" in barcode:
            return "PT"
        elif barcode.startswith("CH") or "CHASSIS" in barcode:
            return "Chassis"
        elif barcode.startswith("BD") or "BODY" in barcode:
            return "Body"
        elif barcode.startswith("IF") or "INFO" in barcode:
            return "Infotainment"
        elif barcode.startswith("AD") or "ADAS" in barcode:
            return "ADAS"

        return None

    def process_scan(
        self, barcode: str, target_domain: Optional[str] = None
    ) -> Tuple[bool, dict]:
        """
        Process a complete scan validation workflow.
        """
        # Step 1: Format validation
        valid, message = self.validate_format(barcode)
        if not valid:
            return False, {
                "barcode": barcode,
                "status": "failed",
                "error_message": f"Format validation failed: {message}",
            }

        # Step 2: Parse barcode
        parsed = self.parse_barcode(barcode)
        serial_number = parsed.get("serial_number")
        part_number = parsed.get("part_number")
        hardware_id = parsed.get("hardware_id")

        # Step 3: Determine control domain
        control_domain = target_domain or self.determine_control_domain(barcode)

        # Step 4: Duplicate check
        is_duplicate, existing = self.check_duplicate(serial_number)
        if is_duplicate:
            # Create duplicate record
            record = ScanRecord(
                barcode=barcode,
                part_number=part_number,
                hardware_id=hardware_id,
                serial_number=serial_number,
                control_domain=control_domain,
                status=ScanStatus.DUPLICATE.value,
                error_message="Serial number already exists with success status",
            )
            self.db.add(record)
            self.db.commit()

            return False, {
                "barcode": barcode,
                "serial_number": serial_number,
                "status": "duplicate",
                "error_message": "This ECU has already been scanned successfully",
                "scanned_at": record.scanned_at.isoformat() if record.scanned_at else None,
            }

        # Step 5: HW ID validation (if hardware_id is available)
        if hardware_id:
            valid_hw, hw_config = self.validate_hw_id(hardware_id, control_domain)
            if not valid_hw:
                record = ScanRecord(
                    barcode=barcode,
                    part_number=part_number,
                    hardware_id=hardware_id,
                    serial_number=serial_number,
                    control_domain=control_domain,
                    status=ScanStatus.FAILED.value,
                    error_message=f"Hardware ID {hardware_id} does not match target for domain {control_domain}",
                )
                self.db.add(record)
                self.db.commit()

                return False, {
                    "barcode": barcode,
                    "hardware_id": hardware_id,
                    "serial_number": serial_number,
                    "control_domain": control_domain,
                    "status": "failed",
                    "error_message": f"Hardware ID does not match target for domain {control_domain}",
                }

        # Step 6: Success
        record = ScanRecord(
            barcode=barcode,
            part_number=part_number,
            hardware_id=hardware_id,
            serial_number=serial_number,
            control_domain=control_domain,
            status=ScanStatus.SUCCESS.value,
        )
        self.db.add(record)
        self.db.commit()

        return True, {
            "barcode": barcode,
            "part_number": part_number,
            "hardware_id": hardware_id,
            "serial_number": serial_number,
            "control_domain": control_domain,
            "status": "success",
            "message": "Scan validated successfully",
            "scanned_at": record.scanned_at.isoformat() if record.scanned_at else None,
        }
