"""
Database Setup Script
- Creates PostgreSQL database if not exists
- Runs migrations automatically
"""
import os
import sys
import subprocess
from psycopg import connect, OperationalError

# Database configuration
DB_NAME = os.environ.get('DB_NAME', 'dxdigitaltwin')
DB_USER = os.environ.get('DB_USER', 'postgres')
DB_PASSWORD = os.environ.get('DB_PASSWORD', '32167')
DB_HOST = os.environ.get('DB_HOST', 'localhost')
DB_PORT = os.environ.get('DB_PORT', '5432')


def create_database():
    """Create the database if it doesn't exist."""
    print(f"[1/3] Checking database '{DB_NAME}'...")

    try:
        # Connect to default 'postgres' database to create our database
        conn = connect(
            dbname='postgres',
            user=DB_USER,
            password=DB_PASSWORD,
            host=DB_HOST,
            port=DB_PORT,
            autocommit=True
        )

        cursor = conn.cursor()

        # Check if database exists
        cursor.execute(
            "SELECT 1 FROM pg_database WHERE datname = %s",
            (DB_NAME,)
        )

        if cursor.fetchone():
            print(f"      Database '{DB_NAME}' already exists.")
        else:
            # Create database
            cursor.execute(f'CREATE DATABASE {DB_NAME}')
            print(f"      Database '{DB_NAME}' created successfully!")

        cursor.close()
        conn.close()
        return True

    except OperationalError as e:
        print(f"      ERROR: Could not connect to PostgreSQL.")
        print(f"      Make sure PostgreSQL is running and credentials are correct.")
        print(f"      Details: {e}")
        return False


def init_migrations():
    """Initialize Flask-Migrate if not already initialized."""
    print("[2/3] Initializing migrations...")

    migrations_dir = os.path.join(os.path.dirname(__file__), 'migrations')

    if os.path.exists(migrations_dir):
        print("      Migrations folder already exists.")
    else:
        result = subprocess.run(
            [sys.executable, '-m', 'flask', 'db', 'init'],
            cwd=os.path.dirname(__file__),
            capture_output=True,
            text=True
        )
        if result.returncode == 0:
            print("      Migrations initialized successfully!")
        else:
            print(f"      Error: {result.stderr}")
            return False

    return True


def run_migrations():
    """Run database migrations."""
    print("[3/3] Running migrations...")

    # Create migration
    print("      Creating migration...")
    result = subprocess.run(
        [sys.executable, '-m', 'flask', 'db', 'migrate', '-m', 'Auto migration'],
        cwd=os.path.dirname(__file__),
        capture_output=True,
        text=True
    )

    if 'No changes in schema detected' in result.stderr:
        print("      No schema changes detected.")
    elif result.returncode != 0 and 'Target database is not up to date' not in result.stderr:
        # Ignore if no changes, continue to upgrade
        pass
    else:
        print("      Migration created.")

    # Apply migration
    print("      Applying migrations...")
    result = subprocess.run(
        [sys.executable, '-m', 'flask', 'db', 'upgrade'],
        cwd=os.path.dirname(__file__),
        capture_output=True,
        text=True
    )

    if result.returncode == 0:
        print("      Migrations applied successfully!")
        return True
    else:
        print(f"      Error: {result.stderr}")
        return False


def main():
    print("=" * 50)
    print("  Digital Twin Portal - Database Setup")
    print("=" * 50)
    print(f"\n  Host: {DB_HOST}:{DB_PORT}")
    print(f"  Database: {DB_NAME}")
    print(f"  User: {DB_USER}")
    print("")

    # Step 1: Create database
    if not create_database():
        print("\nSetup failed at database creation.")
        sys.exit(1)

    # Step 2: Initialize migrations
    if not init_migrations():
        print("\nSetup failed at migration initialization.")
        sys.exit(1)

    # Step 3: Run migrations
    if not run_migrations():
        print("\nSetup failed at migration execution.")
        sys.exit(1)

    print("\n" + "=" * 50)
    print("  Setup completed successfully!")
    print("=" * 50)
    print("\nYou can now run the server with:")
    print("  python run.py")
    print("")


if __name__ == '__main__':
    main()
