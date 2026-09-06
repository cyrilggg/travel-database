# 地图目标城市中心点

`cn-legal-city-centers.csv` 对应仓库固定的 2025-12-31 中国大陆法定城市清单，共 695 座。

中心点取自 AreaCity-JsSpider-StatsGov 的 2025.251231.260403 版 `ok_geo.csv`，原始坐标为 GCJ-02；生成脚本在写入本文件时转换为供网页地图使用的 WGS84。上游仓库采用 MIT License：<https://github.com/xiangyuecn/AreaCity-JsSpider-StatsGov>。

草湖市晚于该三级边界文件设立，中心点使用其政府驻地草湖镇的公开坐标。

需要更新行政区划快照时，应下载对应版本的 `ok_geo.csv`，再运行 `scripts/extract-legal-city-centers.mjs <文件路径>`，不要手工逐城维护坐标或覆盖状态。

## 台湾城市点

`tw-city-centers.csv` 收录 6 个直辖市、3 个市和 14 个县辖市，共 23 个城市入口；在没有对应攻略时统一显示为“尚未收录”。城市层级与县辖市清单依据内政部地方制度资料及国土测绘中心 2025-03-18 版乡镇市区界线。

直辖市和市采用 GeoNames 城市中心点；14 个县辖市采用国土测绘中心界线的几何中心。数据源分别采用 CC BY 4.0 与政府资料开放授权条款第 1 版。

## 朝鲜半岛城市点

`kr-city-centers.csv` 收录韩国 85 个城市入口，包含中央直辖层级城市、一般市与济州特别自治道的 2 个行政市。行政层级按 2026-07-01 生效的韩国行政区划处理：原光州广域市与全罗南道合并为全南光州统合特别市，原全罗南道辖 5 个市继续保留为城市入口。合并口径参考韩国行政安全部行政区划代码公告与《全南光州统合特别市设置特别法》：<https://www.mois.go.kr/frt/bbs/type001/commonSelectBoardArticle.do?bbsId=BBSMSTR_000000000052&nttId=127039>、<https://www.law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1033748505>。

`kp-city-centers.csv` 收录朝鲜 1 个直辖市、3 个特别市和 24 个一般市，共 28 个城市入口。行政区划口径参考韩国国土地理信息院《国家地图集》及当前城市清单：<https://nationalatlas.ngii.go.kr/pages/page_3875.php>。

两份文件的中心点与 GeoNames 标识取自 2026-09-06 下载的 GeoNames 国家数据快照，按 CC BY 4.0 使用：<https://www.geonames.org/export/>。与台湾城市点相同，在没有对应攻略时统一显示为“尚未收录”。

## 日本城市点

`jp-city-centers.csv` 收录日本 792 个“市”与东京特别区部，共 793 个城市入口；不包含町、村、郡及东京各特别区。城市清单取自日本政府统计门户 e-Stat 的 2026-09-06 市区町村代码查询结果，并按“都市区分：市”筛选：<https://www.e-stat.go.jp/municipalities/cities/areacode>。本次使用的官方 CSV 快照 SHA-256 为 `967B97821A3D03768A89823364095194AD3DEDFA68A47328BDE76C3DD83C9B98`。

城市中心点与 GeoNames 标识取自 2026-09-05 更新、2026-09-06 下载的 GeoNames 日本国家数据快照，按 CC BY 4.0 使用：<https://www.geonames.org/export/>。`scripts/import-japan-city-centers.mjs` 会按都道府县和官方日文名称逐项匹配，匹配缺失或存在歧义时停止生成；没有对应攻略的城市统一显示为“尚未收录”。

## 蒙古城市点

`sources/mn-official-cities-2026-09-06.csv` 收录蒙古当前适用口径下的 24 个城市入口：首都乌兰巴托、3 个国家级城市和 20 个省级城市。城市等级与名单依据现行官方土地等级表核对：<https://legalinfo.mn/mn/detail?lawId=203479>。2024 年国家大呼拉尔第 72 号《关于建立城市的决议》所列新体系要到 2027-01-01 才生效，因此本快照不提前录入其中新增的地方级和卫星城市：<https://legalinfo.mn/mn/detail?lawId=17140840711681&type=2>。

中心点与 GeoNames 标识取自 2026-09-06 下载的 GeoNames 蒙古国家数据快照，按 CC BY 4.0 使用：<https://www.geonames.org/export/>；下载压缩包 SHA-256 为 `ACF1C98BB5DC4468B3953D727DDCD2388375831C44332F4ED04296910244C9D0`。蒙古当前体系没有供本项目直接使用的统一城市代码，稳定 ID 由城市等级与官方名称组成；2027 年切换新体系时保留这些既有 ID 并另做增量映射。

## 菲律宾城市点

