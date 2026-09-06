# 地图目标城市中心点

地图面向中文用户，所有城市主名称统一使用简体中文。`city-names-zh.csv` 以国家代码和稳定行政代码关联海外城市：优先使用 Wikidata 与 GeoNames 的现有中文标签，没有通行中文名的城市使用中文音译；`source_name` 保留官方或来源拼写用于匹配和复核。同步脚本会拒绝缺少中文名、夹带拉丁字母、重复键或原名已经漂移的记录，名称调整不改变城市 ID、攻略关联或已保存记录。

`cn-legal-city-centers.csv` 对应仓库固定的 2025-12-31 中国大陆法定城市清单，共 695 座。

中心点取自 AreaCity-JsSpider-StatsGov 的 2025.251231.260403 版 `ok_geo.csv`，原始坐标为 GCJ-02；生成脚本在写入本文件时转换为供网页地图使用的 WGS84。上游仓库采用 MIT License：<https://github.com/xiangyuecn/AreaCity-JsSpider-StatsGov>。

草湖市晚于该三级边界文件设立，中心点使用其政府驻地草湖镇的公开坐标。

需要更新行政区划快照时，应下载对应版本的 `ok_geo.csv`，再运行 `scripts/extract-legal-city-centers.mjs <文件路径>`，不要手工逐城维护坐标或覆盖状态。

## 台湾城市点

`tw-city-centers.csv` 收录 6 个直辖市、3 个市和 14 个县辖市，共 23 个城市入口；在没有对应攻略时统一显示为“尚未收录”。城市层级与县辖市清单依据内政部地方制度资料及国土测绘中心 2025-03-18 版乡镇市区界线。

直辖市和市采用 GeoNames 城市中心点；14 个县辖市采用国土测绘中心界线的几何中心。数据源分别采用 CC BY 4.0 与政府资料开放授权条款第 1 版。

