#!/usr/bin/env python3
"""Exhaustively verify playable cryptarithms and cited, sequential deductions.

Run `python3 scripts/verify_symbols.py dist/data/symbols.json`. Append --json
for machine-readable counts. The search uses every injective digit assignment,
the published number words, and their operators. The stored answer and proof
never generate or prune the solution search.
"""
from __future__ import annotations

import argparse
import json
import re
from collections.abc import Callable, Iterable
from itertools import permutations
from pathlib import Path


def require(ok: bool, message: str) -> None:
    if not ok:
        raise ValueError(message)


def coefficients(terms: Iterable[tuple[int, str]], keys: list[str]) -> tuple[int, list[tuple[int, int]]]:
    """Encode decimal words as a linear expression, including fixed digits."""
    weights = [0] * len(keys)
    constant = 0
    for sign, word in terms:
        require(bool(re.fullmatch("[a-z0-9]+", word)), f"Invalid word {word}")
        for place, token in enumerate(reversed(word)):
            power = sign * 10**place
            if token.isdigit():
                constant += power * int(token)
            else:
                require(token in keys, f"Unknown symbol {token}")
                weights[keys.index(token)] += power
    return constant, [(i, w) for i, w in enumerate(weights) if w]


def parse_clue(clue: dict, keys: list[str], glyphs: dict, digits: list[str]):
    spec = clue["constraint"]
    kind = spec["type"]
    if kind == "domain":
        require(spec["digits"] == digits, "Input candidate digits differ from the clue")
        digit_text = "0〜9" if digits == list("0123456789") else "・".join(digits)
        require(clue["text"] == f"使える数字は{digit_text}です。", "Displayed digit domain differs")
        return (lambda _: True), set()

    def display(word):
        return "".join(glyphs.get(token, token) for token in word)

    left, right = spec["left"], spec["right"]
    if kind == "equation":
        symbol = spec["op"]
        require(symbol in {"+", "-"}, f"Unknown operation {symbol}")
        terms = [(1, left), (1 if symbol == "+" else -1, right), (-1, spec["result"])]
        sign = "＋" if symbol == "+" else "−"
        expected_line = f"{display(left)} {sign} {display(right)} ＝ {display(spec['result'])}"
    elif kind == "less":
        terms = [(1, left), (-1, right)]
        expected_line = f"{display(left)} は {display(right)} より小さい。"
    else:
        raise ValueError(f"Unknown constraint {kind}")
    require(clue["text"] == expected_line, f"Rendered clue differs from its constraint: {clue['id']}")
    constant, weights = coefficients(terms, keys)
    leads = {word[0] for _, word in terms if len(word) > 1 and word[0] in glyphs}
    require(all(len(word) == 1 or word[0] != "0" for _, word in terms), "Fixed leading zero")

    def accepts(values):
        value = constant + sum(weight * values[index] for index, weight in weights)
        return value == 0 if kind == "equation" else value < 0

    return accepts, leads


