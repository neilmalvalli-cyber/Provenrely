"""Tileable stone textures for the marble environment.

Everything is generated from seeded, periodic noise, so the textures tile seamlessly and carry no third-party
licence. Two sets are produced:

  terrazzo  polished white terrazzo: angular aggregate in two sizes, mineral mottling, a faint crackle network
  stucco    honed marble-plaster for walls and ceilings: fine grain, soft clouding, a very faint crackle

For each set: <name>_albedo.webp (sRGB), <name>_rough.webp (linear, roughness in G as three.js expects),
<name>_normal.webp (tangent space, OpenGL convention, +Y up).

Run with the same Python that has bpy (numpy, scipy, pillow):
  python generate_textures.py --out ../public/environment/textures
"""

import argparse
import os

import numpy as np
from PIL import Image
from scipy.spatial import cKDTree

SIZE = 2048


def spectral_noise(rng, size, lo, hi, power=1.0):
    """Periodic band-limited noise: white noise filtered in the frequency domain (tiles by construction)."""
    white = rng.standard_normal((size, size))
    fx = np.fft.fftfreq(size) * size
    f = np.sqrt(fx[None, :] ** 2 + fx[:, None] ** 2)
    f[0, 0] = 1.0
    band = np.exp(-((np.log(f) - np.log((lo + hi) / 2)) ** 2) / (2 * (np.log(hi / lo) / 2.5) ** 2))
    amp = band / f ** (power * 0.5)
    amp[0, 0] = 0
    out = np.real(np.fft.ifft2(np.fft.fft2(white) * amp))
    return (out - out.mean()) / (out.std() + 1e-9)


def voronoi(rng, size, cells, warp=None):
    """Periodic Voronoi: per-pixel F1, F2 (in pixels) and the id of the nearest site."""
    pts = rng.random((cells, 2)) * size
    tree = cKDTree(pts, boxsize=size)
    yy, xx = np.mgrid[0:size, 0:size].astype(np.float64)
    if warp is not None:
        xx = (xx + warp[0]) % size
        yy = (yy + warp[1]) % size
    d, i = tree.query(np.stack([xx.ravel(), yy.ravel()], 1), k=2, workers=-1)
    return d[:, 0].reshape(size, size), d[:, 1].reshape(size, size), i[:, 0].reshape(size, size)


def normal_from_height(h, strength):
    dx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) * 0.5
    dy = (np.roll(h, -1, 0) - np.roll(h, 1, 0)) * 0.5
    n = np.stack([-dx * strength, dy * strength, np.ones_like(h)], -1)  # image rows go down → +dy flips for GL
    n /= np.linalg.norm(n, axis=-1, keepdims=True)
    return n * 0.5 + 0.5


def srgb_encode(linear):
    c = np.clip(linear, 0, 1)
    return np.where(c <= 0.0031308, 12.92 * c, 1.055 * np.power(c, 1 / 2.4) - 0.055)


def srgb_decode(s):
    s = np.asarray(s, dtype=np.float64)
    return np.where(s <= 0.04045, s / 12.92, ((s + 0.055) / 1.055) ** 2.4)


def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def crackle(rng, size, cells, width, warp_amp):
    warp = (spectral_noise(rng, size, 3, 10) * warp_amp, spectral_noise(rng, size, 3, 10) * warp_amp)
    f1, f2, _ = voronoi(rng, size, cells, warp)
    edge = f2 - f1
    # Irregular line weight: some fissures fade out completely, like real crazing.
    fade = smoothstep(-0.4, 0.9, spectral_noise(rng, size, 2, 8))
    return (1 - smoothstep(0, width, edge)) * fade


def aggregate(rng, size, cells, prob, gap, palette, weights):
    """Angular chips: shrunken Voronoi cells, a random subset of them coloured from a palette."""
    warp = (spectral_noise(rng, size, 20, 60) * 1.5, spectral_noise(rng, size, 20, 60) * 1.5)
    f1, f2, ids = voronoi(rng, size, cells, warp)
    chosen = rng.random(cells) < prob
    colour_idx = rng.choice(len(palette), cells, p=weights)
    shade = 1 + rng.normal(0, 0.06, cells)
    inside = smoothstep(gap, gap + 1.2, f2 - f1) * chosen[ids]
    colours = srgb_decode(np.array(palette) / 255.0)[colour_idx] * shade[:, None]
    return inside, colours[ids], chosen[ids]


