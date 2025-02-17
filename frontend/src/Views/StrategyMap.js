import React, { useRef, useState, useEffect } from "react";
import * as d3 from "d3";

const StrategyMap = ({
  data,
  width,
  height,
  onNodeClick,
  valueKey = "totalTrades",
  selectedNode,
}) => {
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const [tooltip, setTooltip] = useState({
    show: false,
    x: 0,
    y: 0,
    content: "",
  });

  useEffect(() => {
    if (!data) return;
    // 清空之前的内容
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const padding = 40;

    // 设置 SVG 的宽高
    svg.attr("width", width + padding).attr("height", height);

    // 创建层级数据
    const root = d3.hierarchy(data);

    // 创建树形布局（横向）
    const treeLayout = d3.tree().size([height, width]); // 高度决定节点的纵向分布，宽度决定横向分布
    treeLayout(root);

    // 获取所有节点和连线
    const nodes = root.descendants();
    const links = root.links();

    // 颜色比例尺，根据节点的 value 映射颜色
    const maxValue = d3.max(nodes, (d) => d.data[valueKey]) || 1;
    const colorScale = d3
      .scaleSequential(d3.interpolateBlues)
      .domain([0, maxValue]);

    // 定义渐变
    const defs = svg.append("defs");

    links.forEach((link, index) => {
      const gradientId = `gradient-${index}`;

      const gradient = defs
        .append("linearGradient")
        .attr("id", gradientId)
        .attr("gradientUnits", "userSpaceOnUse")
        .attr("x1", link.source.x)
        .attr("y1", link.source.y)
        .attr("x2", link.target.x)
        .attr("y2", link.target.y);

      gradient
        .append("stop")
        .attr("offset", "0%")
        .attr("stop-color", colorScale(link.source.data[valueKey]));

      gradient
        .append("stop")
        .attr("offset", "100%")
        .attr("stop-color", colorScale(link.target.data[valueKey]));

      link.gradientId = gradientId;
    });

    // 绘制连线
    svg
      .append("g")
      .selectAll("path")
      .data(links)
      .join("path")
      .attr(
        "d",
        d3
          .linkHorizontal()
          .x((d) => d.y + 20) // 平移以留出边距（横向）
          .y((d) => d.x)
      )
      .attr("fill", "none")
      .attr("stroke", (d) => `url(#${d.gradientId})`)
      .attr("stroke-width", 8)
      .attr("opacity", 0.8);

    // 绘制节点
    const nodeGroup = svg
      .append("g")
      .selectAll("g")
      .data(nodes)
      .join("g")
      .attr("transform", (d) => `translate(${d.y + 20},${d.x})`); // 平移以留出边距

    // 定义鼠标事件处理函数
    const handleMouseOver = () => {
      setTooltip((t) => ({ ...t, show: true }));
    };

    const handleMouseOut = () => {
      setTooltip((t) => ({ ...t, show: false }));
    };

    const handleMouseMove = (event, d) => {
      if (!containerRef.current) return;

      // 计算容器相对于页面的偏移
      const rect = containerRef.current.getBoundingClientRect();

      // 让 tooltip 跟随鼠标，但要减去容器的 left/top
      const x = event.clientX - rect.left + 10;
      const y = event.clientY - rect.top + 10;

      // 你想显示的内容，比如节点的 name、value1、value2、value3
      const { totalTrades, successRate, avgReturn, totalProfit } = d.data;
      const content = `
        <div>totalTrades: ${totalTrades ?? "-"}</div>
        <div>successRate: ${
          successRate != null ? (successRate * 100).toFixed(2) + "%" : "-"
        }</div>
        <div>avgReturn: ${
          avgReturn != null ? (avgReturn * 100).toFixed(2) + "%" : "-"
        }</div>
        <div>totalProfit: ${
          totalProfit != null ? totalProfit.toFixed(2) : "-"
        }</div>
      `;
      setTooltip({
        show: true,
        x,
        y,
        content,
      });
    };

    // 节点圆形
    nodeGroup
      .append("circle")
      .attr("r", (d) => 16) // 固定半径，或根据需要调整
      .attr("fill", (d) => colorScale(d.data[valueKey]))
      .attr("stroke", (d) => {
        // 如果是选中节点，则显示明显的红色外框
        if (selectedNode && selectedNode.data.code === d.data.code) {
          return "#f00";
        }
        return "#333";
      })
      .attr("stroke-width", (d) => {
        // 选中节点加粗，否则正常
        if (selectedNode && selectedNode.data.code === d.data.code) {
          return 3;
        }
        return 1;
      })
      .attr("cursor", "pointer")
      .on("click", (event, d) => {
        event.stopPropagation();
        onNodeClick?.(d);
      })
      .on("mouseover", handleMouseOver)
      .on("mousemove", handleMouseMove)
      .on("mouseout", handleMouseOut);

    // 节点标签
    nodeGroup
      .append("text")
      .attr("dy", 4)
      .attr("x", (d) => (d.children ? -25 : 25)) // 如果有子节点，标签在左侧，否则在右侧
      .attr("text-anchor", (d) => (d.children ? "end" : "start"))
      .text((d) => d.data.name)
      .style("font-size", "12px")
      .attr("cursor", "pointer")
      .on("click", (event, d) => {
        // 避免点击文本也触发事件冲突，这里让其同样回调 onNodeClick
        event.stopPropagation();
        onNodeClick?.(d);
      });
  }, [data, width, height, onNodeClick, valueKey, selectedNode]);

  return (
    <div ref={containerRef} style={{ position: "relative", width, height }}>
      <svg ref={svgRef} width={width} height={height} />

      {tooltip.show && (
        <div
          style={{
            position: "absolute",
            top: tooltip.y,
            left: tooltip.x,
            background: "rgba(0,0,0,0.7)",
            color: "#fff",
            pointerEvents: "none",
            borderRadius: 4,
            padding: "4px 8px",
            fontSize: "12px",
            maxWidth: 200,
            zIndex: 999,
          }}
          dangerouslySetInnerHTML={{ __html: tooltip.content }}
        />
      )}
    </div>
  );
};

export default StrategyMap;
