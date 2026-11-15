"""
Sidecar Coqui XTTS v2 para a Clara.

POST /tts  { "text": "..." }  → audio/wav
GET  /health                  → status do modelo e dos áudios de referência

Otimizações:
- escolhe 1–2 refs curtas (~6–12 s), não todos os WAVs
- clona a voz uma vez (speaker=clara) e reusa o cache
"""

from __future__ import annotations

import io
import os
import time
from contextlib import asynccontextmanager
from pathlib import Path

import numpy as np
import soundfile as sf
import torch
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field

ROOT = Path(__file__).resolve().parent
REPO_ROOT = ROOT.parent.parent
DEFAULT_VOICE_DIR = ROOT / "voices"
DOCS_AUDIO_REFS = REPO_ROOT / "docs" / "audio-refs"
MODEL_ID = "tts_models/multilingual/multi-dataset/xtts_v2"
MAX_CHARS = 420
LANGUAGE = "pt"
SPEAKER_ID = "clara"
# >1.0 = fala mais rápida (XTTS length_scale = 1/speed)
SPEECH_SPEED = float(os.environ.get("CLARA_XTTS_SPEED", "1.3"))
# mono 24 kHz 16-bit ≈ 48_000 bytes/s
BYTES_PER_SEC = 48_000
TARGET_REF_SECS = (6.0, 14.0)
MAX_REF_FILES = 2
AUDIO_GLOBS = ("*.wav", "*.mp3", "*.flac", "*.ogg", "*.m4a")

VOICE_DIR = Path(
    os.environ.get("CLARA_VOICE_DIR", str(DEFAULT_VOICE_DIR))
).expanduser()
VOICE_WAV_ENV = os.environ.get("CLARA_VOICE_WAV", "").strip()
DEVICE_ENV = os.environ.get("DEVICE", "").strip().lower()
PORT = int(os.environ.get("PORT", "8020"))

_tts = None
_device: str | None = None
_boot_error: str | None = None
_voice_ready = False
_voice_files: list[Path] = []


class TtsBody(BaseModel):
    text: str = Field(..., min_length=1)


def resolve_device() -> str:
    if DEVICE_ENV in {"cuda", "cpu"}:
        if DEVICE_ENV == "cuda" and not torch.cuda.is_available():
            return "cpu"
        return DEVICE_ENV
    return "cuda" if torch.cuda.is_available() else "cpu"


def list_all_voice_candidates() -> list[Path]:
    if VOICE_WAV_ENV:
        path = Path(VOICE_WAV_ENV).expanduser()
        return [path] if path.is_file() else []

    files: list[Path] = []
    if VOICE_DIR.is_dir():
        files.extend(sorted(VOICE_DIR.glob("*.wav")))
        files = [f for f in files if f.is_file() and f.stat().st_size > 0]
    if files:
        return files

    if DOCS_AUDIO_REFS.is_dir():
        for pattern in AUDIO_GLOBS:
            files.extend(sorted(DOCS_AUDIO_REFS.glob(pattern)))
        files = [f for f in files if f.is_file() and f.stat().st_size > 0]
    return files


def estimate_secs(path: Path) -> float:
    return max(0.1, path.stat().st_size / BYTES_PER_SEC)


def pick_voice_files(candidates: list[Path]) -> list[Path]:
    """1–2 clips próximos de 6–14 s — refs longas deixam o clone lento no CPU."""
    if not candidates:
        return []
    if VOICE_WAV_ENV:
        return candidates[:1]

    scored = sorted(
        ((abs(estimate_secs(p) - 10.0), estimate_secs(p), p) for p in candidates),
        key=lambda row: (row[0], row[1]),
    )
    chosen: list[Path] = []
    total = 0.0
    lo, hi = TARGET_REF_SECS
    for _, secs, path in scored:
        if len(chosen) >= MAX_REF_FILES:
            break
        if chosen and total + secs > hi + 4:
            continue
        if secs > hi * 1.6 and chosen:
            continue
        chosen.append(path)
        total += secs
        if total >= lo and len(chosen) >= 1:
            # Um bom clip sozinho já basta.
            if secs >= lo or total >= lo:
                break
    return chosen or [scored[0][2]]


def get_tts():
    global _tts, _device
    if _tts is not None:
        return _tts
    os.environ.setdefault("COQUI_TOS_AGREED", "1")
    from TTS.api import TTS

    _device = resolve_device()
    api = TTS(MODEL_ID)
    api.to(_device)
    _tts = api
    return _tts


