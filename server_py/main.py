"""
성동 패스 FastAPI 메인 서버
- /api/claim-coin        : AR 보물 획득 (GPS 검증 + 중복 방지 + 코인 민팅)
- /api/admin/set-event   : 관리자 행사 구역/보물 스팟 저장
- /api/admin/mint        : 수동 코인 발행
- /api/admin/pause       : 긴급 정지 / 재개
- /api/treasures         : 활성 보물 목록
- /api/coins/balance/:addr : 온체인 잔액 조회
"""
import os
import logging
import asyncio
import io
import csv
from datetime import date, datetime
from typing import Optional
from fastapi.responses import StreamingResponse

from fastapi import FastAPI, HTTPException, Depends, Header, BackgroundTasks, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from sqlalchemy.exc import IntegrityError
from dotenv import load_dotenv

from database import (
    init_db, get_db, User, TreasureSpot, ClaimRecord, 
    EventZone, CoinTransaction, AdminLog, encrypt_data, decrypt_data
)
from blockchain_client import blockchain
from haversine import haversine

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(asctime)s  %(levelname)s  %(message)s")
logger = logging.getLogger(__name__)

ADMIN_KEY = os.getenv("ADMIN_API_KEY", "SDP_ADMIN_2026")

# ── FastAPI 앱 ────────────────────────────────────────────────────
app = FastAPI(
    title="성동 패스 API",
    description="성동구 공공 리워드 블록체인 플랫폼 백엔드",
    version="1.0.0",
)

origins = os.getenv("ALLOWED_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {
        "status": "running", 
        "message": "성동 패스(SDP) API 서버가 정상적으로 작동 중입니다.", 
        "docs": "/docs",
        "version": "1.0.0"
    }


# ── WebSocket 관리자 (실시간 알림) ──────────────────────────────────
class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except:
                pass

manager = ConnectionManager()

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text() # 대기
    except WebSocketDisconnect:
        manager.disconnect(websocket)


# 전역 변수 및 락
tx_lock = asyncio.Lock()
QR_TOKENS = {}
REQUEST_COUNTS = {}
@app.on_event("startup")
async def startup():
    await init_db()
    
    # 시드 보물 장소 삽입
    from database import engine
    seed_spots = [
        {"id": "T001", "name": "응봉산 팔각정",   "lat": 37.550473, "lng": 127.024915, "coin_reward": 3, "icon": "🏯"},
        {"id": "T002", "name": "서울숲 솔밭 광장", "lat": 37.544122, "lng": 127.037418, "coin_reward": 2, "icon": "🌲"},
        {"id": "T003", "name": "성동구청 광장",    "lat": 37.563597, "lng": 127.036813, "coin_reward": 1, "icon": "🏛️"},
        {"id": "T004", "name": "왕십리 광장",     "lat": 37.561446, "lng": 127.038580, "coin_reward": 2, "icon": "🚉"},
        {"id": "T005", "name": "뚝섬한강공원",    "lat": 37.530797, "lng": 127.066207, "coin_reward": 3, "icon": "🌊"},
        {"id": "T006", "name": "성수 카페거리",   "lat": 37.544600, "lng": 127.056300, "coin_reward": 5, "icon": "☕"},
        {"id": "T007", "name": "금호동 벽화마을",  "lat": 37.554500, "lng": 127.019200, "coin_reward": 2, "icon": "🎨"},
        {"id": "T008", "name": "마장체육센터",    "lat": 37.567123, "lng": 127.045456, "coin_reward": 2, "icon": "🏊"},
        {"id": "T009", "name": "성수 구두공원",    "lat": 37.542345, "lng": 127.054321, "coin_reward": 3, "icon": "👞"},
        {"id": "T010", "name": "사근동 한양대",    "lat": 37.558789, "lng": 127.048123, "coin_reward": 2, "icon": "🎓"},
    ]
    async with AsyncSession(engine) as session:
        for s in seed_spots:
            existing = await session.get(TreasureSpot, s["id"])
            if not existing:
                session.add(TreasureSpot(**s, description="", radius_m=10, daily_limit=100))
        await session.commit()
    logger.info("✅ DB 초기화 완료")


