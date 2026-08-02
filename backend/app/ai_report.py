"""STEP 6: Upstage Solar LLM 리포트 — 상품 상태·주의 신호 텍스트 보강.

원칙:
- 점수(trust_score/risk_level)에는 절대 개입하지 않는다 — 점수는 rule_engine 전용.
- UPSTAGE_API_KEY 가 없거나 호출이 실패하면 조용히 None 반환 (데모 안죽게).
- 반환 형식은 rule_engine 의 product_status/scam_warnings 와 합집합으로 병합.
"""
import json
import logging
import os

import httpx

logger = logging.getLogger(__name__)

UPSTAGE_URL = "https://api.upstage.ai/v1/chat/completions"
# `or` 폴백: .env 에 UPSTAGE_MODEL= (빈 값)으로 있어도 기본 모델을 쓴다
MODEL = os.getenv("UPSTAGE_MODEL") or "solar-pro3"
# AI 보강은 "있으면 좋은" 부가정보다 — 오래 기다려서 /analyze 전체를 느리게 만들 이유가 없다.
# (스크랩 6s + 시세 6s 와 합쳐 최악 지연을 20초 아래로 유지)
TIMEOUT = 8.0

_SCHEMA = {
    "name": "listing_report",
    "strict": True,
    "schema": {
        "type": "object",
        "properties": {
            "defects_found": {"type": "array", "items": {"type": "string"}},
            "missing_components": {"type": "array", "items": {"type": "string"}},
            "scam_warnings": {"type": "array", "items": {"type": "string"}},
        },
        "required": ["defects_found", "missing_components", "scam_warnings"],
        "additionalProperties": False,
    },
}

_SYSTEM = (
    "너는 중고거래 매물 분석 전문가다. 매물 제목과 설명만 보고 "
    "(1) 언급된 하자/결함, (2) 빠진 구성품, (3) 사기 의심 신호를 한국어로 추출한다. "
    "본문에 없는 내용을 지어내지 마라. 각 항목은 25자 이내의 짧은 구절로."
)


def get_ai_report(listing: dict) -> dict | None:
    """Solar LLM 호출 → {defects_found, missing_components, scam_warnings} 또는 None."""
    api_key = os.getenv("UPSTAGE_API_KEY", "").strip()
    if not api_key:
        return None
    try:
        r = httpx.post(
            UPSTAGE_URL,
            headers={"Authorization": f"Bearer {api_key}"},
            json={
                "model": MODEL,
                "messages": [
                    {"role": "system", "content": _SYSTEM},
                    {
                        "role": "user",
                        "content": f"제목: {listing.get('title', '')}\n\n설명:\n{listing.get('description', '')[:1500]}",
                    },
                ],
                "response_format": {"type": "json_schema", "json_schema": _SCHEMA},
                "max_tokens": 500,
                "temperature": 0,
            },
            timeout=TIMEOUT,
        )
        r.raise_for_status()
        report = json.loads(r.json()["choices"][0]["message"]["content"])
        if not isinstance(report, dict):
            return None
        return {
            "defects_found": [str(x) for x in report.get("defects_found", [])][:5],
            "missing_components": [str(x) for x in report.get("missing_components", [])][:5],
            "scam_warnings": [str(x) for x in report.get("scam_warnings", [])][:5],
        }
    except Exception as e:
        # Solar 실패는 치명적이지 않다(Rule Engine 결과는 그대로) — 다만 키를 넣었는데
        # AI 보강이 안 되는 상황을 조용히 넘기면 연동됐는지 알 수 없다.
        logger.warning("Upstage Solar 호출 실패 → AI 보강 없이 진행 (%s: %s)", type(e).__name__, e)
        return None


def merge_report(rule_result: dict, ai: dict | None) -> dict:
    """rule_engine 결과에 AI 리포트를 합집합 병합. 점수는 건드리지 않는다."""
    if not ai:
        return rule_result
    merged = {**rule_result}
    merged["scam_warnings"] = list(
        dict.fromkeys(rule_result["scam_warnings"] + ai["scam_warnings"])
    )
    merged["product_status"] = {
        "defects_found": list(
            dict.fromkeys(
                rule_result["product_status"]["defects_found"] + ai["defects_found"]
            )
        ),
        "missing_components": list(
            dict.fromkeys(
                rule_result["product_status"]["missing_components"]
                + ai["missing_components"]
            )
        ),
    }
    return merged
