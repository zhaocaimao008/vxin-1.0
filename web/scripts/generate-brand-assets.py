#!/usr/bin/env python3
"""
v信 品牌资源生成脚本（可重复执行）。

唯一几何源：web/src/brand/vxinMark.json（BrandMark.jsx 也读同一文件）。
渲染：系统自带 librsvg + cairo（ctypes 调用，无需 pip 安装），ICO / 预览图用 Pillow。

    python3 web/scripts/generate-brand-assets.py          # 在仓库根目录执行

输出（全部覆盖写入）：
  brand/vxin/svg/       logo.svg logo-256.svg logo-light.svg icon-square.svg icon-mark.svg icon-maskable.svg
  brand/vxin/icons/     icon-{16..1024}.png legacy-*.png mark-fg-*.png icon-square-1024.png maskable-512.png apple-touch-icon.png
  brand/vxin/preview/   brand-preview.png
  brand/vxin/windows/splash.html   desktop-electron/assets/splash.html（Electron 启动窗口）
  web/public/           favicon.svg favicon.png favicon.ico icon.png icon-192.png icon-512.png
                        icons/icon-192.png icons/icon-512.png icons/maskable-192.png icons/maskable-512.png icons/apple-touch-icon.png
  web/build/icons/      {16..512}x{..}.png icon.png icon.ico（web/ 的 electron-builder 图标源）
  desktop-electron/assets/  icon.png icon-1024.png icon.ico（desktop-electron 打包与托盘图标源）
  web/index.html        <!-- brand:splash --> 标记之间的首屏启动标志
"""
import ctypes
import io
import json
import os
import re
import sys

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
GEOM = json.load(open(os.path.join(ROOT, 'web/src/brand/vxinMark.json'), encoding='utf-8'))
C = GEOM['colors']
VB = GEOM['viewBox']


# ── SVG 组装 ──────────────────────────────────────────────────────────────
def glyph(bubble_fill, v_stroke, scale=1.0):
    """白色对话气泡 + 墨绿 V（V 压在气泡上，形成「V 字镂空」的一体图形）。"""
    b = GEOM['bubble']
    v = GEOM['v']
    inner = (
        f'<rect x="{b["x"]}" y="{b["y"]}" width="{b["width"]}" height="{b["height"]}" rx="{b["radius"]}" fill="{bubble_fill}"/>'
        f'<path d="{b["tail"]}" fill="{bubble_fill}" stroke="{bubble_fill}" stroke-width="1.2" stroke-linejoin="round"/>'
        f'<polyline points="{v["points"]}" fill="none" stroke="{v_stroke}" stroke-width="{v["strokeWidth"]}" '
        f'stroke-linecap="round" stroke-linejoin="round"/>'
    )
    if scale == 1.0:
        return inner
    c = VB / 2
    return f'<g transform="translate({c} {c}) scale({scale}) translate({-c} {-c})">{inner}</g>'


def svg_doc(body, size=None, title='v信'):
    dim = f' width="{size}" height="{size}"' if size else ''
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {VB} {VB}"{dim} role="img" aria-label="{title}">'
            f'<title>{title}</title>{body}</svg>\n')


def tile(fill):
    return f'<rect width="{VB}" height="{VB}" rx="{GEOM["tile"]["radius"]}" fill="{fill}"/>'


def square(fill):
    return f'<rect width="{VB}" height="{VB}" fill="{fill}"/>'


VARIANTS = {
    # 圆角墨绿方块：favicon、Web 内品牌、桌面/Windows 图标
    'tile': tile(C['ink']) + glyph(C['paper'], C['ink']),
    # 浅色底版本（用于深色背景或印刷）：白方块 + 墨绿气泡 + 白 V
    'light': tile(C['paper']) + glyph(C['ink'], C['paper']),
    # 满版方形：iOS / apple-touch（系统自行切圆角，不可透明）
    'square': square(C['ink']) + glyph(C['paper'], C['ink']),
    # PWA maskable：满版 + 图形缩进到 80% 安全圆内
    'maskable': square(C['ink']) + glyph(C['paper'], C['ink'], GEOM['maskableScale']),
    # Android 自适应图标前景：透明底，图形缩进到 66/108 安全区，背景层用 ink 纯色
    'foreground': glyph(C['paper'], C['ink'], GEOM['foregroundScale']),
}


