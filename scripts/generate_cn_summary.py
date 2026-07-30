#!/usr/bin/env python3
"""Render the human-readable China coverage summary from inventory and decisions."""

from __future__ import annotations

import argparse
import csv
from datetime import date
import os
from pathlib import Path
import sys
import tempfile

from validate_repository import validate_repository


PHASES = ("cities15000", "cities5000", "cities1000", "cities500")
STATUSES = ("researched", "duplicate", "merged", "out_of_scope")


def csv_rows(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8", newline="") as handle:
        return list(csv.DictReader(handle))


def render_summary(repository: Path, snapshot_date: str, as_of: str) -> str:
    date.fromisoformat(as_of)
    report = validate_repository(repository, snapshot_date)
    if report["errors"]:
        joined = "\n  ".join(report["errors"])
        raise RuntimeError(f"repository validation failed:\n  {joined}")

    snapshot = repository / "coverage" / "geonames" / snapshot_date
    inventory = csv_rows(snapshot / "inventory" / "CN.csv")
    phase_denominators = {
        phase: sum(row["assigned_phase"] == phase for row in inventory) for phase in PHASES
    }
    status_counts = report["status_counts"]
    processed = report["processed_count"]
    denominator = report["inventory_count"]
    percent = processed / denominator * 100 if denominator else 0.0

    lines = [
        "# GeoNames 中国 CN 快照摘要",
        "",
        f"> 快照日期：{snapshot_date}<br>",
        f"> 统计更新：{as_of}<br>",
        "> 工程边界：固定 `cities500` 快照中 `country_code == CN` 的唯一 GeoNames ID",
        "",
        "## 当前进度",
        "",
        f"固定分母为 **{denominator:,}** 条，已处理 **{processed:,}** 条，处理率 **{percent:.6f}%**。未列入决策账本的 **{report['unprocessed_count']:,}** 条记录仍是未处理，不能计为完成。",
        "",
        "| 状态 | 数量 | 是否计入已处理 |",
        "|---|---:|---:|",
        f"| `researched` | {status_counts['researched']:,} | 是 |",
        f"| `duplicate` | {status_counts['duplicate']:,} | 是 |",
        f"| `merged` | {status_counts['merged']:,} | 是 |",
        f"| `out_of_scope` | {status_counts['out_of_scope']:,} | 是 |",
        f"| 未处理 | {report['unprocessed_count']:,} | 否 |",
        "",
        "`researched` 与三类审计决定分开报告，避免用排除项掩盖实际城市指南数量。",
        "",
        "## 分阶段队列",
        "",
        "`assigned_phase` 表示记录第一次进入推进计划的档位。四档在本快照中严格嵌套，因此各阶段新增量之和等于最终分母。",
        "",
        "| 阶段 | 该阶段新增 | researched | duplicate | merged | out_of_scope | 未处理 |",
        "|---|---:|---:|---:|---:|---:|---:|",
    ]
    for phase in PHASES:
        counts = report["phase_status_counts"][phase]
        phase_processed = sum(counts[status] for status in STATUSES)
        lines.append(
            f"| `{phase}` | {phase_denominators[phase]:,} | "
            f"{counts['researched']:,} | {counts['duplicate']:,} | {counts['merged']:,} | "
            f"{counts['out_of_scope']:,} | {phase_denominators[phase] - phase_processed:,} |"
        )

    lines.extend(
        [
            "",
            "## 如何复核",
            "",
            "- [manifest.yml](./manifest.yml)：来源 URL、HTTP 元数据、文件大小、SHA-256、许可证和实际计数；",
            "- [原始快照](./raw/)：四个 GeoNames ZIP 由 Git LFS 保存，说明文件与行政代码表直接版本化；",
            "- [CN.csv](./inventory/CN.csv)：16,049 条不可变库存及四档成员标志；",
            "- [CN.build-report.json](./CN.build-report.json)：哈希校验、行数、交集、差集和嵌套断言；",
            "- [CN.csv 决策账本](./decisions/CN.csv)：已研究页面与人工审计决定；",
            "- [一级行政区映射](./crosswalk/README.md)：GeoNames 一级代码与标准中文目录名的对应；",
            "- [中国城市覆盖口径](../../CN-SCOPE.md)：页面候选、合并、重复和范围外的证据阈值。",
            "",
            "复建库存可运行：",
            "",
            "```powershell",
            "py -3 -B scripts/build_cn_inventory.py `",
            "  --cities15000 coverage/geonames/2026-07-30/raw/cities15000.zip `",
            "  --cities5000 coverage/geonames/2026-07-30/raw/cities5000.zip `",
            "  --cities1000 coverage/geonames/2026-07-30/raw/cities1000.zip `",
            "  --cities500 coverage/geonames/2026-07-30/raw/cities500.zip `",
            "  --checks coverage/geonames/2026-07-30/source-checks.json `",
            "  --output CN.rebuilt.csv `",
            "  --report CN.rebuilt-report.json `",
            "  --strict-hierarchy",
            "```",
            "",
            "重建文件应与 manifest 中的输出 SHA-256 一致。若以后采用新上游数据，应新建日期目录并报告增删差异，不覆盖本快照。",
            "",
            "## 范围说明",
            "",
            "CN 分母不含 GeoNames 的 `HK`、`MO`、`TW` 数据文件。这是上游数据分区边界，不是政治归属判断。香港、澳门和台湾如纳入项目，应各自建立可审计分母和进度。只有 GeoNames CN 候选与公开法定城市清单都完成核对后，才可表述为“中国大陆范围已完成”。",
            "",
        ]
    )
    return "\n".join(lines)


def write_atomic(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    handle = tempfile.NamedTemporaryFile(
        mode="w", encoding="utf-8", newline="\n", delete=False, dir=path.parent
    )
    temporary = Path(handle.name)
    try:
        with handle:
            handle.write(content)
        os.replace(temporary, path)
    except BaseException:
        temporary.unlink(missing_ok=True)
        raise


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repository", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--snapshot-date", default="2026-07-30")
    parser.add_argument("--as-of", required=True, help="summary date in YYYY-MM-DD form")
    parser.add_argument("--output", type=Path)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    repository = args.repository.resolve()
    output = args.output or (
        repository / "coverage" / "geonames" / args.snapshot_date / "summary.md"
    )
    try:
        content = render_summary(repository, args.snapshot_date, args.as_of)
        write_atomic(output, content)
    except (OSError, RuntimeError, ValueError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2
    print(f"wrote {output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
