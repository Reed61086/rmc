import datetime as dt
import importlib.util
import pathlib
import unittest

spec = importlib.util.spec_from_file_location('updater', pathlib.Path(__file__).resolve().parents[1] / 'scripts/update-cmt.py')
updater = importlib.util.module_from_spec(spec)
spec.loader.exec_module(updater)

class WeeklyFeedTest(unittest.TestCase):
    def test_latest_complete_pair(self):
        text = 'observation_date,WGS1YR,WGS10YR\n2026-09-18,4.1,4.6\n2026-09-25,4.15,4.78\n'
        self.assertEqual(updater.parse_csv(text, dt.date(2026, 10, 3)), dict(date='2026-09-25', oneYear=4.15, tenYear=4.78))

    def test_unsafe_sources_fail(self):
        for rows in ['2026-09-25,.,4.78', '2026-09-25,NaN,4.78', '2026-10-09,4.15,4.78', '2026-09-18,4.15,4.78', '2026-09-25,4.15,4.78\n2026-09-25,4.2,4.78']:
            with self.subTest(rows=rows), self.assertRaises(ValueError):
                updater.parse_csv('observation_date,WGS1YR,WGS10YR\n' + rows, dt.date(2026, 10, 3))

if __name__ == '__main__':
    unittest.main()
