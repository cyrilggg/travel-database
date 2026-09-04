# 中国城市覆盖口径

本文件规定中国阶段的工程分母、目录映射和审计阈值。它用于判断一条 GeoNames 记录是否已经处理，不替代中国法律或统计制度中的“城市”定义。

## 两个独立指标

### GeoNames CN 候选处理率

分母是固定日期 `cities500` 快照中 `country_code == CN` 的唯一 `geonameid`。每条记录只有在以下两种情况下才进入分子：

1. 对应一页通过质量门槛的 `researched` 城市指南；
2. 经人工审计确认是 `duplicate`、`merged` 或 `out_of_scope`，并留下理由、证据、审核日期与规范目标。

GeoNames 说明 `cities500` 包含人口超过 500 的聚居点，以及最低到 `PPLA4` 的行政驻地。因此，这个分母是公开数据定义的候选集合，不是中国法定城市清单。

### 法定城市覆盖率

另行以民政部行政区划代码服务明确标示的数据截止日，核对直辖市、地级市和县级市。GeoNames 的抓取日与行政区划数据截止日分别保存，不用当前访问日期冒充行政区划版本。只有 GeoNames CN 候选全部处理、法定城市清单也全部核对后，才可以对外表述为“中国大陆范围已完成”。在此之前只报告各自的实际分母、状态数和百分比。

个别法定城市的同名 GeoNames 聚居点因 `PPL` 人口字段为零，不在 `cities500` 固定快照内。此时页面绑定该城市自己的 GeoNames ID，并显式标记 `coverage_scope: legal_city_only`；页面只写入法定城市决策账本，不写入 GeoNames固定快照账本，也不改变 16,049 条候选的分子或分母。该标记仅用于同时满足“法定城市独立成页”和“固定快照不扩容”，须由同名、坐标、现行行政区划与法定代码共同闭合，不能借用邻近城市或县镇记录。

## 数据范围

- 本阶段严格使用 `country_code == CN`，对应 GeoNames 的中国大陆数据分区；
- GeoNames 将香港、澳门和台湾分别记录为 `HK`、`MO`、`TW`，不进入 CN 分母；
- 后续可以分别建立 HK、MO、TW 快照和完成率，不能把它们静默并入 CN 统计；
- `country_code` 在本项目中只表示上游数据分区，不作政治归属判断。

## 一级行政区与目录

`CN-admin1.csv` 把 GeoNames 的 31 个一级代码映射为标准中文目录名。直辖市的一级目录与核心城市页可以同名，例如：

```text
destinations/中国/北京市/README.md
destinations/中国/北京市/北京市.md
```

GeoNames 一级代码与中国六位行政区划代码是两套编号，不能互换。目录匹配依靠版本化映射表中的代码和 ID，不做模糊名称猜测。

## 页面与行政层级

- `PPLC`、`PPLA`：默认是页面候选，但 GeoNames 城市点不等于整个行政区范围；
- `PPLA2`：表示二级行政区驻地，不自动证明其为中国法定地级市；
- `PPLA3`、`PPLA4`：仍在 cities500 工程边界内，不能因层级低或人口字段为零自动排除；
- `PPL`：只说明它是聚居点，不证明法定城市身份；仍须研究或审计；
- `PPLX`：通常是城市的一部分，可以成为合并候选，但必须确认连续建成区和页面实际覆盖；
- `PPLH`、`PPLQ`、`PPLW`：只有在权威资料证明历史、废弃或不再有人居后，才可判为范围外；
- `ADM*`：行政面不是城市点。若异常进入候选数据，须以证据标记 `not_populated_place`。

地级行政区、自治州、盟和地区不直接等于城市页。页面通常对应其实际驻地聚居点。县级市原则上独立成页；市辖区、县城、镇或直辖市远郊也不能按类型批量合并。

## 审计状态与 reason_code

`status` 与理由分开记录。完成状态只有 `researched`、`duplicate`、`merged`、`out_of_scope`。

| reason_code | 适用情况 |
|---|---|
| `duplicate_same_settlement` | 两个 ID 实际指向同一物理聚居点 |
| `geonames_superseded` | 旧 ID 已由上游替代 |
| `merged_urban_section` | 独立记录是同一连续城市的片区，且规范页明确覆盖 |
| `admin_seat_alias` | 行政驻地标签与实际城市页指向同一目的地 |
| `renamed_or_reorganized` | 更名或行政调整后的旧记录由新页面承接 |
| `historical_or_abandoned` | 权威资料确认已成为历史、废弃或毁坏聚居点 |
| `not_populated_place` | 权威资料确认实际是行政面或设施，不是聚居点 |
| `source_data_error` | 坐标、层级或国家代码存在可证明的上游错误 |

`outside_cn_dataset` 只用于解释 HK、MO、TW 等为何不在本次 CN 分母中，不是对 CN 清单内记录的完成决定。`needs_manual_review` 是待处理状态，不能计入完成。

以下理由无效：`too_small`、`no_attractions`、`not_famous`、`low_population`。既然 cities500 已被选为工程边界，就不能再用知名度或人口主观缩小分母。

## 重复与合并证据

判为重复至少需要：同一行政链、当前名或曾用名关联、坐标或实际建成区一致，以及一项权威地名或行政证据。名称相同、拼音相同或距离接近只能触发复核。

判为合并必须证明两条记录是不同的真实对象，但由同一指南完整承接。被合并区域应在城市页中明确出现，审计行必须填写 `canonical_geonameid` 或 `canonical_page_path`。一日游景点写入某城市页，并不自动完成该地点在覆盖清单中的独立记录。

禁止用以下自动规则作最终决定：

- 去掉“市、县、区、旗”等后缀后同名；
- 小于某个距离阈值；
- `population` 为空或为零；
- 市辖区一律并入、县级市一律拆分；
- 单一第三方地图、Wikidata 同名项或旅游知名度。

## 权威依据

- [GeoNames dump README](https://download.geonames.org/export/dump/readme.txt)：城市分档、字段、许可证；
- [GeoNames feature codes](https://www.geonames.org/export/codes.html)：`PPL`、`PPLA*`、`PPLX` 等定义；
- [GeoNames countryInfo](https://download.geonames.org/export/dump/countryInfo.txt)：CN、HK、MO、TW 的独立数据代码；
- [行政区划管理条例](https://www.gov.cn/zhengce/content/2018-11/01/content_5336379.htm)：中国行政区划管理；
- [行政区划代码管理办法](https://www.moj.gov.cn/pub/sfbgw/flfggz/flfggzbmgz/202512/t20251204_528920.html)：代码的编制、变更和沿用；
- [统计用区划代码和城乡划分代码编制规则](https://www.stats.gov.cn/sj/tjbz/gjtjbz/202302/t20230213_1902741.html)：行政代码与统计代码的关系。

本规则核验于 2026-07-30。行政调整、上游更名或下一版快照应留下新的版本与差异，不覆盖旧决定。
