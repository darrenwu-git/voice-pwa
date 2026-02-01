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

    # 3. 檢查 app.js 密碼切換邏輯
    with open('src/app.js', 'r') as f:
        app = f.read()
        if 'togglePassword' not in app or 'setAttribute(\'type\', type)' not in app:
             print("❌ Error: app.js is missing password toggle logic!")
             return False

    # 4. 檢查 index.html 是否有按鈕
    with open('index.html', 'r') as f:
        html = f.read()
        if 'toggle-btn' not in html:
             print("❌ Error: index.html is missing toggle-password button!")
             return False

    print(f"✅ Validation Passed: v{version} is polished and ready.")
    return True

if __name__ == "__main__":
    if validate():
        sys.exit(0)
    else:
        sys.exit(1)
