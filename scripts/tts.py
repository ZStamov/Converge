"""Render briefing items to natural-sounding speech with Piper (open-source neural TTS).

Usage: python scripts/tts.py <data-out dir> <audio-out dir> <voice.onnx> <public base url>
Reuses clips already in <audio-out> (named by item id + text hash), synthesizes new ones,
deletes clips no longer referenced, and writes clip names back into market.json.
"""
import hashlib
import json
import os
import sys
import tempfile
import wave

data_dir, audio_dir, model, base = sys.argv[1:5]
market_path = os.path.join(data_dir, "market.json")
market = json.load(open(market_path))
os.makedirs(audio_dir, exist_ok=True)
existing = set(os.listdir(audio_dir))

import lameenc  # noqa: E402
from piper import PiperVoice  # noqa: E402

voice = PiperVoice.load(model)
try:
    from piper import SynthesisConfig  # piper-tts >= 1.3

    syn = SynthesisConfig(length_scale=1.06, noise_scale=0.6, noise_w_scale=0.8)
except Exception:  # older API
    syn = None

needed, made = set(), 0


def synth(text, stem):
    global made
    h = hashlib.md5(text.encode("utf-8")).hexdigest()[:8]
    name = f"{stem}-{h}.mp3"
    needed.add(name)
    if name in existing:
        return name
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        wav_path = tmp.name
    with wave.open(wav_path, "wb") as wf:
        if hasattr(voice, "synthesize_wav"):
            voice.synthesize_wav(text, wf, syn_config=syn) if syn else voice.synthesize_wav(text, wf)
        else:
            voice.synthesize(text, wf)
    with wave.open(wav_path, "rb") as wr:
        rate, ch, width = wr.getframerate(), wr.getnchannels(), wr.getsampwidth()
        pcm = wr.readframes(wr.getnframes())
    pcm += b"\x00" * int(rate * 0.35) * ch * width  # short pause after each clip
    enc = lameenc.Encoder()
    enc.set_bit_rate(56)
    enc.set_in_sample_rate(rate)
    enc.set_channels(ch)
    enc.set_quality(2)
    with open(os.path.join(audio_dir, name), "wb") as out:
        out.write(enc.encode(pcm) + enc.flush())
    os.unlink(wav_path)
    made += 1
    return name


bv = market.get("briefingVoice") or {}
for item in market.get("briefing", []):
    if item.get("say"):
        item["audio"] = synth(item["say"], item["id"])
market["briefingAudio"] = {
    "base": base,
    "intro": synth(bv.get("intro", "Here's your Converge briefing."), "intro"),
    "outro": synth(bv.get("outro", "That's your briefing."), "outro"),
    "voice": "Piper neural voice (en_US lessac)",
}
for f in os.listdir(audio_dir):
    if f.endswith(".mp3") and f not in needed:
        os.unlink(os.path.join(audio_dir, f))
json.dump(market, open(market_path, "w"), separators=(",", ":"))
print(f"tts: {len(needed)} clips referenced, {made} newly synthesized")
