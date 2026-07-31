"""시세 함수 단위 테스트 — 네트워크 없이 순수 로직만 검증."""
from app import market_price


def test_trimmed_mean_cuts_outliers():
    # 미끼가격 500원과 뻥튀기 900만원이 절사되어야 한다
    prices = [500, 800_000, 820_000, 850_000, 880_000, 900_000, 9_000_000]
    avg = market_price.trimmed_mean(prices)
    assert 800_000 <= avg <= 900_000


def test_trimmed_mean_small_sample_uses_median():
    assert market_price.trimmed_mean([100, 200, 300]) == 200
    assert market_price.trimmed_mean([]) == 0


def test_build_keyword_strips_noise():
    kw = market_price.build_keyword("아이폰 14 프로 256GB 급처 팝니다!! 미개봉 🔥")
    assert "급처" not in kw and "팝니다" not in kw
    assert "아이폰" in kw


def test_fallback_price_table_match():
    price = market_price._fallback_price("아이폰 14 프로 딥퍼플", listing_price=850_000)
    assert price == market_price.FALLBACK_PRICES["아이폰 14 프로"]


def test_fallback_price_unknown_item_uses_listing_price():
    assert market_price._fallback_price("희귀 골동품 도자기", listing_price=300_000) == 300_000
