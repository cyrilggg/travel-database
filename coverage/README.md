# 覆盖与完成度

这里定义全球城市清单的固定方式、处理状态和审计要求。它用于回答“工程范围内有哪些记录、每条记录处理到什么程度”，不会自动生成城市页，也不会把目录或模板计为完成。

## 当前阶段

固定的 GeoNames 全球快照尚未导入。仓库当前只有苏州、东京和巴黎三座结构验证样例，因此不发布全球分母、完成数或完成百分比。页面样式确认后再建立第一份不可变快照；快照建立前，任何样例数量都不得表述为全球覆盖率。

## 快照目录

```text
coverage/
  README.md
  geonames/
    YYYY-MM-DD/
      manifest.yml
      inventory/
        CN.csv
        FR.csv
        JP.csv
      decisions/
        CN.csv
        FR.csv
        JP.csv
      summary.md
```

- `manifest.yml` 记录上游文件、获取时间、校验值、实际行数和生成版本；
- `inventory/` 是不可变的固定基线，按国家拆分便于审阅；
- `decisions/` 记录可变的处理状态和人工排除决定；
- `summary.md` 由前两者生成，只用于阅读，不作为事实源。

若原始压缩包不放入 Git，必须保存在可长期取回的 Release 或 LFS 资产中。只有 SHA-256 而没有可取回的原文件，不能完整复核旧快照。

## 快照记录

`manifest.yml` 至少应保存：

```yaml
snapshot_id:
scope_file: cities500.zip
retrieved_at_utc:
upstream_last_modified_display:
source_url:
archive_size_bytes:
archive_sha256:
inner_filename:
inner_sha256:
row_count:
distinct_geonameid_count:
duplicate_geonameid_count:
readme_url:
readme_sha256:
license_spdx: CC-BY-4.0
attribution:
normalizer_commit:
scope_rule:
```

四档文件各自的行数、唯一 ID 数、交集和差集数量也应保留。GeoNames 行内的 `modification date` 是单条记录的上游修改日期，不能代替快照获取时间。

## 清单字段

不可变 `inventory` 至少包含：

```text
geonameid
name
asciiname
country_code
admin1_code
admin2_code
admin3_code
admin4_code
feature_class
feature_code
population
latitude
longitude
timezone
geonames_modified_at
in_cities15000
in_cities5000
in_cities1000
in_cities500
assigned_phase
```

不能假设四档文件严格嵌套。阶段队列要根据同一次快照中的实际成员关系生成；若最终分母采用 `cities500`，前三档不在 `cities500` 中的异常记录必须单列，不能静默忽略。

可变 `decisions` 至少包含：

```text
geonameid
status
page_path
canonical_geonameid
canonical_page_path
reason_code
reason
evidence_url
reviewed_by
reviewed_at
quality_gate_version
```

## 处理状态

以下状态计入已处理：

- `researched`：城市页存在，GeoNames ID 匹配，内容状态和研究日期有效，并通过当前质量门槛；
- `duplicate`：经审计确认重复，记录理由、证据、审核信息和规范目标；
- `merged`：经审计确认由另一城市页承接，记录理由、证据、审核信息和目标页面；
- `out_of_scope`：按公开范围规则排除，记录具体理由、证据和审核信息。

以下状态不计入已处理：

- `unprocessed`、`seed`、`draft`、`needs_review`、`stale`；
- 缺页、空页、仅有元数据的页面；
- 国家或一级行政区 README、自动索引和空目录。

覆盖结果使用固定公式：

```text
有效 researched 记录 + 有效审计排除记录
──────────────────────────────────────
固定 cities500 快照中的唯一 geonameid
```

报告必须另外列出 `researched`、`duplicate`、`merged` 和 `out_of_scope` 的数量，避免一个合并比例掩盖内容页与排除项的差别。上游后来删除、重命名或合并记录时，不从旧分母直接移除，而是保留审计决定；更换基线时新建日期目录并报告增删差异。

## 自动化边界

辅助脚本可以校验 YAML、日期、状态、必需标题、相对链接、占位符、重复 GeoNames ID 和来源核验日期，也可以生成索引与覆盖统计。

辅助脚本不能：

- 自动把页面提升为 `researched`；
- 用字数、目录或表格行数代替人工质量判断；
- 自动把低人口、别名或相邻聚落判为范围外；
- 自动生成空城市页并提高覆盖率；
- 把 URL 能访问等同于来源确实支持正文。

## 官方依据

- [GeoNames 下载目录](https://download.geonames.org/export/dump/)
- [GeoNames dump README](https://download.geonames.org/export/dump/readme.txt)
- [GeoNames feature codes](https://www.geonames.org/export/codes.html)
- [GeoNames 数据来源](https://www.geonames.org/datasources/)
- [GeoNames 使用条款](https://www.geonames.org/about.html)
