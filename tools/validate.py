import os
import re
import sys

def validate():
    print("🐈 Pippi Safety Inspector Starting...")
    
    # 1. 檢查 config.js (唯一信源)
    version = ""
    with open('src/config.js', 'r') as f:
        config_content = f.read()
        match = re.search(r"VERSION = '(\d+\.\d+\.\d+)'", config_content)
        if not match:
            print("❌ Error: Could not find VERSION in src/config.js")
            return False
        version = match.group(1)
        print(f"Target Version: v{version}")

    # 2. 檢查 sw.js 是否有同步引用與註解
    with open('sw.js', 'r') as f:
        sw = f.read()
        if f"v{version}" not in sw:
            print(f"❌ Error: sw.js is missing version comment v{version}!")
            return False

    # 3. 檢查 app.js 核心邏輯
    with open('src/app.js', 'r') as f:
        app = f.read()
        if 'undoStack' not in app or 'redoStack' not in app:
             print("❌ Error: app.js is missing Undo/Redo stack!")
             return False
        if 'hardResetBtn' not in app:
             print("❌ Error: app.js is missing Hard Reset button logic!")
             return False

    print(f"✅ Validation Passed: v{version} is architecturally sound.")
    return True

if __name__ == "__main__":
    if validate():
        sys.exit(0)
    else:
        sys.exit(1)
