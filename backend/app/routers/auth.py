"""
Auth Router — /api/auth
========================
POST /api/auth/register  → Kayıt ol
POST /api/auth/login     → Giriş yap
GET  /api/auth/me        → Mevcut kullanıcı
"""
import logging
from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel

from app.services.auth_service import register_user, login_user, get_user_by_id, decode_token

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/auth", tags=["auth"])
_bearer = HTTPBearer(auto_error=False)


# ── Request / Response modelleri ──────────────────────────────────────────────

class RegisterRequest(BaseModel):
    email:    str
    password: str


class LoginRequest(BaseModel):
    email:    str
    password: str


# ── Bağımlılık — mevcut kullanıcıyı token'dan çöz ────────────────────────────

def get_current_user(
    creds: HTTPAuthorizationCredentials = Depends(_bearer),
) -> dict:
    """
    FastAPI Depends() bağımlılığı.
    Authorization: Bearer <token> başlığını doğrular ve {sub, email} payload döner.
    401 fırlatır → token geçersiz / yok.
    """
    if not creds:
        raise HTTPException(401, "Giriş yapmanız gerekiyor.")
    payload = decode_token(creds.credentials)
    if not payload:
        raise HTTPException(401, "Oturum süresi dolmuş veya geçersiz token.")
    return payload


def get_optional_user(
    creds: HTTPAuthorizationCredentials = Depends(_bearer),
) -> dict | None:
    """Token varsa doğrula, yoksa None dön. Opsiyonel auth gerektiren endpoint'ler için."""
    if not creds:
        return None
    return decode_token(creds.credentials)


# ── Endpoint'ler ──────────────────────────────────────────────────────────────

@router.post("/register", summary="Yeni kullanıcı kaydı")
async def register(req: RegisterRequest):
    email = req.email.strip().lower()
    if not email or "@" not in email:
        raise HTTPException(400, "Geçerli bir e-posta adresi girin.")
    if len(req.password) < 6:
        raise HTTPException(400, "Şifre en az 6 karakter olmalıdır.")

    result = register_user(email, req.password)
    if result is None:
        raise HTTPException(409, "Bu e-posta adresi zaten kayıtlı.")

    logger.info("[auth/register] Yeni kullanıcı: %s", email)
    return {
        "token": result["token"],
        "user":  {"id": result["id"], "email": result["email"]},
    }


@router.post("/login", summary="Giriş yap")
async def login(req: LoginRequest):
    result = login_user(req.email, req.password)
    if result is None:
        raise HTTPException(401, "E-posta veya şifre hatalı.")

    logger.info("[auth/login] Giriş: %s", req.email)
    return {
        "token": result["token"],
        "user":  {"id": result["id"], "email": result["email"]},
    }


@router.get("/me", summary="Mevcut kullanıcı bilgisi")
async def me(current_user: dict = Depends(get_current_user)):
    user = get_user_by_id(current_user["sub"])
    if not user:
        raise HTTPException(404, "Kullanıcı bulunamadı.")
    return {"id": user["id"], "email": user["email"], "created_at": user["created_at"]}
