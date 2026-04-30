# 🚀 성동 패스(SDP) 시스템 통합 실행 가이드

본 프로젝트는 모든 인프라가 클라우드에 배포되어 있어, 로컬 개발 환경 없이도 상시 작동합니다.

---

## 1. 🖥️ 관리자 대시보드 (Admin Dashboard)
관리자가 구역을 설정하고 코인 발행 현황을 모니터링하는 웹 페이지입니다.

*   **접속 주소:** [https://serene-beijinho-d5a2ae.netlify.app/](https://serene-beijinho-d5a2ae.netlify.app/)
*   **주요 기능:**
    *   지도상에 보물상자(코인 획득 구역) 설치 및 삭제
    *   전체 코인 발행량 및 사용자 활동 로그 실시간 확인
    *   사용자별 잔액 조회

---

## 2. 📱 시민용 앱 (Citizen App)
일반 사용자가 AR로 코인을 획득하고 결제에 사용하는 모바일 앱입니다.

*   **실행 방법:**
    1.  반드시 **`citizen`** 폴더로 이동한 뒤 명령어 입력:
        ```powershell
        cd "d:\박영수\1.프로그램\SDP\citizen"
        npx expo start --tunnel
        ```
    2.  스마트폰의 **Expo Go** 앱으로 화면의 QR 코드를 스캔합니다.
*   **참고:** `--tunnel` 옵션을 사용하면 컴퓨터와 스마트폰이 서로 다른 네트워크(LTE 등)에 있어도 접속이 가능합니다.

---

## 3. ⚙️ 클라우드 인프라 정보 (System Infrastructure)
시스템의 심장부 역할을 하는 구성 요소들입니다. (별도 조작 없이 상시 가동됨)

*   **백엔드 서버 (API):** [Render](https://dashboard.render.com/) 배포 중
    *   주소: `https://sdp-backend-y2aq.onrender.com`
*   **데이터베이스 (DB):** [Supabase](https://supabase.com/) PostgreSQL 사용
    *   모든 사용자 정보와 보물 위치가 안전하게 저장됩니다.
*   **블록체인 (Network):** **Ethereum Sepolia Testnet** 사용
    *   [Alchemy](https://dashboard.alchemy.com/)를 통해 블록체인 노드에 연결됩니다.
    *   모든 코인 트랜잭션은 실제 블록체인 장부에 기록됩니다.

---

## 🛠️ 유지보수 가이드
*   **서버 로그 확인:** Render 대시보드의 'Logs' 메뉴에서 실시간 서버 상태를 볼 수 있습니다.
*   **DB 직접 관리:** Supabase 대시보드에서 테이블 데이터를 직접 수정하거나 삭제할 수 있습니다.
*   **코드 수정 시:** 로컬에서 수정 후 GitHub에 `git push`를 하면 Render 백엔드가 약 2분 내로 자동 재배포됩니다.

---
**성동구의 스마트한 미래, 성동 패스와 함께하세요!**
