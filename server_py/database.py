"""
SQLite 데이터베이스 모델 (SQLAlchemy async)
- TreasureSpot  : 보물 장소
- ClaimRecord   : 획득 기록 (중복 방지)
- EventZone     : 관리자가 그린 행사 구역 다각형
- Transaction   : 코인 지급/소각 내역
"""
import os
from datetime import date, datetime
from cryptography.fernet import Fernet
from sqlalchemy import (
    Column, String, Float, Integer, Boolean,
    Date, DateTime, JSON, Text, create_engine, UniqueConstraint
)

# [개인정보 보호] 암호화 키 설정 (환경변수에서 가져오거나 생성)
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

from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./sdp.db")

engine = create_async_engine(DATABASE_URL, echo=False)
AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

Base = declarative_base()


# ── 보물 스팟 ─────────────────────────────────────────────────────
class TreasureSpot(Base):
    __tablename__ = "treasure_spots"

    id          = Column(String, primary_key=True)      # "T001" …
    name        = Column(String, nullable=False)
    description = Column(Text,   default="")
    lat         = Column(Float,  nullable=False)
    lng         = Column(Float,  nullable=False)
    coin_reward = Column(Integer, default=1)
    icon        = Column(String,  default="💰")
    radius_m    = Column(Integer, default=10)           # 인정 반경(m)
    daily_limit = Column(Integer, default=100)
    is_active   = Column(Boolean, default=True)
    created_at  = Column(DateTime, default=datetime.utcnow)


# ── 획득 기록 ─────────────────────────────────────────────────────
class ClaimRecord(Base):
    __tablename__ = "claim_records"

    id          = Column(Integer, primary_key=True, autoincrement=True)
    user_id     = Column(String, nullable=False)
    wallet_addr = Column(String, nullable=False)
    spot_id     = Column(String, nullable=False)
    claim_date  = Column(Date,   nullable=False, default=date.today)
    lat         = Column(Float)
    lng         = Column(Float)
    device_id   = Column(String)                        # 기기 고유 ID (부정 수급 방지)
    tx_hash     = Column(String)                        # 블록체인 TX 해시
    created_at  = Column(DateTime, default=datetime.utcnow)

    # [중요] 동시성 방지: 동일 유저가 같은 날, 같은 장소에서 중복 저장되는 것을 DB 수준에서 차단
    __table_args__ = (
        UniqueConstraint('user_id', 'spot_id', 'claim_date', name='_user_spot_date_uc'),
    )


# ── 행사 구역 다각형 ──────────────────────────────────────────────
class EventZone(Base):
    __tablename__ = "event_zones"

    id            = Column(Integer, primary_key=True, autoincrement=True)
    name          = Column(String, default="행사 구역")
    polygon_coords = Column(JSON)                       # [{lat, lng}, …]
    treasure_spots = Column(JSON)                       # [{id, lat, lng}, …]
    is_active     = Column(Boolean, default=True)
    created_at    = Column(DateTime, default=datetime.utcnow)


# ── 코인 트랜잭션 내역 ────────────────────────────────────────────
class CoinTransaction(Base):
    __tablename__ = "coin_transactions"

    id          = Column(Integer, primary_key=True, autoincrement=True)
    tx_type     = Column(String)                        # EARN | SPEND | MINT
    user_id     = Column(String)
    wallet_addr = Column(String)
    amount      = Column(Integer)
    reason      = Column(String)
    tx_hash     = Column(String)
    block_number = Column(Integer)
    created_at  = Column(DateTime, default=datetime.utcnow)


# ── 유저 정보 ─────────────────────────────────────────────────────
class User(Base):
    __tablename__ = "users"

    id           = Column(String, primary_key=True)      # 카카오 ID 등 고유 식별자
    name         = Column(String, nullable=False)
    phone        = Column(String)
    wallet_addr  = Column(String, unique=True)           # 할당된 블록체인 지갑 주소
    is_admin     = Column(Boolean, default=False)
    
    # [1단계/4단계] 레벨 및 통계용
    total_earned = Column(Integer, default=0)           # 총 획득량 (레벨 산정 기준)
    
    # [2단계] 보안용: 마지막 획득 위치 및 시간 (이동 속도 체크)
    last_lat     = Column(Float)
    last_lng     = Column(Float)
    last_claim_at = Column(DateTime)
    
    created_at   = Column(DateTime, default=datetime.utcnow)


# ── 관리자 활동 로그 ──────────────────────────────────────────────
class AdminLog(Base):
    __tablename__ = "admin_logs"

    id          = Column(Integer, primary_key=True, autoincrement=True)
    admin_id    = Column(String)
    action      = Column(String)                        # "SET_EVENT", "MINT_COIN" 등
    details     = Column(Text)
    created_at  = Column(DateTime, default=datetime.utcnow)


# ── DB 초기화 ─────────────────────────────────────────────────────
async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
