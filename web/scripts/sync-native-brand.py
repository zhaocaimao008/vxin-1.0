#!/usr/bin/env python3
"""Sync native app icons and in-app brand marks from vxinMark.json.
Run after generate-brand-assets.py. Does not build, sign or publish native apps.
"""
import importlib.util
import json
from pathlib import Path
import xml.etree.ElementTree as ET
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('vxin_brand', Path(__file__).with_name('generate-brand-assets.py'))
brand = importlib.util.module_from_spec(spec)
spec.loader.exec_module(brand)
written = []

def png(variant, size, path, opaque=False):
    relative = str(path.relative_to(ROOT))
    brand.png(variant, size, relative, opaque=opaque)
    with Image.open(path) as im:
        assert im.size == (size, size)
        if opaque:
            assert im.mode == 'RGB'
    written.append(relative)

for platform in ('android', 'web/android'):
    res = ROOT / platform / 'app/src/main/res'
    if not res.is_dir():
        continue
    for density, size in [('mdpi',48),('hdpi',72),('xhdpi',96),('xxhdpi',144),('xxxhdpi',192)]:
        directory = res / ('mipmap-' + density)
        png('tile', size, directory / 'ic_launcher.png')
        png('tile', size, directory / 'ic_launcher_round.png')
        png('foreground', round(size*108/48), directory / 'ic_launcher_foreground.png')
    background = res / 'values/ic_launcher_background.xml'
    background.write_text(f'<?xml version="1.0" encoding="utf-8"?>\n<resources><color name="ic_launcher_background">{brand.C["ink"]}</color></resources>\n')
    ET.parse(background)
    written.append(str(background.relative_to(ROOT)))

# SwiftUI auth pages use the same generated mark; iOS masks app icons itself.
assets = ROOT / 'ios/Vxin/Assets.xcassets'
if assets.is_dir():
    for path in (assets / 'AppIcon.appiconset').glob('AppIcon-*.png'):
        png('square', int(path.stem.split('-')[1]), path, opaque=True)
    mark = assets / 'VxinBrandMark.imageset'
    mark.mkdir(exist_ok=True)
    png('tile', 512, mark / 'mark.png')
    (mark / 'Contents.json').write_text(json.dumps({'images':[{'filename':'mark.png','idiom':'universal'}], 'info':{'author':'xcode','version':1}}, indent=2)+'\n')
    source = ROOT / 'ios/Vxin/UI/Components/VxinLogoMark.swift'
    source.write_text('''import SwiftUI

/// Generated brand asset shares web/src/brand/vxinMark.json with Web and Android.
struct VxinLogoMark: View {
    var body: some View {
        Image("VxinBrandMark")
            .resizable()
            .scaledToFit()
            .accessibilityHidden(true)
    }
}
''')
    written.extend([str((mark/'Contents.json').relative_to(ROOT)), str(source.relative_to(ROOT))])

res = ROOT / 'android/app/src/main/res'
if res.is_dir():
    png('tile', 512, res / 'drawable-nodpi/vxin_brand_mark.png')
    source = ROOT / 'android/app/src/main/java/com/vxin/app/ui/components/VxinLogoMark.kt'
    source.write_text('''package com.vxin.app.ui.components

import androidx.compose.foundation.Image
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import com.vxin.app.R

/** Shares the generated brand geometry with Web and iOS. */
@Composable
fun VxinLogoMark(modifier: Modifier = Modifier) {
    Image(
        painter = painterResource(R.drawable.vxin_brand_mark),
        contentDescription = null,
        modifier = modifier,
        contentScale = ContentScale.Fit,
    )
}
''')
    written.append(str(source.relative_to(ROOT)))

print(json.dumps({'synced':len(written), 'source':'web/src/brand/vxinMark.json', 'native_packages_published':False, 'files':written}, ensure_ascii=False, indent=2))
