// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title  SeongdongPass (SDP)
 * @notice 성동구청 공공 리워드 토큰
 *         - 구청 서버 지갑(Owner)만 mint 가능
 *         - 비상 시 pause()로 전체 이동 중단
 *         - 가맹점 결제 후 burn()으로 소각
 */
contract SeongdongPass is ERC20, Ownable, Pausable {

    // ── 최대 발행량: 10억 SDP ─────────────────────────────────────
    uint256 public constant MAX_SUPPLY = 1_000_000_000 * 10 ** 18;

    // ── 이벤트 ───────────────────────────────────────────────────
    event CoinMinted(address indexed to,   uint256 amount, string reason);
    event CoinBurned(address indexed from, uint256 amount);
    event SpotClaimed(address indexed user, string spotId, uint256 reward);

    // ── 중복 획득 방지: user → spotId → 날짜(Unix day) → bool ──
    mapping(address => mapping(string => mapping(uint256 => bool))) private _claimed;

    constructor(address initialOwner)
        ERC20("SeongdongPass", "SDP")
        Ownable()
    {
        transferOwnership(initialOwner);
    }

    // ─────────────────────────────────────────────────────────────
    //  Owner 전용: 코인 발행
    // ─────────────────────────────────────────────────────────────

    /**
     * @dev  구청 서버 지갑이 구민 지갑으로 직접 코인 발행
     * @param to     수신 지갑 주소
     * @param amount 발행량 (1 SDP = 1e18)
     * @param reason "응봉산 팔각정 AR 수집" 같은 사유 문자열
     */
    function mint(
        address to,
        uint256 amount,
        string calldata reason
    ) external onlyOwner whenNotPaused {
        require(to != address(0),                     "Zero address");
        require(amount > 0,                           "Amount zero");
        require(totalSupply() + amount <= MAX_SUPPLY, "MAX_SUPPLY exceeded");

        _mint(to, amount);
        emit CoinMinted(to, amount, reason);
    }

    /**
     * @dev  보물 스팟 획득 + 중복 방지 온체인 기록
     *       (서버가 검증 후 이 함수를 호출)
     */
    function claimSpot(
        address user,
        string calldata spotId,
        uint256 rewardAmount
    ) external onlyOwner whenNotPaused {
        uint256 today = block.timestamp / 86400;
        require(!_claimed[user][spotId][today], "Already claimed today");

        _claimed[user][spotId][today] = true;
        require(totalSupply() + rewardAmount <= MAX_SUPPLY, "MAX_SUPPLY exceeded");

        _mint(user, rewardAmount);
        emit SpotClaimed(user, spotId, rewardAmount);
        emit CoinMinted(user, rewardAmount, spotId);
    }

    /**
     * @dev 오늘 이미 획득했는지 조회 (off-chain 사전 체크용)
     */
    function isClaimed(address user, string calldata spotId) external view returns (bool) {
        uint256 today = block.timestamp / 86400;
        return _claimed[user][spotId][today];
    }

    // ─────────────────────────────────────────────────────────────
    //  비상 정지 / 재개
    // ─────────────────────────────────────────────────────────────
    function pause()   external onlyOwner { _pause();   }
    function unpause() external onlyOwner { _unpause(); }

    // ─────────────────────────────────────────────────────────────
    //  전송 시 pause 체크 (Pausable 통합)
    // ─────────────────────────────────────────────────────────────
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override whenNotPaused {
        super._beforeTokenTransfer(from, to, amount);
    }

    // ─────────────────────────────────────────────────────────────
    //  소각 (가맹점 QR 결제 후 서버가 호출)
    // ─────────────────────────────────────────────────────────────
    function burn(uint256 amount) external whenNotPaused {
        _burn(msg.sender, amount);
        emit CoinBurned(msg.sender, amount);
    }

    /** 서버가 유저 대신 소각할 때 (approve 필요) */
    function burnFrom(address account, uint256 amount) external onlyOwner whenNotPaused {
        _burn(account, amount);
        emit CoinBurned(account, amount);
    }
}
