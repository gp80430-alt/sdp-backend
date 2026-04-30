"""
Web3.py 블록체인 클라이언트
- SeongdongPass 컨트랙트와 통신
- 관리자 Private Key로 가스비 대납 (meta-transaction 패턴)
- mint() / claimSpot() / burnFrom() 호출
"""
import os, json, logging
from pathlib import Path
from web3 import Web3
from web3.middleware import ExtraDataToPOAMiddleware
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

# ── SeongdongPass ABI (컴파일 후 artifacts에서 붙여넣기) ──────────
# hardhat compile → artifacts/contracts/SeongdongPass.sol/SeongdongPass.json
_ABI_PATH = Path(__file__).parent / "abi" / "SeongdongPass.json"

def _load_abi() -> list:
    if _ABI_PATH.exists():
        data = json.loads(_ABI_PATH.read_text())
        return data.get("abi", data)
    # 개발/데모 모드: 필수 함수만 포함한 미니 ABI
    return [
        {"inputs": [{"name": "to", "type": "address"},
                    {"name": "amount", "type": "uint256"},
                    {"name": "reason", "type": "string"}],
         "name": "mint", "outputs": [], "stateMutability": "nonpayable", "type": "function"},

        {"inputs": [{"name": "user",    "type": "address"},
                    {"name": "spotId",  "type": "string"},
                    {"name": "rewardAmount", "type": "uint256"}],
         "name": "claimSpot", "outputs": [], "stateMutability": "nonpayable", "type": "function"},

        {"inputs": [{"name": "account", "type": "address"},
                    {"name": "amount",  "type": "uint256"}],
         "name": "burnFrom", "outputs": [], "stateMutability": "nonpayable", "type": "function"},

        {"inputs": [{"name": "account", "type": "address"}],
         "name": "balanceOf", "outputs": [{"name": "", "type": "uint256"}],
         "stateMutability": "view", "type": "function"},

        {"inputs": [], "name": "totalSupply",
         "outputs": [{"name": "", "type": "uint256"}],
         "stateMutability": "view", "type": "function"},

        {"inputs": [], "name": "paused",
         "outputs": [{"name": "", "type": "bool"}],
         "stateMutability": "view", "type": "function"},

        {"inputs": [], "name": "pause",  "outputs": [], "stateMutability": "nonpayable", "type": "function"},
        {"inputs": [], "name": "unpause","outputs": [], "stateMutability": "nonpayable", "type": "function"},
    ]


