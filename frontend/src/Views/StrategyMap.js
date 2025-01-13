import React, { useRef, useEffect } from 'react';
import * as d3 from 'd3';

const StrategyMap = ({ width = 460, height = 450 }) => {
  const svgRef = useRef(null);

  const data = {
    name: 'Start',
    value: 10,
    children: [
      {
        name: 'Train',
        value: 8,
        children: [
          { name: 'Quantize', value: 6 },
          { name: 'Magnitude', value: 4 },
        ],
      },
      {
        name: 'Gradient',
        value: 5,
        children: [
          { name: 'Prune', value: 3 },
          { name: 'Calibrate', value: 2 },
        ],
      },
    ],
  };

  useEffect(() => {
    // 清空之前的内容
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    // 设置 SVG 的宽高
    svg.attr('width', width).attr('height', height);

    // 创建层级数据
    const root = d3.hierarchy(data);

    // 创建树形布局（横向）
    const treeLayout = d3.tree().size([height - 100, width - 200]); // 高度决定节点的纵向分布，宽度决定横向分布
    treeLayout(root);

    // 获取所有节点和连线
    const nodes = root.descendants();
    const links = root.links();

    // 颜色比例尺，根据节点的 value 映射颜色
    const maxValue = d3.max(nodes, d => d.data.value) || 1;
    const colorScale = d3.scaleSequential(d3.interpolateBlues).domain([0, maxValue]);

    // 定义渐变
    const defs = svg.append('defs');

    links.forEach((link, index) => {
      const gradientId = `gradient-${index}`;

      const gradient = defs.append('linearGradient')
        .attr('id', gradientId)
        .attr('gradientUnits', 'userSpaceOnUse')
        .attr('x1', link.source.x)
        .attr('y1', link.source.y)
        .attr('x2', link.target.x)
        .attr('y2', link.target.y);

      gradient.append('stop')
        .attr('offset', '0%')
        .attr('stop-color', colorScale(link.source.data.value));

      gradient.append('stop')
        .attr('offset', '100%')
        .attr('stop-color', colorScale(link.target.data.value));

      link.gradientId = gradientId;
    });

    // 绘制连线
    svg.append('g')
      .selectAll('path')
      .data(links)
      .join('path')
      .attr('d', d3.linkHorizontal()
        .x(d => d.y + 100) // 平移以留出边距（横向）
        .y(d => d.x))
      .attr('fill', 'none')
      .attr('stroke', d => `url(#${d.gradientId})`)
      .attr('stroke-width', 2)
      .attr('opacity', 0.8);

    // 绘制节点
    const nodeGroup = svg.append('g')
      .selectAll('g')
      .data(nodes)
      .join('g')
      .attr('transform', d => `translate(${d.y + 100},${d.x})`); // 平移以留出边距

    // 节点圆形
    nodeGroup.append('circle')
      .attr('r', d => 20) // 固定半径，或根据需要调整
      .attr('fill', d => colorScale(d.data.value))
      .attr('stroke', '#333')
      .attr('stroke-width', 1.5);

    // 节点标签
    nodeGroup.append('text')
      .attr('dy', 4)
      .attr('x', d => d.children ? -25 : 25) // 如果有子节点，标签在左侧，否则在右侧
      .attr('text-anchor', d => d.children ? 'end' : 'start')
      .text(d => d.data.name)
      .style('font-size', '12px');

  }, [width, height]);

  return <svg ref={svgRef}></svg>;
};

export default StrategyMap;