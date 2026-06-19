"""
批量替换 index.css 和 ChatWindow.css 中的硬编码颜色值 (v2 - 更安全)
"""
import re

def replace_in_file(filepath, replacements, skip_patterns=None):
    """Replace multiple patterns in a file, skipping lines matching skip_patterns."""
    with open(filepath, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    new_lines = []
    changed_lines = []
    
    for lineno, line in enumerate(lines, 1):
        original = line
        should_skip = False
        if skip_patterns:
            for pat in skip_patterns:
                if re.search(pat, line):
                    should_skip = True
                    break
        
        if not should_skip:
            for old, new in replacements:
                if old in line:
                    line = line.replace(old, new)
        
        if line != original:
            changed_lines.append(lineno)
        new_lines.append(line)
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.writelines(new_lines)
    
    return changed_lines


def replace_fff_safe(filepath):
    """
    Replace #fff with var(--bg-msg-other) only in CSS property value positions.
    Skip #fff inside gradient/function calls like linear-gradient(...).
    """
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original = content
    
    # Match #fff that appears as a CSS property value:
    # After : and optional space, or after , and space (in multi-value props)
    # But NOT inside rgb/rgba/hsl/gradient functions
    #
    # Strategy: match #fff that is NOT inside parentheses (function args)
    # Use a simple approach: replace #fff in simple contexts
    
    # Pattern 1: color: #fff;
    content = re.sub(r'(color:\s*)#fff(\s*[;!}])', r'\1var(--bg-msg-other)\2', content)
    # Pattern 2: background: #fff;
    content = re.sub(r'(background:\s*)#fff(\s*[;!}])', r'\1var(--bg-msg-other)\2', content)
    # Pattern 3: fill: #fff;
    content = re.sub(r'(fill:\s*)#fff(\s*[;!}])', r'\1var(--bg-msg-other)\2', content)
    # Pattern 4: border: ... #fff ...;
    content = re.sub(r'(border[^:]*:\s*[^;]*?)#fff(\s*[;!}])', r'\1var(--bg-msg-other)\2', content)
    # Pattern 5: background: #fff (without ; at end, e.g. before } or !important)
    content = re.sub(r'(?<![-\w])#fff(?=\s*[!;}])', 'var(--bg-msg-other)', content)
    
    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        # Count changes
        orig_count = original.count('#fff')
        new_count = content.count('#fff')
        changed = orig_count - new_count
        return changed
    return 0


# ====== Task 1 & 2: index.css ======
index_css = '/root/v信/web/src/index.css'

idx_skip = [
    r'^\s*--green:\s*#07C160',
    r'^\s*--green-bubble:\s*#07C160',
    r'^\s*--bg-msg-mine:\s*#07C160',
]

print("=" * 60)
print("1. index.css: #07C160 -> var(--green)")
changed = replace_in_file(index_css, [('#07C160', 'var(--green)')], skip_patterns=idx_skip)
print(f"   替换 {len(changed)} 行: lines {changed}")

print("\n2. index.css: rgba(7,193,96,...) -> rgba(var(--green-rgb),...)")
changed = replace_in_file(index_css, [('rgba(7,193,96,', 'rgba(var(--green-rgb),')])
print(f"   替换 {len(changed)} 行: lines {changed}")

print("\n3. index.css: #FA5151 -> var(--color-badge)")
changed = replace_in_file(index_css, [('#FA5151', 'var(--color-badge)')])
print(f"   替换 {len(changed)} 行: lines {changed}")

# Also handle rgba(250,81,81,...) in index.css - keep as-is per task spec (no #FA5151-rgb var)


# ====== ChatWindow.css ======
chat_css = '/root/v信/web/src/components/ChatWindow.css'

print("\n" + "=" * 60)
print("ChatWindow.css: #07C160 -> var(--green)")
changed = replace_in_file(chat_css, [('#07C160', 'var(--green)')])
print(f"   替换 {len(changed)} 行: lines {changed}")

print("\nChatWindow.css: rgba(7,193,96,...) -> rgba(var(--green-rgb),...)")
changed = replace_in_file(chat_css, [('rgba(7,193,96,', 'rgba(var(--green-rgb),')])
print(f"   替换 {len(changed)} 行: lines {changed}")

print("\nChatWindow.css: #FA5151 -> var(--color-badge)")
changed = replace_in_file(chat_css, [('#FA5151', 'var(--color-badge)')])
print(f"   替换 {len(changed)} 行: lines {changed}")

# Task 3: ChatWindow.css design token migration
print("\n" + "=" * 60)
print("Task 3: ChatWindow.css 设计 Token 迁移")

# Order matters: replace more specific hex first to avoid partial matches
task3_simple = [
    ('#B2B2B2', 'var(--text-tertiary)'),
    ('#E5E5E5', 'var(--border-color)'),
    ('#F5F5F5', 'var(--bg-panel)'),
    ('#888', 'var(--text-tertiary)'),
    ('#333', 'var(--text-primary)'),
    ('#999', 'var(--text-tertiary)'),
]

for old, new in task3_simple:
    changed = replace_in_file(chat_css, [(old, new)])
    print(f"  {old} -> {new}: {len(changed)} lines {changed}")

print("\n  #fff -> var(--bg-msg-other) (安全替换)")
changed_count = replace_fff_safe(chat_css)
print(f"  替换 {changed_count} 处 #fff")

print("\n" + "=" * 60)
print("全部替换完成!")
