"""Contención del servidor local; no sirve archivos de la aplicación."""
from pathlib import Path
import sys
import unittest

LAB=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(LAB/"validators"))
from preview import contained_path


class PreviewServerTests(unittest.TestCase):
    def test_root_opens_only_local_web_preview(self):
        self.assertEqual(contained_path("/"),LAB/"web/index.html")

    def test_local_asset_allowed(self):
        self.assertEqual(contained_path("/output/build/mini_jev.riv?ignored=true"),LAB/"output/build/mini_jev.riv")

    def test_parent_traversal_rejected(self):
        for path in ("/../package.json","/%2e%2e/package.json","/..%5cpackage.json"):
            with self.subTest(path=path):
                with self.assertRaises(ValueError):contained_path(path)

    def test_absolute_windows_path_rejected(self):
        with self.assertRaises(ValueError):contained_path("/C:%5cUsers%5cabdai%5cDesktop%5cTracker%5cjevBot%5cpackage.json")


if __name__ == "__main__":unittest.main()