# ── 관리자 인증 의존성 ────────────────────────────────────────────
def require_admin(x_admin_key: str = Header(...)):
    if x_admin_key != ADMIN_KEY:
        raise HTTPException(status_code=403, detail="관리자 권한 필요")


# ════════════════════════════════════════════════════════════════
#  Pydantic 스키마
# ════════════════════════════════════════════════════════════════

class ClaimRequest(BaseModel):
    user_id:     Optional[str] = Field(None, alias="userId")
    spot_id:     Optional[str] = Field(None, alias="treasureId")
    wallet_addr: Optional[str] = None
    lat:         float
    lng:         float
    device_id:   Optional[str] = None

    class Config:
        populate_by_name = True

class UpdateUserRequest(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None

class AuthRequest(BaseModel):
    kakaoId: str
    name:    Optional[str] = "성동 시민"
    phone:   Optional[str] = ""

class SetEventRequest(BaseModel):
    name:            str             = Field(default="행사 구역")
    polygon_coords:  list[dict]      = Field(..., description="[{lat, lng}, …]")
    treasure_spots:  list[dict]      = Field(..., description="[{id, lat, lng, name, coinReward}, …]")

class MintRequest(BaseModel):
    wallet_addr: str
    amount:      int = Field(..., gt=0, le=10000)
    reason:      str = Field(default="관리자 수동 발행")

class PauseRequest(BaseModel):
    action: str  # "pause" | "unpause"


# ════════════════════════════════════════════════════════════════
#  AUTH / USER 엔드포인트
# ════════════════════════════════════════════════════════════════

# 칭호 계산 함수
def calculate_title(total_earned: int) -> str:
    if total_earned >= 100: return "성동 수호자 👑"
    if total_earned >= 50:  return "성동 탐험가 🗺️"
    if total_earned >= 10:  return "성동 시민 🏙️"
    return "성동 입문자 🌱"

@app.post("/api/auth/kakao")
async def kakao_login(req: AuthRequest, db: AsyncSession = Depends(get_db)):
    """카카오 로그인 시뮬레이션 (유저 생성 및 지갑 할당)"""
    result = await db.execute(select(User).where(User.id == req.kakaoId))
    user = result.scalar_one_or_none()

    if not user:
        from eth_account import Account
        new_wallet = Account.create().address
        user = User(
            id=req.kakaoId,
            name=encrypt_data(req.name),    # [암호화]
            phone=encrypt_data(req.phone),   # [암호화]
            wallet_addr=new_wallet
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)

    return {
        "success": True,
        "user": {
            "id": user.id,
            "name": decrypt_data(user.name), # [복호화]
            "wallet_addr": user.wallet_addr,
            "title": calculate_title(user.total_earned),
            "total_earned": user.total_earned,
            "isAdmin": user.is_admin
        }
    }

@app.get("/api/auth/me/{user_id}")
async def get_me(user_id: str, db: AsyncSession = Depends(get_db)):
    """내 정보 및 온체인 잔액 조회"""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user: raise HTTPException(status_code=404, detail="유저 없음")

    balance = blockchain.get_balance(user.wallet_addr)
    return {
        "id": user.id,
        "name": decrypt_data(user.name), # [복호화]
        "wallet_addr": user.wallet_addr,
        "balance": balance,
        "title": calculate_title(user.total_earned),
        "total_earned": user.total_earned,
        "unit": "SDP"
    }

@app.patch("/api/auth/me/{user_id}")
async def update_user(user_id: str, req: UpdateUserRequest, db: AsyncSession = Depends(get_db)):
    """[구민] 내 정보 수정 (이름, 전화번호 등)"""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user: raise HTTPException(status_code=404, detail="유저 없음")

    if req.name:  user.name  = encrypt_data(req.name) # [암호화]
    if req.phone: user.phone = encrypt_data(req.phone) # [암호화]
    
    await db.commit()
    await db.refresh(user)
    
    # 관리자 로그 기록
    db.add(AdminLog(admin_id="SYSTEM", action="USER_UPDATE", details=f"User {user_id} updated info"))
    await db.commit()

    return {"success": True, "user": {"id": user.id, "name": decrypt_data(user.name)}}

@app.get("/api/coins/balance/{user_id_or_addr}")
async def get_balance_unified(user_id_or_addr: str, db: AsyncSession = Depends(get_db)):
    """ID 혹은 지갑 주소로 잔액 조회"""
    # 1. 지갑 주소 형식인지 확인 (0x...)
    if user_id_or_addr.startswith("0x") and len(user_id_or_addr) == 42:
        balance = blockchain.get_balance(user_id_or_addr)
        return {"balance": balance, "wallet": user_id_or_addr}
    
    # 2. 아니면 유저 ID로 검색
    result = await db.execute(select(User).where(User.id == user_id_or_addr))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="유저를 찾을 수 없습니다.")
    
    balance = blockchain.get_balance(user.wallet_addr)
    return {"balance": balance, "userId": user.id, "wallet": user.wallet_addr}