# ── librsvg 渲染 ──────────────────────────────────────────────────────────
class RsvgRect(ctypes.Structure):
    _fields_ = [('x', ctypes.c_double), ('y', ctypes.c_double),
                ('width', ctypes.c_double), ('height', ctypes.c_double)]


_rsvg = ctypes.CDLL('librsvg-2.so.2')
_cairo = ctypes.CDLL('libcairo.so.2')
_rsvg.rsvg_handle_new_from_data.restype = ctypes.c_void_p
_rsvg.rsvg_handle_new_from_data.argtypes = [ctypes.c_char_p, ctypes.c_size_t, ctypes.c_void_p]
_rsvg.rsvg_handle_render_document.argtypes = [ctypes.c_void_p, ctypes.c_void_p, ctypes.POINTER(RsvgRect), ctypes.c_void_p]
_cairo.cairo_image_surface_create.restype = ctypes.c_void_p
_cairo.cairo_create.restype = ctypes.c_void_p
_cairo.cairo_create.argtypes = [ctypes.c_void_p]
_cairo.cairo_image_surface_get_data.restype = ctypes.POINTER(ctypes.c_ubyte)
_cairo.cairo_image_surface_get_data.argtypes = [ctypes.c_void_p]
_cairo.cairo_image_surface_get_stride.argtypes = [ctypes.c_void_p]
_cairo.cairo_surface_flush.argtypes = [ctypes.c_void_p]
_cairo.cairo_destroy.argtypes = [ctypes.c_void_p]
_cairo.cairo_surface_destroy.argtypes = [ctypes.c_void_p]
_gobj = ctypes.CDLL('libgobject-2.0.so.0')
_gobj.g_object_unref.argtypes = [ctypes.c_void_p]


def render(svg, size):
    data = svg.encode('utf-8')
    h = _rsvg.rsvg_handle_new_from_data(data, len(data), None)
    if not h:
        raise RuntimeError('librsvg 无法解析 SVG')
    surf = _cairo.cairo_image_surface_create(0, size, size)  # CAIRO_FORMAT_ARGB32
    cr = _cairo.cairo_create(surf)
    if not _rsvg.rsvg_handle_render_document(h, cr, ctypes.byref(RsvgRect(0, 0, size, size)), None):
        raise RuntimeError('librsvg 渲染失败')
    _cairo.cairo_surface_flush(surf)
    stride = _cairo.cairo_image_surface_get_stride(surf)
    buf = ctypes.string_at(_cairo.cairo_image_surface_get_data(surf), stride * size)
    # cairo ARGB32（小端 BGRA，预乘 alpha）→ Pillow RGBA
    im = Image.frombuffer('RGBa', (size, size), buf, 'raw', 'BGRa', stride, 1).convert('RGBA')
    _cairo.cairo_destroy(cr)
    _cairo.cairo_surface_destroy(surf)
    _gobj.g_object_unref(h)
    return im


# ── 写文件 ────────────────────────────────────────────────────────────────
written = []


def out(rel):
    p = os.path.join(ROOT, rel)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    written.append(rel)
    return p


def write_text(rel, text):
    with open(out(rel), 'w', encoding='utf-8') as f:
        f.write(text)


def png(variant, size, rel, opaque=False):
    im = render(svg_doc(VARIANTS[variant]), size)
    if opaque:
        im = im.convert('RGB')
    im.save(out(rel), optimize=True)
    return im


def ico(rel, sizes):
    imgs = [render(svg_doc(VARIANTS['tile']), s) for s in sizes]
    big = imgs[-1]
    big.save(out(rel), format='ICO', sizes=[(s, s) for s in sizes], append_images=imgs[:-1])


