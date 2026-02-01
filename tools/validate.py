import os
import re
import sys

def validate():
    print("🐈 Pippi Safety Inspector Starting...")
    
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

    # 2. 檢查 sw.js 是否包含硬編碼版本註解 (確保 Byte 變更)
    with open('sw.js', 'r') as f:
        sw = f.read()
        if f"v{version}" not in sw:
            print(f"❌ Error: sw.js is missing version comment v{version}. It won't update!")
            return False

    # 3. 檢查 app.js 核心邏輯
    with open('src/app.js', 'r') as f:
        app = f.read()
        if 'cancelBtn' not in app or 'this.ai.abort()' not in app:
             print("❌ Error: app.js is missing v1.3.6 'cancel' logic!")
             return False

    print(f"✅ Validation Passed: v{version} is architecturally sound and will trigger update.")
    return True

if __name__ == "__main__":
    if validate():
        sys.exit(0)
    else:
        sys.exit(1)
