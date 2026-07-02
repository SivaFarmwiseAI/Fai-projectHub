import psycopg2


def get_connection():
    return psycopg2.connect(
        host="localhost",
        port=5432,
        database="app_notifications",
        user="postgres",
        password="admin"
    )


def create_tables():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS notifications (
            id            VARCHAR(36)   PRIMARY KEY,
            application_id VARCHAR(255) NOT NULL,
            user_id       VARCHAR(255)  NOT NULL,
            title         VARCHAR(500)  NOT NULL,
            message       TEXT          NOT NULL,
            type          VARCHAR(50)   NOT NULL,
            category      VARCHAR(50)   NOT NULL,
            priority      VARCHAR(50)   NOT NULL,
            is_read       BOOLEAN       NOT NULL DEFAULT FALSE,
            created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
        )
        """
    )
    conn.commit()
    cursor.close()
    conn.close()