def main():
    # 1) brand/vxin/svg —— 矢量主资源
    write_text('brand/vxin/svg/logo.svg', svg_doc(VARIANTS['tile'], 512))
    write_text('brand/vxin/svg/logo-256.svg', svg_doc(VARIANTS['tile'], 256))
    write_text('brand/vxin/svg/logo-light.svg', svg_doc(VARIANTS['light'], 512))
    write_text('brand/vxin/svg/icon-square.svg', svg_doc(VARIANTS['square'], 1024))
    write_text('brand/vxin/svg/icon-maskable.svg', svg_doc(VARIANTS['maskable'], 1024))
    write_text('brand/vxin/svg/icon-mark.svg', svg_doc(VARIANTS['foreground'], 1024))

    # 2) brand/vxin/icons —— 位图主资源
    for s in (16, 32, 48, 64, 72, 96, 128, 144, 152, 192, 256, 384, 512, 1024):
        png('tile', s, f'brand/vxin/icons/icon-{s}.png')
    for name, s in (('mdpi', 48), ('hdpi', 72), ('xhdpi', 96), ('xxhdpi', 144), ('xxxhdpi', 192)):
        png('tile', s, f'brand/vxin/icons/legacy-{name}.png')
        png('foreground', round(s * 108 / 48), f'brand/vxin/icons/mark-fg-{name}.png')
    png('square', 1024, 'brand/vxin/icons/icon-square-1024.png', opaque=True)
    png('maskable', 512, 'brand/vxin/icons/maskable-512.png', opaque=True)
    png('square', 180, 'brand/vxin/icons/apple-touch-icon.png', opaque=True)

    # 3) web/public —— 浏览器标签、PWA、通知、web/electron 窗口图标
    write_text('web/public/favicon.svg', svg_doc(VARIANTS['tile']))
    png('tile', 64, 'web/public/favicon.png')
    ico('web/public/favicon.ico', [16, 32, 48])
    png('tile', 512, 'web/public/icon.png')
    png('tile', 192, 'web/public/icon-192.png')
    png('tile', 512, 'web/public/icon-512.png')
    png('tile', 192, 'web/public/icons/icon-192.png')
    png('tile', 512, 'web/public/icons/icon-512.png')
    png('maskable', 192, 'web/public/icons/maskable-192.png', opaque=True)
    png('maskable', 512, 'web/public/icons/maskable-512.png', opaque=True)
    png('square', 180, 'web/public/icons/apple-touch-icon.png', opaque=True)

    # 4) Electron 图标源（web/ 与 desktop-electron/ 两套打包配置）
    for s in (16, 24, 32, 48, 64, 128, 256, 512):
        png('tile', s, f'web/build/icons/{s}x{s}.png')
    png('tile', 512, 'web/build/icons/icon.png')
    ico('web/build/icons/icon.ico', [16, 24, 32, 48, 64, 128, 256])
    png('tile', 512, 'desktop-electron/assets/icon.png')
    png('tile', 1024, 'desktop-electron/assets/icon-1024.png')
    ico('desktop-electron/assets/icon.ico', [16, 24, 32, 48, 64, 128, 256])

    # 5) 启动画面：Electron splash.html + web/index.html 首屏
    splash = SPLASH_HTML.replace('__MARK__', svg_doc(VARIANTS['tile']).strip())
    write_text('brand/vxin/windows/splash.html', splash)
    write_text('desktop-electron/assets/splash.html', splash)
    patch_index_html()

    # 6) 预览图
    preview()

    print('\n'.join(written))


def patch_index_html():
    rel = 'web/index.html'
    p = os.path.join(ROOT, rel)
    src = open(p, encoding='utf-8').read()
    mark = svg_doc(VARIANTS['tile']).strip().replace(' role="img" aria-label="v信"><title>v信</title>', ' aria-hidden="true">')
    new, n = re.subn(r'(<!-- brand:splash:start -->).*?(<!-- brand:splash:end -->)',
                     lambda m: m.group(1) + mark + m.group(2), src, flags=re.S)
    if n != 1:
        sys.exit('web/index.html 缺少 <!-- brand:splash:start/end --> 标记')
    if new != src:
        open(p, 'w', encoding='utf-8').write(new)
        written.append(rel)


