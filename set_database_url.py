import os

pguser = os.environ.get('PGUSER')
pgpassword = os.environ.get('PGPASSWORD')
pghost = os.environ.get('PGHOST')
pgport = os.environ.get('PGPORT')
pgdatabase = os.environ.get('PGDATABASE')

if all([pguser, pgpassword, pghost, pgport, pgdatabase]):
    # Construct the database URL
    database_url = f"postgresql://{pguser}:{pgpassword}@{pghost}:{pgport}/{pgdatabase}?sslmode=require"
    print(f"export DATABASE_URL='{database_url}'")
else:
    print("Error: One or more required environment variables are missing.")
