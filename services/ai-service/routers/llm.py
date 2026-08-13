import os
import logging
import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

log = logging.getLogger('ai.llm')

router = APIRouter(prefix='/llm', tags=['LLM'])

LLM_BASE_URL  = os.environ.get('LLM_BASE_URL', 'http://localhost:11434')
LLM_MODEL     = os.environ.get('LLM_MODEL', 'qwen2.5:7b')
LLM_TIMEOUT   = float(os.environ.get('LLM_TIMEOUT', '120'))
LLM_MAX_TOKENS = int(os.environ.get('LLM_MAX_TOKENS', '2048'))


class ChatMessage(BaseModel):
    role: str       # system | user | assistant
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    model: Optional[str] = None
    max_tokens: Optional[int] = None
    temperature: Optional[float] = 0.7
    stream: Optional[bool] = False


class AssistantRequest(BaseModel):
    prompt: str
    context: Optional[str] = None
    language: Optional[str] = 'zh'


@router.post('/chat')
async def chat(req: ChatRequest):
    model = req.model or LLM_MODEL
    payload = {
        'model': model,
        'messages': [m.model_dump() for m in req.messages],
        'options': {
            'temperature': req.temperature,
            'num_predict': req.max_tokens or LLM_MAX_TOKENS,
        },
        'stream': False,
    }
    try:
        async with httpx.AsyncClient(timeout=LLM_TIMEOUT) as client:
            resp = await client.post(f'{LLM_BASE_URL}/api/chat', json=payload)
            resp.raise_for_status()
            data = resp.json()
            content = data.get('message', {}).get('content', '')
            return {
                'content': content,
                'model': model,
                'prompt_tokens': data.get('prompt_eval_count'),
                'completion_tokens': data.get('eval_count'),
            }
    except httpx.HTTPStatusError as e:
        log.error('LLM HTTP error: %s', e)
        raise HTTPException(502, f'LLM backend error: {e.response.status_code}')
    except httpx.RequestError as e:
        log.error('LLM connection error: %s', e)
        raise HTTPException(503, 'LLM service unavailable')


@router.post('/assistant')
async def assistant(req: AssistantRequest):
    system_prompt = (
        'You are a helpful assistant embedded in a messaging app called v信. '
        'Be concise, friendly, and reply in the same language the user writes in.'
    )
    if req.context:
        system_prompt += f'\n\nConversation context:\n{req.context}'

    messages = [
        ChatMessage(role='system', content=system_prompt),
        ChatMessage(role='user', content=req.prompt),
    ]
    return await chat(ChatRequest(messages=messages))


@router.get('/models')
async def list_models():
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(f'{LLM_BASE_URL}/api/tags')
            resp.raise_for_status()
            return resp.json()
    except Exception as e:
        raise HTTPException(503, f'LLM service unavailable: {e}')
