"""
Haversine 공식 — 두 GPS 좌표 간 거리 계산 (미터 단위)
GPS 조작 방지를 위해 서버 측에서 재검증에 사용
"""
import math


def haversine(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """두 좌표 사이의 거리를 미터(m) 단위로 반환"""
    R = 6_371_000  # 지구 반지름(m)

    phi1  = math.radians(lat1)
    phi2  = math.radians(lat2)
    dphi  = math.radians(lat2 - lat1)
    dlam  = math.radians(lng2 - lng1)

    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
