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
