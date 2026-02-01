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

    # 2. 檢查 sw.js 是否包含硬編碼版本註解
    with open('sw.js', 'r') as f:
        sw = f.read()
        if f"v{version}" not in sw:
            print(f"❌ Error: sw.js is missing version comment v{version}.")
            return False

    # 3. 檢查 app.js 是否包含關鍵兩階段 Undo 邏輯
    with open('src/app.js', 'r') as f:
        app = f.read()
        if 'STT_PROCESSING' not in app or 'this.saveState(transcript)' not in app:
             print("❌ Error: app.js is missing Two-Stage Undo logic!")
             return False

    # 4. 檢查 test.html 是否已更新測試案例
    with open('test.html', 'r') as f:
        test = f.read()
        if "Two-Stage Undo Test" not in test:
             print("❌ Error: test.html is missing Two-Stage Undo scenario!")
             return False

    print(f"✅ Validation Passed: v{version} is logically sound.")
    return True

if __name__ == "__main__":
    if validate():
        sys.exit(0)
    else:
        sys.exit(1)
