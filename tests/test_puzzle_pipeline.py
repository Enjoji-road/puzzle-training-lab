"""Regression coverage of authoring gates and reproducible draft generation."""
from copy import deepcopy
from pathlib import Path
import shutil
import sys
from tempfile import TemporaryDirectory
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))

from generate_puzzle import generate
from puzzle_identity import signature
from puzzles import check_batch, format_json, register
from verify import DATA, read_catalog
from verify_logic import Model
from verify_routes import adjacency, enumerate_routes, satisfies
from verify_symbols import Evidence


def registration_fixture():
    c1 = {"id": "c1", "text": "駅は列の端。", "test": ["in", ["at", "station"], 1, 3]}
    c2 = {"id": "c2", "text": "駅は井戸のすぐ右。", "test": ["eq", ["at", "station"], ["add", ["at", "well"], 1]]}
    return {
        "id": "logic-registration-fixture", "genre": "logic", "level": 2, "title": "三枚の立て札",
        "goal": "端の候補を絞る", "intro": "井戸、駅、池の札を左から順に確認する。",
        "skills": ["複数条件の統合"],
        "rules": ["左から1、2、3番。各場所に札を一枚ずつ置く。"],
        "board": {"tables": [{"id": "slots", "title": "札と位置", "options": ["1", "2", "3"], "distinct": True,
                              "rows": [{"key": "well", "label": "井戸"}, {"key": "station", "label": "駅"}, {"key": "pond", "label": "池"}]}]},
        "clues": [c1, c2], "solution": {"well": "2", "station": "3", "pond": "1"},
        "hints": [
            {"text": "駅を置ける端は二つ。", "clues": ["c1"]},
            {"text": "そのうち、左隣がある端を探す。", "clues": ["c1", "c2"]},
            {"text": "駅は3番。1番には左隣がない。", "clues": ["c1", "c2"], "facts": {"station": "3"}},
        ],
        "steps": [
            {"title": "駅の場所", "text": "駅が1番だと井戸をすぐ左に置けない。3番が残る。",
             "clues": ["c1", "c2"], "facts": {"station": "3"}},
            {"title": "井戸の場所", "text": "3番のすぐ左は2番。", "clues": ["c2"], "facts": {"well": "2"}},
            {"title": "池の場所", "text": "池に残ったのは1番。", "clues": ["c2"], "facts": {"pond": "1"}},
        ],
        "pitfall": "端には左端も右端もある。", "transfer": "端と隣を同じ列で確認する。",
        "review": {"levelReviewed": True, "explanationReviewed": True, "techniques": ["端と隣の統合"], "notes": "登録のテスト"},
    }


class PipelineTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.catalog = read_catalog()[1]

    def setUp(self):
        self.work = TemporaryDirectory()
        self.addCleanup(self.work.cleanup)
        self.root = Path(self.work.name)
        self.dist = self.root / "data"
        shutil.copytree(DATA, self.dist)
        self.source = self.root / "draft.json"

    def write(self, puzzle):
        self.source.write_text(format_json([puzzle]), encoding="utf-8")

    def test_invalid_deduction_and_unreviewed_candidate_do_not_touch_catalog(self):
        digest = (self.dist / "catalog.json").read_bytes()
        invalid = registration_fixture()
        invalid["hints"][2]["facts"] = {"station": "2"}
        self.write(invalid)
        with self.assertRaisesRegex(ValueError, "deduction"):
            register(self.source, "new.json", self.dist)
        self.assertEqual((self.dist / "catalog.json").read_bytes(), digest)
        self.assertFalse((self.dist / "new.json").exists())
        draft, _ = generate("route", 4, 34, catalog=self.catalog)
        self.write(draft)
        with self.assertRaises(ValueError):
            register(self.source, "new.json", self.dist)
        self.assertEqual((self.dist / "catalog.json").read_bytes(), digest)
        self.assertFalse((self.dist / "new.json").exists())

    def test_check_is_read_only_and_register_preserves_the_original_batches(self):
        versions = {p.name: p.read_bytes() for p in self.dist.glob("*.json")}
        self.write(registration_fixture())
        self.assertEqual(check_batch(self.source, self.dist)[0]["solutions"], 1)
        self.assertEqual({p.name: p.read_bytes() for p in self.dist.glob("*.json")}, versions)
        register(self.source, "new.json", self.dist)
        manifest, loaded = read_catalog(self.dist)
        self.assertEqual(manifest["files"][-1], "new.json")
        self.assertEqual(len(loaded), len(self.catalog) + 1)
        self.assertEqual(loaded[:-1], self.catalog)
        for name, contents in versions.items():
            if name != "catalog.json":
                self.assertEqual((self.dist / name).read_bytes(), contents)
        with self.assertRaises(ValueError):
            register(self.source, "new.json", self.dist)
        self.assertFalse((self.dist / ".catalog.lock").exists())

    def test_same_problem_with_changed_title_and_id_is_rejected(self):
        copy = deepcopy(self.catalog[0])
        copy.update(id="route-renamed", title="別名の一本道",
                    review={"levelReviewed": True, "explanationReviewed": True,
                            "techniques": ["道"], "notes": "比較テスト"})
        self.write(copy)
        with self.assertRaisesRegex(ValueError, "盤面と条件が重複"):
            check_batch(self.source, self.dist)

    def test_symbol_aliases_and_swapped_addends_have_same_signature(self):
        original = next(p for p in self.catalog if p["id"] == "symbol-2")
        alias = deepcopy(original)
        swaps = str.maketrans("abc", "cba")
        alias["board"]["tables"][0]["rows"].reverse()
        for clue in alias["clues"]:
            constraint = clue["constraint"]
            if constraint["type"] == "equation":
                left, right, result = (constraint[key].translate(swaps) for key in ("left", "right", "result"))
                constraint.update(left=right, right=left, result=result)
        self.assertEqual(signature(original), signature(alias))

    def test_draft_generators_for_three_genres_at_both_levels(self):
        for genre in ("route", "logic", "symbol"):
            for level in (4, 5):
                with self.subTest(genre=genre, level=level):
                    draft, rounds = generate(genre, level, 34, catalog=self.catalog)
                    self.assertEqual(draft["level"], level)
                    self.assertEqual(rounds[-1], 1)
                    self.assertTrue(all(a > b for a, b in zip(rounds, rounds[1:])))
                    self.assertFalse(draft["review"]["levelReviewed"])
                    self.assertNotIn(signature(draft), {signature(p) for p in self.catalog})
                    board, clues = draft["board"], draft["clues"]
                    if genre == "route":
                        neighbors = adjacency(board)
                        routes = [p for p in enumerate_routes(draft)
                                  if all(satisfies(p, c, neighbors) for c in board["constraints"])]
                        self.assertEqual(len(routes), 1)
                        solved = {key: "W" if key in routes[0] else "B" for key in draft["solution"]}
                    if genre == "logic":
                        model = Model(board["tables"])
                        worlds = model.matching([c["test"] for c in clues])
                        self.assertEqual(len(worlds), 1)
                        solved = model.decoded(worlds[0])
                    if genre == "symbol":
                        ev = Evidence(draft)
                        worlds = ev.satisfying(list(ev.bits))
                        self.assertEqual(len(worlds), 1)
                        solved = dict(zip(ev.keys, map(str, worlds[0])))
                    self.assertEqual(solved, draft["solution"])


if __name__ == "__main__":
    unittest.main()

