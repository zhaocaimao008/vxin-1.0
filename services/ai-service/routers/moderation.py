import os
import re
import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

log = logging.getLogger('ai.moderation')

router = APIRouter(prefix='/moderation', tags=['Moderation'])

# ── simple keyword-based tier-1 filter (fast, no model needed) ────────────────
_BLOCKED_PATTERNS = [
    re.compile(p, re.IGNORECASE) for p in [
        r'(?:制作|合成|购买).{0,10}(?:炸弹|爆炸物|毒品|冰毒)',
        r'(?:儿童|未成年).{0,10}(?:色情|裸体|性)',
        r'(?:自杀|自残).{0,10}(?:方法|教程|攻略)',
    ]
]

_SENSITIVE_PATTERNS = [
    re.compile(p, re.IGNORECASE) for p in [
        r'(?:赌博|博彩|六合彩)',
        r'(?:诈骗|钓鱼|骗局)',
        r'(?:违禁|非法).{0,10}(?:药品|枪支|武器)',
    ]
]


class ModerationRequest(BaseModel):
    text: str
    image_url: Optional[str] = None


class ModerationResult(BaseModel):
    passed: bool
    action: str          # allow | warn | block
    categories: list[str]
    reason: Optional[str] = None


@router.post('/text', response_model=ModerationResult)
async def moderate_text(req: ModerationRequest):
    if not req.text or not req.text.strip():
        raise HTTPException(400, 'text is required')

    text = req.text.strip()
    categories: list[str] = []

    # tier-1: hard block
    for pat in _BLOCKED_PATTERNS:
        if pat.search(text):
            log.warning('Blocked content detected: pattern=%s', pat.pattern[:40])
            return ModerationResult(
                passed=False,
                action='block',
                categories=['harmful'],
                reason='Content violates community guidelines',
            )

    # tier-2: sensitive — warn but allow
    for pat in _SENSITIVE_PATTERNS:
        if pat.search(text):
            categories.append('sensitive')
            break

    if categories:
        return ModerationResult(passed=True, action='warn', categories=categories)

    return ModerationResult(passed=True, action='allow', categories=[])


@router.get('/health')
def moderation_health():
    return {'ok': True, 'tiers': ['keyword']}
