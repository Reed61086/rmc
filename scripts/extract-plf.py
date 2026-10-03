"""Run with xlrd 2.0.2 installed; extracts the official workbook without fitting.
Usage: python scripts/extract-plf.py path/to/hud-plf.xls
"""
import hashlib
import json
import sys
from pathlib import Path
import xlrd

source = Path(sys.argv[1])
sheet = xlrd.open_workbook(str(source)).sheet_by_name('General Table - 62 to 99')
cells = {}
for index in range(2, sheet.nrows):
    row = sheet.row_values(index)
    if not isinstance(row[0], float):
        continue
    age = int(row[0])
    for column in range(1, 17, 2):
        rate, factor = row[column:column + 2]
        if not isinstance(rate, float) or not isinstance(factor, float):
            raise ValueError('Missing numerical cell')
        key = (age, int(round(rate * 8)))
        if key in cells:
            raise ValueError('Duplicate table cell')
        cells[key] = factor
assert len(cells) == 38 * 128
assert cells[(79, 54)] == 0.444
payload = {
    'version': 'HUD-2017-10-02',
    'source': 'https://www.hud.gov/sites/dfiles/SFH/documents/FY%202018%20PLF%20Tables-Rvsd%20Introduction.xls',
    'sha256': hashlib.sha256(source.read_bytes()).hexdigest(),
    'sheet': sheet.name,
    'minAge': 62, 'maxAge': 99, 'minEighth': 24, 'maxEighth': 151,
    'rows': [[cells[(age, rate)] for rate in range(24, 152)] for age in range(62, 100)]
}
output = Path(__file__).resolve().parents[1] / 'data' / 'hud-plf.js'
output.parent.mkdir(exist_ok=True)
output.write_text('/* Generated from HUD; regenerate with scripts/extract-plf.py. */\n'
                  '(function(root){const data=' + json.dumps(payload, separators=(',', ':')) +
                  ';if(typeof module==="object"&&module.exports)module.exports=data;else root.HudPlfData=data;})(globalThis);\n', encoding='utf-8')
print('Extracted', len(cells), 'cells; SHA256', payload['sha256'])
