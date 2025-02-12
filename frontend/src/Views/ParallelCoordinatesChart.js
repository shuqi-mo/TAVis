import React, { useRef, useEffect } from "react";
import * as d3 from "d3";

const ParallelCoordinatesChart = ({ data, width, height }) => {
  const svgRef = useRef(null);

  useEffect(() => {
    // 2. 设置画布尺寸和边距
    const margin = { top: 30, right: 5, bottom: 50, left: 0 };

    // 3. 获取 SVG，并清空之前的内容（以便重复渲染时不叠加）
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    // 4. 定义需要绘制的维度（不包含 name，因为 name 是字符串，不适合作为坐标轴）
    const dimensions = [
      "totalTrades",
      "successRate",
      "avgReturn",
      "totalProfit",
    ];

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
    // 根据文本宽度进行动态换行
    const legendG = svg
      .append("g")
      .attr("class", "legend")
      .attr(
        "transform",
        `translate(${margin.left}, ${height - margin.bottom + 20})`
      );

    // 为了测量文本宽度，需要一个临时的测量容器
    const measureG = svg
      .append("g")
      .attr("class", "measure-temp")
      .attr("opacity", 0);

    let currentX = 0;
    let currentY = 0;
    const lineHeight = 20; // 每一行的高度
    const maxLegendWidth = width - margin.left - margin.right; // 图例可使用的最大宽度

    uniqueNames.forEach((name, i) => {
      // 先创建一个临时文本来测量宽度
      const tempText = measureG.append("text").attr("font-size", 12).text(name);

      // 测量后获取 bounding box
      const bbox = tempText.node().getBBox();
      const textWidth = bbox.width;

      // 再加上颜色方块 + 间隔等宽度 (假设方块 12px + 间距 8px)
      const itemWidth = textWidth + 12 + 8 + 10; // 额外留一些余量

      // 如果放不下，换行
      if (currentX + itemWidth > maxLegendWidth) {
        currentX = 0;
        currentY += lineHeight;
      }

      // 在 legendG 中添加图例项
      const itemG = legendG
        .append("g")
        .attr("transform", `translate(${currentX}, ${currentY})`);

      // 颜色方块
      itemG
        .append("rect")
        .attr("x", 0)
        .attr("y", -6)
        .attr("width", 12)
        .attr("height", 12)
        .style("fill", colorScale(name));

      // 文本
      itemG
        .append("text")
        .attr("x", 20)
        .attr("y", 0)
        .attr("font-size", 12)
        .attr("alignment-baseline", "middle")
        .text(name);

      // 更新 currentX，使下一个图例项紧接着放在后面
      currentX += itemWidth;

      // 移除临时文本节点，准备测量下一个图例项
      tempText.remove();
    });

    // 最后移除测量容器
    measureG.remove();
  }, [data]);

  return (
    <div style={{ textAlign: "center" }}>
      <svg ref={svgRef} width={width} height={height} />
    </div>
  );
};

export default ParallelCoordinatesChart;
