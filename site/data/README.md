# 地图目标城市中心点

`cn-legal-city-centers.csv` 对应仓库固定的 2025-12-31 中国大陆法定城市清单，共 695 座。

中心点取自 AreaCity-JsSpider-StatsGov 的 2025.251231.260403 版 `ok_geo.csv`，原始坐标为 GCJ-02；生成脚本在写入本文件时转换为供网页地图使用的 WGS84。上游仓库采用 MIT License：<https://github.com/xiangyuecn/AreaCity-JsSpider-StatsGov>。

草湖市晚于该三级边界文件设立，中心点使用其政府驻地草湖镇的公开坐标。

需要更新行政区划快照时，应下载对应版本的 `ok_geo.csv`，再运行 `scripts/extract-legal-city-centers.mjs <文件路径>`，不要手工逐城维护坐标或覆盖状态。
