import React, { useRef, useEffect } from 'react';
import * as d3 from 'd3';

const ScatterPlot = ({ data, width, height }) => {
  const svgRef = useRef(null);

  useEffect(() => {
    if (!data || data.length === 0) return;

    // --- 1. 基础设置 ---
    const margin = { top: 20, right: 20, bottom: 30, left: 30 };

    // 选择并初始化 SVG
    const svg = d3
      .select(svgRef.current)
      .attr('width', width)
      .attr('height', height);

    // 清空之前的内容
    svg.selectAll('*').remove();

    // xScale / yScale
    const xExtent = d3.extent(data, (d) => d[0]);
    const yExtent = d3.extent(data, (d) => d[1]);
    const xScale = d3
      .scaleLinear()
      .domain(xExtent)
      .range([margin.left, width - margin.right]);
    const yScale = d3
      .scaleLinear()
      .domain(yExtent)
      .range([height - margin.bottom, margin.top]);

    // --- 2. 定义 clipPath (裁剪区域) ---
    const clipId = 'clip-scatter';
    const defs = svg.append('defs');
    defs
      .append('clipPath')
      .attr('id', clipId)
      .append('rect')
      .attr('x', margin.left)
      .attr('y', margin.top)
      .attr('width', width - margin.left - margin.right)
      .attr('height', height - margin.top - margin.bottom);

    // --- 3. 主绘图分组 & 绑定 clipPath ---
    const chartArea = svg
      .append('g')
      .attr('class', 'chart-area')
      .attr('clip-path', `url(#${clipId})`);

    // --- 4. 创建坐标轴 (初始状态) ---
    const xAxis = d3.axisBottom(xScale);
    const yAxis = d3.axisLeft(yScale);

    // x 轴
    svg
      .append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(0, ${height - margin.bottom})`)
      .call(xAxis);

    // y 轴
    svg
      .append('g')
      .attr('class', 'y-axis')
      .attr('transform', `translate(${margin.left}, 0)`)
      .call(yAxis);

    // --- 5. 绘制散点 ---
    // 先创建一个 tooltip DIV
    const tooltip = d3
      .select('body')
      .append('div')
      .style('position', 'absolute')
      .style('padding', '4px 8px')
      .style('background', 'rgba(255,255,255,0.9)')
      .style('border', '1px solid #ccc')
      .style('border-radius', '4px')
      .style('font-size', '12px')
      .style('visibility', 'hidden') // 初始隐藏
      .style('pointer-events', 'none'); // tooltip 不阻塞鼠标事件

    const circles = chartArea
      .selectAll('circle')
      .data(data)
      .enter()
      .append('circle')
      .attr('cx', (d) => xScale(d[0]))
      .attr('cy', (d) => yScale(d[1]))
      .attr('r', 5)
      .attr('fill', 'steelblue')
      .attr('opacity', 0.8)
      .on('mouseover', function (event, d) {
        // 放大 + 高亮
        d3.select(this)
          .transition()
          .duration(100)
          .attr('r', 8)
          .attr('fill', 'orange');

        // 显示 tooltip
        tooltip
          .style('visibility', 'visible')
          .text(`x = ${d[0].toFixed(2)}, y = ${d[1].toFixed(2)}`);
      })
      .on('mousemove', (event) => {
        // 移动 tooltip
        tooltip
          .style('top', event.pageY + 6 + 'px')
          .style('left', event.pageX + 6 + 'px');
      })
      .on('mouseout', function () {
        // 恢复原状
        d3.select(this)
          .transition()
          .duration(100)
          .attr('r', 5)
          .attr('fill', 'steelblue');

        // 隐藏 tooltip
        tooltip.style('visibility', 'hidden');
      });

    // --- 6. 缩放/拖拽行为 (让坐标轴与图表一起缩放) ---
    const zoomBehavior = d3
      .zoom()
      .scaleExtent([0.5, 5]) // 缩放范围
      .translateExtent([
        [0, 0],
        [width, height],
      ]) // 限制拖拽范围
      .on('zoom', (event) => {
        // 这里使用 "rescaleX" / "rescaleY" 来更新坐标
        const newXScale = event.transform.rescaleX(xScale);
        const newYScale = event.transform.rescaleY(yScale);

        // 1) 更新散点位置
        circles
          .attr('cx', (d) => newXScale(d[0]))
          .attr('cy', (d) => newYScale(d[1]));

        // 2) 更新坐标轴
        svg.select('.x-axis')
          .call(xAxis.scale(newXScale));
        svg.select('.y-axis')
          .call(yAxis.scale(newYScale));
      });

    svg.call(zoomBehavior);

    // 组件卸载时清理 tooltip
    return () => {
      tooltip.remove();
    };
  }, [data]);

  return <svg ref={svgRef} />;
};

export default ScatterPlot;
