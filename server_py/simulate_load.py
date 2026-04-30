import asyncio
import random
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from database import engine, User, TreasureSpot, ClaimRecord, CoinTransaction, Base

async def simulate_1000_claims():
    async with engine.begin() as conn:
        # DB 초기화
        await conn.run_sync(Base.metadata.create_all)
    
    async with AsyncSession(engine) as session:
        print("🚀 1,000건 시뮬레이션 데이터 생성 시작...")
        
        # 1. 테스트 유저 10명 생성
        users = []
        for i in range(10):
            uid = f"user_{i:03d}"
            user = User(
                id=uid, name=f"테스터_{i}", 
                wallet_addr=f"0x{uid}00000000000000000000000000000000000",
                total_earned=0
            )
            session.add(user)
            users.append(uid)
        
        # 2. 테스트 보물 스팟 5개
        spots = ["T001", "T002", "T003", "T004", "T005"]
        
        # 3. 1,000건의 획득 데이터 주입
        for i in range(1000):
            user_id = random.choice(users)
            spot_id = random.choice(spots)
            reward = random.randint(1, 5)
            
            # 과거 30일간의 랜덤 날짜
            claim_date = (datetime.now() - timedelta(days=random.randint(0, 30))).date()
            
            # 기록 추가
            session.add(ClaimRecord(
                user_id=user_id, wallet_addr=f"addr_{user_id}",
                spot_id=spot_id, claim_date=claim_date,
                lat=37.56 + random.uniform(-0.01, 0.01),
                lng=127.03 + random.uniform(-0.01, 0.01),
                tx_hash=f"0xhash_{i:04d}"
            ))
            
            # 트랜잭션 추가
            session.add(CoinTransaction(
                tx_type="EARN", user_id=user_id, amount=reward,
                reason="시뮬레이션 테스트", tx_hash=f"0xhash_{i:04d}"
            ))
            
            # 유저 총액 업데이트
            u_result = await session.get(User, user_id)
            u_result.total_earned += reward
            
            if i % 200 == 0:
                print(f"--- {i}건 완료 ---")

        await session.commit()
        print("✅ 1,000건 데이터 주입 완료!")

if __name__ == "__main__":
    asyncio.run(simulate_1000_claims())
