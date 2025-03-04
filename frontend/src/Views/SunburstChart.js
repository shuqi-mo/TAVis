import React, { useRef, useEffect } from "react";
import * as d3 from "d3";

const SunburstChart = ({ data, anova, width, height, colorAssignments }) => {
  const ref = useRef(null);

  useEffect(() => {
    if (!data || !colorAssignments || !anova) return;

    // 清空已有内容
    d3.select(ref.current).selectAll("*").remove();

    // 构造分区
    const radius = Math.min(width, height) / 2;
    const partition = d3.partition().size([2 * Math.PI, radius]);
    const offset = 40;
    const margintop = 40;
    const marginbottom = 40;

    const root = d3.hierarchy(data).sum((d) => d.value);
    partition(root);

    const patternNodes = root
      .descendants()
      .filter((d) => d.depth === 2 && d.data.profitStats);

    // 找到 (max - min) 最大的那个 pattern
    let referenceNode = null;
    let maxRange = -Infinity;
    patternNodes.forEach((node) => {
      const ps = node.data.profitStats;
      if (ps) {
        const range = ps.max - ps.min;
        if (range > maxRange) {
          maxRange = range;
          referenceNode = node;
        }
      }
    });

    // 如果意外没有找到任何 referenceNode，就直接退出
    if (!referenceNode) return;

    const differences = [];
    patternNodes.forEach((d) => {
      const ps = d.data.profitStats;
      if (ps) {
        differences.push(ps.q1 - ps.min); // offset
        differences.push(ps.q3 - ps.q1); // thickness
        differences.push(ps.max - ps.min); // range
      }
    });

    const globalDiffMin = d3.min(differences);
    const globalDiffMax = d3.max(differences);
    const singleScale = d3
      .scaleLinear()
      .domain([globalDiffMin, globalDiffMax])
      .range([0, 30]);
    // 基准节点的 min 半径，即"0 位置"
    const psRef = referenceNode.data.profitStats;
    const zeroVal = 0 - psRef.min;
    const zeroOffset = singleScale(zeroVal);
    const zeroRadius = referenceNode.y0 + zeroOffset;

    let dashedCircle = null;

    const arc = d3
      .arc()
      .startAngle((d) => d.x0)
      .endAngle((d) => d.x1)
      .innerRadius((d) => {
        if (d.depth === 1) {
          return d.y0 * 1.5;
        }
        const ps = d.data.profitStats;
        if (!ps) return d.y0;

        if (d === referenceNode) {
          // 基准 pattern => 保留原逻辑 offset
          const offset = singleScale(ps.q1 - ps.min);
          return d.y0 + offset;
        } else {
          // 其它 pattern => 让 profit=0 对齐 zeroRadius
          // => zeroValP = 0 - minP
          const zeroValP = 0 - ps.min;
          const zeroOffsetP = singleScale(zeroValP);
          // baseRadius = zeroRadius - zeroOffsetP => "min" for this pattern
          const baseRadius = zeroRadius - zeroOffsetP;
          // q1 => baseRadius + singleScale(q1 - minP)
          const offsetQ1 = singleScale(ps.q1 - ps.min);
          return baseRadius + offsetQ1;
        }
      })
      .outerRadius((d) => {
        if (d.depth === 1) {
          return d.y1;
        }
        const ps = d.data.profitStats;
        if (!ps) return d.y1;

        let inR; // inner radius
        if (d === referenceNode) {
          const offset = singleScale(ps.q1 - ps.min);
          inR = d.y0 + offset;
        } else {
          const zeroValP = 0 - ps.min;
          const zeroOffsetP = singleScale(zeroValP);
          const baseRadius = zeroRadius - zeroOffsetP;
          const offsetQ1 = singleScale(ps.q1 - ps.min);
          inR = baseRadius + offsetQ1;
        }
        const thickness = singleScale(ps.q3 - ps.q1);
        return inR + thickness;
      })
      // 圆角
      .cornerRadius(6);

    // 创建颜色映射
    const indicatorNames = data.children.map((child) => child.name);

    const patternSet = new Set();
    data.children.forEach((indicatorNode) => {
      indicatorNode.children.forEach((patternNode) => {
        patternSet.add(patternNode.name);
      });
    });
    const patternNames = Array.from(patternSet);

    // 为指标层定义颜色比例：domain = [MACD, RSI, BOLL, ...]
    const indicatorColorScale = d3
      .scaleOrdinal(d3.schemeCategory10)
      .domain(indicatorNames);

    // 为 pattern 层定义颜色比例：domain = [p1, p2, p3, ...]
    const patternColorScale = d3
      .scaleOrdinal(d3.schemeSet2)
      .domain(patternNames);

    // 创建SVG
    const svg = d3
      .select(ref.current)
      .append("svg")
      .attr("width", width)
      .attr("height", height);

    const gMain = svg
      .append("g")
      .attr(
        "transform",
        `translate(${width / 2}, ${height / 2 - offset + margintop})`
      );

    // 添加ANOVA全局信息显示区域
    const anovaTextGroup = gMain.append("g").attr("class", "anova-text");

    // 默认显示全局ANOVA信息
    anovaTextGroup
      .append("text")
      .attr("class", "anova-title")
      .attr("text-anchor", "middle")
      .attr("y", -15)
      .attr("fill", "#000")
      .text("ANOVA for global");

    anovaTextGroup
      .append("text")
      .attr("class", "anova-subtitle")
      .attr("text-anchor", "middle")
      .attr("y", 5)
      .attr("fill", "#000")
      .text("p value");

    anovaTextGroup
      .append("text")
      .attr("class", "anova-value")
      .attr("text-anchor", "middle")
      .attr("y", 30)
      .attr("fill", "#000")
      .attr("font-weight", "bold")
      .attr("font-size", "16px")
      .text(anova[0][1]);

    // 添加固定信息展示区域
    const infoPanel = svg
      .append("g")
      .attr("class", "info-panel")
      .attr("transform", `translate(${width / 2}, 20)`)
      .style("visibility", "hidden");

    infoPanel
      .append("text")
      .attr("class", "info-title")
      .attr("text-anchor", "middle")
      .attr("y", 0)
      .attr("font-weight", "bold")
      .attr("font-size", "12px");

    infoPanel
      .append("text")
      .attr("class", "info-stats")
      .attr("text-anchor", "middle")
      .attr("y", 20)
      .attr("font-size", "10px");

    //  绘制旭日图
    const nodes = root.descendants().filter((d) => d.depth > 0);
    const paths = gMain
      .selectAll("path")
      .data(nodes)
      .join("path")
      .attr("d", arc)
      .attr("fill", (d) => {
        if (d.depth === 1) {
          const colorMatch = colorAssignments.find(
            (item) => item[0] === d.data.name
          );
          return colorMatch ? colorMatch[1] : indicatorColorScale(d.data.name);
        } else if (d.depth === 2) {
          const median = d.data.profitStats?.median ?? 0;
          if (median < 0) {
            return "#fff"; // 白色填充
          } else {
            const colorMatch = colorAssignments.find(
              (item) => item[0] === d.data.name
            );
            return colorMatch ? colorMatch[1] : patternColorScale(d.data.name);
          }
        }
        return "none";
      })
      .attr("stroke", (d) => {
        if (d.depth === 2) {
          const colorMatch = colorAssignments.find(
            (item) => item[0] === d.data.name
          );
          return colorMatch ? colorMatch[1] : patternColorScale(d.data.name);
        } else {
          return "#fff";
        }
      })
      .attr("fill-opacity", 1);

    dashedCircle = gMain
      .append("circle")
      .attr("r", zeroRadius)
      .attr("stroke", "#666")
      .attr("stroke-width", 1)
      .attr("fill", "none")
      .style("stroke-dasharray", "4 2");

    const gPatternLines = gMain
      .selectAll(".pattern-line")
      .data(patternNodes)
      .join("g")
      .attr("class", "pattern-line")
      .attr("transform", (d) => {
        const angleMid = (d.x0 + d.x1) / 2;
        const deg = (angleMid * 180) / Math.PI;
        // const [cx, cy] = arc.centroid(d);
        // return `translate(${cx}, ${cy}) rotate(${deg})`;
        return `rotate(${deg})`;
      });

    gPatternLines.each(function (d) {
      const ps = d.data.profitStats;
      if (!ps) return;

      const lineVal = ps.max - ps.min; // 线段代表 (max-min)
      const lineLen = singleScale(lineVal);
      let minRadius;
      if (d === referenceNode) {
        minRadius = d.y0;
      } else {
        const zeroValP = 0 - ps.min;
        const zeroOffsetP = singleScale(zeroValP);
        minRadius = zeroRadius - zeroOffsetP;
      }
      // const strokeColor = patternColorScale(d.data.name);
      const colorMatch = colorAssignments.find(
        (item) => item[0] === d.data.name
      );
      let strokeColor = [];
      if (colorMatch) strokeColor = colorMatch[1];
      else strokeColor = patternColorScale(d.data.name);
      const sel = d3.select(this);

      // 竖线
      sel
        .append("line")
        .attr("x1", 0)
        .attr("y1", -minRadius)
        .attr("x2", 0)
        .attr("y2", -minRadius - lineLen)
        .attr("stroke", strokeColor)
        .attr("stroke-width", 2);

      // 顶端横杠 (可自行调节长度)
      const barLen = 6;
      sel
        .append("line")
        .attr("x1", -barLen / 2)
        .attr("y1", -minRadius - lineLen)
        .attr("x2", barLen / 2)
        .attr("y2", -minRadius - lineLen)
        .attr("stroke", strokeColor)
        .attr("stroke-width", 2);

      // 底端横杠
      sel
        .append("line")
        .attr("x1", -barLen / 2)
        .attr("y1", -minRadius)
        .attr("x2", barLen / 2)
        .attr("y2", -minRadius)
        .attr("stroke", strokeColor)
        .attr("stroke-width", 2);
    });

    // 鼠标交互事件
    paths
      .on("mouseover", function (event, d) {
        // 设置当前节点和父节点正常显示，其他节点透明度降低
        paths.attr("opacity", (node) => {
          if (node === d || (d.parent && node === d.parent)) {
            return 1;
          }
          return 0.3;
        });

        // 为线条组设置透明度，而不是单独的线条
        gPatternLines.attr("opacity", patternNode => {
          // 判断是否与当前选中节点相关
          if (d.depth === 1) {
            // 如果悬停在内环上，显示该内环下所有外环的线条
            return patternNode.parent && patternNode.parent.data.name === d.data.name ? 1 : 0.3;
          } else {
            // 如果悬停在外环上，只显示该外环的线条
            return patternNode === d ? 1 : 0.3;
          }
        });

        // 根据内环或外环显示不同内容
        if (d.depth === 1) {
          // 内环
          // 查找匹配的ANOVA值
          const anovaItem = anova.find((item) => item[0] === d.data.name);
          if (anovaItem) {
            // 获取内环颜色
            const colorMatch = colorAssignments.find(
              (item) => item[0] === d.data.name
            );
            const color = colorMatch
              ? colorMatch[1]
              : indicatorColorScale(d.data.name);

            // 更新中心显示
            anovaTextGroup
              .select(".anova-title")
              .attr("fill", color)
              .text(`ANOVA for ${d.data.name}`);

            anovaTextGroup
              .select(".anova-subtitle")
              .attr("fill", color)
              .text("p value");

            anovaTextGroup
              .select(".anova-value")
              .attr("fill", color)
              .text(anovaItem[1]);
          }
        } else if (d.depth === 2) {
          // 外环
          // 外环时显示其父节点（内环）的ANOVA信息
          const parentNode = d.parent;
          const anovaItem = anova.find(item => item[0] === parentNode.data.name);
          if (anovaItem) {
            // 获取父节点（内环）颜色
            const colorMatch = colorAssignments.find(item => item[0] === parentNode.data.name);
            const color = colorMatch ? colorMatch[1] : indicatorColorScale(parentNode.data.name);
            
            // 更新中心显示
            anovaTextGroup.select(".anova-title")
              .attr("fill", color)
              .text(`ANOVA for ${parentNode.data.name}`);
              
            anovaTextGroup.select(".anova-subtitle")
              .attr("fill", color)
              .text("p value");
              
            anovaTextGroup.select(".anova-value")
              .attr("fill", color)
              .text(anovaItem[1]);
          }
          // 在固定位置显示外环信息
          if (d.data.profitStats) {
            const colorMatch = colorAssignments.find(
              (item) => item[0] === d.data.name
            );
            const color = colorMatch
              ? colorMatch[1]
              : patternColorScale(d.data.name);

            // 格式化数据为两位小数的百分比
            const formatPercent = (value) => {
              return (value * 100).toFixed(2) + "%";
            };

            // 更新标题，使用不同颜色区分父节点和当前节点
            const parentNode = d.parent;
            const parentColorMatch = colorAssignments.find(
              (item) => item[0] === parentNode.data.name
            );
            const parentColor = parentColorMatch
              ? parentColorMatch[1]
              : indicatorColorScale(parentNode.data.name);

            // 移除之前的标题文本
            infoPanel.select(".info-title").remove();

            // 创建包含两种颜色的标题
            const titleGroup = infoPanel
              .append("g")
              .attr("class", "info-title")
              .style("visibility", "visible");

            // 父节点名称（使用父节点颜色）
            titleGroup
              .append("text")
              .attr("text-anchor", "end")
              .attr("x", -5) // 向左偏移，为分隔符留出空间
              .attr("y", 0)
              .attr("font-weight", "bold")
              .attr("font-size", "12px")
              .attr("fill", parentColor)
              .text(parentNode.data.name);

            // 分隔符
            titleGroup
              .append("text")
              .attr("text-anchor", "middle")
              .attr("x", 0)
              .attr("y", 0)
              .attr("font-weight", "bold")
              .attr("font-size", "12px")
              .attr("fill", "#333") // 中性颜色
              .text(" / ");

            // 当前节点名称（使用当前节点颜色）
            titleGroup
              .append("text")
              .attr("text-anchor", "start")
              .attr("x", 5) // 向右偏移，为分隔符留出空间
              .attr("y", 0)
              .attr("font-weight", "bold")
              .attr("font-size", "12px")
              .attr("fill", color)
              .text(d.data.name);

            // 更新统计数据
            infoPanel
              .select(".info-stats")
              .style("visibility", "visible")
              .attr("fill", color)
              .text(
                `Min: ${formatPercent(
                  d.data.profitStats.min
                )} | Q1: ${formatPercent(
                  d.data.profitStats.q1
                )} | Median: ${formatPercent(
                  d.data.profitStats.median
                )} | Q3: ${formatPercent(
                  d.data.profitStats.q3
                )} | Max: ${formatPercent(d.data.profitStats.max)}`
              );

            // 显示整个信息面板
            infoPanel.style("visibility", "visible");
          }
        }
      })
      // 移除mousemove事件处理程序，因为信息面板是固定位置的
      .on("mouseout", function () {
        // 恢复所有节点的透明度
        paths.attr("opacity", 1);

        // 恢复所有线条的透明度
        gPatternLines.attr("opacity", 1);

        // 重置为全局ANOVA
        anovaTextGroup
          .select(".anova-title")
          .attr("fill", "#000")
          .text("ANOVA for global");

        anovaTextGroup
          .select(".anova-subtitle")
          .attr("fill", "#000")
          .text("p value");

        anovaTextGroup
          .select(".anova-value")
          .attr("fill", "#000")
          .text(anova[0][1]);

        // 隐藏信息面板的所有文本
        infoPanel.style("visibility", "hidden");
        // 清除旧的标题组
        infoPanel.select(".info-title").remove();
        // 创建一个空的标题组，为下次使用做准备
        infoPanel
          .append("text")
          .attr("class", "info-title")
          .attr("text-anchor", "middle")
          .attr("y", 0)
          .attr("font-weight", "bold")
          .attr("font-size", "12px");
        // 隐藏统计信息
        infoPanel.select(".info-stats").style("visibility", "hidden");
        infoPanel.select(".info-stats-extra").style("visibility", "hidden");
      });

    // 为内层圆环添加文字
    gMain
      .selectAll("text.indicator-label")
      .data(root.descendants().filter((d) => d.depth === 1))
      .join("text")
      .attr("class", "indicator-label")
      .attr("transform", (d) => `translate(${arc.centroid(d)})`)
      .attr("text-anchor", "middle")
      .attr("font-size", "10px")
      .attr("font-weight", "bold")
      .attr("fill", "#000")
      .text((d) => (d.depth > 0 ? d.data.name : ""));

    // 添加图例
    const legend = svg
      .append("g")
      .attr("transform", `translate(20, ${height - marginbottom})`);

    const legendItemsPerRow = 3; // 每行显示最多 3 个
    const legendItemWidth = 100; // 每个图例的宽度
    const legendItemHeight = 20; // 每行高度

    const legendItems = legend
      .selectAll(".legend-item")
      .data(patternNames)
      .enter()
      .append("g")
      .attr("class", "legend-item")
      .attr("transform", (d, i) => {
        const row = Math.floor(i / legendItemsPerRow);
        const col = i % legendItemsPerRow;
        return `translate(${col * legendItemWidth}, ${row * legendItemHeight})`;
      });

    legendItems
      .append("rect")
      .attr("width", 15)
      .attr("height", 15)
      .attr("fill", (d) => {
        const colorMatch = colorAssignments.find((item) => item[0] === d);
        return colorMatch ? colorMatch[1] : patternColorScale(d);
      });

    legendItems
      .append("text")
      .attr("x", 20)
      .attr("y", 12)
      .attr("font-size", "12px")
      .attr("fill", "#000")
      .text((d) => d);

    // 组件卸载时不需要额外清理，因为所有元素都在SVG内部
  }, [data, width, height, colorAssignments, anova]);

  return <div ref={ref} width={width} height={height} />;
};

export default SunburstChart;