class Evidence:
    """Finite, executable interpretation of the board and its written terms."""

    def __init__(self, puzzle: dict):
        board = puzzle["board"]
        require(len(board["tables"]) == 1, "Cryptarithms need one digit table")
        table = board["tables"][0]
        self.keys = [row["key"] for row in table["rows"]]
        require(len(self.keys) == len(set(self.keys)), "Duplicate table row keys")
        self.indices = {key: i for i, key in enumerate(self.keys)}
        glyphs = board["symbols"]
        require(set(glyphs) == set(self.keys), "Symbol labels differ from table keys")
        require(len(set(glyphs.values())) == len(glyphs), "Duplicate symbol glyphs")
        require(all(row["label"].startswith(glyphs[row["key"]]) for row in table["rows"]),
                "A table label does not show its equation glyph")
        digits = table["options"]
        require(len(set(digits)) == len(digits) and all(v in list("0123456789") for v in digits),
                "Candidate columns must be distinct single digits")
        require(len(digits) >= len(self.keys), "Too few candidate digits")
        self.digits = set(digits)
        clues = puzzle["clues"]
        self.bits = {c["id"]: 1 << i for i, c in enumerate(clues)}
        require(len(self.bits) == len(clues), "Duplicate clue IDs")
        require(sum(c["constraint"]["type"] == "domain" for c in clues) == 1, "Missing/extra digit domain")
        require(board["equations"] == [c["text"] for c in clues if c["constraint"]["type"] == "equation"],
                "Board equations disagree with clue order or wording")
        require(any("先頭" in rule or "すべて1桁" in rule for rule in puzzle["rules"]),
                "Leading-zero rule missing from player text")

        tests = []
        lead_indices = set()
        for c in clues:
            accepts, leads = parse_clue(c, self.keys, glyphs, digits)
            tests.append((self.bits[c["id"]], accepts))
            lead_indices.update(self.indices[x] for x in leads)
        self.models = []
        for values in permutations(map(int, digits), len(self.keys)):
            if any(values[i] == 0 for i in lead_indices):
                continue
            mask = sum(bit for bit, accepts in tests if accepts(values))
            self.models.append((values, mask))

    def mask_for(self, clues: list[str]) -> int:
        require(len(set(clues)) == len(clues) and set(clues) <= self.bits.keys(), f"Invalid clue references {clues}")
        return sum(self.bits[c] for c in clues)

    def filter_facts(self, facts: dict) -> Callable:
        require(facts.keys() <= self.indices.keys() and all(value in self.digits for value in facts.values()),
                f"Invalid symbol or digit in assertion {facts}")
        indexed = [(self.indices[key], int(val)) for key, val in facts.items()]
        return lambda model: all(model[i] == v for i, v in indexed)

    def satisfying(self, clues: list[str], given: dict | None = None) -> list[tuple]:
        mask = self.mask_for(clues)
        filtered = [model for model, matches in self.models if matches & mask == mask]
        return list(filter(self.filter_facts(given), filtered)) if given else filtered

    def check_claim(self, claim: dict, stage: dict, models: list[tuple], prior: dict) -> None:
        if "reject" in claim:
            assumed = claim["reject"]
            require(not (assumed.keys() & prior.keys()), "A hypothesis overwrote an established fact")
            before, by = claim["before"], claim["by"]
            require(by not in before and set([*before, by]) <= set(stage["clues"]),
                    "A rejected case uses an uncited constraint")
            branch = prior | assumed
            require(bool(self.satisfying(before, branch)), f"Hypothesis {assumed} was already impossible")
            require(not self.satisfying([*before, by], branch), f"Hypothesis {assumed} survives {by}")
        elif "keys" in claim:
            projection = [self.indices[key] for key in claim["keys"]]
            reached = {"".join(str(m[i]) for i in projection) for m in models}
            require(reached == set(claim["possible"]), f"Incorrect projected cases: {sorted(reached)}")
        elif "terms" in claim:
            indexed = [(self.indices[k], c) for k, c in claim["terms"].items()]
            for m in models:
                value = sum(coef * m[i] for i, coef in indexed)
                if "modulo" in claim:
                    value %= claim["modulo"]
                if "atLeast" in claim:
                    require(value >= claim["atLeast"], f"False lower bound: {claim}")
                else:
                    require(value == claim["equals"], f"False arithmetic assertion: {claim}")
        else:
            raise ValueError(f"Unknown assertion {claim}")

    def verify_stage(self, stage: dict, prior: dict) -> None:
        refs = stage["clues"]
        require(bool(refs), "Hint/step without a clue reference")
        require(bool(stage["text"].strip()), "Hint/step without a reason")
        # A displayed deduction may use its cited clues plus previously proved
        # facts. It cannot assume an answer, a later step or a rejected branch.
        models = self.satisfying(refs, prior)
        require(bool(models), "No viable prior state; a deduction would be vacuous")
        require(all(map(self.filter_facts(stage.get("facts", {})), models)),
                f"Facts are not forced by the cited clues: {stage.get('facts')}")
        for claim in stage.get("claims", []):
            self.check_claim(claim, stage, models, prior)


