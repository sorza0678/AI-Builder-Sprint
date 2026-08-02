"""테스트 공통 설정."""
import pytest


@pytest.fixture(autouse=True)
def _clear_external_cache():
    """외부 호출 TTL 캐시를 테스트마다 비운다.

    캐시가 남아 있으면 앞 테스트가 monkeypatch 한 가짜 응답이 뒤 테스트로 새어
    "혼자 돌리면 통과, 전체로 돌리면 실패"하는 유령 실패가 생긴다.
    """
    from app import cache

    cache.clear()
    yield
    cache.clear()
