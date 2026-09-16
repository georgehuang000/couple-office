"""Subset downloaded OFL fonts; uses an existing non-base Conda environment.

Run with py312/python.exe. No packages are installed by this script.
Source downloads and exact upstream links are documented in design-assets/README.md.
"""
import base64
import pathlib
import re
import shutil
from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = pathlib.Path(__file__).resolve().parents[1]
SOURCE = ROOT / ".build" / "fonts"
OUT = ROOT / "miniprogram" / "styles"
OUT.mkdir(parents=True, exist_ok=True)
text = "".join(p.read_text(encoding="utf-8") for p in (ROOT / "miniprogram").rglob("*") if p.suffix in (".wxml", ".ts") and "miniprogram_npm" not in p.parts)
charset = "".join(sorted(set(re.findall(r"[\u3000-\u9fff\uff00-\uffef]", text)))) + "".join(chr(i) for i in range(32, 127)) + "♡♥·～。『』「」—…“”‘’"
headings = "两人事务所待办事项待处理申请和你一起把日子过成喜欢的样谢谢出现在我的生活里工作台今天明未来添加心愿我们的重要时刻相册悄话8260123456789天"
rules = []
for filename, family, chars, license_name in [
    ("LXGWWenKai-Regular.ttf", "JournalHand", charset, "LXGWWenKai-OFL.txt"),
    ("MaShanZheng-Regular.ttf", "JournalTitle", headings, "MaShanZheng-OFL.txt"),
]:
    font = TTFont(SOURCE / filename)
    options = subset.Options()
    options.name_IDs = [0, 1, 2, 3, 4, 5, 6, 13, 14]
    options.name_legacy = True
    subsetter = subset.Subsetter(options=options)
    subsetter.populate(text=chars)
    subsetter.subset(font)
    for rec in font["name"].names:
        if rec.nameID in (1, 3, 4, 6):
            rec.string = family.encode(rec.getEncoding())
    font.flavor = "woff"
    target = SOURCE / (family + ".woff")
    font.save(target)
    data = base64.b64encode(target.read_bytes()).decode("ascii")
    rules.append(f'@font-face{{font-family:"{family}";src:url("data:font/woff;base64,{data}") format("woff");font-style:normal;font-weight:400;font-display:swap;}}')
    licenses = ROOT / "miniprogram" / "assets" / "licenses"
    licenses.mkdir(parents=True, exist_ok=True)
    shutil.copy2(SOURCE / license_name, licenses / license_name)
    print(f"{family}: {target.stat().st_size / 1024:.1f} KiB, {len(set(chars))} characters")
(OUT / "journal-fonts.wxss").write_text("/* Generated OFL font subsets; see scripts/prepare-journal-fonts.py. */\n" + "\n".join(rules) + "\n", encoding="utf-8")
