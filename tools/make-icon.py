"""生成 VidForge 应用图标（build/icon.ico + build/icon.png）。

不依赖第三方库：手写 PNG 编码（zlib）+ ICO 容器，4x 超采样抗锯齿。
图形：圆角方块渐变底 + 白色播放三角。
"""
import os
import struct
import zlib


def lerp(a, b, t):
    return a + (b - a) * t


def render(size):
    """返回 size*size 的 RGBA bytes，坐标系归一化到 [0,1]。"""
    S = size
    buf = bytearray(S * S * 4)
    c1 = (0x5B, 0x8C, 0xFF)   # 左上 蓝
    c2 = (0x3B, 0x4E, 0xD8)   # 右下 深蓝紫
    r = 0.225                  # 圆角半径（归一化）
    # 播放三角（归一化坐标）
    tri = ((0.375, 0.285), (0.375, 0.715), (0.715, 0.500))

    def tri_inside(x, y):
        (x1, y1), (x2, y2), (x3, y3) = tri
        d1 = (x - x2) * (y1 - y2) - (x1 - x2) * (y - y2)
        d2 = (x - x3) * (y2 - y3) - (x2 - x3) * (y - y3)
        d3 = (x - x1) * (y3 - y1) - (x3 - x1) * (y - y1)
        neg = d1 < 0 or d2 < 0 or d3 < 0
        pos = d1 > 0 or d2 > 0 or d3 > 0
        return not (neg and pos)

    for py in range(S):
        y = (py + 0.5) / S
        for px in range(S):
            x = (px + 0.5) / S
            # 圆角矩形内部判定
            cx = min(max(x, r), 1 - r)
            cy = min(max(y, r), 1 - r)
            dx, dy = x - cx, y - cy
            inside = (dx * dx + dy * dy) <= r * r or (r <= x <= 1 - r) or (r <= y <= 1 - r)
            if not inside:
                continue
            t = (x + y) / 2
            rr = int(lerp(c1[0], c2[0], t))
            gg = int(lerp(c1[1], c2[1], t))
            bb = int(lerp(c1[2], c2[2], t))
            if tri_inside(x, y):
                rr, gg, bb = 255, 255, 255
            i = (py * S + px) * 4
            buf[i] = rr
            buf[i + 1] = gg
            buf[i + 2] = bb
            buf[i + 3] = 255
    return bytes(buf)


def downsample(raw, size, factor):
    """factor x factor 盒式降采样，得到 size*size RGBA。"""
    out = bytearray(size * size * 4)
    src = size * factor
    n = factor * factor
    for py in range(size):
        for px in range(size):
            r = g = b = a = 0
            for sy in range(factor):
                base = ((py * factor + sy) * src + px * factor) * 4
                for sx in range(factor):
                    i = base + sx * 4
                    r += raw[i]
                    g += raw[i + 1]
                    b += raw[i + 2]
                    a += raw[i + 3]
            o = (py * size + px) * 4
            out[o] = r // n
            out[o + 1] = g // n
            out[o + 2] = b // n
            out[o + 3] = a // n
    return bytes(out)


def png_bytes(size, rgba):
    def chunk(tag, data):
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)
    rows = b"".join(b"\x00" + rgba[y * size * 4 : (y + 1) * size * 4] for y in range(size))
    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", ihdr)
        + chunk(b"IDAT", zlib.compress(rows, 9))
        + chunk(b"IEND", b"")
    )


def main():
    out_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "build")
    os.makedirs(out_dir, exist_ok=True)

    sizes = [256, 128, 64, 48, 32, 16]
    images = []
    for s in sizes:
        raw = render(s * 4)
        images.append((s, png_bytes(s, downsample(raw, s, 4))))
        print(f"rendered {s}x{s}")

    # ICO：所有尺寸内嵌 PNG（Vista+ 支持）
    count = len(images)
    header = struct.pack("<HHH", 0, 1, count)
    offset = 6 + 16 * count
    entries, blobs = b"", b""
    for s, data in images:
        w = 0 if s >= 256 else s
        entries += struct.pack("<BBBBHHII", w, w, 0, 0, 1, 32, len(data), offset)
        blobs += data
        offset += len(data)

    ico_path = os.path.join(out_dir, "icon.ico")
    with open(ico_path, "wb") as f:
        f.write(header + entries + blobs)
    with open(os.path.join(out_dir, "icon.png"), "wb") as f:
        f.write(dict(images)[256])
    print("wrote", ico_path, os.path.getsize(ico_path), "bytes")


if __name__ == "__main__":
    main()
