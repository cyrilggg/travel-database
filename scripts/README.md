# 中国覆盖清单工具

`build_cn_inventory.py` 从本地 GeoNames `cities15000`、`cities5000`、`cities1000`、`cities500` 文件生成中国清单。脚本不访问网络，也不创建城市页。

输入可以是 GeoNames 原始 `.txt`，也可以是包含同名文本文件的 `.zip`。四个文件应来自同一次快照。

```powershell
py -3 -B scripts/build_cn_inventory.py `
  --cities15000 data/cities15000.zip `
  --cities5000 data/cities5000.zip `
  --cities1000 data/cities1000.zip `
  --cities500 data/cities500.zip `
  --checks data/source-checks.json `
  --output coverage/geonames/2026-07-30/inventory/CN.csv `
  --report coverage/geonames/2026-07-30/CN.build-report.json
```

`--checks` 是可选的 JSON 文件，但发布固定快照时应当提供。每一档必须写入预期文件哈希和总行数，也可以增加内部文本哈希、唯一 ID 数和中国记录数：

```json
{
  "cities15000": {
    "file_sha256": "64 位十六进制 SHA-256",
    "row_count": 0,
    "inner_sha256": "可选",
    "distinct_geonameid_count": 0,
    "cn_row_count": 0
  },
  "cities5000": {"file_sha256": "...", "row_count": 0},
  "cities1000": {"file_sha256": "...", "row_count": 0},
  "cities500": {"file_sha256": "...", "row_count": 0}
}
```

输出 CSV 对每个实际出现过的中国 GeoNames ID 写入四个 `in_cities*` 标记。`assigned_phase` 是该记录第一次进入推进计划的档位：依次为 `cities15000`、`cities5000`、`cities1000`、`cities500`。

JSON 报告保留各输入的文件与内部文本 SHA-256、总行数、唯一 ID 数、中国记录数、各档两两交集与差集数量，以及层级异常的具体 ID。层级异常默认写进报告而不会丢弃记录；需要把异常视为失败时增加 `--strict-hierarchy`。任何重复 ID、跨档事实冲突、格式错误或预期校验不匹配都会阻止输出。脚本也会拒绝把输出路径指向任何输入或校验文件。

## 法定城市交叉核对

`build_cn_legal_city_inventory.py` 使用民政部行政区划代码服务，建立与 GeoNames 候选清单相互独立的法定城市核对表。网络获取和离线生成是两个明确步骤：

```powershell
py -3 -B scripts/build_cn_legal_city_inventory.py fetch `
  --expected-cutoff 2025-12-31 `
  --output-dir coverage/legal-cities/2025-12-31/raw

py -3 -B scripts/build_cn_legal_city_inventory.py build `
  --expected-cutoff 2025-12-31 `
  --raw-dir coverage/legal-cities/2025-12-31/raw `
  --output coverage/legal-cities/2025-12-31/inventory/CN-legal-cities.csv `
  --report coverage/legal-cities/2025-12-31/CN.build-report.json
```

`fetch` 会先从版本页核对数据截止日，再固定大陆 31 个省级行政区的接口响应、获取时间和 SHA-256；若目录已经存在或截止日不符，脚本会拒绝覆盖。`build` 不访问网络，只从固定响应中提取直辖市、地级市和县级市。自治州、地区、盟、县、市辖区与乡级节点不会因名称或层级相近而自动算作法定城市。

城市指南与法定城市代码对齐后，重建人类可读摘要：

```powershell
py -3 -B scripts/generate_cn_legal_summary.py --as-of 2026-07-30
```

## 质量检查与摘要

`validate_repository.py` 校验所有 `researched` 城市页的元数据、标题顺序、占位符和本地链接，并把 CN 决策账本与固定库存逐项对照。`duplicate`、`merged` 和 `out_of_scope` 必须有理由、证据、审核信息；固定快照内的 `researched` 必须对应实际页面和相同 GeoNames ID。标记 `coverage_scope: legal_city_only` 的补充页必须使用固定快照外的真实 GeoNames ID、匹配法定城市账本，且不会进入 GeoNames 决策账本。

```powershell
py -3 -B scripts/validate_repository.py --json
```

检查通过后才能重建人类可读摘要：

```powershell
py -3 -B scripts/generate_cn_summary.py --as-of 2026-07-30
```

摘要只汇总库存和稀疏决策账本，不会自动把任何页面提升为 `researched`。

运行自测：

```powershell
py -3 -B -m unittest discover -s tests -p "test_*.py"
```