def terrazzo(rng):
    s = SIZE
    base = srgb_decode(np.array([229, 227, 222]) / 255.0)
    cloud = spectral_noise(rng, s, 1.5, 6)
    mottle = spectral_noise(rng, s, 12, 40)
    grain = spectral_noise(rng, s, 300, 900, power=0.2)
    albedo = np.ones((s, s, 3)) * base
    albedo *= (1 + 0.035 * cloud + 0.02 * mottle + 0.018 * grain)[..., None]
    # Cool/warm mineral variation, very small.
    albedo[..., 0] *= 1 + 0.008 * mottle
    albedo[..., 2] *= 1 - 0.006 * mottle + 0.006 * cloud

    big_pal = [(212, 211, 210), (190, 190, 192), (218, 212, 201), (160, 160, 164), (240, 238, 234)]
    m1, c1, _ = aggregate(rng, s, 36000, 0.09, 2.4, big_pal, [0.34, 0.2, 0.22, 0.06, 0.18])
    small_pal = [(128, 128, 132), (165, 165, 168), (96, 96, 100), (204, 198, 188)]
    m2, c2, _ = aggregate(rng, s, 140000, 0.07, 1.0, small_pal, [0.35, 0.3, 0.12, 0.23])
    albedo = albedo * (1 - m1[..., None]) + c1 * m1[..., None]
    albedo = albedo * (1 - m2[..., None]) + c2 * m2[..., None]

    cr = crackle(rng, s, 220, 1.8, 26)
    cr_fine = crackle(rng, s, 1100, 1.1, 7) * 0.75
    cracks = np.maximum(cr, cr_fine)
    albedo *= (1 - 0.16 * cracks)[..., None]
    pores = (spectral_noise(rng, s, 500, 1000, power=0) > 3.0).astype(np.float64)
    albedo *= (1 - 0.35 * pores)[..., None]

    rough = 0.16 + 0.03 * mottle + 0.04 * m1 + 0.02 * m2 + 0.16 * cracks + 0.25 * pores + 0.015 * grain
    height = 0.25 * grain + 0.35 * mottle * 0.3 - 1.4 * cracks - 2.0 * pores + 0.3 * m1 + 0.2 * m2
    return albedo, np.clip(rough, 0.08, 0.7), height, 1.3


def stucco(rng):
    s = SIZE
    base = srgb_decode(np.array([232, 230, 226]) / 255.0)
    cloud = spectral_noise(rng, s, 1.2, 4)
    trowel = spectral_noise(rng, s, 6, 24)
    grain = spectral_noise(rng, s, 250, 800, power=0.2)
    fine = spectral_noise(rng, s, 60, 200)
    albedo = np.ones((s, s, 3)) * base
    albedo *= (1 + 0.03 * cloud + 0.016 * trowel + 0.012 * grain + 0.01 * fine)[..., None]
    albedo[..., 2] *= 1 + 0.005 * cloud

    small_pal = [(170, 170, 172), (140, 140, 144), (205, 200, 192)]
    m, c, _ = aggregate(rng, s, 160000, 0.02, 0.9, small_pal, [0.45, 0.2, 0.35])
    albedo = albedo * (1 - 0.45 * m[..., None]) + c * 0.45 * m[..., None]
    cracks = np.maximum(crackle(rng, s, 160, 1.3, 28) * 0.8, crackle(rng, s, 800, 1.0, 8) * 0.5)
    albedo *= (1 - 0.08 * cracks)[..., None]

    rough = 0.58 + 0.06 * trowel + 0.04 * fine + 0.05 * cracks + 0.02 * grain
    height = 0.6 * grain + 0.5 * fine + 0.25 * trowel - 1.0 * cracks
    return albedo, np.clip(rough, 0.35, 0.85), height, 1.0


def save(out, name, albedo, rough, height, strength):
    os.makedirs(out, exist_ok=True)
    albedo = np.clip(albedo, 0, 0.86)  # real stone never reflects all light: keep whites below pure white
    a = (srgb_encode(albedo) * 255 + 0.5).astype(np.uint8)
    Image.fromarray(a).save(os.path.join(out, f"{name}_albedo.webp"), quality=88, method=6)
    # Roughness and normals at half resolution: their detail is sub-pixel at viewing distance.
    r = (np.clip(rough, 0, 1) * 255 + 0.5).astype(np.uint8)
    r = Image.fromarray(np.stack([r, r, r], -1)).resize((SIZE // 2, SIZE // 2), Image.LANCZOS)
    r.save(os.path.join(out, f"{name}_rough.webp"), quality=82, method=6)
    n = (normal_from_height(height, strength) * 255 + 0.5).astype(np.uint8)
    Image.fromarray(n).resize((SIZE // 2, SIZE // 2), Image.LANCZOS).save(
        os.path.join(out, f"{name}_normal.webp"), quality=85, method=6
    )
    print(name, "albedo linear mean", albedo.mean(0).mean(0), "max", albedo.max())


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--out", default=os.path.join(os.path.dirname(__file__), "../public/environment/textures"))
    args = p.parse_args()
    save(args.out, "terrazzo", *terrazzo(np.random.default_rng(1207)))
    save(args.out, "stucco", *stucco(np.random.default_rng(4403)))
