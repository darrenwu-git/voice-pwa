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

    # 2. 檢查 index.html 是否有同步引用
    with open('index.html', 'r') as f:
        html = f.read()
        if 'src/config.js' not in html:
            print("❌ Error: index.html is not importing src/config.js!")
            return False

    # 3. 檢查 sw.js 是否有同步引用
    with open('sw.js', 'r') as f:
        sw = f.read()
        if 'src/config.js' not in sw:
            print("❌ Error: sw.js is not importing src/config.js!")
            return False

    # 4. 檢查 app.js 核心邏輯
    with open('src/app.js', 'r') as f:
        app = f.read()
        # 核心檢查點：檢查更新按鈕是否被綁定
        if 'checkUpdateBtn.onclick' not in app:
            print("❌ Error: checkUpdateBtn.onclick is MISSING in app.js!")
            return False
        # 核心檢查點：自動整理邏輯
        if 'triggerAIFormat()' not in app:
            print("❌ Error: triggerAIFormat() call is MISSING in app.js!")
            return False

    print(f"✅ Validation Passed: v{version} is architecturally sound.")
    return True

if __name__ == "__main__":
    if validate():
        sys.exit(0)
    else:
        sys.exit(1)
