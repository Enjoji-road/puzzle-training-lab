"""Authoring commands. Generate drafts; check or register reviewed batches."""
import argparse
from contextlib import contextmanager
import json
import os
from pathlib import Path
from secrets import randbits
from tempfile import NamedTemporaryFile

from generate_puzzle import GENERATORS, generate
from verify import DATA, DATA_FILENAME, estimate, read_catalog, records_from, validate


def format_json(value):
    return json.dumps(value, ensure_ascii=False, indent=2) + "\n"


def _atomic_write(path, content):
    # The temporary file and destination share a filesystem.
    with NamedTemporaryFile(mode="w", dir=path.parent, encoding="utf-8", delete=False) as stream:
        temporary = Path(stream.name)
        try:
            stream.write(content)
        except BaseException:
            temporary.unlink(missing_ok=True)
            raise
    try:
        temporary.replace(path)
    finally:
        temporary.unlink(missing_ok=True)


@contextmanager
def _catalog_lock(directory):
    lock = directory / ".catalog.lock"
    try:
        with lock.open("x", encoding="ascii") as file:
            file.write(f"{os.getpid()}\n")
    except FileExistsError as error:
        raise ValueError("別の問題登録が進行中です。完了後に再実行してください。") from error
    try:
        yield
    finally:
        lock.unlink(missing_ok=True)


def check_batch(path, directory=DATA):
    _, existing = read_catalog(directory)
    return validate(records_from(path), against=existing)


def register(path, filename, directory=DATA):
    if not DATA_FILENAME.fullmatch(filename) or filename == "catalog.json":
        raise ValueError("追加先には新しい問題ファイル名を指定してください。例 advanced-2026-11.json")
    batch = records_from(path)
    output = directory / filename
    with _catalog_lock(directory):
        manifest, existing = read_catalog(directory)
        if filename in manifest["files"]:
            raise ValueError(f"{filename} はすでに登録済みです。")
        report = validate(batch, against=existing)
        content = format_json(batch)
        if output.exists() and output.read_text(encoding="utf-8") != content:
            raise ValueError(f"{filename} は存在します。別の登録先を指定してください。")
        if not output.exists():
            _atomic_write(output, content)
        # A failed catalog write leaves an unlisted batch. Rerunning with the
        # same content safely completes registration without changing earlier data.
        manifest["files"].append(filename)
        _atomic_write(directory / "catalog.json", format_json(manifest))
        return report


def main():
    cli = argparse.ArgumentParser(description=__doc__)
    commands = cli.add_subparsers(dest="command", required=True)
    draft = commands.add_parser("generate", help="未登録の問題候補を生成")
    draft.add_argument("--genre", required=True, choices=GENERATORS)
    draft.add_argument("--level", required=True, type=int, choices=(4, 5))
    draft.add_argument("--seed", type=int, default=None)
    draft.add_argument("--count", type=int, default=1)
    draft.add_argument("--output", type=Path, required=True)
    check = commands.add_parser("check", help="候補の完成度と既存問題との重複を検査")
    check.add_argument("draft", type=Path)
    publish = commands.add_parser("register", help="検証を通った作問レビュー済み問題をカタログに登録")
    publish.add_argument("draft", type=Path)
    publish.add_argument("--file", required=True)
    args = cli.parse_args()

    try:
        if args.command == "generate":
            output = args.output.resolve()
            if output.is_relative_to(DATA.parent.resolve()):
                raise ValueError("候補は配信用の dist/ の外へ書き出してください。")
            if output.exists():
                raise ValueError(f"{output} は存在します。新しい候補ファイルを指定してください。")
            if args.count < 1:
                raise ValueError("候補数は1以上を指定してください。")
            seed = randbits(32) if args.seed is None else args.seed
            _, catalog = read_catalog()
            drafts, report = [], []
            for offset in range(args.count):
                puzzle, counts = generate(args.genre, args.level, seed + offset, catalog=catalog, earlier=drafts)
                drafts.append(puzzle)
                report.append({"id": puzzle["id"], "seed": seed + offset, "remaining_models": counts,
                               "estimated": estimate(puzzle), "status": "下書き・公開未登録"})
            with output.open("x", encoding="utf-8") as stream:
                stream.write(format_json(drafts))
            print(format_json(report).strip())
            return
        if args.command == "check":
            result = check_batch(args.draft)
        else:
            result = register(args.draft, args.file)
        for row in result:
            print(f'{row["id"]}: 一意解・ヒント{row["hints"]}件・解説{row["steps"]}手 / 機械推定Lv.{row["estimate"]["level"]}')
    except (AssertionError, OSError, ValueError) as error:
        cli.exit(1, f"{error}\n")


if __name__ == "__main__":
    main()

