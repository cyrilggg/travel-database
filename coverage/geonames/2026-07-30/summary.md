# GeoNames 中国 CN 快照摘要

> 快照日期：2026-07-30<br>
> 统计更新：2026-08-12<br>
> 工程边界：固定 `cities500` 快照中 `country_code == CN` 的唯一 GeoNames ID

## 当前进度

固定分母为 **16,049** 条，已处理 **351** 条，处理率 **2.187052%**。未列入决策账本的 **15,698** 条记录仍是未处理，不能计为完成。

| 状态 | 数量 | 是否计入已处理 |
|---|---:|---:|
| `researched` | 315 | 是 |
| `duplicate` | 2 | 是 |
| `merged` | 32 | 是 |
| `out_of_scope` | 2 | 是 |
| 未处理 | 15,698 | 否 |

`researched` 与三类审计决定分开报告，避免用排除项掩盖实际城市指南数量。

## 分阶段队列

`assigned_phase` 表示记录第一次进入推进计划的档位。四档在本快照中严格嵌套，因此各阶段新增量之和等于最终分母。

| 阶段 | 该阶段新增 | researched | duplicate | merged | out_of_scope | 未处理 |
|---|---:|---:|---:|---:|---:|---:|
| `cities15000` | 2,106 | 315 | 2 | 32 | 2 | 1,755 |
| `cities5000` | 773 | 0 | 0 | 0 | 0 | 773 |
| `cities1000` | 2,085 | 0 | 0 | 0 | 0 | 2,085 |
| `cities500` | 11,085 | 0 | 0 | 0 | 0 | 11,085 |

## 如何复核

- [manifest.yml](./manifest.yml)：来源 URL、HTTP 元数据、文件大小、SHA-256、许可证和实际计数；
- [原始快照](./raw/)：四个 GeoNames ZIP 由 Git LFS 保存，说明文件与行政代码表直接版本化；
- [CN.csv](./inventory/CN.csv)：16,049 条不可变库存及四档成员标志；
- [CN.build-report.json](./CN.build-report.json)：哈希校验、行数、交集、差集和嵌套断言；
- [CN.csv 决策账本](./decisions/CN.csv)：已研究页面与人工审计决定；
- [一级行政区映射](./crosswalk/README.md)：GeoNames 一级代码与标准中文目录名的对应；
- [中国城市覆盖口径](../../CN-SCOPE.md)：页面候选、合并、重复和范围外的证据阈值。

复建库存可运行：

```powershell
py -3 -B scripts/build_cn_inventory.py `
  --cities15000 coverage/geonames/2026-07-30/raw/cities15000.zip `
  --cities5000 coverage/geonames/2026-07-30/raw/cities5000.zip `
  --cities1000 coverage/geonames/2026-07-30/raw/cities1000.zip `
  --cities500 coverage/geonames/2026-07-30/raw/cities500.zip `
  --checks coverage/geonames/2026-07-30/source-checks.json `
  --output CN.rebuilt.csv `
  --report CN.rebuilt-report.json `
  --strict-hierarchy
```

重建文件应与 manifest 中的输出 SHA-256 一致。若以后采用新上游数据，应新建日期目录并报告增删差异，不覆盖本快照。

## 范围说明

CN 分母不含 GeoNames 的 `HK`、`MO`、`TW` 数据文件。这是上游数据分区边界，不是政治归属判断。香港、澳门和台湾如纳入项目，应各自建立可审计分母和进度。只有 GeoNames CN 候选与公开法定城市清单都完成核对后，才可表述为“中国大陆范围已完成”。