def preview():
    W, H = 1360, 640
    im = Image.new('RGB', (W, H), C['canvas'])
    d = ImageDraw.Draw(im)
    d.rectangle([W // 2, 0, W, H], fill='#111412')
    font = None
    for f in ('/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',
              '/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc',
              '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'):
        if os.path.exists(f):
            font = ImageFont.truetype(f, 18)
            break
    font = font or ImageFont.load_default()
    for half, (bg, fg) in enumerate(((C['canvas'], '#1C211E'), ('#111412', '#ECEFEC'))):
        x0 = half * W // 2 + 40
        d.text((x0, 24), 'v信 品牌标志 · ' + ('浅色背景' if half == 0 else '深色背景'), fill=fg, font=font)
        big = render(svg_doc(VARIANTS['tile']), 220)
        im.paste(big, (x0, 70), big)
        x = x0 + 246
        for s in (128, 64, 48, 32, 24, 16):
            r = render(svg_doc(VARIANTS['tile']), s)
            im.paste(r, (x, 70 + 220 - s), r)
            d.text((x, 300), str(s), fill=fg, font=font)
            x += s + 12
        y = 380
        labels = (('maskable', 'maskable 512'), ('square', 'apple-touch'), ('foreground', 'Android 前景'), ('light', '浅色版'))
        x = x0
        for v, label in labels:
            r = render(svg_doc(VARIANTS[v]), 150)
            if v == 'foreground':
                box = Image.new('RGBA', (150, 150), C['ink'])
                box.alpha_composite(r)
                r = box
            im.paste(r, (x, y), r)
            d.text((x, y + 160), label, fill=fg, font=font)
            x += 160
    im.save(out('brand/vxin/preview/brand-preview.png'), optimize=True)


SPLASH_HTML = '''<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>v信</title>
<!-- 由 web/scripts/generate-brand-assets.py 生成，勿手改；标志几何源 web/src/brand/vxinMark.json -->
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { height: 100%; }
  body {
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 18px;
    background: #F5F6F2; color: #1C211E; overflow: hidden;
    font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', 'Segoe UI', sans-serif;
  }
  .mark { width: 96px; height: 96px; filter: drop-shadow(0 10px 24px rgba(23,107,82,.22)); animation: rise .5s ease-out both; }
  .mark svg { width: 100%; height: 100%; display: block; }
  .name { font-size: 22px; font-weight: 600; letter-spacing: 1px; animation: fade .5s ease-out .15s both; }
  .bar { width: 72px; height: 3px; border-radius: 3px; background: rgba(23,107,82,.14); overflow: hidden; animation: fade .5s ease-out .25s both; }
  .bar::after { content: ''; display: block; width: 40%; height: 100%; border-radius: 3px; background: #176B52; animation: slide 1.1s ease-in-out infinite; }
  @media (prefers-color-scheme: dark) {
    body { background: #111412; color: #ECEFEC; }
    .bar { background: rgba(46,149,115,.22); }
    .bar::after { background: #2E9573; }
  }
  @keyframes rise { from { opacity: 0; transform: scale(.88); } to { opacity: 1; transform: none; } }
  @keyframes fade { from { opacity: 0; } to { opacity: 1; } }
  @keyframes slide { from { transform: translateX(-100%); } to { transform: translateX(250%); } }
  @media (prefers-reduced-motion: reduce) { .mark, .name, .bar, .bar::after { animation: none; } }
</style>
</head>
<body>
  <div class="mark">__MARK__</div>
  <div class="name">v信</div>
  <div class="bar" role="progressbar" aria-label="正在启动"></div>
</body>
</html>
'''

if __name__ == '__main__':
    main()
