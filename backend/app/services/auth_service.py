"""
Kimlik Doğrulama Servisi — JWT + bcrypt
=========================================
- Kullanıcı kaydı / girişi
- Token oluşturma / doğrulama
- Şifre hash'leme
"""
import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

import jwt
from passlib.context import CryptContext

from app.config import settings
from app.database import db_create_user, db_get_user_by_email, db_get_user_by_id

logger = logging.getLogger(__name__)

_ALGORITHM          = "HS256"
_TOKEN_EXPIRE_DAYS  = 30
_pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(plain: str) -> str:
    return _pwd.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    return _pwd.verify(plain, hashed)


def create_token(user_id: str, email: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=_TOKEN_EXPIRE_DAYS)
    payload = {
        "sub":   user_id,
        "email": email,
        "exp":   expire,
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=_ALGORITHM)


def decode_token(token: str) -> Optional[dict]:
    """Token'ı doğrula ve payload'ı döndür. Geçersizse None."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        logger.debug("[auth] Token süresi dolmuş.")
        return None
    except jwt.InvalidTokenError as e:
        logger.debug("[auth] Geçersiz token: %s", e)
        return None


def register_user(email: str, password: str) -> Optional[dict]:
    """
    Yeni kullanıcı kaydı.
    Başarılıysa {id, email, token} döner.
    E-posta zaten kayıtlıysa None döner.
    """
    user_id       = str(uuid.uuid4())
    password_hash = hash_password(password)
    created_at    = datetime.now(timezone.utc).isoformat()

    ok = db_create_user(user_id, email, password_hash, created_at)
    if not ok:
        logger.warning("[auth] Kayıt başarısız — e-posta zaten var: %s", email)
        return None

    token = create_token(user_id, email)
    logger.info("[auth] Yeni kullanıcı kaydedildi: %s", email)
    return {"id": user_id, "email": email, "token": token}


def login_user(email: str, password: str) -> Optional[dict]:
    """
    Giriş doğrulama.
    Başarılıysa {id, email, token} döner.
    Yanlış bilgilerde None döner.
    """
    user = db_get_user_by_email(email)
    if not user:
        logger.debug("[auth] Giriş başarısız — kullanıcı bulunamadı: %s", email)
        return None
    if not verify_password(password, user["password_hash"]):
        logger.debug("[auth] Giriş başarısız — şifre hatalı: %s", email)
        return None

    token = create_token(user["id"], user["email"])
    logger.info("[auth] Giriş yapıldı: %s", email)
    return {"id": user["id"], "email": user["email"], "token": token}


def get_user_by_id(user_id: str) -> Optional[dict]:
    return db_get_user_by_id(user_id)
