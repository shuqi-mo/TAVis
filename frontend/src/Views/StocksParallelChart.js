import React, { useEffect, useRef } from "react";
import * as d3 from "d3";

const StocksParallelChart = ({ stocks }) => {
  const svgRef = useRef();

  const calculatePerformance = (stock) => {
    const totalTrades = stock.success.reduce(
      (sum, successArray) => sum + successArray.length,
      0
    );

    const totalSuccessCount = stock.success.reduce(
      (sum, successArray) =>
        sum + successArray.filter((val) => val === 1).length,
      0
    );
    const successRate = totalSuccessCount / totalTrades;

    const totalReturnSum = stock.singlereturn.reduce(
      (sum, returnArray) =>
        sum + returnArray.reduce((innerSum, val) => innerSum + val, 0),
      0
    );
    const totalReturnCount = stock.singlereturn.reduce(
      (sum, returnArray) => sum + returnArray.length,
      0
    );
    const avgReturn = totalReturnSum / totalReturnCount;

    const totalProfit = stock.totalprofit[stock.totalprofit.length - 1].reduce(
      (sum, profit) => sum + profit,
      0
    );

    return {
      name: stock.name,
      totalTrades,
      successRate,
      avgReturn,
      totalProfit,
    };
  };

  useEffect(() => {
    const data = stocks.map((stock) => calculatePerformance(stock));

    const width = 250;
    const height = 300;
    const margin = { top: 30, right: 10, bottom: 10, left: 10 };

    const dimensions = [
      "totalTrades",
      "successRate",
      "avgReturn",
      "totalProfit",
    ];

    const colorScale = d3
          .scaleOrdinal(d3.schemeCategory10)
          .domain(data.map((d) => d.name));

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

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

    const uniqueNames = [...new Set(data.map((d) => d.name))];
    const legend = svg
      .append("g")
      .attr("class", "legend")
      .attr(
        "transform",
        `translate(${width - margin.right + 20}, ${margin.top})`
      );

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
  }, [stocks]);

  return (
    <div style={{ textAlign: "center" }}>
      <svg ref={svgRef} width={350} height={300} />
    </div>
  );
};

export default StocksParallelChart;
