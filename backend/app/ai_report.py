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
            "model_name": {"type": ["string", "null"]},
            "year": {"type": ["string", "null"]},
            "size_or_capacity": {"type": ["string", "null"]},
            "color": {"type": ["string", "null"]},
            "usage_period": {"type": ["string", "null"]},
        },
        "required": [
            "defects_found", "missing_components", "scam_warnings",
            "model_name", "year", "size_or_capacity", "color", "usage_period",
        ],
        "additionalProperties": False,
    },
}

# AI 가 채우는 부가 필드 — AI 성공/실패 두 경로가 항상 같은 키 집합을 반환해야
# 호출부가 dict 를 직접 써도 KeyError 가 나지 않는다 (merge_report 참고).
_AI_DETAIL_KEYS = ("model_name", "year", "size_or_capacity", "color", "usage_period")

# 프롬프트가 "본문에 명시적으로 없으면 반드시 null" 이라고 지시해도 LLM 은 관성적으로
# "없음"/"미상" 같은 문자열을 뱉는다. 이게 그대로 통과하면 프론트의 `?? ""` 폴백이
# null 이 아니라서 작동하지 않고, 모델명 입력칸에 "없음" 이 자동 입력된다.
# 비교는 반드시 완전일치 — 부분일치로 걸러내면 "무광 블랙", "미사용" 같은 진짜 값까지 날아간다.
# (소문자화 + 공백 제거 후 비교하므로 "N/A", " 미상 ", "확인 불가" 도 같이 잡힌다)
_PLACEHOLDER_TEXTS = frozenset(
    {
        "없음", "없습니다", "미상", "미기재", "미확인", "미제공",
        "확인불가", "확인불가능", "확인안됨", "정보없음", "해당없음", "알수없음", "모름",
        "n/a", "na", "null", "none", "nil", "unknown", "unspecified",
        "-", "--", "_", ".", "?", "??",
    }
)

_SYSTEM = (
    "너는 중고거래 매물 분석 전문가다. 매물 제목과 설명만 보고 다음을 한국어로 추출한다: "
    "(1) 언급된 하자/결함, (2) 빠진 구성품, (3) 사기 의심 신호, "
    "(4) 모델명(예: iPhone 14 Pro, 갤럭시 Z플립6), (5) 연식 또는 출시년도, "
    "(6) 용량 또는 사이즈(예: 256GB, 260mm), (7) 색상, (8) 사용 기간(예: 6개월, 1년). "
    "본문에 없는 내용을 지어내지 마라 — (4)~(8)은 본문에 명시적으로 없으면 반드시 null. "
    "(1)~(3)의 각 항목은 25자 이내의 짧은 구절로."
)


def _short_text(value) -> str | None:
    """LLM 이 준 단문 필드를 정리 — 빈 값·자리표시 문자열은 None, 나머지는 30자로 자른다."""
    if not isinstance(value, str):
        return None
    stripped = value.strip()
    if not stripped:
        return None
    # 대소문자·공백에 견고하게: "N/A", " 미상 ", "확인 불가" 를 모두 같은 형태로 눕혀 비교
    if "".join(stripped.split()).lower() in _PLACEHOLDER_TEXTS:
        return None
    return stripped[:30]


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
                # 응답 필드가 3개 → 8개로 늘면서 최악 출력량이 500 토큰 코앞까지 왔다
                # (배열 3개 × 5항목 × 25자 + 신규 5필드 + JSON 키/구두점 ≒ 415~490 토큰).
                # 잘리면 JSON 이 중간에서 끊겨 json.loads 가 터지고 → None 반환 → merge_report 가
                # early return 해서 신규 필드뿐 아니라 defects_found/scam_warnings 까지 통째로 날아간다.
                # 여유를 둬서 "기능 추가가 기존 기능을 죽이는" 사고를 막는다.
                "max_tokens": 800,
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
            **{key: _short_text(report.get(key)) for key in _AI_DETAIL_KEYS},
        }
    except Exception as e:
        # Solar 실패는 치명적이지 않다(Rule Engine 결과는 그대로) — 다만 키를 넣었는데
        # AI 보강이 안 되는 상황을 조용히 넘기면 연동됐는지 알 수 없다.
        logger.warning("Upstage Solar 호출 실패 → AI 보강 없이 진행 (%s: %s)", type(e).__name__, e)
        return None


def merge_report(rule_result: dict, ai: dict | None) -> dict:
    """rule_engine 결과에 AI 리포트를 합집합 병합. 점수는 건드리지 않는다."""
    if not ai:
        # AI 가 없어도 키 집합은 AI 있음 경로와 동일해야 한다(값만 null).
        # 지금은 Pydantic 스키마 기본값이 None 이라 우연히 동작하지만,
        # 호출부가 반환 dict 를 직접 읽으면 KeyError 가 난다.
        return {**rule_result, **dict.fromkeys(_AI_DETAIL_KEYS)}
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
    for key in _AI_DETAIL_KEYS:
        merged[key] = ai.get(key)
    return merged
