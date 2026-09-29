"""Create tables and seed the default administrator (admin / admin123)."""
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1] / "backend"))

from app.auth import hash_password  # noqa: E402
from app.database import SessionLocal, init_db  # noqa: E402
from app.models import User  # noqa: E402


def main() -> None:
    init_db()
    db = SessionLocal()
    try:
        if db.query(User).filter(User.username == "admin").first():
            print("admin user already exists")
            return
        db.add(
            User(
                username="admin",
                hashed_password=hash_password("admin123"),
                role="administrator",
            )
        )
        db.commit()
        print("seeded default admin -> username: admin  password: admin123")
    finally:
        db.close()


if __name__ == "__main__":
    main()
