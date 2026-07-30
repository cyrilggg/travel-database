# 中国一级行政区映射

`CN-admin1.csv` 把本快照中 GeoNames 的 31 个 `CN.*` 一级代码映射到中国大陆省级行政区的标准中文名与六位行政区划代码。目录使用标准中文名；匹配使用代码和 ID，不用模糊名称。

这份表只解决一级目录归属，不把 GeoNames 的 `PPLA*` 层级直接解释为中国法定城市级别。`CN.04` 等值是 GeoNames 内部代码，不是六位行政区划代码；例如 `CN.04` 对应江苏省，而江苏省的行政区划代码是 `320000`。

核验依据：

- [GeoNames admin1CodesASCII.txt](../raw/admin1CodesASCII.txt)：GeoNames 一级代码、英文名与 GeoNames ID；
- [行政区划代码管理办法](https://www.moj.gov.cn/pub/sfbgw/flfggz/flfggzbmgz/202512/t20251204_528920.html)：行政区划代码的管理与使用规则；
- [统计用区划代码和城乡划分代码编制规则](https://www.stats.gov.cn/sj/tjbz/gjtjbz/202302/t20230213_1902741.html)：县以上统一采用国家行政区划代码；
- [全国省级行政区划代码表（政府部门公开附件）](https://nynct.xinjiang.gov.cn/xjnynct/uploads/20230420113735pf24ovprby3.pdf)：31 个省级名称与六位代码对照。

核验日期：2026-07-30。后续若行政区划发生变化，应新建快照目录或带日期的映射版本，不覆盖本表。