class BlockchainClient:
    """싱글톤 Web3 클라이언트"""

    def __init__(self):
        rpc   = os.getenv("ETHEREUM_RPC_URL", "http://127.0.0.1:8545")
        self.w3 = Web3(Web3.HTTPProvider(rpc))
        # PoA 체인(예: Polygon, BSC) 사용 시 필요
        self.w3.middleware_onion.inject(ExtraDataToPOAMiddleware, layer=0)

        self._admin_key  = os.getenv("ADMIN_PRIVATE_KEY", "")
        self._admin_addr = os.getenv("ADMIN_WALLET", "")

        contract_addr = os.getenv("CONTRACT_ADDRESS", "")
        
        # 디버깅 출력 추가
        print(f"DEBUG: ADMIN_KEY exists? {bool(self._admin_key)}")
        print(f"DEBUG: CONTRACT_ADDR: {contract_addr}")
        
        self._demo_mode = not (self._admin_key and contract_addr)

        if not self._demo_mode:
            try:
                abi = _load_abi()
                self.contract = self.w3.eth.contract(
                    address=Web3.to_checksum_address(contract_addr),
                    abi=abi
                )
                print(f"✅ 블록체인 연결 성공: {rpc} | 컨트랙트: {contract_addr}")
                logger.info(f"✅ 블록체인 연결: {rpc} | 컨트랙트: {contract_addr[:10]}…")
            except Exception as e:
                print(f"⚠️  컨트랙트 연결 실패: {e}. DEMO MODE로 전환합니다.")
                self._demo_mode = True
        
        if self._demo_mode:
            print("⚠️  DEMO MODE 활성화됨 (환경변수 설정 확인 필요)")
            logger.warning("⚠️  DEMO MODE: 블록체인 연결 없음 (환경변수 미설정). 실제 TX는 전송되지 않습니다.")

    # ── 내부: 트랜잭션 서명 & 전송 ───────────────────────────────
    def _send_tx(self, fn) -> str:
        if self._demo_mode or not self._admin_addr or not self._admin_key:
            return "0xDEMO_TX_" + "0" * 56

        try:
            admin = Web3.to_checksum_address(self._admin_addr)
        except Exception as e:
            logger.error(f"지갑 주소 변환 실패: {e}")
            return "0xDEMO_TX_" + "0" * 56
            
        nonce = self.w3.eth.get_transaction_count(admin)
        gas_price = self.w3.eth.gas_price

        tx = fn.build_transaction({
            "from":     admin,
            "nonce":    nonce,
            "gasPrice": gas_price,
        })
        tx["gas"] = self.w3.eth.estimate_gas(tx)

        signed = self.w3.eth.account.sign_transaction(tx, self._admin_key)
        # web3 v6+ 에서는 raw_transaction (언더바 있음)을 사용합니다.
        raw_tx = getattr(signed, "raw_transaction", getattr(signed, "rawTransaction", None))
        tx_hash = self.w3.eth.send_raw_transaction(raw_tx)
        receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)

        if receipt.status != 1:
            raise RuntimeError(f"TX 실패: {tx_hash.hex()}")

        return tx_hash.hex()

    # ── 퍼블릭 API ────────────────────────────────────────────────

    def mint(self, to_addr: str, amount_sdp: int, reason: str) -> str:
        """구청 → 구민 코인 직접 발행 (단위: SDP 정수, 내부에서 * 1e18)"""
        if self._demo_mode:
            return self._send_tx(None)

        if not to_addr:
            raise ValueError("수신자 지갑 주소가 없습니다.")
        fn = self.contract.functions.mint(
            Web3.to_checksum_address(to_addr),
            amount_sdp * 10 ** 18,
            reason
        )
        return self._send_tx(fn)

    def claim_spot(self, user_addr: str, spot_id: str, reward: int) -> str:
        """보물 획득 — 온체인 중복 방지 포함"""
        if self._demo_mode:
            return self._send_tx(None)

        if not user_addr:
            raise ValueError("사용자 지갑 주소가 없습니다.")
        fn = self.contract.functions.claimSpot(
            Web3.to_checksum_address(user_addr),
            spot_id,
            reward * 10 ** 18
        )
        return self._send_tx(fn)

    def burn_from(self, user_addr: str, amount_sdp: int) -> str:
        """가맹점 결제 시 유저 코인 소각"""
        if self._demo_mode:
            return self._send_tx(None)

        if not user_addr:
            raise ValueError("사용자 지갑 주소가 없습니다.")
        fn = self.contract.functions.burnFrom(
            Web3.to_checksum_address(user_addr),
            amount_sdp * 10 ** 18
        )
        return self._send_tx(fn)

    def get_balance(self, addr: str) -> int:
        """온체인 잔액 조회 (SDP 정수 반환)"""
        if self._demo_mode:
            return 0
        if not addr:
            return 0
        raw = self.contract.functions.balanceOf(
            Web3.to_checksum_address(addr)
        ).call()
        return raw // 10 ** 18

    def is_paused(self) -> bool:
        if self._demo_mode:
            return False
        return self.contract.functions.paused().call()

    def pause(self) -> str:
        return self._send_tx(self.contract.functions.pause())

    def unpause(self) -> str:
        return self._send_tx(self.contract.functions.unpause())

    @property
    def demo_mode(self) -> bool:
        return self._demo_mode


# 싱글톤
blockchain = BlockchainClient()
