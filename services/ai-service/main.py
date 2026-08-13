import logging
import os

import uvicorn
from fastapi import FastAPI
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
    host = os.environ.get('AI_HOST', '0.0.0.0')
    port = int(os.environ.get('AI_PORT', '8000'))
    uvicorn.run('main:app', host=host, port=port, log_level='info')
