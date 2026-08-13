import os
import time
import tempfile
import logging
import asyncio
from concurrent.futures import ThreadPoolExecutor

from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import JSONResponse

log = logging.getLogger('ai.asr')

MODEL_SIZE = os.environ.get('ASR_MODEL', 'base')
DEVICE     = os.environ.get('ASR_DEVICE', 'cpu')
COMPUTE    = os.environ.get('ASR_COMPUTE', 'int8')
MAX_BYTES  = int(os.environ.get('ASR_MAX_BYTES', str(25 * 1024 * 1024)))
MODEL_DIR  = os.environ.get('ASR_MODEL_DIR', os.path.join(os.path.dirname(__file__), '..', 'models'))

router = APIRouter(prefix='/asr', tags=['ASR'])
_pool = ThreadPoolExecutor(max_workers=int(os.environ.get('ASR_WORKERS', '2')))
_model = None
_model_err = None


def load_model():
    global _model, _model_err
    if _model is not None or _model_err is not None:
        return
    try:
        from faster_whisper import WhisperModel
        t0 = time.time()
        os.makedirs(MODEL_DIR, exist_ok=True)
        _model = WhisperModel(MODEL_SIZE, device=DEVICE, compute_type=COMPUTE, download_root=MODEL_DIR)
        log.info('ASR model loaded %s/%s/%s in %.1fs', MODEL_SIZE, DEVICE, COMPUTE, time.time() - t0)
    except Exception as e:
        _model_err = str(e)
        log.error('ASR model load failed: %s', e)


def _transcribe_sync(path: str, language: str):
    lang = None if (not language or language == 'auto') else language
    segments, info = _model.transcribe(
        path, language=lang, beam_size=5, vad_filter=True,
        vad_parameters=dict(min_silence_duration_ms=500),
    )
    text = ''.join(seg.text for seg in segments).strip()
    return text, info.language, info.duration


@router.get('/health')
def asr_health():
    load_model()
    if _model_err:
        return JSONResponse(status_code=503, content={'ok': False, 'error': _model_err})
    return {'ok': True, 'model': MODEL_SIZE, 'device': DEVICE}


@router.post('/transcribe')
async def transcribe(file: UploadFile = File(...), language: str = Form('auto')):
    load_model()
    if _model_err or _model is None:
        raise HTTPException(503, detail=f'ASR unavailable: {_model_err or "not loaded"}')

    data = await file.read()
    if not data:
        raise HTTPException(400, 'Empty audio file')
    if len(data) > MAX_BYTES:
        raise HTTPException(413, f'Audio exceeds limit of {MAX_BYTES} bytes')

    suffix = os.path.splitext(file.filename or '')[1] or '.bin'
    tmp = tempfile.NamedTemporaryFile(suffix=suffix, delete=False)
    try:
        tmp.write(data); tmp.flush(); tmp.close()
        loop = asyncio.get_event_loop()
        t0 = time.time()
        text, lang, dur = await loop.run_in_executor(_pool, _transcribe_sync, tmp.name, language)
        log.info('Transcribed %d bytes -> %d chars lang=%s dur=%.1fs cost=%.1fs',
                 len(data), len(text), lang, dur or 0, time.time() - t0)
        return {'text': text, 'language': lang, 'duration': dur}
    except HTTPException:
        raise
    except Exception as e:
        log.error('Transcription failed: %s', e)
        raise HTTPException(500, f'Transcription failed: {e}')
    finally:
        try: os.unlink(tmp.name)
        except OSError: pass
