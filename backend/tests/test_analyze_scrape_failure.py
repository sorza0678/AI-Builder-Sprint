"""scrape_ok=False 인 경우 /analyze 가 가짜 데이터로 200을 반환하지 않고
정직하게 400 SCRAPE_FAILED를 돌려주는지 검증 (이전에는 scrape_ok가 무시됐음)."""
import pytest
from fastapi.testclient import TestClient

from app import db, scraper
from app.main import app
from app.scraper import FALLBACK_LISTING


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(db, "DATABASE", tmp_path / "test_resale_guard.db")
    with TestClient(app) as c:
        yield c


def test_real_scrape_failure_returns_scrape_failed_not_fake_success(client, monkeypatch):
    monkeypatch.setattr(
        scraper, "scrape_listing", lambda url: {**FALLBACK_LISTING, "platform": "unknown"}
    )

    r = client.post(
        "/api/v1/analyze",
        json={"user_id": "u1", "url": "https://example.com/some-real-listing-that-fails"},
    )

    assert r.status_code == 400
    body = r.json()
    assert body["ok"] is False
    assert body["error"]["code"] == "SCRAPE_FAILED"


def test_demo_trigger_words_still_bypass_scraper_entirely(client, monkeypatch):
    def _fail_if_called(url):
        raise AssertionError("trigger words should short-circuit before scrape_listing runs")

    monkeypatch.setattr(scraper, "scrape_listing", _fail_if_called)

    r = client.post("/api/v1/analyze", json={"user_id": "u1", "url": "mock-safe-demo"})

    assert r.status_code == 200
    assert r.json()["data"]["risk_level"] == "SAFE"
