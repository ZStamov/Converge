"""Render briefing items to human-sounding speech with Kokoro (open-source neural TTS, Apache-2.0).

Usage: python scripts/tts.py <data-out dir> <audio-out dir> <model.onnx> <voices.bin> <public base url> [voice]
Reuses clips already in <audio-out> (named by item id + voice + text hash), synthesizes new ones,
deletes clips no longer referenced, and writes clip names back into market.json.
"""
import hashlib
import json
import os
import sys

import lameenc
import numpy as np
from kokoro_onnx import Kokoro

data_dir, audio_dir, model, voices, base = sys.argv[1:6]
VOICE = sys.argv[6] if len(sys.argv) > 6 else "af_heart"
market_path = os.path.join(data_dir, "market.json")
market = json.load(open(market_path))
os.makedirs(audio_dir, exist_ok=True)
existing = set(os.listdir(audio_dir))
tts = Kokoro(model, voices)
needed, made = set(), 0


def synth(text, stem, speed=1.0):
    global made
    h = hashlib.md5(f"{VOICE}|{speed}|{text}".encode("utf-8")).hexdigest()[:8]
    name = f"{stem}-{h}.mp3"
    needed.add(name)
    if name in existing:
        return name
    samples, sr = tts.create(text, voice=VOICE, speed=speed, lang="en-us")
    pause = np.zeros(int(sr * 0.45), dtype=np.float32)  # breath between items
    pcm = (np.clip(np.concatenate([samples, pause]), -1, 1) * 32767).astype(np.int16).tobytes()
    enc = lameenc.Encoder()
    enc.set_bit_rate(64)
    enc.set_in_sample_rate(sr)
    enc.set_channels(1)
    enc.set_quality(2)
    with open(os.path.join(audio_dir, name), "wb") as out:
        out.write(enc.encode(pcm) + enc.flush())
    made += 1
    return name


bv = market.get("briefingVoice") or {}
for item in market.get("briefing", []):
    if item.get("say"):
        item["audio"] = synth(item["say"], item["id"])
market["briefingAudio"] = {
    "base": base,
    "intro": synth(bv.get("intro", "Here's your Converge briefing."), "intro", 0.98),
    "outro": synth(bv.get("outro", "That's your briefing."), "outro", 0.98),
    "voice": f"Kokoro neural voice ({VOICE})",
}
for f in os.listdir(audio_dir):
    if f.endswith(".mp3") and f not in needed:
        os.unlink(os.path.join(audio_dir, f))
json.dump(market, open(market_path, "w"), separators=(",", ":"))
print(f"tts: {len(needed)} clips referenced, {made} newly synthesized, voice {VOICE}")
