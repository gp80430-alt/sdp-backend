"""
SQLite 데이터베이스 모델 (SQLAlchemy async)
- TreasureSpot  : 보물 장소
- ClaimRecord   : 획득 기록 (중복 방지)
- EventZone     : 관리자가 그린 행사 구역 다각형
- Transaction   : 코인 지급/소각 내역
"""
import os
import ssl
from datetime import date, datetime
from cryptography.fernet import Fernet
from sqlalchemy import (
    Column, String, Float, Integer, Boolean,
    Date, DateTime, JSON, Text, create_engine, UniqueConstraint
)
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession

# [개인정보 보호] 암호화 키 설정
SECRET_KEY = os.getenv("ENCRYPTION_KEY", Fernet.generate_key().decode())
cipher_suite = Fernet(SECRET_KEY.encode())

def encrypt_data(data: str) -> str:
    if not data: return data
    return cipher_suite.encrypt(data.encode()).decode()

def decrypt_data(data: str) -> str:
    if not data: return data
    try:
        return cipher_suite.decrypt(data.encode()).decode()
    except:
        return "Decryption Error"

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./sdp.db")

# ── Supabase(PostgreSQL)용 SSL 설정 ──────────────────────────────────
connect_args = {}
if "postgresql" in DATABASE_URL:
    # 윈도우에서 SSL 검증 문제를 피하기 위한 가장 확실한 방법
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    connect_args = {
        "ssl": ctx,
        "server_settings": {
            "ssl_renegotiation_limit": "0"
        }
    }

engine = create_async_engine(DATABASE_URL, echo=False, connect_args=connect_args)
AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

Base = declarative_base()

# ── 모델 정의 ─────────────────────────────────────────────────────
class TreasureSpot(Base):
    __tablename__ = "treasure_spots"
    id          = Column(String, primary_key=True)
    name        = Column(String, nullable=False)
    description = Column(Text,   default="")
    lat         = Column(Float,  nullable=False)
    lng         = Column(Float,  nullable=False)
    coin_reward = Column(Integer, default=1)
    icon        = Column(String,  default="💰")
    radius_m    = Column(Integer, default=10)
    daily_limit = Column(Integer, default=100)
    is_active   = Column(Boolean, default=True)
    created_at  = Column(DateTime, default=datetime.utcnow)

class ClaimRecord(Base):
    __tablename__ = "claim_records"
    id          = Column(Integer, primary_key=True, autoincrement=True)
    user_id     = Column(String, nullable=False)
    wallet_addr = Column(String, nullable=False)
    spot_id     = Column(String, nullable=False)
    claim_date  = Column(Date,   nullable=False, default=date.today)
    lat         = Column(Float)
    lng         = Column(Float)
    device_id   = Column(String)
    tx_hash     = Column(String)
    created_at  = Column(DateTime, default=datetime.utcnow)
    __table_args__ = (UniqueConstraint('user_id', 'spot_id', 'claim_date', name='_user_spot_date_uc'),)

class EventZone(Base):
    __tablename__ = "event_zones"
    id            = Column(Integer, primary_key=True, autoincrement=True)
    name          = Column(String, default="행사 구역")
    polygon_coords = Column(JSON)
    treasure_spots = Column(JSON)
    is_active     = Column(Boolean, default=True)
    created_at    = Column(DateTime, default=datetime.utcnow)

class CoinTransaction(Base):
    __tablename__ = "coin_transactions"
    id          = Column(Integer, primary_key=True, autoincrement=True)
    tx_type     = Column(String)
    user_id     = Column(String)
    wallet_addr = Column(String)
    amount      = Column(Integer)
    reason      = Column(String)
    tx_hash     = Column(String)
    block_number = Column(Integer)
    created_at  = Column(DateTime, default=datetime.utcnow)

class User(Base):
    __tablename__ = "users"
    id           = Column(String, primary_key=True)
    name         = Column(String, nullable=False)
    phone        = Column(String)
    wallet_addr  = Column(String, unique=True)
    is_admin     = Column(Boolean, default=False)
    total_earned = Column(Integer, default=0)
    last_lat     = Column(Float)
    last_lng     = Column(Float)
    last_claim_at = Column(DateTime)
    created_at   = Column(DateTime, default=datetime.utcnow)

class AdminLog(Base):
    __tablename__ = "admin_logs"
    id          = Column(Integer, primary_key=True, autoincrement=True)
    admin_id    = Column(String)
    action      = Column(String)
    details     = Column(Text)
    created_at  = Column(DateTime, default=datetime.utcnow)

# ── DB 초기화 ─────────────────────────────────────────────────────
async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
