# 旅行地图

这个目录是 `travel-database` 的地图阅读界面。它把仓库里的中国单城市攻略同步为地图点位，并在侧栏中提供速览、分点阅读和完整原文。

## 本地运行

需要 Node.js 22 或更新版本。

```bash
npm install
npm run dev
```

若要按 GitHub Pages 的子路径测试静态版本：

```bash
npm run dev:pages
npm run build:pages
```

## 数据来源

- 城市攻略：`../destinations/中国/**/*.md`
- 坐标清单：`../data/geonames/中国地级行政区_geonames.csv`
- 地图底图：OpenFreeMap
- 地形高程：Mapterhorn

构建前会从当前仓库工作区重新生成攻略索引和公开 Markdown，不再依赖另一份远端快照。生成目录 `app/generated/`、`public/guides/` 与 `pages-dist/` 不提交到 Git。

## 发布

合并到 `main` 后，GitHub Actions 会构建静态站并发布到 GitHub Pages。工作流也可以在 Actions 页面手动触发。
