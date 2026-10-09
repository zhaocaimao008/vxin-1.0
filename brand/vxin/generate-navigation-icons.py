#!/usr/bin/env python3
"""Export shared web navigation geometry to Android vectors and iOS templates."""
import importlib.util
import io
import json
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[2]
CHECK = '--check' in sys.argv
spec = importlib.util.spec_from_file_location('brand_renderer', ROOT / 'web/scripts/generate-brand-assets.py')
renderer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(renderer)
icons = json.loads((ROOT / 'brand/vxin/navigation-icons.json').read_text())
theme = json.loads((ROOT / 'brand/vxin/theme.json').read_text())
web = (ROOT / 'web/src/components/Icons.jsx').read_text()
drift = []

def emit(path, data):
    path = ROOT / path
    if isinstance(data, str):
        data = data.encode()
    if path.exists() and path.read_bytes() == data:
        return
    if CHECK:
        drift.append(str(path.relative_to(ROOT)))
    else:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)

kt = '''// Generated from brand/vxin/navigation-icons.json; geometry shared with web.
package com.vxin.app.ui

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.vector.PathParser
import androidx.compose.ui.unit.dp

object SharedIcons {
    private fun icon(name: String, vararg paths: String): ImageVector {
        val builder = ImageVector.Builder(name, 24.dp, 24.dp, 24f, 24f)
        for (data in paths) builder.addPath(pathData = PathParser().parsePathString(data).toNodes(), fill = null, stroke = SolidColor(Color.Black), strokeLineWidth = STROKEf, strokeLineCap = StrokeCap.Round, strokeLineJoin = StrokeJoin.Round)
        return builder.build()
    }
'''.replace('STROKE', str(theme['icon']['stroke']))
for name, entry in icons.items():
    # Prevent an unnoticed change to the web geometry leaving native assets stale.
    body = re.search(r'export const ' + entry['webName'] + r' = make\([^,]+, (.*)\);', web)[1]
    paths = re.findall(r'<path d="([^"]+)"', body)
    for cx, cy, radius in re.findall(r'<circle cx="([^"]+)" cy="([^"]+)" r="([^"]+)"', body):
        x, y, r = map(float, (cx, cy, radius))
        paths.insert(0, f'M{x-r:g} {y:g}a{r:g} {r:g} 0 1 0 {r*2:g} 0a{r:g} {r:g} 0 1 0 {-r*2:g} 0')
    if paths != entry['paths']:
        raise RuntimeError(f'{name}: web geometry changed; update navigation-icons.json')
    kt += f'    val {name}: ImageVector by lazy {{ icon("{name}", ' + ', '.join(json.dumps(p) for p in paths) + ') }\n'
    svg = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">'
           f'<g fill="none" stroke="#000" stroke-width="{theme["icon"]["stroke"]}" stroke-linecap="round" stroke-linejoin="round">'
           + ''.join(f'<path d="{p}"/>' for p in paths) + '</g></svg>')
    emit(f'brand/vxin/navigation/{name}.svg', svg + '\n')
    asset = f'ios/Vxin/Assets.xcassets/VxinIcon{name}.imageset'
    images = []
    for scale in (1, 2, 3):
        image = renderer.render(svg, 24 * scale)
        data = io.BytesIO()
        image.save(data, format='PNG')
        filename = f'icon@{scale}x.png'
        emit(f'{asset}/{filename}', data.getvalue())
        images.append(dict(idiom='universal', filename=filename, scale=f'{scale}x'))
    emit(f'{asset}/Contents.json', json.dumps(dict(images=images, info=dict(author='xcode', version=1), properties={'template-rendering-intent': 'template'}), indent=2) + '\n')
emit('android/app/src/main/java/com/vxin/app/ui/SharedIcons.kt', kt + '}\n')
if drift:
    raise SystemExit('Icon output drift: ' + ', '.join(drift))
print(f'{len(icons)} shared icons: Android paths and iOS 1x/2x/3x templates ' + ('verified' if CHECK else 'generated'))
