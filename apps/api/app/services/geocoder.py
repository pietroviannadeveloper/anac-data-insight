"""
Brazilian city geocoder — offline dictionary of main cities.
Parses city strings like "Belo Horizonte - MG", "SÃO PAULO - SP", "CABO FRIO - RJ".
"""

from __future__ import annotations
import unicodedata
import re

# (lat, lon) for major Brazilian cities
_CITIES: dict[str, tuple[float, float]] = {
    "saopaulo": (-23.5505, -46.6333), "saopaulosp": (-23.5505, -46.6333),
    "riodejaneiro": (-22.9068, -43.1729), "riosp": (-22.9068, -43.1729),
    "belohorizonte": (-19.9191, -43.9386),
    "brasilia": (-15.7801, -47.9292), "brasiliabsb": (-15.7801, -47.9292),
    "salvador": (-12.9714, -38.5014),
    "fortaleza": (-3.7172, -38.5433),
    "manaus": (-3.1190, -60.0217),
    "curitiba": (-25.4284, -49.2733),
    "recife": (-8.0476, -34.8770),
    "portoalegre": (-30.0346, -51.2177),
    "belem": (-1.4558, -48.5044),
    "goiania": (-16.6869, -49.2648),
    "guarulhos": (-23.4543, -46.5334),
    "campinas": (-22.9099, -47.0626),
    "saoluis": (-2.5297, -44.3028),
    "maceio": (-9.6658, -35.7350),
    "natal": (-5.7945, -35.2110),
    "teresina": (-5.0892, -42.8019),
    "campogrande": (-20.4435, -54.6478),
    "joaopessoa": (-7.1195, -34.8450),
    "aracaju": (-10.9472, -37.0731),
    "cuiaba": (-15.6014, -56.0979),
    "macapa": (0.0349, -51.0694),
    "portovelho": (-8.7612, -63.9004),
    "riobranco": (-9.9754, -67.8249),
    "boavista": (2.8235, -60.6758),
    "palmas": (-10.2491, -48.3243),
    "florianopolis": (-27.5954, -48.5480),
    "vitoria": (-20.3155, -40.3128),
    "santos": (-23.9608, -46.3336),
    "saojosdoscompos": (-23.1794, -45.8869),
    "sorocaba": (-23.5015, -47.4526),
    "ribeiraopreto": (-21.1775, -47.8103),
    "londrina": (-23.3045, -51.1696),
    "maringa": (-23.4273, -51.9375),
    "joinville": (-26.3045, -48.8487),
    "blumenau": (-26.9190, -49.0661),
    "uberlandia": (-18.9188, -48.2769),
    "contagem": (-19.9319, -44.0536),
    "juizdefora": (-21.7642, -43.3503),
    "betim": (-19.9678, -44.1989),
    "anapolis": (-16.3281, -48.9532),
    "aparecidadegoiania": (-16.8239, -49.2438),
    "camapari": (-12.6869, -38.3197),
    "feiraodesantana": (-12.2664, -38.9663),
    "niteroi": (-22.8830, -43.1035),
    "duquedecaxias": (-22.7853, -43.3115),
    "novaigu": (-22.7592, -43.4613),
    "saobernaroodocampo": (-23.6944, -46.5646),
    "mossorosterno": (-5.1877, -37.3440),
    "caruaru": (-8.2760, -35.9756),
    "petrolina": (-9.3891, -40.4997),
    "juazeirdonorte": (-7.2136, -39.3152),
    "cascavel": (-24.9578, -53.4595),
    "fozdeiguacu": (-25.5478, -54.5882),
    "macae": (-22.3713, -41.7869),
    "campos": (-21.7542, -41.3244),
    "voltagredonda": (-22.5228, -44.1042),
    "santarem": (-2.4384, -54.6978),
    "cabofriorj": (-22.8794, -42.0186),
    "angradosreis": (-22.9676, -44.3174),
    "resende": (-22.4694, -44.4506),
    "taubate": (-23.0248, -45.5548),
    "saojoaqimdalapa": (-21.9794, -49.9378),
    "bauru": (-22.3246, -49.0960),
    "novaprussia": (-28.5819, -51.5128),
    "pelotas": (-31.7654, -52.3376),
    "caxiasdosul": (-29.1681, -51.1794),
    "gravatai": (-29.9440, -50.9865),
    "passo fundo": (-28.2553, -52.4068),
    "saoleopoldo": (-29.7613, -51.1493),
    "ilheus": (-14.7886, -39.0453),
    "vitoriadaconquista": (-14.8661, -40.8445),
    "barreiras": (-12.1527, -44.9912),
    "mossoroce": (-5.1877, -37.3440),
    "piracicaba": (-22.7252, -47.6492),
    "santacruzdsul": (-29.7212, -52.4255),
    "palhoca": (-27.6456, -48.6609),
    "itajai": (-26.9078, -48.6618),
    "chapeco": (-27.1004, -52.6150),
    "criciuma": (-28.6782, -49.3698),
    "lajeado": (-29.4671, -51.9602),
    "cacador": (-26.7751, -51.0137),
    "bageredefinido": (0, 0),
}


def _norm(text: str) -> str:
    text = text.lower()
    text = unicodedata.normalize("NFKD", text)
    text = "".join(c for c in text if not unicodedata.combining(c))
    text = re.sub(r"[^a-z0-9]", "", text)
    return text


def geocode_city(city_raw: str) -> tuple[float, float] | None:
    """
    Try to resolve a city string like 'Belo Horizonte - MG' to (lat, lon).
    Returns None if not found.
    """
    if not city_raw or not city_raw.strip():
        return None

    # Remove state suffix: "Belo Horizonte - MG" → "Belo Horizonte"
    parts = re.split(r"\s*[-–]\s*[A-Z]{2}$", city_raw.strip())
    city = parts[0] if parts else city_raw
    key  = _norm(city)

    if key in _CITIES:
        return _CITIES[key]

    # Partial match — try first 8+ chars
    if len(key) >= 6:
        for k, coords in _CITIES.items():
            if k.startswith(key[:6]) or key.startswith(k[:6]):
                return coords

    return None
