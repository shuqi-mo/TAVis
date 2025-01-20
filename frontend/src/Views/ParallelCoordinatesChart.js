import React, { useRef, useEffect } from "react";
import * as d3 from "d3";

const ParallelCoordinatesChart = ({ data }) => {
  const svgRef = useRef(null);

  useEffect(() => {

    // 2. 设置画布尺寸和边距
    const width = 250;
    const height = 400;
    const margin = { top: 30, right: 10, bottom: 10, left: 5 };

    // 3. 获取 SVG，并清空之前的内容（以便重复渲染时不叠加）
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    // 4. 定义需要绘制的维度（不包含 name，因为 name 是字符串，不适合作为坐标轴）
    const dimensions = ["totalTrades", "successRate", "avgReturn", "totalProfit"];

    const colorScale = d3
      .scaleOrdinal(d3.schemeCategory10)
      .domain(data.map((d) => d.name));

    // 5. 为每个维度定义一个 yScale
    //    根据各维度的值域动态生成比例尺
    const yScales = {};
    dimensions.forEach((dim) => {
      yScales[dim] = d3
        .scaleLinear()
        .domain(d3.extent(data, (d) => d[dim])) // 取该维度的最小值和最大值
        .range([height - margin.bottom, margin.top]); 
    });

    // 6. 定义 xScale，用来分布各个维度在水平方向的位置
    const xScale = d3
      .scalePoint()
      .range([margin.left, width - margin.right])
      .padding(0.5)
      .domain(dimensions);

    // 7. 在平行坐标中，通常每一条线代表一条数据
    //    定义画路径的函数 path(d)
    //    把每个维度映射到 (xScale(维度), yScales[该维度](d[该维度])) 上，再用 line 连接起来
    const lineGenerator = d3.line();
    const path = (d) => {
      return lineGenerator(
        dimensions.map((dim) => [xScale(dim), yScales[dim](d[dim])])
      );
    };

    // 8. 绘制所有数据对应的路径
    svg
      .selectAll(".data-line")
      .data(data)
      .enter()
      .append("path")
      .attr("class", "data-line")
      .attr("d", path)
      .attr("fill", "none")
      .attr("stroke", (d) => colorScale(d.name))
      .attr("stroke-width", 1)
      .attr("opacity", 0.7);

    // 9. 绘制每个维度的坐标轴
    dimensions.forEach((dim) => {
      svg
        .append("g")
        .attr("transform", `translate(${xScale(dim)}, 0)`)
        .call(d3.axisLeft(yScales[dim]).ticks(5)) // 你可以根据需要调整刻度数量
        .append("text")
        .attr("y", margin.top - 10)
        .attr("x", 0)
        .attr("text-anchor", "middle")
        .attr("fill", "black")
        .text(dim);
    });
    // 10. 添加图例 (Legend)
    const uniqueNames = [...new Set(data.map((d) => d.name))];
    const legend = svg
      .append("g")
      .attr("class", "legend")
      .attr("transform", `translate(${width - margin.right}, ${margin.top})`);

    uniqueNames.forEach((name, i) => {
      legend
        .append("rect")
        .attr("x", 0)
        .attr("y", i * 20)
        .attr("width", 12)
        .attr("height", 12)
        .style("fill", colorScale(name))
        .style("stroke", "#333");

      legend
        .append("text")
        .attr("x", 20)
        .attr("y", i * 20 + 10)
        .attr("font-size", 12)
        .attr("alignment-baseline", "middle")
        .text(name);
    });
  }, [data]);

  return (
    <div style={{ textAlign: "center" }}>
      <svg ref={svgRef} width={300} height={400} />
    </div>
  );
};

export default ParallelCoordinatesChart;
