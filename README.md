# 🏙️ 성동 패스 (Seongdong Pass) — 개발 가이드

## 📁 프로젝트 구조

```
SDP/
├── contract/          # Solidity ERC20 스마트 컨트랙트 (Hardhat)
├── server/            # Node.js 데모 서버 (로컬 테스트용)
├── server_py/         # Python FastAPI 백엔드 (실제 블록체인 연동)
├── citizen/           # 구민용 모바일 앱 (React Native + Expo)
└── admin/             # 관리자 웹 대시보드 (React + Vite + Google Maps)
```

---

## 🚀 실행 순서

### 1. 스마트 컨트랙트 배포

```bash
cd contract
npm install
# 로컬 테스트
npx hardhat node                        # 터미널 1
npx hardhat run scripts/deploy.js --network localhost  # 터미널 2
# 출력된 CONTRACT_ADDRESS를 server_py/.env에 복사
```

### 2. FastAPI 백엔드 실행

```bash
cd server_py
cp .env.example .env
# .env 편집: ADMIN_PRIVATE_KEY, CONTRACT_ADDRESS, ETHEREUM_RPC_URL 입력
pip install -r requirements.txt
python main.py
# → http://localhost:8000  |  API 문서: http://localhost:8000/docs
```

### 3. 관리자 대시보드 실행

```bash
cd admin
npm install
cp .env.example .env
# .env 편집: VITE_GMAPS_KEY=구글맵API키
npm run dev
# → http://localhost:5173
```

### 4. 구민 앱 실행

```bash
cd citizen
npm install
npx expo start
# → QR 스캔으로 Expo Go 앱에서 실행 (안드로이드/iOS)
```

---

## 🔑 환경변수 체크리스트

| 파일 | 변수 | 설명 |
|------|------|------|
| `server_py/.env` | `ADMIN_PRIVATE_KEY` | 구청 지갑 프라이빗 키 |
| `server_py/.env` | `CONTRACT_ADDRESS` | 배포된 SeongdongPass 컨트랙트 주소 |
| `server_py/.env` | `ETHEREUM_RPC_URL` | Hardhat 로컬 / Infura / Alchemy |
| `admin/.env` | `VITE_GMAPS_KEY` | Google Maps JavaScript API 키 |
| `citizen/src/services/api.ts` | `BASE_URL` | FastAPI 서버 주소 |

---

## 🗺️ API 엔드포인트 요약

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/treasures` | 활성 보물 장소 목록 |
| POST | `/api/claim-coin` | 코인 획득 (GPS 검증 + 민팅) |
| GET | `/api/coins/balance/{addr}` | 온체인 잔액 |
| POST | `/api/admin/set-event` | 행사 구역/마커 저장 🔒 |
| POST | `/api/admin/mint` | 코인 수동 발행 🔒 |
| POST | `/api/admin/pause` | 긴급 정지/재개 🔒 |
| GET | `/api/admin/stats` | 대시보드 통계 🔒 |
| GET | `/api/admin/transactions` | 전체 거래 내역 🔒 |

> 🔒 = `x-admin-key` 헤더 필요 (`.env`의 `ADMIN_API_KEY`)

---

## 🔗 블록체인 흐름

```
구민 GPS 좌표 전송
       ↓
FastAPI: Haversine 서버 검증 (10m 이내?)
       ↓
FastAPI: DB 중복 체크 (오늘 이미 획득?)
       ↓
Web3.py: 관리자 Private Key로 서명
       ↓
SeongdongPass.claimSpot() 호출 (가스비 대납)
       ↓
ERC20 코인 → 구민 지갑 도달 🎉
```

---

## 📱 구민 앱 화면 구조

```
LoginScreen (카카오 로그인)
    ↓
HomeScreen (지갑 — 코인 잔액, 보물찾기 버튼, QR버튼)
    ├── ARScreen (카메라 뷰 + GPS 1초 추적 + Haversine + 코인 팝업 + 폭죽)
    ├── QRScreen (QR 결제 토큰 생성 — 5분 유효)
    └── HistoryScreen (블록체인 거래 내역)
