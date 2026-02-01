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

    # 3. 檢查 app.js 核心邏輯 (新增 autoFormatToggle 檢查)
    with open('src/app.js', 'r') as f:
        app = f.read()
        if 'autoFormatToggle' not in app or 'autoCopyToggle' not in app:
             print("❌ Error: app.js is missing workflow toggles!")
             return False
        if 'this.el.autoFormatToggle.checked' not in app:
             print("❌ Error: app.js is not checking toggle states!")
             return False

    # 4. 檢查 index.html
    with open('index.html', 'r') as f:
        html = f.read()
        if 'auto-format-toggle' not in html:
             print("❌ Error: index.html is missing checkboxes!")
             return False

    print(f"✅ Validation Passed: v{version} workflow is customizable.")
    return True

if __name__ == "__main__":
    if validate():
        sys.exit(0)
    else:
        sys.exit(1)