def verify(puzzle: dict) -> dict:
    ev = Evidence(puzzle)
    all_ids = list(ev.bits)
    answers = ev.satisfying(all_ids)
    require(len(answers) == 1, f"Expected one solution, got {len(answers)}")
    computed = {key: str(answers[0][i]) for key, i in ev.indices.items()}
    require(computed == puzzle["solution"], "Exhaustive solution differs from the playable answer")

    require(len(puzzle["hints"]) == 3, "Exactly three hints are required")
    for i, h in enumerate(puzzle["hints"]):
        ev.verify_stage(h, {})
        if i == 2:
            require(0 < len(h.get("facts", {})) < len(computed), "Hint 3 should prove one partial move")
    require(len(puzzle["steps"]) >= 3, "Too few explanation steps")
    prior = {}
    for s in puzzle["steps"]:
        require(bool(s["title"]), "Untitled explanation step")
        ev.verify_stage(s, prior)
        for key, value in s.get("facts", {}).items():
            require(key not in prior or prior[key] == value, "Conflicting proof steps")
            prior[key] = value
    require(prior == computed, "The explanation does not account for the whole solution")
    require(puzzle["pitfall"] and puzzle["transfer"], "Missing typical mistake or reusable tactic")

    # The five launch puzzles were authored with an essentiality check. Future
    # teaching problems may legitimately include a redundant, reinforcing clue.
    omissions = {}
    launch_problem = puzzle["id"] in {f"symbol-{n}" for n in range(1, 6)}
    for clue in puzzle["clues"]:
        if clue["constraint"]["type"] == "domain":
            continue
        omitted = clue["id"]
        count = len(ev.satisfying([c for c in all_ids if c != omitted]))
        if launch_problem:
            require(count > 1, f"Constraint {omitted} is redundant")
        omissions[omitted] = count
    return {"id": puzzle["id"], "assignments": len(ev.models), "solutions": len(answers),
            "hints": len(puzzle["hints"]), "steps": len(puzzle["steps"]),
            "solution_counts_with_clue_removed": omissions}


def locate_data() -> Path:
    parent = Path(__file__).resolve().parent
    for candidate in (parent / "symbols.json", parent.parent / "dist/data/symbols.json",
                      parent.parent / "data/symbols.json"):
        if candidate.is_file():
            return candidate
    raise FileNotFoundError("Pass the path to the puzzle JSON file")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path, nargs="?")
    parser.add_argument("--json", action="store_true", help="Print validation counts as JSON")
    args = parser.parse_args()
    raw = json.loads((args.source or locate_data()).read_text(encoding="utf-8"))
    puzzles = [p for p in raw if p.get("genre") == "symbol"]
    required = {f"symbol-{n}" for n in range(1, 6)}
    ids = [p["id"] for p in puzzles]
    require(required <= set(ids) and len(set(ids)) == len(ids), "Missing/duplicate initial symbol IDs")
    require(all(p["id"] == f"symbol-{p['level']}" for p in puzzles if p["id"] in required),
            "An initial puzzle is assigned the wrong level")
    reports = []
    for p in puzzles:
        try:
            reports.append(verify(p))
        except (TypeError, ValueError, KeyError, IndexError) as error:
            raise SystemExit(f"{p['id']}: {error}") from error
    if args.json:
        print(json.dumps(reports, ensure_ascii=False, indent=2))
    else:
        for r in reports:
            print(f"{r['id']}: {r['assignments']} injective assignments; {r['solutions']} solution; "
                  f"{r['hints']} hints; {r['steps']} proved steps; omission counts "
                  f"{r['solution_counts_with_clue_removed']}")


if __name__ == "__main__":
    main()
