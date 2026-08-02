"""외부 호출 결과를 잠깐 재사용하는 초경량 TTL 캐시.

왜 필요한가:
- 데모 중 같은 매물 URL 을 여러 번 넣으면 매번 스크래핑·시세검색이 다시 나간다 (느리고 민폐).
- 번개장터에 짧은 시간에 반복 요청하면 차단될 수 있다 — 발표 당일 차단되면 시세가 전부 폴백으로 떨어진다.

의도적으로 단순하게 만들었다 (Redis 같은 외부 의존 없이):
- 프로세스 메모리에만 있고 재시작하면 사라진다 — 캐시가 없어도 동작은 동일하다.
- 워커가 여러 개면 워커마다 따로 캐시된다. 정확성에 영향 없음(읽기 전용 조회 결과라서).
- 예외는 캐시하지 않는다 — 일시적 실패가 TTL 동안 굳어버리면 안 된다.
"""
import threading
import time
from collections.abc import Callable

_store: dict[str, tuple[float, object]] = {}
_lock = threading.Lock()
MAX_ENTRIES = 500  # 메모리 무한 증가 방지


def get_or_call(key: str, ttl_seconds: float, factory: Callable[[], object]) -> object:
    """캐시에 있으면 반환, 없으면 factory() 호출 후 저장.

    factory 가 예외를 던지면 캐시하지 않고 그대로 전파한다 (호출부의 fallback 로직이 처리).
    """
    now = time.monotonic()
    with _lock:
        hit = _store.get(key)
        if hit and hit[0] > now:
            return hit[1]

    value = factory()  # 락 밖에서 호출 — 느린 네트워크 호출이 다른 요청을 막지 않게

    with _lock:
        if len(_store) >= MAX_ENTRIES:
            # 만료된 것부터 정리하고, 그래도 꽉 차면 가장 오래된 것을 버린다
            for k in [k for k, (exp, _) in _store.items() if exp <= now]:
                _store.pop(k, None)
            if len(_store) >= MAX_ENTRIES:
                _store.pop(min(_store, key=lambda k: _store[k][0]), None)
        _store[key] = (now + ttl_seconds, value)
    return value


def clear() -> None:
    """테스트용 — 캐시 초기화."""
    with _lock:
        _store.clear()
