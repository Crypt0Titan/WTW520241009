from app import app, db
from models import Admin
from werkzeug.security import generate_password_hash
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)

def recreate_admin_user():
    """Delete the existing admin user and create a new one."""
    with app.app_context():
        try:
            # Check if the admin user exists
            admin = Admin.query.filter_by(username='TitanAdmin').first()

            if admin:
                # Delete the existing admin user
                db.session.delete(admin)
                db.session.commit()
                logging.info(f"Admin user '{admin.username}' deleted successfully.")
            else:
                logging.info("No existing admin user found.")

            # Create the new admin user
            new_admin = Admin(username='TitanAdmin', password_hash=generate_password_hash('MMAvsBJJ911!'))
            db.session.add(new_admin)
            db.session.commit()
            logging.info("New admin user 'TitanAdmin' created successfully.")

        except Exception as e:
            logging.error(f"Error managing admin user: {str(e)}")

if __name__ == "__main__":
    recreate_admin_user()  # Delete existing admin and create new one
