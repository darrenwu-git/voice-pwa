import os
import re
import sys

def validate():
    print("🐈 Pippi Release Validator Starting...")
    
    # 1. 取得 index.html 裡的版本號
    with open('index.html', 'r') as f:
        content = f.read()
        version_match = re.search(r'v(\d+\.\d+\.\d+)', content)
        if not version_match:
            print("❌ Error: Could not find version tag in index.html")
            return False
        current_version = version_match.group(1)
        print(f"Detected version: v{current_version}")

    # 2. 檢查 sw.js
    with open('sw.js', 'r') as f:
        content = f.read()
        if f"v{current_version}" not in content:
            print(f"❌ Error: sw.js CACHE_NAME mismatch. Expected v{current_version}")
            return False
        
        # 檢查 ASSETS 裡是否有帶版本號
        if f"?v={current_version}" not in content:
             print(f"⚠️ Warning: Some assets in sw.js might missing version suffix.")

    # 3. 檢查 app.js
    with open('src/app.js', 'r') as f:
        content = f.read()
        # 檢查是否有核心狀態機邏輯關鍵字
        if "fsm" not in content or "handleStateChange" not in content:
            print("❌ Error: app.js seems to be missing State Machine logic!")
            return False

    print("✅ All systems GO! Pippi is ready to push.")
    return True

if __name__ == "__main__":
    if validate():
        sys.exit(0)
    else:
        sys.exit(1)
