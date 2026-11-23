"""Enumerate each matching table and verify clues, narrated deductions and trial branches."""
import argparse
import itertools
import json
from pathlib import Path


class Model:
    """A complete state is the tuple of 1-based option indices for all table rows."""

    def __init__(self, tables):
        self.tables = {}
        self.rows = {}
        choices = []
        for table in tables:
            table_id = table["id"]
            assert table_id not in self.tables and table["distinct"]
            size = len(table["options"])
            assert len(set(table["options"])) == size == len(table["rows"]) and size > 0
            start = len(self.rows)
            self.tables[table_id] = (start, start + size)
            for row in table["rows"]:
                assert row["key"] not in self.rows
                self.rows[row["key"]] = (len(self.rows), table["options"])
            choices.append(itertools.permutations(range(1, size + 1)))
        self.worlds = [tuple(itertools.chain.from_iterable(parts)) for parts in itertools.product(*choices)]

    def fact(self, key, value):
        _, labels = self.rows[key]
        return ["eq", ["at", key], labels.index(value) + 1]

    def ev(self, expr, state):
        if isinstance(expr, int):
            return expr
        operator, *args = expr
        if operator == "at":
            return state[self.rows[args[0]][0]]
        if operator in ("row", "inv", "changed"):
            start, stop = self.tables[args[0]]
            if operator == "changed":
                assert len(args[1]) == stop - start
                return sum(a != b for a, b in zip(state[start:stop], args[1]))
            index = self.ev(args[1], state)
            assert 1 <= index <= stop - start
            if operator == "row":
                return state[start + index - 1]
            return state[start:stop].index(index) + 1
        values = [self.ev(element, state) for element in args]
        x = values[0]
        if operator == "in":
            return x in values[1:]
        assert len(values) == 2
        y = values[1]
        if operator == "eq":
            return x == y
        if operator == "ne":
            return x != y
        if operator == "lt":
            return x < y
        if operator == "add":
            return x + y
        if operator == "distance":
            return abs(x - y)
        if operator == "and":
            return x and y
        if operator == "or":
            return x or y
        raise ValueError(f"Unknown constraint: {operator!r}")

    def matching(self, conditions):
        return [world for world in self.worlds if all(self.ev(condition, world) for condition in conditions)]

    def decoded(self, state):
        return {key: options[state[index] - 1] for key, (index, options) in self.rows.items()}


def verify_record(puzzle):
    model = Model(puzzle["board"]["tables"])
    clues = {item["id"]: item["test"] for item in puzzle["clues"]}
    assert len(clues) == len(puzzle["clues"])
    solutions = model.matching(list(clues.values()))
    assert len(solutions) == 1, f"solution count {len(solutions)}"
    assert model.decoded(solutions[0]) == puzzle["solution"], "published board and rule solution differ"

    # Dropping an entire clue must admit at least one extra answer in this authored set.
    removal_counts = {}
    for missing in clues:
        reduced = [expr for key, expr in clues.items() if key != missing]
        remaining = len(model.matching(reduced))
        if puzzle["id"] in {f"logic-{i}" for i in range(1, 6)}:
            assert remaining > 1, f"redundant clue {missing}"
        removal_counts[missing] = remaining

    checked = 0
    branches = 0
    assert len(puzzle["hints"]) == 3 and puzzle["pitfall"] and puzzle["transfer"]
    for stage in ("hints", "steps"):
        previous = []
        stated_values = {}
        for number, item in enumerate(puzzle[stage], 1):
            context = f"{stage} {number}"
            assert item["text"] and item["clues"], context
            assert all(clue_id in clues for clue_id in item["clues"]), context
            # A hint must stand by itself; proof steps may reuse only proved statements.
            cited = [clues[key] for key in item["clues"]]
            premise = previous + cited
            worlds = model.matching(premise)
            assert worlds, f"{context}: prior facts or cited conditions conflict"
            claims = list(item.get("checks", []))
            for key, value in item.get("facts", {}).items():
                claims.append(model.fact(key, value))
                stated_values[key] = value
            for claim in claims:
                counterexample = next((world for world in worlds if not model.ev(claim, world)), None)
                assert counterexample is None, f"{context}: invalid deduction {claim}: {model.decoded(counterexample)}"
                checked += 1
            # Branch reasoning uses only the named clues and already established facts.
            # A false trial may temporarily entail statements that contradict the final board.
            for case in item.get("cases", []):
                assert set(case["using"]) <= set(item["clues"]), context
                trials = model.matching(previous + [clues[key] for key in case["using"]] + [case["if"]])
                if case.get("impossible"):
                    assert not trials, f"{context}: supposedly contradictory trial still has a model"
                else:
                    assert trials, f"{context}: trial explanation has no witness"
                    for claim in case["holds"]:
                        assert all(model.ev(claim, world) for world in trials), f"{context}: faulty trial claim"
                        checked += 1
                branches += 1
            if stage == "steps":
                assert claims, f"{context}: no verifiable new conclusion"
                previous += claims
        if stage == "steps":
            assert stated_values == puzzle["solution"], "explanation does not reach every editable cell"

    return {"id": puzzle["id"], "candidates": len(model.worlds), "solutions": len(solutions),
            "claims": checked, "branches": branches, "without_one_clue": removal_counts}


def verify_file(path):
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    results = []
    for puzzle in data:
        try:
            results.append(verify_record(puzzle))
        except (AssertionError, KeyError, ValueError) as error:
            raise AssertionError(f'{puzzle.get("id", "?")}: {error}') from error
    assert [puzzle["level"] for puzzle in data] == list(range(1, 6))
    return results


def default_data():
    here = Path(__file__).resolve().parent
    for path in (here / "logic.json", here.parent / "dist" / "data" / "logic.json", here.parent / "data" / "logic.json"):
        if path.is_file():
            return path
    raise FileNotFoundError("pass the path to logic.json")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("data", nargs="?", type=Path)
    parser.add_argument("--json", action="store_true", help="print a structured report")
    args = parser.parse_args()
    report = verify_file(args.data or default_data())
    if args.json:
        print(json.dumps(report, ensure_ascii=False, indent=2))
    else:
        for entry in report:
            print(f'{entry["id"]}: {entry["candidates"]} arrangements, {entry["solutions"]} solution, '
                  f'{entry["claims"]} deductions and {entry["branches"]} branch checks passed. '
                  f'Clue omissions: {list(entry["without_one_clue"].values())}')
