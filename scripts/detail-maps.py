# Builds one detail texture per character from the RenderPeople 8K maps:
# R,G = tangent-space normal (x, y), B = cavity (1 = open, darker in creases), A unused.
import sys, numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter
Image.MAX_IMAGE_PIXELS = None

def load(path, size):
    im = Image.open(path).convert('RGB')
    if im.size[0] != size: im = im.reduce(im.size[0] // size) if im.size[0] % size == 0 else im.resize((size, size), Image.LANCZOS)
    return np.asarray(im).astype(np.float32) / 255.0

def divergence(nx, ny, s, green_up):
    bx, by = gaussian_filter(nx, s), gaussian_filter(ny, s)
    dx = np.gradient(bx, axis=1); dy = np.gradient(by, axis=0)
    return dx - dy if green_up else dx + dy  # d/dv = -d/drow when green points up the image

def build(norm_path, dif_path, out_path, size=2048, green_up=None, k=None, report=True):
    n = load(norm_path, size); d = load(dif_path, size)
    nx, ny = n[..., 0] * 2 - 1, n[..., 1] * 2 - 1
    L = d @ np.array([0.299, 0.587, 0.114], np.float32)
    shade = np.log(np.maximum(L, 0.02)) - np.log(np.maximum(gaussian_filter(L, 10), 0.02))  # scan shading, high-passed
    best = None
    for gu in ([True, False] if green_up is None else [green_up]):
        div = sum(divergence(nx, ny, s, gu) * s for s in (3, 7, 14)) / 3
        c = np.corrcoef(-div.ravel()[::7], shade.ravel()[::7])[0, 1]
        if report: print(out_path.split('/')[-1], 'green_up' if gu else 'green_down', 'corr(cavity, -shade)', round(-c, 3))
        if best is None or -c > best[0]: best = (-c, gu, div)
    _, gu, div = best
    occ = np.maximum(0, -div)
    kk = k if k else 0.55 / max(np.percentile(occ, 97), 1e-6)
    cav = 1 - np.clip(occ * kk, 0, 0.85)
    rgb = np.stack([n[..., 0], n[..., 1], cav], -1)
    Image.fromarray((rgb * 255 + 0.5).astype(np.uint8)).save(out_path, quality=88, method=6)
    return gu

if __name__ == '__main__':
    build(*sys.argv[1:4], size=int(sys.argv[4]) if len(sys.argv) > 4 else 2048)
