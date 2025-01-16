import React, { useRef, useEffect } from "react";
import * as d3 from "d3";

const ParallelCoordinatesChart = ({ indicators }) => {
  const svgRef = useRef(null);

  useEffect(() => {
    // 如果没有数据则不进行渲染
    if (!indicators || indicators.length === 0) return;

    // 1. 先将数据格式化，提取与表格对应的指标：totalTrades, successRate, avgReturn, totalProfit
    const data = indicators.map((indicator) => {
      const successCount = indicator.success.filter((s) => s === 1).length;
      const successRate = successCount / indicator.success.length;
      const avgReturn =
        indicator.singlereturn.reduce((sum, value) => sum + value, 0) /
        indicator.singlereturn.length;
      const totalProfit =
        indicator.totalprofit[indicator.totalprofit.length - 1];

      return {
        name: indicator.name,         // 虽然 name 不用于平行坐标的绘图轴，但可以在鼠标悬停时显示
        totalTrades: indicator.success.length,
        successRate: successRate,
        avgReturn: avgReturn,
        totalProfit: totalProfit,
      };
    });

    // 2. 设置画布尺寸和边距
    const width = 280;
    const height = 300;
    const margin = { top: 30, right: 10, bottom: 30, left: 10 };

    // 3. 获取 SVG，并清空之前的内容（以便重复渲染时不叠加）
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    // 4. 定义需要绘制的维度（不包含 name，因为 name 是字符串，不适合作为坐标轴）
    const dimensions = ["totalTrades", "successRate", "avgReturn", "totalProfit"];

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
      .attr("stroke", "steelblue")
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
  }, [indicators]);

  return (
    <div style={{ textAlign: "center" }}>
      <svg ref={svgRef} width={800} height={400} />
    </div>
  );
};

export default ParallelCoordinatesChart;
