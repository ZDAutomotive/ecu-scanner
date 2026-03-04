"""
Database initialization script.
Run this to create the database tables and seed initial data.
"""
from app.models.database import engine, Base
from app.models.models import ControlDomainConfig


def init_db():
    """Initialize database with tables and seed data."""
    # Create all tables
    Base.metadata.create_all(bind=engine)
    print("Database tables created successfully!")

    # Seed initial control domains
    from sqlalchemy.orm import Session
    with Session(engine) as db:
        # Check if domains already exist
        existing = db.query(ControlDomainConfig).count()
        if existing == 0:
            domains = [
                ControlDomainConfig(name="动力域", domain_code="PT", description="Power Train - 动力域"),
                ControlDomainConfig(name="底盘域", domain_code="Chassis", description="底盘控制系统"),
                ControlDomainConfig(name="车身域", domain_code="Body", description="车身电子"),
                ControlDomainConfig(name="信息娱乐域", domain_code="Infotainment", description="信息娱乐系统"),
                ControlDomainConfig(name="ADAS域", domain_code="ADAS", description="高级驾驶辅助系统"),
            ]
            db.add_all(domains)
            db.commit()
            print("Initial control domains seeded!")
        else:
            print("Control domains already exist, skipping seed.")


if __name__ == "__main__":
    init_db()
