"""Maakt de muziek en geluidjes voor de uitlegvideo's, puur gesynthetiseerd (geen samples, geen rechten).

Draaien: python3 scripts/make-audio.py  ->  public/audio/*.wav
"""
import math, random, struct, wave, os

SR = 44100
OUT = os.path.join(os.path.dirname(__file__), "..", "public", "audio")
os.makedirs(OUT, exist_ok=True)
random.seed(7)


def save(name, samples, peak=0.9):
    m = max(1e-9, max(abs(s) for s in samples))
    k = peak / m
    with wave.open(os.path.join(OUT, name + ".wav"), "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(b"".join(struct.pack("<h", int(max(-1, min(1, s * k)) * 32767)) for s in samples))


def blank(sec):
    return [0.0] * int(SR * sec)


def add(buf, start, samples, gain=1.0):
    i0 = int(start * SR)
    for i, s in enumerate(samples):
        j = i0 + i
        if j >= len(buf): break
        buf[j] += s * gain


def midi(n):
    return 440 * 2 ** ((n - 69) / 12)


# ---------- geluidjes ----------
def pop():
    n = int(SR * 0.12); out = []
    for i in range(n):
        t = i / SR; f = 520 + 520 * min(1, t / 0.05)
        out.append(math.sin(2 * math.pi * f * t) * math.exp(-t * 38))
    return out


def click():
    n = int(SR * 0.06); out = []
    for i in range(n):
        t = i / SR
        out.append((math.sin(2 * math.pi * 2200 * t) * 0.6 + (random.random() * 2 - 1) * 0.4) * math.exp(-t * 120))
    return out


def whoosh():
    n = int(SR * 0.5); out = []; lp = 0.0
    for i in range(n):
        t = i / SR; env = math.sin(math.pi * t / 0.5) ** 2
        a = 0.02 + 0.25 * env
        lp += a * ((random.random() * 2 - 1) - lp)
        out.append(lp * env)
    return out


def bell(f, dur, decay):
    n = int(SR * dur); out = []
    for i in range(n):
        t = i / SR
        s = math.sin(2 * math.pi * f * t) + 0.35 * math.sin(2 * math.pi * f * 2.0 * t) * math.exp(-t * 4) + 0.15 * math.sin(2 * math.pi * f * 3.01 * t) * math.exp(-t * 7)
        out.append(s * math.exp(-t * decay) * min(1, t / 0.004))
    return out


def ding():
    buf = blank(1.2)
    add(buf, 0, bell(midi(88), 1.1, 5))       # E6
    add(buf, 0.09, bell(midi(95), 1.1, 5))    # B6
    return buf


def tick():
    n = int(SR * 0.03)
    return [(math.sin(2 * math.pi * 1500 * i / SR)) * math.exp(-i / SR * 180) for i in range(n)]


def typing(sec=4.5):
    buf = blank(sec); t = 0.0
    while t < sec - 0.05:
        n = int(SR * 0.025); f = random.uniform(2500, 4000)
        add(buf, t, [((random.random() * 2 - 1) * 0.7 + 0.3 * math.sin(2 * math.pi * f * i / SR)) * math.exp(-i / SR * 260) for i in range(n)], random.uniform(0.5, 1))
        t += random.uniform(0.055, 0.13)
    return buf


save("pop", pop(), 0.8)
save("click", click(), 0.8)
save("whoosh", whoosh(), 0.7)
save("ding", ding(), 0.8)
save("tick", tick(), 0.6)
save("typing", typing(), 0.6)

# ---------- deuntje: rustig, warm, 96 bpm ----------
BPM = 96; beat = 60 / BPM; bar = beat * 4
CHORDS = [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59]]  # Fmaj7 Em7 Dm7 Cmaj7
BASS = [41, 40, 38, 36]
MELODY = [  # (maat, tel, noot, lengte in tellen)
    (2, 0, 72, 1), (2, 1.5, 71, 0.5), (2, 2, 69, 2), (3, 0, 67, 1.5), (3, 2, 64, 2),
    (6, 0, 72, 1), (6, 1.5, 74, 0.5), (6, 2, 76, 2), (7, 0, 74, 1.5), (7, 2, 72, 2),
]
BARS = 8
music = blank(BARS * bar + 2)

def pad(notes, dur):
    n = int(SR * dur); out = [0.0] * n
    for note in notes:
        for det in (-0.12, 0.12):
            f = midi(note + det)
            for i in range(n):
                t = i / SR
                env = min(1, t / 0.35) * min(1, (dur - t) / 0.4)
                out[i] += math.sin(2 * math.pi * f * t) * env * 0.12
    return out

def pluck(note, dur, bright=0.3):
    n = int(SR * dur); f = midi(note)
    return [(math.sin(2 * math.pi * f * i / SR) + bright * math.sin(4 * math.pi * f * i / SR)) * math.exp(-i / SR * 3.5) * min(1, i / SR / 0.005) for i in range(n)]

def kick():
    n = int(SR * 0.3); out = []; ph = 0.0
    for i in range(n):
        t = i / SR; f = 45 + 90 * math.exp(-t * 30); ph += 2 * math.pi * f / SR
        out.append(math.sin(ph) * math.exp(-t * 11))
    return out

def hat():
    n = int(SR * 0.05); out = []; prev = 0.0
    for i in range(n):
        x = random.random() * 2 - 1; hp = x - prev; prev = x
        out.append(hp * math.exp(-i / SR * 90))
    return out

K, H = kick(), hat()
for b in range(BARS):
    c = b % 4; t0 = b * bar
    add(music, t0, pad(CHORDS[c], bar + 0.3), 0.9)
    add(music, t0, pluck(BASS[c], beat * 1.8, 0.15), 0.35)
    add(music, t0 + beat * 2.5, pluck(BASS[c] + 7, beat, 0.15), 0.22)
    if b >= 1:
        for k in (0, 2):
            add(music, t0 + k * beat, K, 0.55)
        for e in range(8):
            add(music, t0 + e * beat / 2, H, 0.10 if e % 2 else 0.05)
for (b, tel, note, ln) in MELODY:
    add(music, b * bar + tel * beat, pluck(note, ln * beat + 0.6, 0.4), 0.22)

# simpele galm voor warmte
d = int(SR * 0.23)
for i in range(d, len(music)):
    music[i] += music[i - d] * 0.28
save("bed", music, 0.85)
print("klaar:", sorted(os.listdir(OUT)))