def warm_voice(tts) -> None:
    """Clona e cacheia a speaker 'clara' uma vez."""
    global _voice_ready, _voice_files
    candidates = list_all_voice_candidates()
    _voice_files = pick_voice_files(candidates)
    if not _voice_files:
        raise RuntimeError(
            "Áudio de referência ausente em voices/ ou docs/audio-refs/."
        )

    speaker_wav: str | list[str]
    if len(_voice_files) == 1:
        speaker_wav = str(_voice_files[0])
    else:
        speaker_wav = [str(p) for p in _voice_files]

    t0 = time.perf_counter()
    # Texto curto só para forçar o cache do speaker.
    tts.tts(
        text="Oi.",
        speaker_wav=speaker_wav,
        speaker=SPEAKER_ID,
        language=LANGUAGE,
        speed=SPEECH_SPEED,
    )
    _voice_ready = True
    print(
        f"[clara-xtts] voz '{SPEAKER_ID}' cacheada em {time.perf_counter() - t0:.1f}s "
        f"com {len(_voice_files)} ref(s): "
        + ", ".join(f"{p.name}~{estimate_secs(p):.0f}s" for p in _voice_files),
        flush=True,
    )


@asynccontextmanager
async def lifespan(_app: FastAPI):
    global _boot_error
    try:
        tts = get_tts()
        warm_voice(tts)
        _boot_error = None
    except Exception as exc:  # noqa: BLE001
        _boot_error = str(exc)
        print(f"[clara-xtts] boot_error: {exc}", flush=True)
    yield


app = FastAPI(title="Clara XTTS", version="0.1.0", lifespan=lifespan)


@app.get("/health")
def health() -> dict:
    return {
        "ok": _tts is not None and _voice_ready and not _boot_error,
        "model": MODEL_ID,
        "device": _device or resolve_device(),
        "voice_dir": str(VOICE_DIR),
        "voice_files": [str(p) for p in _voice_files],
        "voice_count": len(_voice_files),
        "voice_cached": _voice_ready,
        "boot_error": _boot_error,
    }


@app.post("/tts")
def synthesize(body: TtsBody) -> Response:
    text = body.text.strip()[:MAX_CHARS]
    if not text:
        raise HTTPException(status_code=400, detail="Texto vazio.")

    try:
        tts = get_tts()
        if not _voice_ready:
            warm_voice(tts)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=503,
            detail=f"Falha ao carregar XTTS: {exc}",
        ) from exc

    try:
        t0 = time.perf_counter()
        try:
            # Reusa embedding cacheado — sem reprocessar os WAVs.
            wav = tts.tts(
                text=text,
                speaker=SPEAKER_ID,
                language=LANGUAGE,
                speed=SPEECH_SPEED,
            )
        except Exception:
            speaker_wav: str | list[str] = (
                str(_voice_files[0])
                if len(_voice_files) == 1
                else [str(p) for p in _voice_files]
            )
            wav = tts.tts(
                text=text,
                speaker_wav=speaker_wav,
                speaker=SPEAKER_ID,
                language=LANGUAGE,
                speed=SPEECH_SPEED,
            )
        elapsed = time.perf_counter() - t0
        if hasattr(wav, "detach"):
            wav = wav.detach().cpu().numpy()
        samples = np.asarray(wav, dtype=np.float32).reshape(-1)
        sample_rate = 24000
        synth = getattr(tts, "synthesizer", None)
        if synth is not None and getattr(synth, "output_sample_rate", None):
            sample_rate = int(synth.output_sample_rate)

        buf = io.BytesIO()
        sf.write(buf, samples, sample_rate, format="WAV")
        print(
            f"[clara-xtts] tts {elapsed:.1f}s chars={len(text)} device={_device}",
            flush=True,
        )
        return Response(
            content=buf.getvalue(),
            media_type="audio/wav",
            headers={
                "Cache-Control": "no-store",
                "X-Clara-TTS": f"xtts_v2/{LANGUAGE}/cached",
                "X-Clara-TTS-Ms": str(int(elapsed * 1000)),
            },
        )
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=502,
            detail=f"Falha ao sintetizar: {exc}",
        ) from exc


def main() -> None:
    DEFAULT_VOICE_DIR.mkdir(parents=True, exist_ok=True)
    uvicorn.run(
        "server:app",
        host="127.0.0.1",
        port=PORT,
        reload=False,
        log_level="info",
    )


if __name__ == "__main__":
    main()
