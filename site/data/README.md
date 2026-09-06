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
