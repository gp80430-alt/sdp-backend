# 🚀 성동 패스(SDP) 시스템 통합 실행 및 접속 가이드

본 프로젝트는 모든 인프라가 클라우드에 배포되어 있어 상시 작동하며, 개발 시에는 로컬 환경에서도 테스트할 수 있습니다.

---

## 🌐 외부망 접속 주소 (전 세계 어디서든 접속 가능)

| 서비스명 | 접속 주소 (URL) | 비고 |
| :--- | :--- | :--- |
| **관리자 대시보드** | [https://serene-beijinho-d5a2ae.netlify.app/](https://serene-beijinho-d5a2ae.netlify.app/) | 보물 스팟 관리 및 통계 |
| **시민용 웹 (Citizen Web)** | [https://fascinating-dolphin-da52c7.netlify.app/](https://fascinating-dolphin-da52c7.netlify.app/) | 모바일 브라우저용 시민 앱 |
| **백엔드 API 서버** | [https://sdp-backend-m09z.onrender.com](https://sdp-backend-m09z.onrender.com) | 서버 상태 확인: [/health](https://sdp-backend-m09z.onrender.com/health) |

---

## 1. 🖥️ 관리자 대시보드 (Admin Dashboard)
*   **로컬 실행 방법:**
    ```powershell
    cd "d:\박영수\1.프로그램\SDP\admin"
    npm run dev
    ```
    *   접속: `http://localhost:5173`

---

## 2. 📱 시민용 앱 (Citizen App - Mobile)
*   **실행 방법 (테스트):**
    1.  스마트폰에 **'Expo Go'** 앱 설치
    2.  로컬 터미널 실행:
        ```powershell
        cd "d:\박영수\1.프로그램\SDP\citizen"
        npx expo start --tunnel
        ```
    3.  화면의 **QR 코드를 스캔**하여 접속

---

## 3. ⚙️ 백엔드 및 인프라 (Backend & Infrastructure)
*   **로컬 실행:**
    ```powershell
    cd "d:\박영수\1.프로그램\SDP\server_py"
    python main.py
    ```
*   **데이터베이스:** Supabase PostgreSQL
*   **블록체인:** Ethereum Sepolia Testnet

---

## 🛠️ 통합 빌드 및 동기화 스크립트 사용법
수정된 내용을 외부 서버에 반영하려면 다음 스크립트를 사용하세요:
1.  **전체 빌드**: `.\build_sdp.cmd` (Admin, Citizen Web, Contract 일괄 빌드)
2.  **GitHub 동기화**: `.\git_sync.cmd` (수정 사항 업로드 및 자동 재배포 트리거)

---
**성동구의 스마트한 미래, 성동 패스와 함께하세요!**