2026-09-06 为朴子市补齐 GeoNames 关联 `1670367`，保留原行政代码、地图 ID 与几何中心。核对 [GeoNames TW 数据](https://download.geonames.org/export/dump/TW.zip)中的 `Pozi`、别名 `朴子`、嘉义县 `CYQ` 与朴子 `Q02`，并以 [Wikidata Q706520](https://www.wikidata.org/wiki/Q706520)交叉确认；没有误配台中“埔子”。下载包 SHA-256：`224d3e868ce87e4f58e9137c17fba3b42b9419b10311442dca60946e00d189b2`。

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

## 马来西亚城市点

`sources/my-city-local-authorities-2026-09-06.csv` 收录马来西亚当前 20 个城市级地方行政入口：地方政府发展局现行目录中的 19 个 `Dewan/Majlis Bandaraya`，以及依据《联邦首都法》单列的吉隆坡市政厅。目录、地方政府类别、PBT 代码与机构坐标均来自马来西亚房屋及地方政府部地方政府发展局的实时官方目录：<https://jkt.kpkt.gov.my/senarai-nama-dan-alamat-pbt/>、<https://ejkt.kpkt.gov.my/eprofil/api/jkt-portal-senarai-maklumat>。名称中含 `Bandaraya` 但类别仍为 `Majlis Perbandaran` 的哥打巴鲁和兰卡威不在本批范围内；普通市议会和县议会同样不收录。

19 个目录内单位使用官方 PBT 代码作为稳定 ID，吉隆坡使用官方机构缩写 `DBKL`；古晋按北市政厅与南市议会两个法定管辖单位分别保留。中心点与 GeoNames 标识取自 2026-09-06 下载的 GeoNames 马来西亚国家数据快照，按 CC BY 4.0 使用：<https://www.geonames.org/export/>；下载压缩包 SHA-256 为 `D7CDF5057205A319180BACDAB86ADE70D38239CDA6C1BEE87A54191F8874A598`。GeoNames 没有与 Seberang Perai、Kuching North、Kuching South 法定管辖单位一一对应的城市记录，这三项使用官方目录坐标并留空 GeoNames 标识，避免误绑到辖区内单一聚居点。

## 新加坡城市点

`sources/sg-city-state-2026-09-06.csv` 只收录新加坡一个城市国家级入口。新加坡外交部将其明确表述为 `city-state`：<https://www.mfa.gov.sg/about-singapore/>；城市规划使用的区域、规划区和分区是土地规划单元，不作为独立法定城市重复列入。稳定 ID 使用 ISO 3166-1 国家代码 `SG`。

中心点与 GeoNames 标识取自 2026-09-06 下载的 GeoNames 新加坡国家数据快照，按 CC BY 4.0 使用：<https://www.geonames.org/export/>；下载压缩包 SHA-256 为 `3DBBB2ACD8DD924F90DD5179B3444EA1FC0229D708BDBE08DC80000A26771A52`。

## 文莱城市点

`sources/bn-municipal-areas-2026-09-06.csv` 收录文莱《Municipal Boards Act》（Cap. 57）下划定的 4 个法定市政辖区：Bandar Seri Begawan、Kuala Belait、Seria 和 Tutong。文莱总检察署现行附属法例目录分别列有首都、Kuala Belait 与 Seria、Tutong 的市政委员会及其边界文件：<https://www.agc.gov.bn/SitePages/MUNICIPAL%2520BOARDS%2520ACT%2520-%2520SL.aspx>；Kuala Belait 与 Seria 虽由同一市政部门管理，官方说明明确保留两个市政委员会和两个市政辖区：<https://www.bandaran-kb.gov.bn/perkhidmatan/>。Bangar 等其他 `pekan` 没有纳入该法定市政体系，因此不按普通地名补入。

稳定 ID 使用长期通行的市政简称或规范化名称。中心点与 GeoNames 标识取自 2026-09-06 下载的 GeoNames 文莱国家数据快照，按 CC BY 4.0 使用：<https://www.geonames.org/export/>；下载压缩包 SHA-256 为 `E025A22E0D0D8352C9A29500DC75F4B9F4079D7E4B13FD139D291D5706E80E7E`。

## 柬埔寨城市点

`sources/kh-official-municipalities-2026-09-06.csv` 按柬埔寨国家地方民主发展委员会（NCDD）在线 Gazetteer 的现行行政区划收录 33 个 `Krong`（Municipality），并单列金边特别首都，共 34 个城市入口；不包含 163 个 District，也不把金边 14 个 Khan 或普通 Commune、Sangkat、Village 作为城市重复收录。现行清单、代码和层级均取自官方 Gazetteer：<https://db.ncdd.gov.kh/gazetteer/view/index.castle>；稳定 ID 使用其省级代码 `12` 或四位 Municipality 代码。

27 个既有城市中心点与 GeoNames 标识取自 2026-09-06 下载的 GeoNames 柬埔寨国家数据快照，按 CC BY 4.0 使用：<https://www.geonames.org/export/>；下载压缩包 SHA-256 为 `24A6D6DA9F4292A3D43862D6176636302738B0E8AE8E879FAFFBB0D57C066F61`。Odongk Maechay、Bokor、Sampeou Poun、Akreiy Ksatr 和 Kaoh Rung 使用柬埔寨国土规划与建设部 2023 Gazetteer PDF 公布的市级中心坐标；Run Ta Aek Techo Sen 在 2024 年建市，使用该 PDF 中同名核心行政区 Run Ta Aek 的中心坐标。Kampong Soam 是由 Ream、Bet Trang、Ou Oknha Heng、Boeng Ta Prum 和 Ou Chrov 五个行政区新设的城市，数据点取这五个官方行政区中心的算术平均值。上述 7 项留空 GeoNames 标识，避免绑定到旧县、单一村庄或同名岛屿；官方坐标文件：<https://asset.cambodia.gov.kh/mlmupc/wp-content/uploads/2023/10/Gazetteer-of-Cambodia-2.pdf>。

## 老挝城市点

`sources/la-official-cities-2026-09-06.csv` 收录万象首都和老挝现行 3 个正式 `ນະຄອນ` 城市，共 4 个入口。老挝总理于 2018 年批准将琅勃拉邦、凯山·丰威汉和巴色三个县级行政体升级为城市，官方通讯社公告：<https://kpl.gov.la/EN/detail.aspx?id=33983>；老挝政府第十个国家社会经济发展五年计划仍使用“Vientiane Capital, 3 cities”的现行口径：<https://rtm.org.la/wp-content/uploads/2025/11/10th_NSEDP_10112025_Eng.CLN1_.pdf>。塔凯克、万荣及其他省会、县治和普通城镇不因英文资料中的泛称 `city` 自动纳入。

稳定 ID 使用老挝官方行政代码：万象首都使用省级代码 `01`，三个城市沿用升级前后不变的县级代码 `0601`、`1301` 和 `1601`。代码目录可由老挝贸易门户公布的部级决定复核：<https://laotradeportal.gov.la/en-gb/site/display/674>。中心点与 GeoNames 标识取自 2026-09-06 下载的 GeoNames 老挝国家数据快照，按 CC BY 4.0 使用：<https://www.geonames.org/export/>；下载压缩包 SHA-256 为 `97983335A0835F6F46C11D72D0A85D49E039074CC144F6B417C22D5A5A98F99B`。

## 缅甸城市点

`sources/mm-city-development-areas-2026-09-06.csv` 收录缅甸国家门户当前单列的 3 个城市发展辖区：内比都、仰光和曼德勒。国家门户的政府机构目录同时列出 Naypyitaw、Yangon、Mandalay 三个 City Development Committee：<https://myanmar.gov.mm/government-website>；仰光城市发展法也明确其委员会管辖 `City of Yangon Municipality` 的法定边界。其余 330 个 Township、普通 Town 及地方 Development Affairs 管辖区不因聚居地名称或英文泛称 `city` 纳入本批。

稳定 ID 使用三个法定机构长期通行的官方简称 `NPTDC`、`YCDC`、`MCDC`，避免未来区县边界调整造成 ID 重排。中心点与 GeoNames 标识取自 2026-09-06 下载的 GeoNames 缅甸国家数据快照，按 CC BY 4.0 使用：<https://www.geonames.org/export/>；下载压缩包 SHA-256 为 `FC711D9BCC1F43DB60E0C2C36C07B743AD7D0E3AA7F6C4980B1710F4694AD156`。

## 东帝汶城市点

`sources/tl-capital-city-2026-09-06.csv` 只收录东帝汶国家首都城市帝力。东帝汶政府行政区划说明明确称其首都为 `the city of Dili`：<https://timor-leste.gov.tl/?lang=en&p=91>；同一官方口径将 Aileu、Baucau、Covalima 等列为 Municipality，并把各自驻地称为 Municipality Capital，因此不把这些一级行政区或普通驻地重复视为法定城市。

帝力城市没有独立于同名 Municipality 的全国统一城市代码，稳定 ID 使用规范化官方名称 `DILI`。中心点与 GeoNames 标识取自 2026-09-06 下载的 GeoNames 东帝汶国家数据快照，按 CC BY 4.0 使用：<https://www.geonames.org/export/>；下载压缩包 SHA-256 为 `3DF62836BF2A66E4AF57EACF62696C98A552E7A8457DC2F0D386A89CA3A87A25`。

## 马尔代夫城市点

`sources/mv-city-councils-2026-09-06.csv` 收录马尔代夫《地方分权法》下现行 5 个 City Council：Male、Addu、Fuvahmulah、Kulhudhuffushi 和 Thinadhoo。地方政府管理局当前目录统计为 5 个 City Council：<https://www.lga.gov.mv/en/councils>；总统府 2023 年授予 Thinadhoo 城市地位的公告同时确认全国城市数增至 5：<https://presidency.gov.mv/Press/Article/28841>。178 个 Island Council 及 Atoll Council 不作为城市入口。

全国没有供这 5 个 City Council 统一复用的城市代码，稳定 ID 使用规范化官方城市名。中心点与 GeoNames 标识取自 2026-09-06 下载的 GeoNames 马尔代夫国家数据快照，按 CC BY 4.0 使用：<https://www.geonames.org/export/>；下载压缩包 SHA-256 为 `0ABB3BB889545F7D781EF038D0DF4307F91EF9AA7CCFE11B27ADB8E7EB1838B0`。Addu City 跨多个岛屿，使用官方登记的市议会驻地 Hithadhoo 城市中心点：<https://www.tourism.gov.mv/en/page/homestay_permitted_councils>。

## 不丹城市点

`sources/bt-autonomous-thromdes-2026-09-06.csv` 收录不丹当前 4 个具独立民选 Thromde Tshogde 的城市自治体：Thimphu、Phuentsholing、Gelephu 和 Samdrup Jongkhar。不丹内政部地方治理部门的现行说明明确将地方政府中的 Thromde Tshogde 数量列为 4：<https://www.dlgdm.gov.bt/dlg-faq>；内政部人口登记部门的 Thromde 办公室目录逐项列出同一 4 个单位：<https://dcrc.moha.gov.bt/index.php/dzongkhag-office/>。其他 Dzongkhag Thromde、Yenlag Thromde 和县城规划边界没有作为独立城市自治体重复纳入。

全国没有统一公开的 Thromde 代码目录，稳定 ID 使用规范化官方名称。中心点与 GeoNames 标识取自 2026-09-06 下载的 GeoNames 不丹国家数据快照，按 CC BY 4.0 使用：<https://www.geonames.org/export/>；下载压缩包 SHA-256 为 `66925274ED081FAC2D265A19CD45CD9878E20B5BE232F0EC7BFBFB4FD3743A06`。

## 斯里兰卡城市点

`sources/lk-municipal-councils-2026-09-06.csv` 收录斯里兰卡现行 29 个 Municipal Council；不包含 36 个 Urban Council 和 276 个 Pradeshiya Sabha。名单与各区数量按斯里兰卡统计局截至 2024-08-01 的官方行政区划表核对：<https://www.statistics.gov.lk/Publication/PocketBook2025>。其中 Kalutara、Vavuniya、Trincomalee、Puttalam 和 Kegalle 依据第 2296/05、2296/37 号公报自 2023-02-20 由 Urban Council 升格；2025 年地方选举结果页仍保留部分旧类别标签，且未列入没有参加该次选举的 Kalmunai，因此只用于逐项复核地方政府名称，不覆盖统计局的现行法定分类：<https://elections.gov.lk/Pages/2025/LAE_2025_Results.html>。

当前官方公开表没有提供可复用的全国 Municipal Council 代码，本批稳定 ID 使用规范化官方英文名称，后续新增或改制不重排既有 ID。中心点与 GeoNames 标识取自 2026-09-06 下载的 GeoNames 斯里兰卡国家数据快照，按 CC BY 4.0 使用：<https://www.geonames.org/export/>；下载压缩包 SHA-256 为 `34CC6412A53EB48491B91E1FD11299B00C0D709C54FC65170BD4E283050C14B1`。Dehiwala-Mount Lavinia 使用其 Dehiwala 城市中心点；没有对应攻略的城市统一显示为“尚未收录”。

## 尼泊尔城市点

`sources/np-urban-municipalities-2026-09-06.csv` 收录尼泊尔 293 个城市型地方政府：6 个 Metropolitan City、11 个 Sub-Metropolitan City 和 276 个 Municipality；460 个 Gaunpalika（农村 Municipality）不纳入城市入口。数量与分类依据尼泊尔联邦事务与总务部现行说明复核：<https://mofaga.gov.np/local-contact>。名称和稳定 ID 直接使用尼泊尔国家统计局 753 个地方政府代码表中的官方英文名及五位 Local Level Code：<https://ec.nsonepal.gov.np/html/admin_code.html>；2026-09-06 页面快照 SHA-256 为 `C7EEEFDAF7CD03CB797E54BB1C1CB6E8ECDD4B5A204919166B573663D442CE61`。

城市点由 `scripts/import-nepal-city-centers.mjs` 将上述 293 个官方单位逐区匹配到 Open Knowledge Nepal 的 WGS84 地方政府边界，并计算保证落在各自辖区内的几何代表点：<https://localboundries.oknp.org/download/>。边界项目按 CC BY 4.0 发布并说明其行政资料来源包含尼泊尔 Survey Department / National Geoportal；本次边界快照 SHA-256 为 `CCB2C0EE43EB997AF724DF65B3C262C9DAE441E8983448A812AFC053087B97B2`。导入器固定校验两个快照哈希、官方总数、三级城市数量、一一匹配和名称距离；不使用 GeoNames 标识，避免把新合并或同名 Municipality 误绑到普通聚居点。没有对应攻略的城市统一显示为“尚未收录”。

## 孟加拉国城市点

`sources/bd-urban-local-bodies-2026-09-06.csv` 收录孟加拉国现行 340 个城市级地方机构：13 个 City Corporation，以及 327 个 Pourashava（182 个 A 类、104 个 B 类、41 个 C 类）；Upazila 和 Union 不作为城市入口。基础名单及等级取自地方政府工程局发布的 328 个 Pourashava、12 个 City Corporation 逐项清单：<https://oldweb.lged.gov.bd/uploadeddocument/unitpublication/10/1142/Paura%20List.pdf>，本次 PDF 快照 SHA-256 为 `2A7C8FBFDDD9603F1D00EB17D882786C5B068AECC54A7A8BE1A7C3E5459F2AFA`。

2026-05-14 发布的公报已将 Bogura Pourashava 改制为 Bogura City Corporation，因此生成时移除旧 Pourashava 条目并加入其法定继承单位；地方政府司现行全国目录也已列出 13 个 City Corporation：<https://lgd.gov.bd/pages/static-pages/69414020c4774958d7b54af5>。Bogura 的设立边界与管理人任命公报分别见：<https://www.dpp.gov.bd/bgpress/index.php/document/get_extraordinary/61652>、<https://www.dpp.gov.bd/bgpress/index.php/document/get_extraordinary/61653>。这样既不会重复显示 Bogura，也保留全国 340 个城市型地方机构的现行总数。

官方名单没有提供可覆盖全部现行单位、且能直接复用的统一城市代码，稳定 ID 使用“区名 + 官方英文名称 + 机构类型”的规范化组合，后续新增或改制不重排既有条目。`scripts/import-bangladesh-city-centers.py` 固定校验官方 PDF 与 GeoNames 快照哈希、分类数量、唯一 ID、唯一 GeoNames 标识和坐标国界范围；GeoNames 2026-09-06 国家数据快照按 CC BY 4.0 使用：<https://www.geonames.org/export/>，压缩包 SHA-256 为 `C5FAFB3EB4297E521255056EF6D6E4F27C07AD0E66856A1FBBAD8D81823C9830`，解压文本 SHA-256 为 `04D29E3DB226675E5E29A5D83A1A36271B610C311BB078326EF93012E0F79A74`。

少数官方拼写无法自动可靠对应 GeoNames：Baroiyarhat 使用孟加拉国 Urban Development Directorate 城市规划勘测点：<https://mudp.gov.bd/documents/reports/pk2_Geophysical_investigation_report_Final.PDF>；Keshorhat 使用 OpenStreetMap 中标注为“কেশরহাট পৌরসভা ভবন”的市政府建筑中心点，并与市政府官网所列 Mohanpur、Rajshahi 位置交叉核对：<https://www.openstreetmap.org/way/529370752>、<https://www.keshorhatpourashava.gov.bd/InstituteInfo/DetailsInfo>；Dhaka North 使用该 City Corporation 的区域代表点，与使用 Dhaka 主城中心点的 Dhaka South 分开显示：<https://www.wikidata.org/wiki/Q5268748>。没有对应攻略的城市统一显示为“尚未收录”。

## 阿富汗城市点

`sources/af-provincial-municipalities-2026-09-06.csv` 收录阿富汗 34 个省级 Municipality，每省一个；Kabul 单列为首都 Municipality。阿富汗 Municipality 体系还包括设在部分 District 中的 district/rural Municipality：IDLG 的正式口径曾列为 34 个省级 Municipality 加 119 个 district Municipality，共 153 个：<https://uclg-mewa.org/wp-content/uploads/2023/01/Local_Goverments_in_Middle_East_and_West_Asia.pdf>。本批按全球清单的“地级城市”口径，只纳入覆盖全部一级行政区、层级稳定的 34 个省级 Municipality，不把兼具城乡性质且名单持续变化的 district/rural Municipality 当作同级城市重复加入。现行政府仍在审议新的 Municipalities Law，后续法律正式替换旧制时再按同一稳定 ID 迁移：<https://arg.gov.af/en/post_details/news/eyJpdiI6ImxxektIUExlQVhSZXZWbGpRSCtHRGc9PSIsInZhbHVlIjoiZ2taVnppMHhLMW9IakVMWExvR1l1QT09IiwibWFjIjoiNDJmOTBjMjI3MDkxNjBmMzhkZWI2YmRhNzRhZGNkNmNjYTU3YmYyNGEzYjdiNWJkNDZjZTJhODUzZDcxNWU1YiJ9>。

`scripts/import-afghanistan-provincial-municipalities.mjs` 从 GeoNames 中逐一读取 33 个 `PPLA` 省会与 1 个 `PPLC` 首都，固定校验 34 个省级入口、唯一省份和唯一稳定 ID。全国没有公开统一的 Municipality 代码目录，因此稳定 ID 复用 GeoNames 标识；2026-09-06 国家数据快照按 CC BY 4.0 使用：<https://www.geonames.org/export/>，压缩包 SHA-256 为 `FF6A991DAF4B1349209228E234A82FE97EF946DA158B426C6985632ABF03EB87`，解压文本 SHA-256 为 `3769309D6CABF3CC7B53075A7C5028F99ADBAC9A6DF6059345050FD714E8A112`。Kapisa 的入口沿用同一 GeoNames 中心点，但显示官方现行省会名 `Mahmud-i-Raqi`，并以阿富汗国家门户的省份资料复核：<https://afghanistan.af/wolayat/kapisa>。没有对应攻略的城市统一显示为“尚未收录”。

## 巴基斯坦城市点

`sources/pk-municipal-cities-2023.csv` 从巴基斯坦统计局 2023 人口普查 Table 2 的 657 个官方 `urban locality` 分段中，收录 337 个城市级市政机构：8 个 Metropolitan Corporation、21 个 Municipal Corporation、7 个 District Municipal Corporation 和 301 个 Municipal Committee。Town Committee 属镇级机构，Cantonment Board 属国防部管理的特殊军事辖区，均不作为本批地级城市入口；同一市政机构被普查表按 Tehsil、Sub-Division 拆开的分段只生成一个入口。官方全国报告说明 urban locality 按各省和地方政府通知确定，并确认全国总数为 657；逐项表格来自统计局 Census 2023 结果页：<https://www.pbs.gov.pk/result-excel/>、<https://www.pbs.gov.pk/wp-content/uploads/2020/07/table_2_national.xlsx>。本次 Excel 快照 SHA-256 为 `F36A8DC0E077CA6A5C3CF232325A35929588E8651B0F6046AAA3C5D7F6EF9F29`。

官方表没有可覆盖全部市政机构的统一代码，稳定 ID 使用“区名 + 官方英文名称 + 机构类型”的规范化组合，后续改制不重排现有入口。`scripts/import-pakistan-municipal-cities.py` 固定校验官方表与 GeoNames 快照哈希、657 个原始分段、四级机构数量、唯一稳定 ID、唯一中心点和国界范围；GeoNames 2026-09-06 国家数据快照按 CC BY 4.0 使用：<https://www.geonames.org/export/>，压缩包 SHA-256 为 `D3681649649AC34B2E8AE650EDB01EC262DAC76B3F163909A91A98763E4375CA`，解压文本 SHA-256 为 `D1D4D4C882C990F1D61C240B02BAFB2E92C5B45DDE64331CFD26E0D5BCA51573`；生成 CSV SHA-256 为 `13D25C3212AEA45E4622E61A1B6583CC95A856B99EF849C749C8AE0CDCDEB574`。

少数新设区、旧拼写和市政边界在 GeoNames 中仍沿用原所属区，导入器对这些中心点逐项固定，避免跨区模糊匹配。GeoNames 尚无现代 Farooqabad（旧称 Chuhar Kana）的城市记录，因此该项使用 OpenStreetMap 的 `place=city` 节点中心点：<https://www.openstreetmap.org/node/2421644170>；Tasp 使用 GeoNames 独立城区记录 `11221164`，不复用相邻 Panjgur 主城中心。没有对应攻略的城市统一显示为“尚未收录”。

## 印度城市点

`sources/in-municipal-cities-2026-09-05.csv` 收录印度现行 2,321 个城市级自治体：268 个 Municipal Corporation、1,986 个 Municipality、66 个 City Municipal Council，以及单列的 New Delhi Municipal Council。基础名单来自印度地方政府目录（LGD）截至 2026-09-05 的 5,050 个 Urban Local Body 快照；本批保留类型代码 4、5、21、24，排除 166 个 Notified Area、2,420 个 Town Panchayat 和 118 个 Town Municipal Council，以维持“正式城市自治体、不把镇级过渡机构全部铺开”的全球口径。LGD 当前数据目录见：<https://lgdirectory.gov.in/>、<https://www.data.gov.in/catalog/local-government-directory-lgd>。名单快照 SHA-256 为 `A176B29B39A086653377952EC08AF18A0B43B47E21358F5DAC5BCF1F5E8084DA`，行政区覆盖快照 SHA-256 为 `ABB6F164FB6C9B9BB6649F5914CB0381C33CDD535E805A0D96C365D232FB9AFD`。

生成时按现行法修正两组尚未完全同步到中央目录的撤并记录：Delhi 的 3 个旧 Municipal Corporation 以 2022 年合并后的 Municipal Corporation of Delhi 替代；Telangana 的快照已加入 2026-02-11 成立的 Cyberabad、Malkajgiri 两个 Municipal Corporation，却仍保留 23 个已于 2025-12 并入扩展 GHMC 的旧自治体，因此删除这 23 条，不重复显示。Telangana 关于三个现行法人立即生效的 2026-02-11 政府令见：<https://ipass.telangana.gov.in/viewpdf.aspx?enc=olSBrXl6rl1gh1Zl%2FgAtCGca%2FCR3RYtQYOLxLKxZ5D0Ad9wcJJ0ayrbjsrCqAWCo8AUo4WjhZbPYwe4uV4i5KGJk7GH9uz5rqknOneMdIFKaAC7CQA3zaQGb4VGigy2MUR4X79w1VckVoKwXiOlFqmfQ5lSQCgJG4wWymgV70D1tAhOIrFsZZYkgSg7IjFUK1lEN5sd%2FCDiv0i+0br46rusNv1cKG1zsyK7Ja+yZXWs%3D>。

稳定 ID 直接使用 LGD `Local Body Code`；合并后的 Delhi 使用保留值 `MCD`，不会因名单排序改变。`scripts/import-india-municipal-cities.py` 固定校验全部输入哈希、LGD 七类原始数量、最终四类数量、唯一稳定 ID、唯一 GeoNames 标识、唯一中心坐标和印度国界范围。中心点优先使用带 LGD 代码属性的 Wikidata 项（查询结果 2026-09-06 快照 SHA-256 为 `E9C7265DE004B18E495A4F99425CA49A601F3092599B5D0347E1BB114A232C1A`），其余通过行政区约束匹配 GeoNames，并只对低置信条目使用 Nominatim 二次复核（缓存快照 SHA-256 为 `FE8F4B23765BB0E2C1C1A46C9325F91C1ECA0BD32DC19104D8181E69B0EBCDBF`）。GeoNames 2026-09-06 国家数据快照按 CC BY 4.0 使用：<https://www.geonames.org/export/>，压缩包 SHA-256 为 `7318D308AE76A52F04F8B9742C1CF711D208EDB1B0A4B660897B4F1CF7B4EE94`，解压文本 SHA-256 为 `3685B3E00AA99B607D0B9B1465B348E231835654FA3C225983F13E49668B07FC`；生成 CSV SHA-256 为 `8AE7644A8A1319B7BBD074FCF6535BBAC8BCD983DE1EDF249DE97156E0A21A9A`。没有对应攻略的城市统一显示为“尚未收录”。

## 哈萨克斯坦城市点

`sources/kz-kato-cities-2026-07-17.csv` 按哈萨克斯坦国家统计局现行 KATO 分类器收录全部 90 个法定城市：3 个共和国直属城市、39 个州级城市和 48 个区级城市；不包含 29 个镇，也不把 `г.а.` 标记的城市行政区或其下属村镇重复作为城市。国家统计局截至 2026-07-01 的行政区划汇总同样列出 90 个城市及上述三级数量：<https://stat.gov.kz/ru/industries/socialstatistics/demography/publications/335821/>；KATO 分类器页面及 2026-07-17 快照：<https://stat.gov.kz/ru/classifiers/statistical/21/>。稳定 ID 直接使用 KATO 九位代码，官方 Excel 快照 SHA-256 为 `5346ADE0EC37A5A6F6B186E626527A17685121EB73B57152AA09E7F370FCFF09`。

`scripts/import-kazakhstan-kato-cities.py` 固定校验 KATO 与 GeoNames 快照哈希、90 个城市、三级数量、唯一稳定 ID、唯一中心点和国界范围，并按州代码约束同名地点。中心点与 GeoNames 标识取自 2026-09-06 下载的国家数据快照，按 CC BY 4.0 使用：<https://www.geonames.org/export/>；解压文本 SHA-256 为 `15F639EB644F3AB62312DB175B84091EC8A6433324EC8E3E90E0E4C0EBAB01EB`。2024 年围绕原 Zhetigen 新设的 Alatau、特殊地位的 Baikonur，以及当前拼写为 Qosshy、Sarqan 的城市使用固定映射，避免绑定同名地点；GeoNames 尚无 Zhem 城市记录，因此使用阿克托别州土地主管部门公布的城市坐标并留空 GeoNames 标识：<https://www.gov.kz/memleket/entities/aktobe-zher-paidalanuy/press/article/details/208526>。生成 CSV SHA-256 为 `34330036ECFB0B0C1449B47A1BD905AA8D5FD1EB5D23829A8EEB9642ECEEEB12`；没有对应攻略的城市统一显示为“尚未收录”。

## 吉尔吉斯斯坦城市点

`sources/kg-soate-cities-2025-10.csv` 按吉尔吉斯斯坦国家统计委员会现行 GK 003-2025 SOATE 分类器附录 2 收录全部 34 个法定城市：2 个共和国直属城市、14 个州级城市和 18 个区级城市。该官方分类器自 2025-06-12 实施，并已纳入 2025 年修订；PDF 快照 SHA-256 为 `0B2178EDCDB79F0E257DDAE6AFA7DF4F55E85E3BF5BA77D18C4589940C7800DD`：<https://www.stat.gov.kg/media/files/8d597c5c-6d6d-454c-91fd-5bfaf1bb729d.pdf>。清单已反映 Jalal-Abad 改名 Manas，以及 Gulcho 升格为区级城市的现行法律状态：<https://president.kg/ru/news/21/39594>、<https://president.kg/ru/news/21/39692>。稳定 ID 使用附录公布的 14 位 SOATE 代码，村庄和其他 territorial unit 不纳入。

`scripts/import-kyrgyzstan-soate-cities.py` 固定校验官方 PDF、GeoNames 快照哈希、34 个城市、三级数量、唯一稳定 ID、唯一中心点和国界范围，并按州约束重名地点。中心点与 GeoNames 标识取自 2026-09-06 下载的国家数据快照，按 CC BY 4.0 使用：<https://www.geonames.org/export/>；压缩包 SHA-256 为 `E29AB9BB37723EF60FDFEBCAB3B521687D84EC3B454D166EB7E9C9AE67E2DDC0`，解压文本 SHA-256 为 `46F974ED681830E83B5660BBCA64E35FF6C98AA6CE4921DCE593C38FE4E4D6B5`。Manas 沿用同一城市更名前的 Jalal-Abad 中心点，Gulcho 对应 GeoNames 中旧拼写 Gulcha；生成 CSV SHA-256 为 `6E8E5FB696E98DC9CE22588AF27E1F0D141C64505FEEC74572F6CD41045D2181`。没有对应攻略的城市统一显示为“尚未收录”。

## 塔吉克斯坦城市点

`sources/tj-statutory-cities-2025.csv` 按塔吉克斯坦总统直属统计局截至 2025-01-01 的行政区划表收录全部 18 个法定城市；不包含 68 个镇或城市内部 4 个区。官方人口汇编的全国汇总明确列出 47 个区、18 个城市、68 个镇和 366 个乡级 Jamoat：<https://www.stat.tj/wp-content/uploads/2025/12/machmuai-shumorai-aholi-to-1.01.2025.pdf>；本次 PDF 快照 SHA-256 为 `A17B41044EA3459E5D2833F66FECFC01D725C8FBE7F8275B5F9E6A2B09AC4665`。清单使用现行名称 Bokhtar、Levakant、Hisor、Istiqlol、Guliston 和 Buston，不保留已废止的 Soviet-era 城市名。

官方统计表没有公布可复用的全国城市代码，因此稳定 ID 使用对应 GeoNames 标识。`scripts/import-tajikistan-statutory-cities.mjs` 固定校验官方 PDF、18 城清单、GeoNames 快照哈希、唯一 ID、唯一中心点和国界范围；GeoNames 2026-09-06 国家数据快照按 CC BY 4.0 使用：<https://www.geonames.org/export/>，压缩包 SHA-256 为 `361FF215B46A3C5EBF6E82EE3AB24D0A812FC3F8704A3A164B8D921FC2F63B7A`，解压文本 SHA-256 为 `E6C078F5D4BA9CE12A5EED70C7757C418CC7B8E758DC16F94DF49C0539FEB1B8`。Guliston 沿用同一城市旧名 Qayroqqum 的中心记录；生成 CSV SHA-256 为 `771DCFF8C559D5D704A197B4537BD9E58D87C899FA50D9013CBFA0F68CC95E76`。没有对应攻略的城市统一显示为“尚未收录”。

## 乌兹别克斯坦城市点

`sources/uz-soato-cities-2026-06-12.csv` 收录乌兹别克斯坦现行全部 120 个法定城市：以 SOATO 2017 明细中的 119 城为基线，再按官方 SIAT 现行序列应用 Nurafshon、Ohangaron、Yangiyo‘l 的升格换码及 2020 年新增 Gʻozgʻon。SIAT “Cities”指标定义、地区层级和 2026 年全国 120 城总数见：<https://siat.stat.uz/data/290/?lang=en>；官方 CSV 快照 SHA-256 为 `064B72C9C05E28FFAA902DD35FA982B613AC6D120B557E255EBF5AF3C5219487`。SOATO 明细转录页来自 NRM，页面快照 SHA-256 为 `E8D4D41C7EA6B082090A6FE70C05E8C1BF2A90176193D781223075F931FAB0C6`：<https://nrm.uz/contentf?doc=395915_soato_%28sistema_oboznacheniya_administrativno-territorialnyh_obrazovaniy%29&products=1_vse_zakonodatelstvo_uzbekistana>。

稳定 ID 使用当前 SOATO 代码；`scripts/import-uzbekistan-soato-cities.py` 固定校验输入哈希、2017 年 27 个直属城市与 91 个区属城市、当前 14 个地区计数、120 个唯一城市、32 个现行直属/共和国城市代码、唯一中心点和国界范围。中心点与 GeoNames 标识取自 2026-09-06 下载的国家数据快照，按 CC BY 4.0 使用：<https://www.geonames.org/export/>；压缩包 SHA-256 为 `CE796486A7DD26A92CF22C391DB9AA9C2E1982F216A55172D3A077877F524BC2`，解压文本 SHA-256 为 `139865976D1228BB0C16579F50CDF08346726B528907945311797BC6987B8F4F`，生成 CSV SHA-256 为 `94E428FFA6379CB7371DC55862A0F4D7506314563BB9CF569249903AFA333B6A`。不纳入城镇、村庄或城市内部行政区；没有对应攻略的城市统一显示为“尚未收录”。

## 土库曼斯坦城市点

`sources/tm-statutory-cities-2026-09-06.csv` 收录土库曼斯坦现行全部 50 个法定城市：1 个具有州权的首都、1 个国家重要城市 Arkadag、6 个具有区权的城市和 42 个区内城市。土库曼斯坦议会当前行政区划页面明确公布上述总数与层级构成：<https://mejlis.gov.tm/turkmenistan/general-information?lang=ru>；逐城名称以 2022 年人口普查行政地域表为基线：<https://stat.gov.tm/population-census-pdfs/results/en/1.pdf>，并按议会 2025 年第 171-VII 号决议复核 Altyn asyr、Andalyp、Gubadag、Dostluk、Farap、Garabekewül 和 Şatlyk 等城市的现行归属：<https://mejlis.gov.tm/single-decree/472?lang=ru>。不把 71 个城镇、城市内部 7 个区、村庄或 geňeşlik 重复作为城市。

官方公开清单没有提供可复用的全国城市代码，因此稳定 ID 使用对应 GeoNames 标识。`scripts/import-turkmenistan-statutory-cities.py` 固定校验 50 城及四级数量、唯一名称、唯一 ID、唯一中心点和国界范围。中心点来自 2026-09-06 下载的 GeoNames 国家数据快照，按 CC BY 4.0 使用：<https://www.geonames.org/export/>；压缩包 SHA-256 为 `FEDD754C28450629CC3F11CE3CC9AB0F7552DCBC5BB3D1DA59B05919A1B96C3B`，解压文本 SHA-256 为 `0473C102550AAD307C6D660718DF4BA07D34D97B50597560DF9E807114C5B9A7`，生成 CSV SHA-256 为 `82CAE97A48D0F7B861500AF99AFC7E85DFC94404970786A80B249F960CE9707B`。Şabat、Seýdi、Sakarçäge 固定到其现行城市中心，避免沿用 GeoNames 的空白或旧州归属；没有对应攻略的城市统一显示为“尚未收录”。

## 亚美尼亚城市点

`sources/am-statutory-cities-2026-09-06.csv` 按亚美尼亚现行《行政区域划分法》附件 2 收录 48 个标注为 `քաղաք` 的法定城市，并单列首都 Yerevan，共 49 城。现行法律及完整社区、居民点附件见：<https://www.arlis.am/hy/acts/209495/latest>；本次官方 HTML 快照 SHA-256 为 `A5C9DBF418C3AF4D3395BEFFE848D4B4E6952D884ED76EAA203C6085FFE67040`。清单以现行法条为准，包含 Shamlugh、Agarak 和 Dastakert，不沿用仍只列 46 城的旧版统计清单；不把合并后的多居民点社区整体重复作为城市，也不纳入村庄。

法律附件没有公布可复用的城市代码，因此稳定 ID 使用对应 GeoNames 标识。`scripts/import-armenia-statutory-cities.py` 直接从固定法律快照复核全部 48 个亚美尼亚文城市名，并校验 49 个唯一城市、唯一 ID、唯一中心点和国界范围。中心点来自 2026-09-06 下载的 GeoNames 国家数据快照，按 CC BY 4.0 使用：<https://www.geonames.org/export/>；压缩包 SHA-256 为 `D2141F51F6937D8852A15148E21E1DB9C69DC6080B8722A3DCF9469483A0B13A`，解压文本 SHA-256 为 `B71FF40F3520FEF61F11B874E19C1D9567348489E3FAD625681E2D58611BDA75`，生成 CSV SHA-256 为 `63EE18F837B9ADD342E9D6512FECF7A4C81748CD852B7ACEBE85AA44EC4D29EE`。没有对应攻略的城市统一显示为“尚未收录”。

## 阿塞拜疆城市点

`sources/az-statutory-cities-2026-09-06.csv` 收录阿塞拜疆现行全部 79 个法定城市，包括 11 个共和国直属城市或自治共和国首府层级城市、68 个区属城市。逐城名称与法定层级依据国家统计委员会 2024 年《行政区域划分分类器》：<https://stat.gov.az/menu/5/classifications/source/Inzibati-1.05.2024.pdf>；分类器明确以八位编码末位 `2` 表示共和国直属城市、`4` 表示区属城市。国家统计委员会最新 2025 年行政区划工作簿独立核对全国总数为 79，同时列出 12 个市辖区和 263 个城镇型居民点，后二者均不作为城市重复纳入：<https://www.stat.gov.az/source/demoqraphy/ap/az/2_5.xls>。本次官方 Excel 快照 SHA-256 为 `88593D2C4FE8C4338D32B025BFA66A21F75BB5B6D11EDC7954D005C26C75CD6B`。

官方分类器没有为地图中心点提供坐标，稳定 ID 因此使用对应 GeoNames 标识。`scripts/import-azerbaijan-statutory-cities.py` 固定校验官方工作簿与 GeoNames 快照哈希、79 城及两级数量、唯一 ID、唯一中心点和国界范围；中心点来自 2026-09-06 下载的 GeoNames 国家数据快照，按 CC BY 4.0 使用：<https://www.geonames.org/export/>，压缩包 SHA-256 为 `0FBABA2C25F75D66535A4F09F60403EA34FE9FE1B89CDB566CF2627F8CC128C3`，解压文本 SHA-256 为 `B695685D6A41C074381D581433E78CB5B25569F9AF9C6BFD4C541FD25841D5C0`，生成 CSV SHA-256 为 `7AFAB16208DA81ACEF9C8B3AB605E2B1DE0F02E179E40D47B6B9F95F2C94AC9C`。Gobustan 固定为原名 Maraza 的区治中心，Liman 固定为里海南岸原 Port-Ilich 城市，避免绑定到国内同名居民点；没有对应攻略的城市统一显示为“尚未收录”。

## 格鲁吉亚城市点

`sources/ge-statutory-cities-2026-09-06.csv` 收录格鲁吉亚现行 63 个法定城市：5 个自治市、政府实际管辖区内的另外 50 个城市，以及法律与官方统计城市序列中位于未实际管辖地区的 8 个城市。政府实际管辖区的 55 城逐城取自国家统计局 2024 年人口普查最终行政地域工作簿：<https://www.geostat.ge/en/modules/categories/909/the-geographical-distribution-of-the-population-and-internal-migration>，本次官方 Excel 快照 SHA-256 为 `D6348F94CB4827C4C9433F3EE5820EC35DC016254316AE65EB07FE923EDC0DE1`。国家统计局年鉴把 New Athos、Gagra、Gali、Gudauta、Ochamchire、Sokhumi、Tkvarcheli 和 Tskhinvali 列在 `Cities` 而非 `Urban type settlements` 下：<https://geostat.ge/media/20935/Yearbook_2014.pdf>；现行《地方自治法典》定义城市与小城镇为不同聚居地类别，并确认当前 5 个自治市为 Tbilisi、Rustavi、Kutaisi、Poti 和 Batumi：<https://www.matsne.gov.ge/en/document/view/2244429?publication=63>。因此不纳入 borough / daba、村庄、城市内部行政区或多个聚居地组成的自治市整体。

官方工作簿没有为地图中心点提供坐标，也不公开当前内部行政地域分类的可复用城市代码，因此稳定 ID 使用对应 GeoNames 标识。`scripts/import-georgia-statutory-cities.py` 固定校验官方工作簿与 GeoNames 快照哈希、55 城原始顺序、63 城及三级数量、唯一名称、唯一 ID、唯一中心点和国界范围。中心点来自 2026-09-06 下载的 GeoNames 国家数据快照，按 CC BY 4.0 使用：<https://www.geonames.org/export/>；压缩包 SHA-256 为 `2AF7C3CE99A740E95191C374FE619B9809B5E9F3378340E17DABB3E27D9AFB56`，解压文本 SHA-256 为 `C931624C25587EEECA8ABB6490C572122C85188B5DDD765F5B1589E967F816B7`，生成 CSV SHA-256 为 `C58DC6212D90153A7813B1DBCA031AE1CFF76FD50B054EF78607F43C3229837E`。对同名居民点与拼写差异使用固定 GeoNames 标识，避免中心点漂移；没有对应攻略的城市统一显示为“尚未收录”。

## 伊朗城市点

`sources/ir-county-seats-1404.csv` 按伊朗统计中心 1404 年度行政地理工作簿收录全部 484 个县治城市，作为本项目与“地级城市”最接近且可稳定复现的地图层级；不把 1,481 个法定城市、城市内部区域或村庄全部展开。工作簿使用 `Hameds/IranCountryDivisions` 在提交 `68687cf96cc1852d5d38c7283353c80829331758` 中保存的统计中心原始文件：<https://github.com/Hameds/IranCountryDivisions>，快照 SHA-256 为 `4EBF8DE69F64E7634867E096F52346828690DF31975E8638CEC4BF863746C704`。

`scripts/import-iran-county-seats.py` 固定校验 31 省、484 县和原始行政层级数量，以县级稳定代码作为城市 ID；452 个县治通过固定的 Wikidata 查询快照取得中心点，32 个新设、改名或拼写无法稳定连接的县治使用固定 GeoNames 城市记录。Wikidata 快照 SHA-256 为 `D684241C6AF4E7526FC24968C5ECC3C17CCA597AF660CCE8F27F1A532952A587`，GeoNames 伊朗文本快照 SHA-256 为 `D950D5EB5C449D7441BD1A3166F7FE46A70ED452199F1E8D7C083D4E7CE669E9`，生成 CSV SHA-256 为 `DE856D18C7D4960F48E3C83AA225D07FE61B5669009637C7F42DABE08864DEAE`。所有地图主名称通过中文名称表显示；没有攻略的县治统一显示为“尚未收录”。

## 伊拉克城市点

`sources/iq-city-centers-2026-09-06.csv` 收录 154 个伊拉克城市级入口：首都、17 个 GeoNames 省会、82 个区治、21 个次区治、1 个更低层级行政中心，以及 32 个不兼任行政中心且人口超过 5,000 的普通城市。伊拉克没有公开、稳定且带全国统一代码的法定城市总表，因此本批使用可复现的国际地名口径：保留 GeoNames `PPLC`、`PPLA`、`PPLA2`、`PPLA3`、`PPLA4` 行政中心，并补充人口超过 5,000 的 `PPL`；不纳入废弃地、村落/地方性聚居地类别、农场、毁坏地、城市内部片区或同一城市的重复记录。Sadr City 作为巴格达内部城区排除。GeoNames 对 cities 系列数据和字段的官方说明见：<https://download.geonames.org/export/dump/readme.txt>。

GeoNames 快照尚未把 2025 年新设的哈拉卜贾省会提升为 `PPLA`，因此导入器按伊拉克第 7/2025 号法律把 Halabja 固定为第 19 省省会：<https://moj.gov.iq/upload/pdf/4825_compressed_244.pdf>。稳定 ID 使用 GeoNames 标识，不随排序或中文译名变化。`scripts/import-iraq-city-centers.py` 固定校验来源哈希、六类层级数量、154 个唯一 ID、唯一中心点、19 省中文归属和国界范围；2026-09-06 下载的 GeoNames 伊拉克国家数据快照按 CC BY 4.0 使用，压缩包 SHA-256 为 `EB7C1532C27BD3F8C960F53E84D5F3AC0ACE6D399402286CDE346384BA8C73D1`，解压文本 SHA-256 为 `F699E53135801F5594C7BD8AA2238B41132DCE82B8967A81547E1B3F852D0164`，生成 CSV SHA-256 为 `A3918FDB82E1F91786C5C9C3F7453C636FE3ECA95CDBCA678E808CB68040DF93`。所有地图主名称通过中文名称表显示；没有攻略的城市统一显示为“尚未收录”。

## 叙利亚城市点

`sources/sy-city-centers-2026-09-06.csv` 收录 296 个叙利亚城市级入口：首都、12 个省会、46 个区治、211 个次区治，以及 26 个不兼任行政中心且人口超过 5,000 的普通城市。公开资料没有提供一张现行、稳定且带全国统一代码的法定城市总表，因此沿用西亚批次的可复现口径：保留 GeoNames `PPLC`、`PPLA`、`PPLA2`、`PPLA3`、`PPLA4` 行政中心，并补充人口超过 5,000 的 `PPL`。Yarmouk 是大马士革内部城区和难民营，不作为独立城市；废弃地、地方性聚居地类别、农场、毁坏地和城市内部片区同样不纳入。GeoNames 对 cities 系列数据和字段的官方说明见：<https://download.geonames.org/export/dump/readme.txt>。

稳定 ID 使用 GeoNames 标识，不随排序或中文译名变化。`scripts/import-syria-city-centers.py` 固定校验来源哈希、五类层级数量、296 个唯一 ID、唯一中心点、14 省中文归属和国界范围。2026-09-06 下载的 GeoNames 叙利亚国家数据快照按 CC BY 4.0 使用，压缩包 SHA-256 为 `A242AB60ED19F6EEABDD9DACA65C7A23C8928E3FEE9F0410E341884233DB9CE5`，解压文本 SHA-256 为 `B02C93103FBCF70A3AC02048DB3A6F2EE2B814A5BDD3E84A9F56FBCFE78FAD2A`，生成 CSV SHA-256 为 `22102A3BA1F069EB397099DF97C315F75EE55C0528613768E2DF9EEE75E1FC29`。所有地图主名称通过中文名称表显示；没有攻略的城市统一显示为“尚未收录”。

## 黎巴嫩城市点

`sources/lb-city-centers-2026-09-06.csv` 收录 40 个黎巴嫩城市级入口：首都、7 个省会、18 个区治，以及 14 个不兼任行政中心且人口超过 5,000 的普通城市。公开资料没有提供一张现行、稳定且带全国统一代码的法定城市总表，因此沿用西亚批次的可复现口径：保留 GeoNames `PPLC`、`PPLA`、`PPLA2`、`PPLA3`、`PPLA4` 行政中心，并补充人口超过 5,000 的 `PPL`；不纳入废弃地、地方性聚居地类别、农场、毁坏地或城市内部片区。GeoNames 对 cities 系列数据和字段的官方说明见：<https://download.geonames.org/export/dump/readme.txt>。

稳定 ID 使用 GeoNames 标识，不随排序或中文译名变化。`scripts/import-lebanon-city-centers.py` 固定校验来源哈希、四类层级数量、40 个唯一 ID、唯一中心点、8 省中文归属和国界范围。2026-09-06 下载的 GeoNames 黎巴嫩国家数据快照按 CC BY 4.0 使用，压缩包 SHA-256 为 `7FCCEEDFCE97D7A3C132A57F311A4A054F9097ACE3C5C02A0250B5C074A32A4A`，解压文本 SHA-256 为 `C22BEB564C2640FA221E493061EE18060D119D278467F89A0BF82B1303E5ABE8`，生成 CSV SHA-256 为 `816EBE52F7E493F7BDF019FB0E049844BB0FFC036619982D0D564D88F4886584`。所有地图主名称通过中文名称表显示；没有攻略的城市统一显示为“尚未收录”。

## 约旦城市点

`sources/jo-city-centers-2026-09-06.csv` 收录 115 个约旦城市级入口：首都、11 个省会、30 个区治、37 个次区治，以及 36 个不兼任行政中心且人口超过 5,000 的普通城市。沿用西亚批次的可复现口径，保留 GeoNames `PPLC`、`PPLA`、`PPLA2`、`PPLA3`、`PPLA4` 行政中心，并补充人口超过 5,000 的 `PPL`。导入器固定排除鲁克班难民营、三个以公路交叉口作为中心的记录、安曼内部城区，以及鲁赛法、鲁韦希德、卡拉克的重复城市点；废弃地、地方性聚居地类别、农场和毁坏地同样不纳入。GeoNames 对 cities 系列数据和字段的官方说明见：<https://download.geonames.org/export/dump/readme.txt>。

稳定 ID 使用 GeoNames 标识，不随排序或中文译名变化。`scripts/import-jordan-city-centers.py` 固定校验来源哈希、五类层级数量、115 个唯一 ID、唯一中心点、12 省中文归属和国界范围。2026-09-06 下载的 GeoNames 约旦国家数据快照按 CC BY 4.0 使用，压缩包 SHA-256 为 `BD843C1008D74BE315F67B0EEFC31E95E3CE9C947E2551440371C5AA98FDC4BA`，解压文本 SHA-256 为 `CDCC54B0F5741106D1053DECA5FEC8917B70991A6A679D66073A1C1DB2EA67E7`，生成 CSV SHA-256 为 `417947DB71FCC2D4E6950B19B71C3EBB7A931D9FE0818687F1CF3D3D6C41258E`。所有地图主名称通过中文名称表显示；没有攻略的城市统一显示为“尚未收录”。

## 以色列城市点

`sources/il-city-centers-2026-09-06.csv` 收录 160 个以色列城市级入口：7 个 GeoNames 行政中心，以及 153 个不兼任行政中心且人口超过 5,000 的普通城市型聚居地。沿用西亚批次的可复现口径，保留 GeoNames `PPLC`、`PPLA`、`PPLA2`、`PPLA3`、`PPLA4` 行政中心，并补充人口超过 5,000 的 `PPL`。导入器固定排除耶路撒冷内部社区、三个戈兰高地的叙利亚旧行政中心、同一城市或地方政府的重复记录，以及部落、村庄、莫沙夫和隶属区域委员会的社区型聚居地。非城市记录以以色列人口与移民局持续更新的官方聚居地名录辅助核对：<https://data.gov.il/datasets/population_authority/citiesandsettelments>；GeoNames 对城市文件和字段的官方说明见：<https://download.geonames.org/export/dump/readme.txt>。

稳定 ID 使用 GeoNames 标识，不随排序或中文译名变化。`scripts/import-israel-city-centers.py` 固定校验来源哈希、两类层级数量、160 个唯一 ID、唯一中心点、7 个地区中文归属和坐标范围。2026-09-06 下载的 GeoNames 以色列国家数据快照按 CC BY 4.0 使用，压缩包 SHA-256 为 `24C182AB70064F3D2DCDB5169BA2A825CE4DF8AA07B6D5F41D59138BA5662AF6`，解压文本 SHA-256 为 `FFDADAA0E6159DEE5DB4B390803B30EC5DE99953E3F97C93C81B2E0BF592D5F8`，生成 CSV SHA-256 为 `BB854FEC5CC5BD13D712003DE0B4C72DBA68C3B31C14E750EE18C0B9EBEA6EF2`。来源文件把阿里埃勒归入 `WE` 地区，本项目保留其来源分组并显示为“约旦河西岸”；该地区标签用于说明数据来源与位置，不表达边界或主权立场。所有地图主名称通过中文名称表显示；没有攻略的城市统一显示为“尚未收录”。

## 巴勒斯坦城市点

`sources/ps-city-centers-2026-09-06.csv` 收录 104 个巴勒斯坦城市级入口：2 个 GeoNames 一级行政中心、7 个二级行政中心，以及 95 个不兼任行政中心且人口超过 5,000 的普通城市型聚居地；其中加沙地带 17 个、约旦河西岸 87 个。沿用西亚批次的可复现口径，保留 GeoNames `PPLC`、`PPLA`、`PPLA2`、`PPLA3`、`PPLA4` 行政中心，并补充人口超过 5,000 的 `PPL`。导入器固定排除耶路撒冷内部社区、三个难民营、两个重复城市点，以及四个不属于巴勒斯坦地方城市体系的以色列定居点/地方委员会记录。巴勒斯坦地方政府部当前列出的 16 个行政区用于复核城市归属和主要行政中心：<https://gate.molg.pna.ps/EN/Locales>；巴勒斯坦中央统计局正在编制的 2026 聚居地指南明确以 2017 聚居地指南和 2025 地方机构选区边界为更新基础：<https://www.pcbs.gov.ps/ar/post-details/?postId=26604>。

稳定 ID 使用 GeoNames 标识，不随排序或中文译名变化。`scripts/import-palestine-city-centers.py` 固定校验来源哈希、三类层级数量、104 个唯一 ID、唯一中心点、两个地理区域中文归属和坐标范围。2026-09-06 下载的 GeoNames 巴勒斯坦国家数据快照按 CC BY 4.0 使用，压缩包 SHA-256 为 `5283D143B05D7BC8C2F41CCB76C287AF9C7B481B6F9B2588FC43631478E9CBB0`，解压文本 SHA-256 为 `2B85B6C5942A8F6F6B07AE889B7F84D66A8F21CB61E35AE4D48AB5197AC2EF4A`，生成 CSV SHA-256 为 `32AA495C6400DABB84BF98CDEFB2E51A08A4612604401A59C51EBA921AC7CA98`。人口字段只用于本批筛选，并非对当前人口或现场状况的陈述；“加沙地带”和“约旦河西岸”标签用于说明来源分组与位置，不表达边界或主权立场。所有地图主名称通过中文名称表显示；没有攻略的城市统一显示为“尚未收录”。

## 科威特城市点

`sources/kw-city-centers-2026-09-06.csv` 收录 14 个科威特城市级入口：首都、5 个其他省会和 8 个不兼任行政中心且人口超过 5,000 的普通城市型聚居地。沿用西亚批次的可复现口径，保留 GeoNames `PPLC`、`PPLA`、`PPLA2`、`PPLA3`、`PPLA4` 行政中心，并补充人口超过 5,000 的 `PPL`；固定排除科威特城内部的代斯曼、南苏拉住宅区和以农场命名的阿卜达利农业聚居地。科威特政府当前公布的 6 省清单用于复核省级覆盖：<https://www.e.gov.kw/sites/kgoenglish/Pages/Visitors/AboutKuwait/KuwaitGovernorates.aspx>；GeoNames 对城市文件和字段的官方说明见：<https://download.geonames.org/export/dump/readme.txt>。

稳定 ID 使用 GeoNames 标识，不随排序或中文译名变化。`scripts/import-kuwait-city-centers.py` 固定校验来源哈希、三类层级数量、14 个唯一 ID、唯一中心点、6 省中文归属和国界范围。2026-09-06 下载的 GeoNames 科威特国家数据快照按 CC BY 4.0 使用，压缩包 SHA-256 为 `9DA6AD32FEDD5C09E2A8655AF1E02109E1A2D1452379FCE2A599BE29E08F649A`，解压文本 SHA-256 为 `CF831E9E798DE436FEA21DE60D89AA0E1BB762244D05E901CDAA730267CBCA7B`，生成 CSV SHA-256 为 `AE78C268104E239A85A2C8DD54C473E6849997C477390D69C2426942FD728B57`。所有地图主名称通过中文名称表显示；没有攻略的城市统一显示为“尚未收录”。

## 巴林城市点

`sources/bh-city-centers-2026-09-06.csv` 收录 11 个巴林城市级入口：首都麦纳麦和 10 个不兼任行政中心且人口超过 5,000 的普通城市型聚居地。沿用西亚批次的可复现口径，保留 GeoNames `PPLC`、`PPLA`、`PPLA2`、`PPLA3`、`PPLA4` 行政中心，并补充人口超过 5,000 的 `PPL`；本批没有混入 `PPLX` 城市内部片区、村庄或废弃聚居地。巴林国家门户当前公布的首都、穆哈拉格、北方和南方四省用于复核省级覆盖：<https://www.bahrain.bh/>；GeoNames 对城市文件和字段的官方说明见：<https://download.geonames.org/export/dump/readme.txt>。

稳定 ID 使用 GeoNames 标识，不随排序或中文译名变化。`scripts/import-bahrain-city-centers.py` 固定校验来源哈希、两类层级数量、11 个唯一 ID、唯一中心点、4 省中文归属和国界范围。2026-09-06 下载的 GeoNames 巴林国家数据快照按 CC BY 4.0 使用，压缩包 SHA-256 为 `BDA7F2729070F599E19015036E06DC7BE4F00CD6F829B43CCEDA12EF18F5C75F`，解压文本 SHA-256 为 `F95E6967AD10E7AA2544C7750878D50F24CE944781AF53F48E55FE8BF70CA7C9`，生成 CSV SHA-256 为 `A4F3412C3A22A5679B5E230E0721D53E32B59ECAE1100DE4E15050F6DEC2F5BF`。所有地图主名称通过中文名称表显示；没有攻略的城市统一显示为“尚未收录”。

## 卡塔尔城市点

`sources/qa-city-centers-2026-09-06.csv` 收录 13 个卡塔尔城市级入口：首都多哈、7 个其他市级行政中心和 5 个不兼任行政中心且人口超过 5,000 的普通城市型聚居地。沿用西亚批次的可复现口径，保留 GeoNames `PPLC`、`PPLA`、`PPLA2`、`PPLA3`、`PPLA4` 行政中心，并补充人口超过 5,000 的 `PPL`。卡塔尔国家总体规划把努艾贾和乌姆古韦利纳明确列为多哈内部的 District Centre，并把相关赖扬建成区列为市内中心，因此导入器固定排除这三个内部城区记录；国家总体规划同时确认全国共有 8 个市：<https://www.mme.gov.qa/QatarMasterPlan/English/MSDP-Municipalities.aspx?panel=about>、<https://www.mme.gov.qa/QatarMasterPlan/English/Centers.aspx?panel=about>。

稳定 ID 使用 GeoNames 标识，不随排序或中文译名变化。`scripts/import-qatar-city-centers.py` 固定校验来源哈希、三类层级数量、13 个唯一 ID、唯一中心点、8 市中文归属和国界范围。2026-09-06 下载的 GeoNames 卡塔尔国家数据快照按 CC BY 4.0 使用，压缩包 SHA-256 为 `44385A2651AB21ED51D425C10C38EC021DF8F9455065BE30A96D563D6DDFDFAC`，解压文本 SHA-256 为 `393AE7831C80D9C3EA2FC4022187956D9B05DAD5256288F5BEE1C8FD93A88E04`，生成 CSV SHA-256 为 `4CE6FB9C5892F64F725412B2439FCD5D5D6DD9C0A1F27D2982807070DDAB2C0E`。所有地图主名称通过中文名称表显示；没有攻略的城市统一显示为“尚未收录”。

## 阿联酋城市点

`sources/ae-city-centers-2026-09-06.csv` 收录 24 个阿联酋城市级入口：联邦首都、6 个其他酋长国首府和 17 个不兼任行政中心且人口超过 5,000 的普通城市型聚居地。沿用西亚批次的可复现口径，保留 GeoNames `PPLC`、`PPLA`、`PPLA2`、`PPLA3`、`PPLA4` 行政中心，并补充人口超过 5,000 的 `PPL`。导入器固定排除阿布扎比、迪拜、富查伊拉和沙迦的内部城区、工业区、规划社区及重复城市中心，例如哈利法城、穆萨法、迪拜汽车城和朱美拉棕榈岛；迪巴希森按阿联酋政府公布的七酋长国地理关系从 GeoNames 的富查伊拉分组修正到沙迦。七酋长国清单以阿联酋政府官方平台复核：<https://u.ae/en/about-the-uae/the-seven-emirates>。

稳定 ID 使用 GeoNames 标识，不随排序或中文译名变化。`scripts/import-uae-city-centers.py` 固定校验来源哈希、三类层级数量、24 个唯一 ID、唯一中心点、7 个酋长国中文归属和国界范围。2026-09-06 下载的 GeoNames 阿联酋国家数据快照按 CC BY 4.0 使用，压缩包 SHA-256 为 `ED7BD42AF618973D1FD51DDE8FE050E63375E0448C9629337F8B4552D5026100`，解压文本 SHA-256 为 `CB3D6AD67234DD9CEE04DE8D38E0E27743669F2E1C6F20121F7D7497D65B61DA`，生成 CSV SHA-256 为 `EBD5357257CE720B0C30AFD18298E3560D32A65637158FC969511CAAD050A5D1`。所有地图主名称通过中文名称表显示；没有攻略的城市统一显示为“尚未收录”。

## 阿曼城市点

`sources/om-city-centers-2026-09-06.csv` 收录 32 个阿曼城市级入口：首都、8 个来源标注的其他省会、1 个二级行政中心、20 个来源标注为普通聚居地且人口超过 5,000 的城市，以及穆特拉和巴尔卡两个来源分类为 `PPLX`、但经官方资料确认应独立保留的城市。沿用西亚批次的可复现口径，保留 GeoNames `PPLC`、`PPLA`、`PPLA2`、`PPLA3`、`PPLA4` 行政中心，并补充人口超过 5,000 的 `PPL`。阿曼外交部将穆特拉称为重要的历史城市，并确认巴尔卡是独立州镇；导入器同时排除萨迈勒的重复城市点和阿瓦比内部片区。官方资料确认阿曼由 11 个省组成、各省再分为州；2022 年绿山州和西纳乌州设立后全国共有 63 州，但“州”属于行政区域，不直接等同于城市，因此不把缺乏独立城市实体的州整体作为地图城市：<https://www.fm.gov.om/en/about-oman/state/oman-by-region/>、<https://omannews.gov.om/topics/en/79/show/110798>。

稳定 ID 使用 GeoNames 标识，不随排序或中文译名变化。`scripts/import-oman-city-centers.py` 固定校验来源哈希、五类层级数量、32 个唯一 ID、唯一中心点、11 省中文归属和国界范围。2026-09-06 下载的 GeoNames 阿曼国家数据快照按 CC BY 4.0 使用，压缩包 SHA-256 为 `B6BEAF3B8020E297E7979C22C2D2E9A0D25F426EB50AFD1C456358732CB8D624`，解压文本 SHA-256 为 `E07528CBC14A205BD3C6083DCA15BB0C51767E72D540CB857041589D3F1D597B`，生成 CSV SHA-256 为 `992C0787A03E005C494C96E50FB20B669281AF4BE244893DD7981060E5DDB72E`。所有地图主名称通过中文名称表显示；没有攻略的城市统一显示为“尚未收录”。

## 沙特阿拉伯城市点

`sources/sa-city-centers-2026-09-06.csv` 收录 136 个沙特阿拉伯城市级入口：首都、12 个其他行政区首府、4 个来源标注的省级行政中心，以及 119 个来源标注为普通聚居地且人口超过 5,000 的城市。沙特官方资料确认全国分为 13 个行政区，每区设一座首府城市，行政区下再分省、中心和城市村庄；由于官方服务指南把城市与村庄合并统计，未提供可直接复用的现行法定城市总表，本批继续采用西亚统一的可复现口径：保留 GeoNames `PPLC`、`PPLA`、`PPLA2`、`PPLA3`、`PPLA4` 行政中心，并补充人口超过 5,000 的 `PPL`。行政结构以沙特国家平台和国家法规档案中心的现行资料复核：<https://my.gov.sa/en/content/govmechanism>、<https://ncar.gov.sa/regions-coding>。

导入器固定排除阿基克、欧奈宰和图赖夫的旧重复点，麦地那内部的苏丹纳城区，哈萨绿洲城市群内部的小朱拜勒点，费萨尔国王军事城，以及与拉斯坦努拉重复的拉希迈中心点；阿卜杜拉国王经济城作为已有常住人口的独立规划城市保留。稳定 ID 使用 GeoNames 标识，不随排序或中文译名变化。`scripts/import-saudi-city-centers.py` 固定校验来源哈希、四类层级数量、136 个唯一 ID、唯一中心点、13 个行政区中文归属和国界范围。2026-09-06 下载的 GeoNames 沙特阿拉伯国家数据快照按 CC BY 4.0 使用，压缩包 SHA-256 为 `5540AA0C91E9C651D1D66F1E5090091D235F118C97C15F993F95692BE7518485`，解压文本 SHA-256 为 `7974F27B41FCEB564FAA7D95A73BC29BA1A6D78AFDC1B307AFCE288E1DAF3615`，生成 CSV SHA-256 为 `79051FC7E026D0DD61FF2B4A03FB2F146CF4DD51378D84AF2A65934A65905489`。所有地图主名称通过中文名称表显示；没有攻略的城市统一显示为“尚未收录”。

## 也门城市点

`sources/ye-city-centers-2026-09-06.csv` 收录 286 个也门城市级入口：首都、19 个来源标注的省会、262 个县级行政中心，以及 4 个不兼任行政中心且人口超过 5,000 的普通城市。也门现行地方行政体系由 21 个省、首都直辖区和 333 个县组成；法律同时规定省会城市按县级行政单位管理。由于公开行政名录列的是县域而不是一张独立法定城市总表，本批沿用西亚统一的可复现口径：保留 GeoNames `PPLC`、`PPLA`、`PPLA2`、`PPLA3`、`PPLA4` 行政中心，并补充人口超过 5,000 的 `PPL`。行政层级以也门《地方权力法》、国家信息中心和政府部门现行资料复核：<https://agoye.gov.ye/page.php?id=395&lng=arabic>、<https://yemennic.net/%D9%85%D8%AD%D8%A7%D9%81%D8%B8%D8%A7%D8%AA-%D8%A7%D9%84%D8%AC%D9%85%D9%87%D9%88%D8%B1%D9%8A%D8%A9>、<https://mom-ye.com/site-en/%D8%B9%D9%86-%D8%A7%D9%84%D9%8A%D9%85%D9%86/>。

导入器固定排除亚丁市内部 7 个城区、萨那市内部 2 个城区，并把希巴姆的县治重复点合并到保留的人口城市中心；亚丁、萨那和希巴姆本身继续保留。稳定 ID 使用 GeoNames 标识，不随排序或中文译名变化。`scripts/import-yemen-city-centers.py` 固定校验来源哈希、四类层级数量、286 个唯一 ID、唯一中心点、22 个省级地区中文归属和国界范围。2026-09-06 下载的 GeoNames 也门国家数据快照按 CC BY 4.0 使用，压缩包 SHA-256 为 `F970E264FE1AC63A475776C4C0142EEAA75ADECEE0BC2ADF2ED335C50F481A9C`，解压文本 SHA-256 为 `4622489F8B9F293ECB88A5A9EB3D87E004C828E9130F95D666053D6221E4F4FA`，生成 CSV SHA-256 为 `02A5B5C631267C9BC38225378873A7A28670FFD5584A5C891D55CB475B93B495`。所有地图主名称通过中文名称表显示；没有攻略的城市统一显示为“尚未收录”。

## 塞浦路斯城市点

`sources/cy-city-centers-2026-09-06.csv` 收录 35 个塞浦路斯城市级入口：首都、5 个来源标注的区级行政中心、3 个其他行政中心，以及 26 个不兼任行政中心且人口超过 5,000 的普通城市。塞浦路斯 2024 年地方行政改革形成的 20 个新市镇多为合并辖区，并不等同于 20 个实体城市；本批因此不把合并辖区名称直接替代原有城市点，而是沿用西亚统一的可复现口径：保留 GeoNames `PPLC`、`PPLA`、`PPLA2`、`PPLA3`、`PPLA4` 行政中心，并补充人口超过 5,000 的 `PPL`。现行 20 个新市镇的组成和全国 29 个市镇结构以塞浦路斯内政部资料复核：<https://www.gov.cy/moi/20-neoi-dimoi/>、<https://www.gov.cy/moi/ypoyrgeio/domh/topiki-aytodioikisi/klados-dimon/>。

导入器固定排除特罗多斯、梅拉迪亚、波莱米和科洛尼等村庄，耶罗斯基普的城区重复点，以及把三个地方名称拼接为一条的边界记录；并依据官方新市镇组成和坐标，把 GeoNames 错挂到拉纳卡区的科洛西修正为利马索尔区。稳定 ID 使用 GeoNames 标识，不随排序、中文译名或归属修正变化。`scripts/import-cyprus-city-centers.py` 固定校验来源哈希、四类层级数量、35 个唯一 ID、唯一中心点、6 个区中文归属和国界范围。2026-09-06 下载的 GeoNames 塞浦路斯国家数据快照按 CC BY 4.0 使用，压缩包 SHA-256 为 `302F1D2ED5111ED199E0D156AAB69BB7EC22D98898D8E1C37042B1291F3DFE56`，解压文本 SHA-256 为 `AFB528BCC24174BAD87FDCEF9D21B867F69C1981BE433E53459CBAD51374B2F5`，生成 CSV SHA-256 为 `4C5479D080629934CF347EE39356CEB955BCC581EEFC151FC10FE8CCD5825421`。区名仅用于说明来源分组和地理位置，不表达边界或主权立场；所有地图主名称通过中文名称表显示，没有攻略的城市统一显示为“尚未收录”。

## 土耳其城市点

`sources/tr-city-centers-2026-09-06.csv` 收录 971 个土耳其城市级入口：首都、80 个其他省会、779 个独立县级行政中心，以及 111 个不兼任上述行政中心且人口超过 5,000 的普通城市和城镇。土耳其内政部现行系统覆盖 81 个省和 973 个县，环境、城市化与气候变化部的地方政府报告则列出 1,402 个市镇；后一个数字同时包含大都会、市辖区和镇级市镇等法律实体，不能直接当作 1,402 座彼此独立的实体城市。官方结构资料见：<https://www.nvi.gov.tr/mernis>、<https://webdosya.csb.gov.tr/db/yerelyonetimler/icerikler/2023_faal-yet_raporu_26072024-20240726161101.pdf>。

本批以实体聚居地为地图对象，保留 GeoNames `PPLC`、`PPLA`、`PPLA2` 行政中心并补充人口超过 5,000 的 `PPL`；不自动纳入来源中的 663 个 `PPLA3`，因为它们大量对应旧次区中心、村庄或缺乏现行城市身份的聚居地。导入器从初始候选中固定排除 114 条记录，包括伊斯坦布尔、安卡拉、伊兹密尔、布尔萨等连续建成区内的市辖区和城区点，以及皮拉齐兹、卡拉苏等重复城市点；物理上分离的县城和普通城镇仍保留。稳定 ID 使用 GeoNames 标识，不随排序或中文译名变化。`scripts/import-turkey-city-centers.py` 固定校验来源哈希、四类层级数量、971 个唯一 ID、唯一中心点、81 省中文归属和国界范围。2026-09-06 下载的 GeoNames 土耳其国家数据快照按 CC BY 4.0 使用，压缩包 SHA-256 为 `4782A88ACAE75737C0F4D1C46BD4D3161FA277CE5B6F3E1F2E864F47A930E89A`，解压文本 SHA-256 为 `3647C776E8E32F7076361C34445CBC63280F9A83B7E0BC886176808ECEB8DBB3`，生成 CSV SHA-256 为 `8620985818020798276A32C8463658F5A66DAF83FFE8BC0291371A6A79714339`。所有 971 个地图主名称均已固定为简体中文；没有攻略的城市统一显示为“尚未收录”。

## 阿尔巴尼亚城市点

`sources/al-official-cities-2026-09-06.csv` 收录阿尔巴尼亚统计局城市—乡村分类中的全部 74 个实体城市，包括首都、11 个州府和 62 个其他普通城市。该官方分类把 74 个城市与 2,972 个村庄分别列出，适合直接回答地图上“哪些是城市”；2014 年以后形成的 61 个市镇则是合并后的地方行政辖区，不表示全国只剩 61 座实体城市。官方城市分类和现行行政结构分别见：<https://www.instat.gov.al/media/2919/a_new_urban-rural_classification_of_albanian_population.pdf>、<https://www.instat.gov.al/en/documentation/classifications/version/?verId=3488>。

导入器按官方城市名称逐项绑定固定 GeoNames ID，不使用人口阈值删掉巴伊泽、卡姆、雷普斯等规模很小但官方明确列为城市的地点，也不把 307 个来源标注为 `PPLA3` 的旧乡级中心整体误收为城市。稳定 ID 使用 GeoNames 标识，不随市镇合并、排序或中文译名变化。`scripts/import-albania-city-centers.py` 固定校验 74 个官方城市、五类来源层级数量、唯一 ID、唯一中心点、12 州中文归属和国界范围。2026-09-06 下载的 GeoNames 阿尔巴尼亚国家数据快照按 CC BY 4.0 使用，压缩包 SHA-256 为 `F93685C8E566A7138B7CBFAC73A0D005ACA7D495429895433BE259B49F0C0B7F`，解压文本 SHA-256 为 `35E214657A911E009FB5B019308B1360276AEC89F0B2168BD71F7E7DB26B3A55`，生成 CSV SHA-256 为 `BFEFB7E8D8FD1B647C8DC09FC84A2FFCB4D1831BC3A94C257AC3683D6DB4DD98`。所有地图主名称均为简体中文；没有攻略的城市统一显示为“尚未收录”。

## 黑山城市点

`sources/me-city-centers-2026-09-06.csv` 收录 42 个黑山实体城市与城镇：首都波德戈里察、24 个其他现行地方政府驻地，以及 17 个普通城镇。黑山统计局 2023 年聚居地名录列出全国 1,462 个聚居地，2025 年统计年鉴同时说明其中有 93 个“城市型聚居地”；该统计分类依据各市镇决定，包含构成连续城市建成区的细分聚居地，不能直接等同于 93 座彼此独立的城市。现行 25 个地方政府单位和统计口径分别见：<https://www.gov.me/clanak/drzavna-uprava-i-lokalne-samouprave>、<https://monstat.org/uploads/files/klasifikacije/spisak%20naselja/Spisak%20naselja%20cg%202023_za%20sajt.xlsx>、<https://monstat.org/uploads/files/publikacije/godisnjak2025/14.pdf>。

本批以实体城市中心为地图对象：完整保留 25 个现行地方政府驻地，再从 MONSTAT 2011 年逐项标注的城市型聚居地中保留 17 个物理上分离的普通城镇；比耶洛波列连续建成区内的 Babića Brijeg、Centar、Ćukovac、Gornji dio grada、Kruševo、Lipnica、Medanovići、Nikoljac、Pruška 和 Rijeke 等组成部分不重复设城市点。2011 年官方逐聚居地表见：<https://www.monstat.org/userfiles/file/popis2011/saopstenje/knjiga_prvi%20rezultati.pdf>。稳定 ID 使用 GeoNames 标识，不随排序或中文译名变化；来源把官方城镇 Gradac 记作 Donji Gradac，本项目以其坐标绑定并显示为“格拉达茨”。`scripts/import-montenegro-city-centers.py` 固定校验 42 个城市、四类来源层级数量、唯一 ID、唯一中心点、25 个市镇中文归属和国界范围。2026-09-06 下载的 GeoNames 黑山国家数据快照按 CC BY 4.0 使用，压缩包 SHA-256 为 `305D90747B31C4DE47BBF50DD74CF4691C9D7B4879A827B6B22F9761D5621934`，解压文本 SHA-256 为 `B40769DC867BA233C10F4C8E2449D571B6360C048F31F98BF3C9B7D680435440`，生成 CSV SHA-256 为 `5B715D0C5D5FA088AA53381BD6C22EF7E883726F0A10D4F40E8BE16C321C2ACD`。所有地图主名称均为简体中文；没有攻略的城市统一显示为“尚未收录”。

## 波斯尼亚和黑塞哥维那城市点

`sources/ba-city-centers-2026-09-06.csv` 收录 141 个波黑实体城市与城镇：首都萨拉热窝、巴尼亚卢卡和布尔奇科两个实体/特区中心、131 个其他市镇行政中心，以及弗尔诺格拉奇、萨尼察、波斯尼亚奥托卡、奥斯特罗扎茨、奥马尔斯卡、扬亚和耶拉赫 7 个不兼任行政中心的普通城镇。波黑 2013 年人口普查以实体、布尔奇科特区、州、市/市镇和聚居地为统计层级；联合国国家资料列出全国 143 个地方自治单位，但萨拉热窝和东萨拉热窝的市内市镇属于城市组成部分，自治单位数量不能直接当作独立城市数量。官方普查结果和行政层级说明见：<https://www.popis.gov.ba/popis2013/knjige.php>、<https://bhas.gov.ba/data/Dokumenti/pdf/Brosura_PopisGIS_EN.pdf>。

本批沿用实体城市点口径，保留 GeoNames `PPLC`、`PPLA`、`PPLA2` 和 `PPLA3` 标注的 134 个独立行政中心，并从人口超过 5,000 的普通 `PPL` 中补入 7 个独立城镇；特恩等连续城市郊区、同一行政中心的重复点，以及 Tržačka Raštela、Tojšići、Orahovica Donja、Mahala、Gromiljak、Donja Mahala、Divičani、Blatnica、Tešanjka、Kovači 和 Kačuni 等村庄不纳入。GeoNames 对城市文件和字段的官方说明见：<https://download.geonames.org/export/dump/readme.txt>。稳定 ID 使用 GeoNames 标识，不随排序或中文译名变化。`scripts/import-bosnia-herzegovina-city-centers.py` 固定校验 141 个城市、五类来源层级数量、唯一 ID、唯一中心点、三个实体级地区中文归属和国界范围。2026-09-06 下载的 GeoNames 波黑国家数据快照按 CC BY 4.0 使用，压缩包 SHA-256 为 `31F954EB0F08ABBB869FA768DF57970A41845AF012D619C1E33EF561CFF67147`，解压文本 SHA-256 为 `2CE12DF5CC846F539ADD05158DDFD470390B7DF4F133DEC431245473F933EEEC`，生成 CSV SHA-256 为 `E3252CB563F39EC44991D186EBF2642C6B2DBB0B82343DEBFF743C682FC26C9E`。所有地图主名称均为简体中文；没有攻略的城市统一显示为“尚未收录”。

## 克罗地亚城市点

`sources/hr-official-cities-2026-09-06.csv` 收录克罗地亚全部 128 个法定城市：国家首都萨格勒布、19 个其他县治，以及 108 个普通城市。克罗地亚司法、公共行政和数字化转型部的现行地方自治清单列出 127 个城市和 428 个市镇；萨格勒布另具城市与县双重地位，因此地图城市总数为 128。官方清单和下载表见：<https://mpudt.gov.hr/gradjani-21417/iz-djelokruga/lokalna-i-podrucna-regionalna-samouprava-24398/popis-zupanija-gradova-i-opcina-24402/24402>。

本批不以人口门槛删去法定小城市，恰巴尔、斯克拉丁和弗尔利卡等规模很小但官方明确列为城市的地点同样保留；卡什泰拉作为多中心法定城市，以市政府所在的卡什泰尔苏丘拉茨中心点绑定稳定 GeoNames ID。布耶、诺维格勒、波雷奇、普拉、罗维尼、乌马格和沃德年保留官方清单中的克罗地亚语—意大利语双语法定名称，同时地图主名称统一显示为简体中文。`scripts/import-croatia-official-cities.py` 固定校验 128 个官方城市、三类来源层级数量、唯一 ID、唯一中心点、21 个县级地区中文归属和国界范围。2026-09-06 下载的官方 XLS SHA-256 为 `1F60A60B90E875CF59DD69DE2FFF64A1550A699165251FF665ED039FA67A3AC0`；GeoNames 克罗地亚国家数据快照按 CC BY 4.0 使用，压缩包 SHA-256 为 `A61EAE4D3CAEC1EFB060F7EA8D5B98F137243AA933D588B8CD91E2A4BCF0428B`，解压文本 SHA-256 为 `8F96F768C771746C8E4770D39D1C827E7B22D0E155F15DF8B778B0BF6D130F1C`，生成 CSV SHA-256 为 `F72E9D14CDF2172EFF87E6633D5195CEF67D83BB03F2AB34525BA39DF9DABF20`。没有攻略的城市统一显示为“尚未收录”。

## 塞尔维亚城市点

`sources/rs-official-urban-settlements-2026-09-06.csv` 收录 167 个塞尔维亚实体城市与城镇。塞尔维亚共和国统计局 2025 年聚居地名录逐项标注 205 个 `G` 类城市型聚居地；其中 26 个位于后续单独接入的科索沃地区，贝尔格莱德和尼什又分别按市辖区拆成 10 条和 4 条同城记录。合并这 14 个重复中心并各保留一个城市点后，本批完整覆盖来源范围内其余 167 个城市型聚居地。官方现行名录见：<https://www.stat.gov.rs/en-us/oblasti/registar-prostornih-jedinica-i-gis/arhiva/>；2022 年人口普查说明该分类采用行政—法律标准，由地方自治单位通过法律行为确定城市身份：<https://publikacije.stat.gov.rs/G2023/pdf/G20234003.pdf>。

本批不使用人口门槛，西亚林斯卡巴尼亚、贝洛波列和鲁茨卡等小型但法定为城市型的聚居地同样保留；村庄和贝尔格莱德、尼什的内部重复城市中心不另设点。地图稳定 ID 优先采用官方聚居地代码，合并后的贝尔格莱德和尼什采用官方上级城市代码；坐标逐项绑定 GeoNames，库尔舒姆利斯卡巴尼亚使用来源中的温泉地点中心点，贝洛波列使用同地点异拼名 Bijelo Polje 的记录。`scripts/import-serbia-official-urban-settlements.py` 直接解析并校验官方 XLSX 与 GeoNames 快照，固定检查 205 个原始城市型聚居地、26 个另批地区记录、14 个合并组成部分、167 个唯一城市点、25 个行政区和坐标范围。2026-09-06 下载的官方 XLSX SHA-256 为 `94AFB9355CD4FBBDAD768E52579C189873A751FDA524CC7C01B9DAEC598E3AA8`；GeoNames 塞尔维亚国家数据快照按 CC BY 4.0 使用，压缩包 SHA-256 为 `160B4708CB53276FC7A63B96C1E343DBD3C2D5AA457358778E07873940446411`，解压文本 SHA-256 为 `92645DB1EB5FCFEC7886834A1970530488399B619CFF7E41DE0B79879CA90342`，生成 CSV SHA-256 为 `67A91E57859AA11C00E657EFFD05026B26361F47D3362C03E274137CB18F8C31`。所有地图主名称均为简体中文；没有攻略的城市统一显示为“尚未收录”。

## 斯洛文尼亚城市点

`sources/si-official-cities-2026-09-06.csv` 收录斯洛文尼亚全部 69 个具有正式城市地位的聚居地。斯洛文尼亚政府当前明确区分 69 个法定城市与 12 个“城市市镇”：后者是承担更多法定职能的地方行政辖区，不能被误读为全国只有 12 座城市。政府城市主题页和完整法定城市清单见：<https://www.gov.si/teme/mesta-in-druga-urbana-naselja/>、<https://www.gov.si/assets/ministrstva/MNVP/Dokumenti/Urbani-razvoj/naselja_s_statusom_mesta.pdf>。

本批按 69 个法定城市逐项绑定固定 GeoNames ID，不以人口门槛删除科斯塔涅维察、维什尼亚戈拉、博韦茨等小城市，也不把统计上的都市圈组成聚居地或市镇辖区整体另设为城市。`scripts/import-slovenia-official-cities.py` 固定校验 69 个法定城市、三类来源层级数量、唯一 ID、唯一中心点、12 个统计区中文归属和国界范围。2026-09-06 下载的官方 PDF SHA-256 为 `C5F446A92FA0C7038F1FEDB241C67F1204E72049043BE900F3DF0D048B27778A`；GeoNames 斯洛文尼亚国家数据快照按 CC BY 4.0 使用，压缩包 SHA-256 为 `AC8636BF26A16522E7AA481F1E8C55B1C798E0EBFFF3EA823C3A5BACD26F8590`，解压文本 SHA-256 为 `82A5E0C53656C359C8DE6C39070960121B10647AD024CBAC960C21F34F47D0F9`，生成 CSV SHA-256 为 `C59B0A4816CDA8F911D47EC7FABC644477BF1D844E62922D3563BCB0B2247C65`。所有地图主名称均为简体中文；没有攻略的城市统一显示为“尚未收录”。
