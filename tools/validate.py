import os
import re
import sys

def validate():
    print("🐈 Pippi Release Validator Starting...")
    
    # 1. 檢查 config.js
    version = ""
    with open('src/config.js', 'r') as f:
        config_content = f.read()
        match = re.search(r"VERSION = '(\d+\.\d+\.\d+)'", config_content)
        if not match:
            print("❌ Error: Could not find VERSION in src/config.js")
            return False
        version = match.group(1)
        print(f"Target Version: v{version}")

    # 2. 檢查 sw.js
    with open('sw.js', 'r') as f:
        sw = f.read()
        if f"v{version}" not in sw:
            print(f"❌ Error: sw.js is missing version comment v{version}.")
            return False

    # 3. 檢查 style.css 眼睛按鈕定位
    with open('src/style.css', 'r') as f:
        css = f.read()
        if 'position: absolute' not in css or 'top: 50%' not in css:
             print("❌ Error: style.css is missing password eye positioning logic!")
             return False

    print(f"✅ Validation Passed: v{version} is ready.")
    return True

if __name__ == "__main__":
    if validate():
        sys.exit(0)
    else:
        sys.exit(1)
