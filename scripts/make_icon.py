import math
import struct
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parent
OUT = ROOT.parent / 'apps' / 'desktop' / 'electron'


def make(size=256):
    s = size / 256.0
    px = [[(0, 0, 0, 0) for _ in range(size)] for _ in range(size)]

    def blend(x, y, color, alpha=255):
        if not (0 <= x < size and 0 <= y < size) or alpha <= 0:
            return
        r, g, b, a = color
        if alpha >= 255:
            px[y][x] = (r, g, b, 255)
            return
        old = px[y][x]
        oa = old[3] / 255.0
        na = alpha / 255.0
        out_a = na + oa * (1 - na)
        if out_a <= 0:
            return
        px[y][x] = (
            int((r * na + old[0] * oa * (1 - na)) / out_a),
            int((g * na + old[1] * oa * (1 - na)) / out_a),
            int((b * na + old[2] * oa * (1 - na)) / out_a),
            int(out_a * 255),
        )

    def rounded(x0, y0, x1, y1, radius, color):
        x0, y0, x1, y1 = [int(v * s) for v in (x0, y0, x1, y1)]
        r = radius * s
        for y in range(max(0, y0), min(size, y1 + 1)):
            for x in range(max(0, x0), min(size, x1 + 1)):
                cx = min(max(x, x0 + r), x1 - r)
                cy = min(max(y, y0 + r), y1 - r)
                if (x - cx) ** 2 + (y - cy) ** 2 <= r * r:
                    blend(x, y, color)

    def ellipse(cx, cy, rx, ry, color):
        cx, cy, rx, ry = cx * s, cy * s, rx * s, ry * s
        for y in range(max(0, int(cy - ry)), min(size, int(cy + ry) + 1)):
            for x in range(max(0, int(cx - rx)), min(size, int(cx + rx) + 1)):
                if ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1:
                    blend(x, y, color)

    def segment(x0, y0, x1, y1, width, color):
        x0, y0, x1, y1 = x0 * s, y0 * s, x1 * s, y1 * s
        w = width * s
        steps = int(max(abs(x1 - x0), abs(y1 - y0)) * 2) + 1
        for i in range(steps + 1):
            t = i / steps
            cx, cy = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t
            for oy in range(int(-w), int(w) + 1):
                for ox in range(int(-w), int(w) + 1):
                    if ox * ox + oy * oy <= w * w:
                        blend(int(cx + ox), int(cy + oy), color)

    # 封面：蓝色渐变圆角矩形
    for y in range(size):
        for x in range(size):
            nx, ny = x / s, y / s
            if 52 <= nx <= 214 and 14 <= ny <= 242:
                cx = min(max(nx, 70), 196)
                cy = min(max(ny, 32), 224)
                if (nx - cx) ** 2 + (ny - cy) ** 2 <= 18 ** 2:
                    t = (nx - 52) / 162 * 0.5 + (ny - 14) / 228 * 0.5
                    r = int(10 + (94 - 10) * t)
                    g = int(132 + (92 - 132) * t)
                    b = int(255 + (230 - 255) * t)
                    blend(x, y, (r, g, b, 255))

    # 装订脊与金属线圈
    rounded(52, 14, 76, 242, 12, (6, 40, 110, 210))
    for cy in (52, 92, 132, 172, 212):
        ellipse(66, cy, 10, 6, (236, 244, 255, 255))
        ellipse(66, cy, 5, 3, (16, 52, 130, 255))

    # 清单横线
    for y in (70, 102, 134):
        rounded(100, y, 196, y + 9, 4, (255, 255, 255, 228))
    # 勾选框与对勾
    rounded(96, 168, 124, 196, 6, (255, 255, 255, 245))
    segment(101, 182, 108, 189, int(3.2), (12, 140, 90, 255))
    segment(108, 189, 121, 173, int(3.2), (12, 140, 90, 255))
    rounded(134, 174, 196, 183, 4, (255, 255, 255, 190))
    rounded(134, 188, 176, 197, 4, (255, 255, 255, 140))

    raw = b''.join(b'\x00' + b''.join(bytes(px[y][x]) for x in range(size)) for y in range(size))

    def chunk(tag, data):
        return struct.pack('>I', len(data)) + tag + data + struct.pack('>I', zlib.crc32(tag + data) & 0xffffffff)

    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b'')


png = make(256)
(OUT / 'icon.png').write_bytes(png)
(OUT / 'tray.png').write_bytes(make(32))

# ICO 容器：单张 256x256 PNG 条目
header = struct.pack('<HHH', 0, 1, 1)
entry = struct.pack('<BBBBHHII', 0, 0, 0, 0, 1, 32, len(png), 6 + 16)
(OUT / 'icon.ico').write_bytes(header + entry + png)
print('ICON_OK', len(png))
