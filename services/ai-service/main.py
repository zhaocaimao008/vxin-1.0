import logging
import os
import secrets

import uvicorn
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from routers.asr import router as asr_router, load_model as load_asr_model
from routers.llm import router as llm_router
from routers.moderation import router as moderation_router

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [ai] %(levelname)s %(message)s',
)
log = logging.getLogger('ai')

app = FastAPI(
    title='vxin-ai',
    version='1.0.0',
    docs_url='/docs',
    redoc_url=None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_methods=['*'],
    allow_headers=['*'],
)


@app.middleware('http')
async def require_service_token(request: Request, call_next):
    expected = os.environ.get('SERVICE_TOKEN', '')
    if not expected:
        log.error('SERVICE_TOKEN is not configured')
        return JSONResponse(status_code=503, content={'detail': 'Service unavailable'})
    supplied = request.headers.get('X-Service-Token', '')
    if not secrets.compare_digest(supplied, expected):
        return JSONResponse(status_code=401, content={'detail': 'Unauthorized'})
    return await call_next(request)

app.include_router(asr_router)
app.include_router(llm_router)
app.include_router(moderation_router)


@app.on_event('startup')
def startup():
    load_asr_model()
    log.info('AI service started')


@app.get('/health')
def health():
    return {'ok': True, 'service': 'vxin-ai'}


if __name__ == '__main__':
    host = os.environ.get('HOST', '127.0.0.1')
    port = int(os.environ.get('AI_PORT', '8000'))
    uvicorn.run('main:app', host=host, port=port, log_level='info')