```

---

## 🌐 서버 위치 — 개발 단계별 가이드

### 현재 상태: 로컬 PC 서버 (개발용)

지금 만든 서버는 모두 **내 컴퓨터에서만 돌아가는 로컬 서버**입니다.

| 서버 | 로컬 주소 | 용도 |
|------|-----------|------|
| Node.js (데모) | `http://localhost:3000` | 블록체인 없이 빠른 기능 테스트 |
| FastAPI (실서버) | `http://localhost:8000` | 실제 블록체인 연동, API 문서: `/docs` |
| Hardhat (가상 체인) | `http://localhost:8545` | 이더리움 로컬 시뮬레이터 |
| 관리자 대시보드 | `http://localhost:5173` | 브라우저에서 접속 |

> ⚠️ 구민 앱(폰)에서 테스트할 때는 **PC와 폰이 같은 WiFi**에 있어야 합니다.
> `citizen/src/services/api.ts`의 `BASE_URL`을 `http://내PC_IP:8000`으로 변경하세요.
> (내 PC IP 확인: 윈도우 → `ipconfig` → IPv4 주소)

---

### 단계 1: 개발 중 — 외부 폰 테스트 (ngrok)

같은 WiFi가 없어도 인터넷으로 테스트할 수 있습니다.

```bash
# ngrok 설치 (최초 1회)
npm install -g ngrok

# FastAPI 서버를 임시 공개 URL로 노출
ngrok http 8000
# 출력 예시: https://a1b2c3d4.ngrok.io

# citizen/src/services/api.ts 수정
BASE_URL = 'https://a1b2c3d4.ngrok.io'  # ngrok URL로 변경
```

> ⚠️ ngrok 무료 플랜은 8시간 후 URL이 바뀝니다. 시연/데모 전용으로만 사용하세요.

---

### 단계 2: 시범 운영 — 클라우드 서버 (추천)

공식 서비스 전 시범 운영 단계에서는 클라우드 서버를 사용합니다.

#### AWS EC2 기준 배포 예시

```bash
# 1. EC2 인스턴스 생성 (Ubuntu 22.04, t3.small 권장)
# 2. 서버 접속 후 설치
sudo apt update && sudo apt install python3-pip python3-venv -y

# 3. 코드 업로드
git clone https://github.com/your-org/sdp.git
cd sdp/server_py

# 4. 환경변수 설정
cp .env.example .env
nano .env   # 실제 값 입력

# 5. 서비스 등록 (백그라운드 실행)
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 &

# 6. Nginx + HTTPS 설정 (Let's Encrypt)
# → https://api.sdpass.seongdong.go.kr 형태로 서비스
```

#### 클라우드 서버 비용 비교

| 서비스 | 스펙 | 월 비용(예상) | 특징 |
|--------|------|---------------|------|
| AWS EC2 t3.small | 2코어 2GB | ~$17/월 | 가장 일반적 |
| GCP e2-small | 2코어 2GB | ~$15/월 | 구글 생태계 |
| **카카오클라우드** | 2코어 4GB | ~₩20,000/월 | **국내 서비스, 공공기관 적합** |
| **NHN클라우드** | 2코어 4GB | ~₩18,000/월 | **공공 G-클라우드 인증** |

> 💡 **공공기관 추천**: 카카오클라우드 또는 NHN클라우드는 국내 데이터 보관 + 한국어 지원으로 구청 업무에 적합합니다.

---

### 단계 3: 정식 운영 — 성동구청 자체 서버 (온프레미스)

```
[구민 폰] ──인터넷──▶ [Nginx / 방화벽]
                              │
                    ┌─────────┴──────────┐
                    │   성동구청 서버실   │
                    │  FastAPI (:8000)   │
                    │  SQLite→PostgreSQL │
                    └────────────────────┘
```

**정식 운영 전환 시 코드 변경 사항:**

```python
# server_py/database.py — SQLite → PostgreSQL
DATABASE_URL = "postgresql+asyncpg://user:pass@localhost/sdp_db"
```

```typescript
// citizen/src/services/api.ts — 서버 URL 변경
const BASE_URL = 'https://api.sdpass.seongdong.go.kr';
```

---

### 📋 단계별 배포 체크리스트

| 단계 | 서버 | 상태 |
|------|------|------|
| 개발 | localhost | ✅ 현재 이 상태 |
| 테스트 | ngrok 또는 클라우드 t3.small | □ |
| 시범 운영 | 클라우드 + HTTPS + 도메인 + PostgreSQL | □ |
| 정식 운영 | 구청 자체 서버 또는 G-클라우드 + 보안 심의 | □ |