@app.get("/api/coins/history/{user_id}")
async def get_user_history(user_id: str, db: AsyncSession = Depends(get_db)):
    """특정 유저의 거래 내역 조회"""
    result = await db.execute(
        select(CoinTransaction)
        .where(CoinTransaction.user_id == user_id)
        .order_by(CoinTransaction.created_at.desc())
    )
    txs = result.scalars().all()
    return {
        "history": [
            {
                "id": t.id, "type": t.tx_type, "amount": t.amount,
                "reason": t.reason, "tx_hash": t.tx_hash,
                "created_at": t.created_at.isoformat()
            } for t in txs
        ]
    }

# QR 결제용 임시 저장소 (실제로는 Redis 추천)
QR_TOKENS = {}

@app.post("/api/coins/generate-qr")
async def generate_qr(req: dict, db: AsyncSession = Depends(get_db)):
    """QR 결제 토큰 생성"""
    user_id = req.get("userId")
    amount  = req.get("amount")
    
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user: raise HTTPException(status_code=404, detail="유저 없음")
    
    balance = blockchain.get_balance(user.wallet_addr)
    if balance < amount: raise HTTPException(status_code=400, detail="잔액 부족")
    
    import uuid
    token = str(uuid.uuid4())
    QR_TOKENS[token] = {"user_id": user_id, "amount": amount, "expires": datetime.utcnow().timestamp() + 300}
    
    return {
        "token": token,
        "expiresIn": 300,
        "amount": amount,
        "userId": user_id
    }

@app.post("/api/coins/pay-qr")
async def pay_qr(req: dict, db: AsyncSession = Depends(get_db)):
    """가맹점 QR 결제 처리"""
    token       = req.get("token")
    merchant_id = req.get("merchantId")

    if token not in QR_TOKENS:
        raise HTTPException(status_code=404, detail="만료되었거나 유효하지 않은 QR 코드입니다.")

    qr_data = QR_TOKENS.pop(token)
    if datetime.utcnow().timestamp() > qr_data["expires"]:
        raise HTTPException(status_code=410, detail="QR 코드 유효시간이 초과되었습니다.")

    user_id = qr_data["user_id"]
    amount  = qr_data["amount"]

    # 유저 지갑 조회
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user: raise HTTPException(status_code=404, detail="유저 없음")

    # 블록체인 소각 (SPEND)
    try:
        tx_hash = blockchain.burn_from(user.wallet_addr, amount)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"결제 처리 실패: {str(e)}")

    # DB 기록
    db.add(CoinTransaction(
        tx_type="SPEND", user_id=user_id,
        wallet_addr=user.wallet_addr, amount=amount,
        reason=f"가맹점 결제 ({merchant_id})", tx_hash=tx_hash,
    ))
    await db.commit()

    # 실시간 방송
    await manager.broadcast({
        "event": "COIN_SPENT",
        "userName": user.name,
        "amount": amount,
        "merchantId": merchant_id,
        "timestamp": datetime.utcnow().isoformat()
    })

    return {"success": True, "tx_hash": tx_hash, "new_balance": blockchain.get_balance(user.wallet_addr)}

