# 攻略地图数据

地图点位由代码从公开结构化攻略中批量生成，页面构建只读取本地结果，不在访问网站时请求地理编码服务。

## 日常更新

```powershell
npm run guides:public
npm run guides:maps
```

转换器会扫描全部攻略，自动提取：

- “主要景点”中的景点名称与 A/B/C 优先级
- “美食”标签中的具体餐饮片区，并把同片区的菜品合并
- “经典行程”中的景点出现顺序，并生成线路

坐标来自 `guide-map-cache.json`。普通构建全程离线，生成文件位于 `app/generated/guideMaps.ts`。

## 批量补坐标

设置高德 Web 服务 Key 后运行：

```powershell
$env:AMAP_WEB_SERVICE_KEY = "你的 Key"
npm run guides:maps:resolve
```

也可以先处理一座城市或限定本次数量：

```powershell
npm run guides:maps:resolve -- --guide cn-1815286 --limit 50
```

脚本按城市分组并以每批 10 个地点请求坐标，将 GCJ-02 转换为底图使用的 WGS84。省份匹配且落在城市中心 5 度范围内的结果进入页面，其余结果标为 `review`，便于集中复核。

`guide-map-overrides.json` 用于少量同名地点、复合餐饮区和希望固定顺序的线路。成都样板已经迁入这里，后续城市默认走自动提取与坐标缓存。
