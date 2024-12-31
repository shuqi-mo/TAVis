import React, { useRef, useEffect } from 'react';
import * as d3 from 'd3';

const LineChart = ({ lines }) => {
  const svgRef = useRef();

  useEffect(() => {
    // 获取 SVG 的宽高
    const width = 800;
    const height = 400;

    // 创建 SVG 元素
    const svg = d3.select(svgRef.current)
      .attr("width", width)
      .attr("height", height);

    // 设置比例尺
    const xScale = d3.scaleLinear()
      .domain([0, lines[0].length - 1]) // 假设每个线的数据点数量一样
      .range([0, width]);

    const yScale = d3.scaleLinear()
      .domain([d3.min(lines.flat()), d3.max(lines.flat())])  // 根据所有线的值来设定 y 轴范围
      .range([height, 0]);

    // 创建线生成器
    const lineGenerator = d3.line()
      .x((d, i) => xScale(i))
      .y(d => yScale(d));

    // 绘制三条线
    lines.forEach((lineData, index) => {
      svg.append("path")
        .data([lineData])
        .attr("class", `line line-${index}`)
        .attr("d", lineGenerator)
        .attr("fill", "none")
        .attr("stroke", d3.schemeCategory10[index]) // 使用不同颜色
        .attr("stroke-width", 2);
    });

    // 添加 x 轴
    svg.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(xScale));

    // 添加 y 轴
    svg.append("g")
      .call(d3.axisLeft(yScale));

  }, [lines]);

  return (
    <svg ref={svgRef}></svg>
  );
};

export default LineChart;
