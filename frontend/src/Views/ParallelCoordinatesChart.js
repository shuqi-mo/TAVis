import React, { useRef, useState, useEffect } from "react";
import * as d3 from "d3";

const ParallelCoordinatesChart = ({
  data,
  width,
  height,
  colorAssignments,
}) => {
  const svgRef = useRef(null);

  // 维度管理状态
  const [activeDimensions, setActiveDimensions] = useState([
    "totalTrades",
    "successRate",
    "avgReturn",
    "totalProfit",
  ]);

  // 连线显示状态
  const [lineVisibility, setLineVisibility] = useState({});

  // 更新坐标轴连线显示状态
  const toggleLineVisibility = (dim) => {
    // 复制现有的 lineVisibility 状态对象
    const newVisibility = { ...lineVisibility };

    // 遍历所有相邻坐标轴的组合
    for (let i = 0; i < activeDimensions.length - 1; i++) {
      const currentDim = activeDimensions[i];
      const nextDim = activeDimensions[i + 1];

      // 如果当前维度是被双击的坐标轴或其相邻坐标轴，切换连线显示状态
      if (dim === currentDim) {
        const lineKey = `${currentDim}-${nextDim}`;
        // 切换该连线的显示状态
        newVisibility[lineKey] = !newVisibility[lineKey];
      }
    }
    // 更新 lineVisibility 状态，保留其他连线的状态
    setLineVisibility(newVisibility);
  };

  useEffect(() => {
    if (!colorAssignments) return;

    const margin = { top: 30, right: 5, bottom: 50, left: 0 };
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove(); // 每次更新时清空之前的内容

    const colorScale = d3
      .scaleOrdinal(d3.schemeCategory10)
      .domain(data.map((d) => d.name));

    // 根据 activeDimensions 动态定义 yScales
    const yScales = {};
    activeDimensions.forEach((dim) => {
      yScales[dim] = d3
        .scaleLinear()
        .domain(d3.extent(data, (d) => d[dim]))
        .range([height - margin.bottom, margin.top]);
    });

    const xScale = d3
      .scalePoint()
      .range([margin.left, width - margin.right])
      .padding(0.5)
      .domain(activeDimensions);

    const path = (d) => {
      const points = [];
      for (let i = 0; i < activeDimensions.length - 1; i++) {
        const currentDim = activeDimensions[i];
        const nextDim = activeDimensions[i + 1];
        const lineKey = `${currentDim}-${nextDim}`;
        if (lineVisibility[lineKey]) {
          points.push([xScale(currentDim), yScales[currentDim](d[currentDim])]);
          points.push([xScale(nextDim), yScales[nextDim](d[nextDim])]);
        }
      }
      return d3.line()(points);
    };

    // 绘制坐标轴
    activeDimensions.forEach((dim, index) => {
      svg
        .append("g")
        .attr("transform", `translate(${xScale(dim)}, 0)`)
        .call(d3.axisLeft(yScales[dim]).ticks(5))
        .append("text")
        .attr("y", margin.top - 10)
        .attr("x", 0)
        .attr("text-anchor", "middle")
        .attr("fill", "black")
        .text(dim)
        .on("dblclick", () => toggleLineVisibility(dim)); // 双击事件，切换连线显示状态
    });
    // 清除旧的连线路径
    svg.selectAll(".line-link").remove();

    // 绘制坐标轴之间的连线
    svg
      .selectAll(".line-link")
      .data(data)
      .enter()
      .append("path")
      .attr("class", "line-link")
      .attr("d", path)
      .attr("fill", "none")
      .attr("stroke", (d) => {
        const colorMatch = colorAssignments.find((item) => item[0] === d.name);
        return colorMatch ? colorMatch[1] : colorScale(d.name);
      })
      .attr("stroke-width", 1)
      .attr("opacity", 0.7);

    // 绘制每个坐标轴上的数据点
    activeDimensions.forEach((dim) => {
      svg
        .selectAll(`.data-point-${dim}`)
        .data(data)
        .enter()
        .append("circle")
        .attr("class", `data-point-${dim}`)
        .attr("cx", xScale(dim))
        .attr("cy", (d) => yScales[dim](d[dim]))
        .attr("r", 4)
        .attr("fill", (d) => {
          const colorMatch = colorAssignments.find(
            (item) => item[0] === d.name
          );
          return colorMatch ? colorMatch[1] : colorScale(d.name);
        })
        .attr("opacity", 0.7);
    });

    // 图例绘制部分
    const uniqueNames = [...new Set(data.map((d) => d.name))];
    const legendG = svg
      .append("g")
      .attr("class", "legend")
      .attr(
        "transform",
        `translate(${margin.left}, ${height - margin.bottom + 15})`
      );

    const measureG = svg
      .append("g")
      .attr("class", "measure-temp")
      .attr("opacity", 0);

    let currentX = 0;
    let currentY = 0;
    const lineHeight = 15;
    const maxLegendWidth = width - margin.left - margin.right;

    uniqueNames.forEach((name, i) => {
      const tempText = measureG.append("text").attr("font-size", 10).text(name);
      const bbox = tempText.node().getBBox();
      const textWidth = bbox.width;
      const itemWidth = textWidth + 12 + 8 + 10;

      if (currentX + itemWidth > maxLegendWidth) {
        currentX = 0;
        currentY += lineHeight;
      }

      const itemG = legendG
        .append("g")
        .attr("transform", `translate(${currentX}, ${currentY})`);

      itemG
        .append("rect")
        .attr("x", 0)
        .attr("y", -6)
        .attr("width", 12)
        .attr("height", 12)
        .style("fill", () => {
          const colorMatch = colorAssignments.find((item) => item[0] === name);
          return colorMatch ? colorMatch[1] : colorScale(name);
        });

      itemG
        .append("text")
        .attr("x", 15)
        .attr("y", 0)
        .attr("font-size", 10)
        .attr("alignment-baseline", "middle")
        .text(name);

      currentX += itemWidth;
      tempText.remove();
    });

    measureG.remove();
  }, [data, colorAssignments, activeDimensions, lineVisibility]);

  const handleDimensionClick = (dim) => {
    setActiveDimensions((prev) =>
      prev.includes(dim)
        ? prev.filter((dimension) => dimension !== dim)
        : [...prev, dim]
    );
  };

  // 坐标轴选择按钮
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ display: "flex", justifyContent: "center" }}>
        {["totalTrades", "successRate", "avgReturn", "totalProfit"].map(
          (dim) => (
            <div
              key={dim}
              onClick={() => handleDimensionClick(dim)}
              style={{
                margin: "0 10px",
                cursor: "pointer",
                color: activeDimensions.includes(dim) ? "black" : "gray",
              }}
            >
              {dim}
            </div>
          )
        )}
      </div>
      <svg ref={svgRef} width={width} height={height} />
    </div>
  );
};

export default ParallelCoordinatesChart;
