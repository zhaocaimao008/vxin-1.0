#!/usr/bin/env python3
"""
生成 before/after 截图的像素级 diff 高亮图。
用法: python3 diff-image.py before.png after.png out-diff.png
依赖: Pillow（pip install Pillow），仅本地调试用，非项目运行时依赖。
"""
import sys
from PIL import Image, ImageChops, ImageEnhance

if len(sys.argv) != 4:
    print('用法: python3 diff-image.py before.png after.png out-diff.png')
    sys.exit(1)

before_path, after_path, out_path = sys.argv[1:4]
im1 = Image.open(before_path).convert('RGB')
im2 = Image.open(after_path).convert('RGB')
if im1.size != im2.size:
    print(f'尺寸不一致: before={im1.size} after={im2.size}')
    sys.exit(1)

diff = ImageChops.difference(im1, im2)
w, h = im1.size
changed = sum(1 for px in diff.get_flattened_data() if px != (0, 0, 0)) if hasattr(diff, 'get_flattened_data') else sum(1 for px in diff.getdata() if px != (0, 0, 0))
pct = 100 * changed / (w * h)
print(f'{before_path} vs {after_path}: changed_px={changed}/{w*h} ({pct:.1f}%)')

enhanced = ImageEnhance.Brightness(diff).enhance(5)
enhanced.save(out_path)
print('saved', out_path)
