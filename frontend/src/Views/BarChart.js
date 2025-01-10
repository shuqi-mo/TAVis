import React, { useRef, useEffect } from 'react';
import * as d3 from 'd3';
import './BarChart.css';

const BarChart = ({ data, width = 450, height = 150 }) => {
  const svgRef = useRef();

  useEffect(() => {
    // 设置边距
    const margin = { top: 10, right: 10, bottom: 20, left: 0 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // 复制并排序数据以避免直接修改props
    const sortedData = [...data].sort((a, b) => {
      const numA = parseInt(a.key.replace(/\D/g, ''), 10);
      const numB = parseInt(b.key.replace(/\D/g, ''), 10);
      return numA - numB;
    });

    // 创建SVG容器
    const svg = d3.select(svgRef.current)
                  .attr('viewBox', `0 0 ${width} ${height}`)
                  .attr('preserveAspectRatio', 'xMidYMid meet');

    // 清除之前的内容
    svg.selectAll('*').remove();

    // 创建一个组元素，应用边距
    const chart = svg.append('g')
                     .attr('transform', `translate(${margin.left},${margin.top})`);

    // 设置x轴比例尺（类目）
    const x = d3.scaleBand()
                .domain(sortedData.map(d => d.key))
                .range([0, innerWidth])
                .padding(0.2);

    // 添加x轴
    chart.append('g')
         .attr('transform', `translate(0, ${innerHeight})`)
         .call(d3.axisBottom(x))
         .selectAll('text')
         .attr('class', 'axis-label')
         .style('text-anchor', 'middle');

    // 设置y轴比例尺（数值）
    const y = d3.scaleLinear()
                .domain([0, d3.max(sortedData, d => d.value) + 5]) // 增加一些空间
                .range([innerHeight, 0]);

    // 添加y轴
    // chart.append('g')
    //      .call(d3.axisLeft(y))
    //      .selectAll('text')
    //      .attr('class', 'axis-label');

    // 创建工具提示
    const tooltip = d3.select('body')
                      .append('div')
                      .attr('class', 'tooltip')
                      .style('opacity', 0);

    // 绘制柱状图
    chart.selectAll('.bar')
         .data(sortedData)
         .enter()
         .append('rect')
         .attr('class', 'bar')
         .attr('x', d => x(d.key))
         .attr('width', x.bandwidth())
         .attr('y', innerHeight) // 初始y位置在图表底部
         .attr('height', 0) // 初始高度为0
         .on('mouseover', function(event, d) {
           tooltip.transition()
                  .duration(200)
                  .style('opacity', .9);
           tooltip.html(`pattern: ${d.key}<br/>value: ${d.value}`)
                  .style('left', (event.pageX) + 'px')
                  .style('top', (event.pageY - 28) + 'px');
           d3.select(this).style('fill', 'orange');
         })
         .on('mouseout', function(d) {
           tooltip.transition()
                  .duration(500)
                  .style('opacity', 0);
           d3.select(this).style('fill', 'steelblue');
         })
         .transition()
         .duration(800)
         .attr('y', d => y(d.value))
         .attr('height', d => innerHeight - y(d.value));

    // 添加x轴标签
    chart.append('text')
         .attr('class', 'axis-label')
         .attr('x', innerWidth / 2)
         .attr('y', innerHeight + margin.bottom - 10)
         .style('text-anchor', 'middle');

    // 添加y轴标签
    chart.append('text')
         .attr('class', 'axis-label')
         .attr('transform', 'rotate(-90)')
         .attr('x', -innerHeight / 2)
         .attr('y', -margin.left + 15)
         .style('text-anchor', 'middle');

    // 清理工具提示
    return () => {
      tooltip.remove();
    };

  }, [data, width, height]);

  return (
    <svg ref={svgRef} className="bar-chart"></svg>
  );
};

export default BarChart;