# ════════════════════════════════════════════════════════════════
#  공개 엔드포인트
# ════════════════════════════════════════════════════════════════

@app.get("/api/merchants")
async def get_merchants():
    """가맹점 목록 (데모 데이터)"""
    return {
        "merchants": [
            {"id": "M001", "name": "성수 뚝섬 카페", "category": "음식점", "lat": 37.545, "lng": 127.055},
            {"id": "M002", "name": "한양대 앞 분식", "category": "음식점", "lat": 37.561, "lng": 127.039},
            {"id": "M003", "name": "성동 구립 도서관", "category": "공공기관", "lat": 37.563, "lng": 127.036},
        ]
    }

@app.get("/api/treasures")
async def get_treasures(db: AsyncSession = Depends(get_db)):
    """활성 보물 장소 목록"""
    result = await db.execute(select(TreasureSpot).where(TreasureSpot.is_active == True))
    spots  = result.scalars().all()
    return {
        "treasures": [
            {
                "id": s.id, "name": s.name, "description": s.description,
                "lat": s.lat, "lng": s.lng, "coinReward": s.coin_reward,
                "icon": s.icon, "radius": s.radius_m,
            }
            for s in spots
        ]
    }


@app.get("/api/coins/balance/{wallet_addr}")
async def get_balance(wallet_addr: str):
    """온체인 잔액 조회"""
    try:
        balance = blockchain.get_balance(wallet_addr)
        return {"wallet": wallet_addr, "balance": balance, "unit": "SDP"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ════════════════════════════════════════════════════════════════
#  핵심: 코인 획득 (/api/claim-coin)
# ════════════════════════════════════════════════════════════════

@app.post("/api/claim-coin")
async def claim_coin(
    req: ClaimRequest,
    background: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """
    1. 보물 스팟 존재 확인
    2. Haversine 서버 측 GPS 재검증 (GPS 조작 방지)
    3. 오늘 중복 획득 체크
    4. 스마트 컨트랙트 claimSpot() 호출 (가스비 대납)
    5. DB 기록
    """
    # 1. 유저 및 지갑 확인
    user_id = req.user_id
    if not user_id:
        raise HTTPException(status_code=400, detail="user_id가 필요합니다.")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="등록되지 않은 유저입니다.")

    wallet_addr = req.wallet_addr or user.wallet_addr
    if not wallet_addr:
        raise HTTPException(status_code=400, detail="지갑 주소가 없습니다.")

    # 2. 보물 스팟 조회
    spot_id = req.spot_id
    if not spot_id:
        raise HTTPException(status_code=400, detail="spot_id가 필요합니다.")

    spot = await db.get(TreasureSpot, spot_id)
    if not spot or not spot.is_active:
        raise HTTPException(status_code=404, detail="해당 보물 스팟이 없거나 비활성화 상태입니다.")

    # 3. 서버 측 GPS 재검증 (Haversine)
    dist = haversine(req.lat, req.lng, spot.lat, spot.lng)
    if dist > spot.radius_m:
        raise HTTPException(
            status_code=403,
            detail=f"위치가 너무 멉니다. 현재 {dist:.1f}m (허용 반경 {spot.radius_m}m). GPS를 확인해 주세요."
        )

    # 4. 오늘 중복 획득 체크 (동일 유저 + 동일 장소)
    today = date.today()
    existing = await db.execute(
        select(ClaimRecord).where(
            and_(
                ClaimRecord.user_id    == user_id,
                ClaimRecord.spot_id    == spot_id,
                ClaimRecord.claim_date == today,
            )
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=409,
            detail="오늘 이미 이 장소에서 코인을 획득했습니다."
        )

    # [보완] 5. 보안: 기기당 일일 획득 횟수 제한 (예: 5회)
    if req.device_id:
        device_claims = await db.execute(
            select(ClaimRecord).where(
                and_(ClaimRecord.device_id == req.device_id, ClaimRecord.claim_date == today)
            )
        )
        if len(device_claims.scalars().all()) >= 5:
            raise HTTPException(status_code=429, detail="해당 기기에서 오늘 획득 가능한 횟수를 초과했습니다.")

    # [보완] 3단계: 보안 - API 속도 제한 (Rate Limiting)
    now = datetime.utcnow().timestamp()
    user_reqs = REQUEST_COUNTS.get(user_id, [])
    user_reqs = [t for t in user_reqs if now - t < 60] # 최근 1분 내역만 유지
    if len(user_reqs) >= 10: # 1분에 최대 10번만 시도 가능
        raise HTTPException(status_code=429, detail="요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.")
    user_reqs.append(now)
    REQUEST_COUNTS[user_id] = user_reqs

    # [보완] 2단계: 보안 - 이동 속도 검증
    if user.last_claim_at and user.last_lat and user.last_lng:
        time_diff = (datetime.utcnow() - user.last_claim_at).total_seconds()
        if time_diff < 3600: # 1시간 이내 활동인 경우만 체크
            dist = haversine(req.lat, req.lng, user.last_lat, user.last_lng)
            speed_kmh = (dist / 1000) / (max(time_diff, 1) / 3600)
            if speed_kmh > 120: # 시속 120km 초과 이동 시 차단
                raise HTTPException(
                    status_code=403, 
                    detail=f"비정상적인 이동이 감지되었습니다. (시속 {speed_kmh:.1f}km)"
                )

    # 6. 블록체인 claimSpot() 호출 (락을 사용하여 순차 처리)
    try:
        async with tx_lock:
            tx_hash = blockchain.claim_spot(wallet_addr, spot_id, spot.coin_reward)
    except Exception as e:
        logger.error(f"TX 실패: {e}")
        raise HTTPException(status_code=500, detail=f"블록체인 전송 실패: {str(e)}")

    # 7. DB 기록 및 유저 상태 업데이트 (백그라운드)
    async def _save_record():
        try:
            async with AsyncSession(db.bind) as s:
                # 기록 저장
                s.add(ClaimRecord(
                    user_id=user_id, wallet_addr=wallet_addr,
                    spot_id=spot_id, claim_date=today,
                    lat=req.lat, lng=req.lng, tx_hash=tx_hash,
                    device_id=req.device_id
                ))
                s.add(CoinTransaction(
                    tx_type="EARN", user_id=user_id,
                    wallet_addr=wallet_addr, amount=spot.coin_reward,
                    reason=f"{spot.name} AR 수집", tx_hash=tx_hash,
                ))
                
                # 유저 상태 업데이트
                u = await s.get(User, user_id)
                if u:
                    u.last_lat = req.lat
                    u.last_lng = req.lng
                    u.last_claim_at = datetime.utcnow()
                    u.total_earned += spot.coin_reward
                
                await s.commit()
                # 실시간 방송 생략...
        except IntegrityError:
            # 동시에 여러 요청이 들어와 UniqueConstraint에 걸린 경우
            logger.warning(f"⚠️ 중복 요청 차단됨: {user_id}")
            pass
            
            # 실시간 방송 (COIN_CLAIMED)
            await manager.broadcast({
                "event": "COIN_CLAIMED",
                "userName": user.name,
                "spotName": spot.name,
                "amount": spot.coin_reward,
                "title": calculate_title(u.total_earned if u else 0),
                "txHash": tx_hash[:12] + "..."
            })

    background.add_task(_save_record)

    logger.info(f"✅ 코인 획득: {req.user_id} | {spot.name} | {spot.coin_reward}SDP | TX:{tx_hash[:12]}…")

    return {
        "success":    True,
        "message":    f"🎉 {spot.coin_reward} 성동 코인을 획득했습니다!",
        "earned":     spot.coin_reward,
        "spot_name":  spot.name,
        "tx_hash":    tx_hash,
        "demo_mode":  blockchain.demo_mode,
    }


# ════════════════════════════════════════════════════════════════
#  관리자 엔드포인트
# ════════════════════════════════════════════════════════════════

@app.post("/api/admin/set-event", dependencies=[Depends(require_admin)])
async def set_event(req: SetEventRequest, db: AsyncSession = Depends(get_db)):
    """
    관리자 지도에서 그린 다각형 구역과 보물 마커를 저장.
    기존 활성 행사 구역을 비활성화 후 새로 삽입.
    """
    # 기존 활성 구역 비활성화
    result = await db.execute(select(EventZone).where(EventZone.is_active == True))
    for zone in result.scalars().all():
        zone.is_active = False

    # 새 구역 삽입
    new_zone = EventZone(
        name=req.name,
        polygon_coords=req.polygon_coords,
        treasure_spots=req.treasure_spots,
    )
    db.add(new_zone)

    # 보물 스팟 동기화 (지도에서 추가/수정된 마커 반영)
    for spot_data in req.treasure_spots:
        existing = await db.get(TreasureSpot, spot_data["id"])
        if existing:
            existing.lat = spot_data["lat"]
            existing.lng = spot_data["lng"]
            existing.is_active = True
        else:
            db.add(TreasureSpot(
                id=spot_data["id"],
                name=spot_data.get("name", "새 보물"),
                lat=spot_data["lat"], lng=spot_data["lng"],
                coin_reward=spot_data.get("coinReward", 1),
            ))

    # 감사 로그 기록
    from database import AdminLog
    db.add(AdminLog(
        admin_id="ADMIN", 
        action="SET_EVENT",
        details=f"Spots: {len(req.treasure_spots)}, Zone Points: {len(req.polygon_coords)}"
    ))
    await db.commit()

    return {
        "success":      True,
        "zone_id":      new_zone.id,
        "polygon_pts":  len(req.polygon_coords),
        "spot_count":   len(req.treasure_spots),
    }


@app.post("/api/admin/mint", dependencies=[Depends(require_admin)])
async def admin_mint(req: MintRequest, db: AsyncSession = Depends(get_db)):
    """관리자 수동 코인 발행"""
    try:
        tx_hash = blockchain.mint(req.wallet_addr, req.amount, req.reason)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    db.add(CoinTransaction(
        tx_type="MINT", wallet_addr=req.wallet_addr,
        amount=req.amount, reason=req.reason, tx_hash=tx_hash,
    ))
    # 감사 로그
    from database import AdminLog
    db.add(AdminLog(admin_id="ADMIN", action="MINT_COIN", details=f"Addr: {req.wallet_addr}, Amt: {req.amount}"))
    await db.commit()

    return {"success": True, "tx_hash": tx_hash, "amount": req.amount}


@app.post("/api/admin/pause", dependencies=[Depends(require_admin)])
async def admin_pause(req: PauseRequest):
    """긴급 정지 / 재개"""
    try:
        if req.action == "pause":
            tx = blockchain.pause()
            return {"success": True, "action": "paused", "tx_hash": tx}
        else:
            tx = blockchain.unpause()
            return {"success": True, "action": "unpaused", "tx_hash": tx}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/admin/stats", dependencies=[Depends(require_admin)])
async def admin_stats(db: AsyncSession = Depends(get_db)):
    """대시보드 통계"""
    from sqlalchemy import func

    total_earn  = await db.execute(
        select(func.sum(CoinTransaction.amount)).where(CoinTransaction.tx_type == "EARN")
    )
    total_spend = await db.execute(
        select(func.sum(CoinTransaction.amount)).where(CoinTransaction.tx_type == "SPEND")
    )
    today_claims = await db.execute(
        select(func.count(ClaimRecord.id)).where(ClaimRecord.claim_date == date.today())
    )
    active_spots = await db.execute(
        select(func.count(TreasureSpot.id)).where(TreasureSpot.is_active == True)
    )
    total_txs = await db.execute(select(func.count(CoinTransaction.id)))

    earned  = total_earn.scalar()  or 0
    spent   = total_spend.scalar() or 0

    # [보완] 관리자 지갑 잔액 모니터링 (실제 메인넷 시 매우 중요)
    admin_balance = 0
    try:
        if blockchain._admin_addr:
            # 관리자 가스비(ETH/MATIC 등) 잔액 확인 로직 (Web3 이용)
            wei_balance = blockchain.w3.eth.get_balance(blockchain._admin_addr)
            admin_balance = blockchain.w3.from_wei(wei_balance, 'ether')
    except: pass

    return {
        "total_issued":    earned,
        "total_spent":     spent,
        "in_circulation":  earned - spent,
        "today_claims":    today_claims.scalar() or 0,
        "active_spots":    active_spots.scalar() or 0,
        "total_txs":       total_txs.scalar()    or 0,
        "is_paused":       blockchain.is_paused(),
        "demo_mode":       blockchain.demo_mode,
        "admin_wallet": {
            "address": blockchain._admin_addr,
            "gas_balance": float(admin_balance)
        }
    }


@app.get("/api/admin/transactions", dependencies=[Depends(require_admin)])
async def admin_transactions(
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(CoinTransaction)
        .order_by(CoinTransaction.created_at.desc())
        .limit(limit)
    )
    txs = result.scalars().all()
    return {
        "transactions": [
            {
                "id": t.id, "type": t.tx_type,
                "user_id": t.user_id, "wallet": t.wallet_addr,
                "amount": t.amount, "reason": t.reason,
                "tx_hash": t.tx_hash,
                "created_at": t.created_at.isoformat() if t.created_at else None,
            }
            for t in txs
        ]
    }


@app.get("/api/admin/heatmap", dependencies=[Depends(require_admin)])
async def admin_heatmap(db: AsyncSession = Depends(get_db)):
    """[4단계] 관리자용 히트맵 데이터 (좌표 리스트)"""
    result = await db.execute(select(ClaimRecord.lat, ClaimRecord.lng))
    coords = result.all()
    return {
        "points": [{"lat": p.lat, "lng": p.lng, "count": 1} for p in coords]
    }

@app.post("/api/admin/clear-transactions", dependencies=[Depends(require_admin)])
async def clear_transactions(db: AsyncSession = Depends(get_db)):
    """[관리자] 모든 트랜잭션 기록 삭제 (테스트용)"""
    from sqlalchemy import delete
    await db.execute(delete(CoinTransaction))
    
    # 관리자 로그 남김
    db.add(AdminLog(admin_id="ADMIN", action="CLEAR_HISTORY", details="All transaction logs cleared by admin"))
    await db.commit()
    
    return {"success": True, "message": "모든 거래 내역이 삭제되었습니다."}

@app.get("/api/admin/export/transactions", dependencies=[Depends(require_admin)])
async def export_transactions(db: AsyncSession = Depends(get_db)):
    """[관리자] 전체 거래 내역 CSV 내보내기"""
    result = await db.execute(select(CoinTransaction).order_by(CoinTransaction.created_at.desc()))
    txs = result.scalars().all()
    
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["ID", "유형", "유저ID", "지갑주소", "수량", "사유", "TX해시", "일시"])
    
    for t in txs:
        writer.writerow([t.id, t.tx_type, t.user_id, t.wallet_addr, t.amount, t.reason, t.tx_hash, t.created_at])
    
    output.seek(0)
    return StreamingResponse(
        output,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=sdp_transactions.csv"}
    )

# ── 서버 실행 ─────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
