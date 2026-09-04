#!/usr/bin/env python3
"""Render the human-readable mainland-China legal-city coverage summary."""

from __future__ import annotations

import argparse
import csv
from datetime import date
import json
import os
from pathlib import Path
import sys
import tempfile

from validate_repository import validate_repository


LEVEL_LABELS = (
    ("direct_municipality", "直辖市"),
    ("prefecture_level_city", "地级市"),
    ("county_level_city", "县级市"),
)


def csv_rows(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8", newline="") as handle:
        return list(csv.DictReader(handle))


def render_summary(
    repository: Path,
    geonames_snapshot_date: str,
    legal_snapshot_date: str,
    as_of: str,
) -> str:
    date.fromisoformat(as_of)
    report = validate_repository(
        repository, geonames_snapshot_date, legal_snapshot_date
    )
    if report["errors"]:
        raise RuntimeError("repository validation failed:\n  " + "\n  ".join(report["errors"]))
    legal = report["legal_city_coverage"]
    if not legal["available"]:
        raise RuntimeError(f"legal-city snapshot {legal_snapshot_date} is not available")

    snapshot = repository / "coverage" / "legal-cities" / legal_snapshot_date
    inventory = csv_rows(snapshot / "inventory" / "CN-legal-cities.csv")
    build_report = json.loads(
        (snapshot / "CN.build-report.json").read_text(encoding="utf-8")
    )
    denominators = {
        level: sum(row["city_level"] == level for row in inventory)
        for level, _ in LEVEL_LABELS
    }
    researched = legal["researched_counts_by_city_level"]
    percent = legal["completion_fraction"] * 100
    lines = [
        "# 中国大陆法定城市核对摘要",
        "",
        f"> 行政区划数据截止日：{legal_snapshot_date}<br>",
        f"> 资料获取时间：{build_report['source_retrieved_at_utc']}<br>",
        f"> 统计更新：{as_of}<br>",
        "> 范围：民政部行政区划代码中的直辖市、地级市和县级市",
        "",
        "## 当前进度",
        "",
        f"固定分母为 **{legal['inventory_count']:,}** 座，已有达到质量要求的城市指南 **{legal['researched_count']:,}** 座，核对率 **{percent:.6f}%**。其余 **{legal['unprocessed_count']:,}** 座仍未处理，省级目录、空页和 GeoNames 审计决定不能替代法定城市指南。",
        "",
        "| 类别 | 固定分母 | researched | 未处理 |",
        "|---|---:|---:|---:|",
    ]
    for level, label in LEVEL_LABELS:
        lines.append(
            f"| {label} | {denominators[level]:,} | {researched[level]:,} | "
            f"{denominators[level] - researched[level]:,} |"
        )
    lines.extend(
        [
            "",
            "这份清单是 GeoNames CN 候选处理率的独立交叉核对，不把 695 座法定城市与 16,049 条聚居点记录混成一个分母。固定快照内的法定城市页与 GeoNames 决策账本对齐；同名聚居点位于固定快照外时，页面以 `legal_city_only` 标记进入法定城市账本，不改变 GeoNames 分母或进度。GeoNames 中的乡镇、片区、别名和历史记录继续按各自证据研究或审计。",
            "",
            "## 清单怎样形成",
            "",
            f"[民政部行政区划代码版本页]({build_report.get('source_version_page_url', 'https://dmfw.mca.gov.cn/XzqhVersionPublish.html')})明确标示数据截止日。快照保存版本页和大陆 31 个省级行政区的接口响应；离线构建程序只提取来源类型明确为“直辖市”“地级市”“县级市”的节点，并校验其层级和六位代码。自治州、地区、盟、县、市辖区和乡级节点不计入法定城市分母。",
            "",
            "接口在部分直辖市响应中仍返回了请求层级之外的乡级节点；原始响应完整保留，构建程序按明确城市类型与预期层级筛选，不根据名称后缀猜测。",
            "",
            "## 如何复核",
            "",
            "- [source-manifest.json](./raw/source-manifest.json)：版本页、31 个接口响应、获取时间、文件大小与 SHA-256；",
            "- [原始固定响应](./raw/)：版本页和按省级代码保存的压缩 JSON；",
            "- [CN-legal-cities.csv](./inventory/CN-legal-cities.csv)：695 座直辖市、地级市和县级市的不可变库存；",
            "- [CN.build-report.json](./CN.build-report.json)：节点类型统计、分省数量和输出哈希；",
            "- [CN.csv 决策账本](./decisions/CN.csv)：已达到质量要求并与页面、GeoNames ID 对齐的城市；",
            "- [中国城市覆盖口径](../../CN-SCOPE.md)：法定城市与 GeoNames 候选的独立统计规则。",
            "",
            "离线重建库存可运行：",
            "",
            "```powershell",
            "py -3 -B scripts/build_cn_legal_city_inventory.py build `",
            f"  --expected-cutoff {legal_snapshot_date} `",
            f"  --raw-dir coverage/legal-cities/{legal_snapshot_date}/raw `",
            "  --output CN-legal-cities.rebuilt.csv `",
            "  --report CN-legal-cities.rebuilt-report.json",
            "```",
            "",
            "若民政部发布新的数据截止日，应新建版本目录并报告新增、撤销或调整，不覆盖本快照。",
            "",
            "## 范围说明",
            "",
            "本快照仅请求大陆 31 个省级行政区，未请求香港、澳门和台湾。这是本阶段工程分母的边界，不是政治归属判断；相关地区如纳入项目，应分别建立可复核清单与进度。",
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
    parser.add_argument("--geonames-snapshot-date", default="2026-07-30")
    parser.add_argument("--legal-snapshot-date", default="2025-12-31")
    parser.add_argument("--as-of", required=True)
    parser.add_argument("--output", type=Path)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    repository = args.repository.resolve()
    output = args.output or (
        repository / "coverage" / "legal-cities" / args.legal_snapshot_date / "README.md"
    )
    try:
        content = render_summary(
            repository,
            args.geonames_snapshot_date,
            args.legal_snapshot_date,
            args.as_of,
        )
        write_atomic(output, content)
    except (OSError, RuntimeError, ValueError, json.JSONDecodeError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2
    print(f"wrote {output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