`sources/ph-official-cities-2026-06-30.csv` 按菲律宾统计局 PSGC 2026 年第二季度口径收录 149 个法定 City：33 个 Highly Urbanized City、5 个 Independent Component City 和 111 个 Component City；不包含 1,493 个 Municipality。稳定 ID 直接使用 PSGC 10 位代码。总数与发布日期依据 2026-07-13 发布、统计截至 2026-06-30 的官方更新：<https://psa.gov.ph/classification/psgc>；城市分级逐项按官方 HUC、ICC、CC 名单核对：<https://psa.gov.ph/classification/psgc/hucs>、<https://psa.gov.ph/classification/psgc/iccs>、<https://psa.gov.ph/classification/psgc/ccs>。

中心点与 GeoNames 标识取自 2026-09-06 下载的 GeoNames 菲律宾国家数据快照，按 CC BY 4.0 使用：<https://www.geonames.org/export/>；下载压缩包 SHA-256 为 `0AD6226C3AEDD9AA0D486DBEEDEB4899FC1D1E3F1714350FEC353525F3CDAC95`。名称匹配同时使用 PSGC 省区归属和 GeoNames 行政代码排除重名地点；没有对应攻略的城市统一显示为“尚未收录”。

## 印度尼西亚城市点

`sources/id-official-cities-2025.csv` 按印尼内政部 2025 年第 300.2.2-2138 号决定收录 98 个 `kota`：93 个自治市和雅加达的 5 个行政市；不包含 416 个 `kabupaten`。稳定 ID 使用内政部两级地区代码。现行法规记录：<https://peraturan.bpk.go.id/Details/322912/keputusan-mendagri-no-30022-2430-tahun-2025>；98 市总数由印度尼西亚中央统计局 2025 年省际统计资料复核。为避免从 4,428 页附件手工抄录，名称与代码使用该决定的结构化转录版 `masmaksum/kode-wilayah-2025@a878917` 提取，并逐省核对总数：<https://github.com/masmaksum/kode-wilayah-2025>。

中心点与 GeoNames 标识取自 2026-09-06 下载的 GeoNames 印度尼西亚国家数据快照，按 CC BY 4.0 使用：<https://www.geonames.org/export/>；下载压缩包 SHA-256 为 `8CEF7AC3A959E64261EDD2A07059BC80B8D9412C72222F7B183536BF9BDD5122`。雅加达行政市采用 GeoNames 的 ADM2 几何中心，其余城市采用人口地名中心；重名城市同时按省份消歧。

## 越南城市点

`sources/vn-central-cities-2025-07-01.csv` 收录越南 2025 年两级地方政府改革后仍作为正式行政单位存在的 6 个中央直辖市。越南已于 2025-07-01 结束县级行政单位运作，因此不继续罗列改革前的省辖市、县级市和市社；这能避免地图把已经失效的旧层级误标为现行城市。名单依据越南政府公布的 34 个省级行政单位（28 省、6 中央直辖市）核对：<https://xaydungchinhsach.chinhphu.vn/chi-tiet-34-don-vi-hanh-chinh-cap-tinh-tu-12-6-2025-119250612141845533.htm>。

稳定 ID 使用越南总理 2025 年第 19/2025/QĐ-TTg 号决定公布的省级单位代码；官方代码目录：<https://danhmuchanhchinh.nso.gov.vn/>。中心点与 GeoNames 标识取自 2026-09-06 下载的 GeoNames 越南国家数据快照，按 CC BY 4.0 使用：<https://www.geonames.org/export/>；下载压缩包 SHA-256 为 `49F45EF72735D8833D528384EECD89E86C690667B63C35D9F132A21E2B02F6C2`。

## 泰国城市点

`sources/th-city-municipalities-2026-06-10.csv` 收录泰国 35 个 `เทศบาลนคร`（นคร级市政体），以及曼谷、芭堤雅两个特别地方行政体，共 37 个城市入口；不包含 246 个 `เทศบาลเมือง`（镇级市政体）和 2,489 个 `เทศบาลตำบล`（街镇级市政体）。类别总数依据泰国内政部地方行政厅截至 2025-12-16 的官方统计：<https://asean.dla.go.th/public/article.do?lang=th&lv2Index=36&random=1786068602604>；35 个นคร级市政体及芭堤雅逐项取自地方行政厅 2026-06-10 更新的地方行政组织名录：<https://opendata.dla.go.th/dataset/dlads_05_01>。曼谷不在该地方行政组织名录内，按同一官方统计中的特别地方行政体单列。

泰国当前名录没有随 CSV 提供可复用的行政代码，因此稳定 ID 由行政体类别与规范化官方名称组成；后续新增或改制不重排既有 ID。中心点与 GeoNames 标识主要取自 2026-09-06 下载的 GeoNames 泰国国家数据快照，按 CC BY 4.0 使用：<https://www.geonames.org/export/>；下载压缩包 SHA-256 为 `62B27E399569A63277FFEBE6B7884F4852E1F10CB2EBF7ED3BC5D7A8B505F125`。Chao Phraya Surasak 在 GeoNames 快照中没有独立城市记录，使用其市政体公开中心坐标且留空 GeoNames 标识，避免误绑到相邻的 Si Racha。
