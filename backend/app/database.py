"""
SQLite Veritabanı — Kullanıcı & Simülasyon Kalıcılığı
=======================================================
Tablolar:
  users            — e-posta / şifre hash / kayıt tarihi
  sim_accounts     — kullanıcı başına simülasyon hesabı (JSON)
  sim_transactions — her kullanıcının işlem geçmişi
"""
import json
import logging
import sqlite3
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

# Veritabanı dosyası backend/data/ klasöründe
_DB_DIR  = Path(__file__).parent.parent / "data"
_DB_PATH = _DB_DIR / "piyasanabzi.db"


def _get_conn() -> sqlite3.Connection:
    _DB_DIR.mkdir(exist_ok=True)
    conn = sqlite3.connect(str(_DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")   # eş zamanlı okuma için
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db() -> None:
    """Tabloları oluştur (yoksa). Uygulama başlangıcında çağrılır."""
    with _get_conn() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS users (
                id           TEXT PRIMARY KEY,
                email        TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                created_at   TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS sim_accounts (
                user_id    TEXT PRIMARY KEY,
                data       TEXT NOT NULL,      -- SimulationAccount JSON
                updated_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS sim_transactions (
                id         TEXT PRIMARY KEY,
                user_id    TEXT NOT NULL,
                timestamp  TEXT NOT NULL,
                tx_type    TEXT NOT NULL,
                symbol     TEXT NOT NULL,
                name       TEXT NOT NULL,
                quantity   REAL NOT NULL,
                price      REAL NOT NULL,
                total      REAL NOT NULL,
                fee        REAL NOT NULL DEFAULT 0,
                FOREIGN KEY (user_id) REFERENCES users(id)
            );

            CREATE INDEX IF NOT EXISTS idx_sim_tx_user ON sim_transactions(user_id);
        """)
    logger.info("[db] Veritabanı hazır: %s", _DB_PATH)


# ── Kullanıcı işlemleri ───────────────────────────────────────────────────────

def db_create_user(user_id: str, email: str, password_hash: str, created_at: str) -> bool:
    """Yeni kullanıcı ekle. E-posta zaten varsa False döner."""
    try:
        with _get_conn() as conn:
            conn.execute(
                "INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)",
                (user_id, email.lower().strip(), password_hash, created_at),
            )
        return True
    except sqlite3.IntegrityError:
        return False


def db_get_user_by_email(email: str) -> Optional[dict]:
    with _get_conn() as conn:
        row = conn.execute(
            "SELECT id, email, password_hash, created_at FROM users WHERE email = ?",
            (email.lower().strip(),),
        ).fetchone()
    return dict(row) if row else None


def db_get_user_by_id(user_id: str) -> Optional[dict]:
    with _get_conn() as conn:
        row = conn.execute(
            "SELECT id, email, created_at FROM users WHERE id = ?",
            (user_id,),
        ).fetchone()
    return dict(row) if row else None


# ── Simülasyon hesabı işlemleri ───────────────────────────────────────────────

def db_save_account(user_id: str, account_dict: dict, updated_at: str) -> None:
    with _get_conn() as conn:
        conn.execute(
            """INSERT INTO sim_accounts (user_id, data, updated_at) VALUES (?, ?, ?)
               ON CONFLICT(user_id) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at""",
            (user_id, json.dumps(account_dict, ensure_ascii=False), updated_at),
        )


def db_load_account(user_id: str) -> Optional[dict]:
    with _get_conn() as conn:
        row = conn.execute(
            "SELECT data FROM sim_accounts WHERE user_id = ?",
            (user_id,),
        ).fetchone()
    if row:
        return json.loads(row["data"])
    return None


def db_delete_account(user_id: str) -> None:
    """Kullanıcının simülasyon hesabını sil (reset)."""
    with _get_conn() as conn:
        conn.execute("DELETE FROM sim_accounts WHERE user_id = ?", (user_id,))
        conn.execute("DELETE FROM sim_transactions WHERE user_id = ?", (user_id,))


# ── İşlem geçmişi işlemleri ───────────────────────────────────────────────────

def db_insert_transaction(user_id: str, tx: dict) -> None:
    with _get_conn() as conn:
        conn.execute(
            """INSERT OR IGNORE INTO sim_transactions
               (id, user_id, timestamp, tx_type, symbol, name, quantity, price, total, fee)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                tx["id"], user_id, tx["timestamp"], tx["tx_type"],
                tx["symbol"], tx["name"], tx["quantity"],
                tx["price"], tx["total"], tx.get("fee", 0),
            ),
        )


def db_load_transactions(user_id: str) -> list[dict]:
    with _get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM sim_transactions WHERE user_id = ? ORDER BY timestamp DESC",
            (user_id,),
        ).fetchall()
    return [dict(r) for r in rows]
