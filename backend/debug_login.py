import sys
from app.database import SessionLocal
from app.models.user import User, UserRole
from app.utils.security import hash_password

def main():
    try:
        db = SessionLocal()
        user_count = db.query(User).count()
        print("USER COUNT:", user_count)
        
        if user_count == 0:
            print("Creating default user...")
            default_user = User(
                name="Admin",
                email="admin@calibracao.com",
                password_hash=hash_password("admin123"),
                role=UserRole.ADMIN,
                must_change_password=False,
            )
            db.add(default_user)
            db.commit()
            print("User created successfully!")
            
        user = db.query(User).filter(User.email == "admin@calibracao.com").first()
        print("USER:", user)
        
    except Exception as e:
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    main()
