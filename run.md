# 🚀 성동 패스(SDP) 시스템 통합 실행 및 접속 가이드

본 프로젝트는 모든 인프라가 클라우드에 배포되어 있어 상시 작동하며, 개발 시에는 로컬 환경에서도 테스트할 수 있습니다.

---

## 1. 🖥️ 관리자 대시보드 (Admin Dashboard)
관리자가 보물 스팟을 배치하고 통계를 모니터링하는 웹 페이지입니다.

*   **외부 주소 (인터넷):** [https://serene-beijinho-d5a2ae.netlify.app/](https://serene-beijinho-d5a2ae.netlify.app/)
*   **로컬 실행 방법:**
    ```powershell
    cd "d:\박영수\1.프로그램\SDP\admin"
    npm run dev
    ```
    *   접속: `http://localhost:5173`
*   **주요 기능:** 보물 스팟 좌표 수동 입력/수정, 실시간 모니터링, 사용자 관리

---

## 2. 📱 시민용 앱 (Citizen App)
일반 사용자가 AR로 코인을 획득하고 결제에 사용하는 모바일 앱입니다.

*   **실행 방법 (테스트):**
    1.  스마트폰에 **'Expo Go'** 앱 설치
    2.  로컬 터미널 실행:
        ```powershell
        cd "d:\박영수\1.프로그램\SDP\citizen"
        npx expo start --tunnel
        ```
    3.  화면의 **QR 코드를 스캔**하여 접속
*   **특징:** `--tunnel` 옵션을 통해 외부 네트워크에서도 실시간 테스트 가능

---

## 3. ⚙️ 백엔드 및 인프라 (Backend & Infrastructure)
시스템의 데이터와 블록체인 연동을 담당하는 핵심 요소입니다.

*   **백엔드 API 서버 (Python):** 
    *   외부 주소: `https://sdp-backend-m09z.onrender.com` (자동 배포됨)
    *   로컬 실행:
        ```powershell
        cd "d:\박영수\1.프로그램\SDP\server_py"
        python main.py
        ```
*   **데이터베이스:** Supabase PostgreSQL (사용자 및 스팟 데이터 저장)
*   **블록체인:** Ethereum Sepolia Testnet (SDP 코인 발행 및 전송)

---

## 🛠️ 유지보수 및 업데이트 가이드
1.  **코드 수정 후 반영:**
    *   로컬에서 소스 수정 -> `git add .` -> `git commit` -> `git push`
    *   GitHub에 푸시되면 Render(백엔드)와 Netlify(프론트엔드)가 **자동으로 빌드 및 재배포**를 시작합니다.
2.  **보안 관리:**
    *   GitHub 토큰(PAT)은 본인의 비밀번호와 같으므로 타인에게 노출되지 않도록 주의하십시오.
3.  **데이터 관리:**
    *   보물 스팟의 정확한 위치값(위도, 경도)은 관리자 대시보드 내 **'지도 관리'** 메뉴에서 언제든 직접 수정할 수 있습니다.

---
**성동구의 스마트한 미래, 성동 패스와 함께하세요!**
