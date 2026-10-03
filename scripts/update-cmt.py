"""Refresh a complete weekly H.15 pair. Keep the previous asset on failure."""
import csv
import datetime as dt
import io
import json
import pathlib
import urllib.request

URL = 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=WGS1YR,WGS10YR'

def parse_csv(text, today):
    pairs = {}
    for row in csv.DictReader(io.StringIO(text)):
        date = row.get('observation_date', row.get('DATE', ''))
        try:
            day = dt.date.fromisoformat(date)
            one, ten = float(row['WGS1YR']), float(row['WGS10YR'])
        except (ValueError, KeyError):
            continue
        if day > today or day.weekday() != 4 or not (0 < one <= 20 and 0 < ten <= 20):
            continue
        if date in pairs and pairs[date] != (one, ten):
            raise ValueError('Conflicting weekly observations')
        pairs[date] = (one, ten)
    if not pairs:
        raise ValueError('No complete weekly observations')
    date = max(pairs)
    if (today - dt.date.fromisoformat(date)).days > 10:
        raise ValueError('Weekly source is stale')
    return dict(date=date, oneYear=pairs[date][0], tenYear=pairs[date][1])

def main():
    now = dt.datetime.now(dt.timezone.utc)
    with urllib.request.urlopen(URL, timeout=30) as response:
        observation = parse_csv(response.read().decode('utf-8-sig'), now.date())
    destination = pathlib.Path(__file__).resolve().parents[1] / 'data/cmt-weekly.json'
    if destination.exists():
        old = json.loads(destination.read_text())
        if observation['date'] < old['date'] or (observation['date'] == old['date'] and any(observation[k] != old[k] for k in ('oneYear', 'tenYear'))):
            raise ValueError('Regressed or revised source requires review')
    observation.update(checkedAt=now.isoformat(), source=URL, series=['WGS1YR', 'WGS10YR'], frequency='weekly', provider='Federal Reserve H.15 via FRED')
    temporary = destination.with_suffix('.tmp')
    temporary.write_text(json.dumps(observation, indent=2) + '\n', encoding='utf-8')
    temporary.replace(destination)
    print('Verified weekly CMT:', observation['date'], observation['oneYear'], observation['tenYear'])

if __name__ == '__main__':
    main()
