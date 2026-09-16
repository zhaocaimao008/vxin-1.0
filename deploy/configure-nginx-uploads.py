#!/usr/bin/env python3
"""Route only vxinchat.com uploads through existing backend authorization."""
import argparse
import os
from pathlib import Path
import re
import shutil
import subprocess
import time
import urllib.error
import urllib.request


def block_end(text, start):
    depth = 0
    tokens = re.finditer(r'''\#[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[{}]''', text[start:])
    for token in tokens:
        if token[0] == '{':
            depth += 1
        elif token[0] == '}':
            depth -= 1
            if depth == 0:
                return start + token.end()
    raise ValueError('Unbalanced Nginx block')


def updated_config(text):
    matches = []
    for server in re.finditer(r'(?m)^\s*server\s*\{', text):
        start = text.index('{', server.start())
        end = block_end(text, start)
        block = text[start:end]
        names = re.search(r'(?m)^\s*server_name\s+([^;]+);', block)
        if names and set(names[1].split()) == {'vxinchat.com', 'www.vxinchat.com'}:
            matches.append((start, end, block))
    if len(matches) != 1:
        raise ValueError('Expected exactly one dedicated vxinchat.com server')
    start, end, block = matches[0]
    locations = list(re.finditer(r'(?m)^[ \t]*location\s+(?:\^~\s+)?/uploads/\s*\{', block))
    if len(locations) != 1:
        raise ValueError('Expected exactly one uploads location')
    location = locations[0]
    location_end = block_end(block, block.index('{', location.start()))
    replacement = '''    location ^~ /uploads/ {
        proxy_pass http://127.0.0.1:3002;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache off;
        proxy_no_cache 1;
        proxy_cache_bypass 1;
        expires off;
        add_header Cache-Control "private, no-store" always;
    }'''
    return text[:start] + block[:location.start()] + replacement + block[location_end:] + text[end:]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('config', type=Path)
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    original = args.config.read_text()
    updated = updated_config(original)
    if not args.apply:
        print(updated)
        return
    backup = args.config.with_name(args.config.name + '.vxin-uploads-' + str(time.time_ns()) + '.bak')
    shutil.copy2(args.config, backup)
    try:
        temporary = args.config.with_suffix('.vxin-tmp')
        temporary.write_text(updated)
        shutil.copymode(args.config, temporary)
        os.replace(temporary, args.config)
        subprocess.run(['nginx', '-t'], check=True)
        subprocess.run(['systemctl', 'reload', 'nginx'], check=True)
        url = 'https://vxinchat.com/uploads/__release_auth_probe_' + str(time.time_ns())
        request = urllib.request.Request(url, headers={'Cache-Control': 'no-cache'})
        try:
            response = urllib.request.urlopen(request, timeout=20)
        except urllib.error.HTTPError as error:
            response = error
        with response:
            if response.status != 401 or 'no-store' not in response.headers.get('Cache-Control', ''):
                raise RuntimeError('Public anonymous media authorization check failed')
        print('Uploads authentication verified: anonymous 401, no-store; backup:', backup)
    except BaseException:
        shutil.copy2(backup, args.config)
        subprocess.run(['nginx', '-t'], check=True)
        subprocess.run(['systemctl', 'reload', 'nginx'], check=True)
        raise


if __name__ == '__main__':
    main()
