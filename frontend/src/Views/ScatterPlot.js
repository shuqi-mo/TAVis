import React, { useRef, useEffect } from "react";
import * as d3 from "d3";

const ScatterPlot = ({
  data,
  performance,
  valueKey,
  colorStats,
  width,
  height,
}) => {
  const svgRef = useRef(null);

  useEffect(() => {
    if (!data || data.length === 0) return;

    // --- 1. 基础设置 ---
    const margin = { top: 10, right: 10, bottom: 10, left: 10 };

    // 选择并初始化 SVG
    const svg = d3
      .select(svgRef.current)
      .attr("width", width)
      .attr("height", height);

    // 清空之前的内容
    svg.selectAll("*").remove();

    // xScale / yScale
    const xExtent = d3.extent(data, (d) => d[1]);
    const yExtent = d3.extent(data, (d) => d[2]);
    const xScale = d3
      .scaleLinear()
      .domain(xExtent)
      .range([margin.left, width - margin.right]);
    const yScale = d3
      .scaleLinear()
      .domain(yExtent)
      .range([height - margin.bottom, margin.top]);

    // --- 2. 定义 clipPath (裁剪区域) ---
    const circleRadius = 5;
    const clipOffset = circleRadius;
    const clipId = "clip-scatter";
    const defs = svg.append("defs");
    defs
      .append("clipPath")
      .attr("id", clipId)
      .append("rect")
      .attr("x", margin.left - clipOffset)
      .attr("y", margin.top - clipOffset)
      .attr("width", width - margin.left - margin.right + clipOffset * 2)
      .attr("height", height - margin.top - margin.bottom + clipOffset * 2);

    // --- 3. 主绘图分组 & 绑定 clipPath ---
    const chartArea = svg
      .append("g")
      .attr("class", "chart-area")
      .attr("clip-path", `url(#${clipId})`);

    // 创建坐标轴 (初始状态)
    const xAxis = d3.axisBottom(xScale);
    const yAxis = d3.axisLeft(yScale);

    // 根据 performance 数据构造 diverging color scale
    let divergingScale = null;
    if (
      colorStats &&
      colorStats.min !== undefined &&
      colorStats.median !== undefined &&
      colorStats.max !== undefined
    ) {
      divergingScale = d3
        .scaleDiverging()
        .domain([colorStats.min, colorStats.median, colorStats.max])
        .interpolator((t) => d3.interpolateRdYlGn(1 - t));
    }
    // mapping: performance中各指标所在的下标
    const metricIndex = {
      totalTrades: 1,
      successRate: 2,
      avgReturn: 3,
      totalProfit: 4,
    };
    
    // 绘制主图散点
    // 定义获取填充颜色的函数
    const getFillColor = (d) => {
      // 若未传入 colorStats，则全部使用 steelblue
      if (!colorStats) {
        return "steelblue";
      }
      // 若传入 colorStats，并且 performance 存在，则根据 performance 数据更新颜色
      if (divergingScale && performance) {
        // 根据股票名称匹配 performance 数据（d[0] 为股票名称）
        const perf = performance.find((p) => p[0] === d[0]);
        if (perf) {
          const value = parseFloat(perf[metricIndex[valueKey]]);
          if (!isNaN(value)) {
            return divergingScale(value);
          }
        }
        return "gray"; // 若找不到匹配的 performance 或数值无效，则返回灰色
      }
      // 如果 colorStats 存在但未满足上述条件，默认返回 steelblue
      return "steelblue";
    };

    // 创建一个 tooltip DIV
    const tooltip = d3
      .select("body")
      .append("div")
      .style("position", "absolute")
      .style("padding", "4px 8px")
      .style("background", "rgba(255,255,255,0.9)")
      .style("border", "1px solid #ccc")
      .style("border-radius", "4px")
      .style("font-size", "12px")
      .style("visibility", "hidden") // 初始隐藏
      .style("pointer-events", "none"); // tooltip 不阻塞鼠标事件

    const circles = chartArea
      .selectAll("circle")
      .data(data)
      .enter()
      .append("circle")
      .attr("cx", (d) => xScale(d[1]))
      .attr("cy", (d) => yScale(d[2]))
      .attr("r", 5)
      .attr("fill", (d) => getFillColor(d))
      .attr("opacity", 0.8)
      .on("mouseover", function (event, d) {
        // 放大 + 高亮
        d3.select(this)
          .transition()
          .duration(100)
          .attr("r", 8)
          .attr("fill", "orange");

        // 显示 tooltip
        tooltip.style("visibility", "visible").text(`${d[0]}`);
      })
      .on("mousemove", (event) => {
        // 移动 tooltip
        tooltip
          .style("top", event.pageY + 6 + "px")
          .style("left", event.pageX + 6 + "px");
      })
      .on("mouseout", function (event, d) {
        // 鼠标移出时恢复原有颜色
        let fillColor = "gray";
        if (divergingScale && performance) {
          const perf = performance.find((p) => p[0] === d[0]);
          if (perf) {
            let value = parseFloat(perf[metricIndex[valueKey]]);
            if (!isNaN(value)) {
              fillColor = divergingScale(value);
            }
          }
        }
        d3.select(this)
          .transition()
          .duration(100)
          .attr("r", circleRadius)
          .attr("stroke", "none")
          .attr("fill", fillColor);
        tooltip.style("visibility", "hidden");
      });

    // --- 4. 缩放/拖拽行为 (让坐标轴与图表一起缩放) ---
    const zoomBehavior = d3
      .zoom()
      .scaleExtent([1, 5]) // 缩放范围
      .translateExtent([
        [0, 0],
        [width, height],
      ]) // 限制拖拽范围
      .on("zoom", zoomed);

    svg.call(zoomBehavior);

    // --- 5. 添加缩略图 ---
    // 缩略图尺寸设置（例如宽高各为主图的 1/6）
    const thumbWidth = width / 6;
    const thumbHeight = height / 6;
    const thumbMargin = { top: 5, right: 5, bottom: 5, left: 5 };

    // 缩略图中比例尺：使用与主图相同的 domain，但范围缩小
    const thumbXScale = d3
      .scaleLinear()
      .domain(xScale.domain())
      .range([0, thumbWidth - thumbMargin.left - thumbMargin.right]);
    const thumbYScale = d3
      .scaleLinear()
      .domain(yScale.domain())
      .range([thumbHeight - thumbMargin.bottom - thumbMargin.top, 0]); // 注意：y 轴翻转

    // 在主 SVG 中新增一个分组来绘制缩略图，放置于右上角（可根据需要调整位置）
    const thumbGroup = svg
      .append("g")
      .attr("class", "thumbnail")
      .attr("transform", `translate(${width - thumbWidth}, 0)`);

    // 绘制缩略图背景
    thumbGroup
      .append("rect")
      .attr("x", 0)
      .attr("y", 0)
      .attr("width", thumbWidth)
      .attr("height", thumbHeight)
      .attr("fill", "#f5f5f5")
      .attr("stroke", "#ccc");

    // 在缩略图中绘制所有数据点（用较小的圆点）
    thumbGroup
      .selectAll("circle")
      .data(data)
      .enter()
      .append("circle")
      .attr("cx", (d) => thumbXScale(d[1]) + thumbMargin.left)
      .attr("cy", (d) => thumbYScale(d[2]) + thumbMargin.top)
      .attr("r", 2)
      .attr("fill", (d) => getFillColor(d))
      .attr("opacity", 0.8);

    // 在缩略图中添加一个矩形框，用于指示当前主图的缩放区域
    const brushRect = thumbGroup
      .append("rect")
      .attr("class", "brush-rect")
      .attr("fill", "none")
      .attr("stroke", "orange")
      .attr("stroke-width", 1);

    // 根据当前缩放状态更新缩略图中矩形框的位置和大小
    function updateThumbBrush(transform) {
      // 使用当前缩放状态计算主图可见区域的数据域
      const newXScale = transform.rescaleX(xScale);
      const newYScale = transform.rescaleY(yScale);

      const xVisibleMin = newXScale.invert(margin.left);
      const xVisibleMax = newXScale.invert(width - margin.right);
      const yVisibleMax = newYScale.invert(margin.top); // 注意：y 轴翻转
      const yVisibleMin = newYScale.invert(height - margin.bottom);

      // 将数据域映射到缩略图的像素坐标
      const thumbX1 = thumbXScale(xVisibleMin) + thumbMargin.left;
      const thumbX2 = thumbXScale(xVisibleMax) + thumbMargin.left;
      const thumbY1 = thumbYScale(yVisibleMax) + thumbMargin.top;
      const thumbY2 = thumbYScale(yVisibleMin) + thumbMargin.top;

      brushRect
        .attr("x", thumbX1)
        .attr("y", thumbY1)
        .attr("width", thumbX2 - thumbX1)
        .attr("height", thumbY2 - thumbY1);
    }

    // 初始时设置缩略图中 brush 的位置（使用 identity transform）
    updateThumbBrush(d3.zoomIdentity);

    // --- 6. 缩放事件处理 ---
    function zoomed(event) {
      const transform = event.transform;
      // 更新主图中散点位置
      const newXScale = transform.rescaleX(xScale);
      const newYScale = transform.rescaleY(yScale);
      circles
        .attr("cx", (d) => newXScale(d[1]))
        .attr("cy", (d) => newYScale(d[2]));

      // 更新坐标轴
      svg.select(".x-axis").call(xAxis.scale(newXScale));
      svg.select(".y-axis").call(yAxis.scale(newYScale));

      // 同步更新缩略图中表示可视区域的矩形框
      updateThumbBrush(transform);
    }

    // 组件卸载时清理 tooltip
    return () => {
      tooltip.remove();
    };
  }, [data, performance, valueKey, colorStats, width, height]);

  return <svg ref={svgRef} />;
};

export default ScatterPlot;
