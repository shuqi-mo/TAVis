import React, { useRef, useEffect } from 'react';
import * as d3 from 'd3';
// 引入 d3-sankey 布局相关
import { sankey, sankeyLinkHorizontal, sankeyJustify } from 'd3-sankey';

const StrategyMap = ({ width = 460, height = 450 }) => {
  const svgRef = useRef(null);

  useEffect(() => {
    // 0. 准备示例数据
    // 你可以根据实际需要将名字改成 "train" / "quantize" / "magnitude prune" 等
    const data = {
      nodes: [
        { name: 'Train' },       // id: 0
        { name: 'Quantize' },    // id: 1
        { name: 'Magnitude' },   // id: 2
        { name: 'Gradient' },    // id: 3
        { name: 'Calibrate' },   // id: 4
        { name: 'Final' }        // id: 5
      ],
      links: [
        // source 和 target 是上面 nodes 的下标
        { source: 0, target: 1, value: 10 },
        { source: 0, target: 2, value: 8 },
        { source: 1, target: 3, value: 6 },
        { source: 2, target: 3, value: 4 },
        { source: 3, target: 4, value: 5 },
        { source: 4, target: 5, value: 5 }
      ]
    };

    // 1. 创建 SVG，并清空之前的内容（防止重复绘制）
    const svgEl = d3.select(svgRef.current);
    svgEl.selectAll('*').remove();

    const svg = svgEl
      .attr('width', width)
      .attr('height', height);

    // 2. 创建 Sankey 布局
    const sankeyGenerator = sankey()
      .nodeAlign(sankeyJustify)          // 这里可以换成 sankeyLeft / sankeyRight / sankeyCenter 等
      .nodeWidth(20)                     // 节点的矩形宽度
      .nodePadding(20)                   // 相邻节点之间的垂直间距
      .extent([[0, 0], [width, height]]);// Sankey 图在 SVG 内的绘制范围

    // 3. 把数据传入 sankey 进行布局计算
    const { nodes, links } = sankeyGenerator({
      nodes: data.nodes.map(d => Object.assign({}, d)), // 需要深拷贝
      links: data.links.map(d => Object.assign({}, d))
    });

    // 4. 绘制 link
    svg
      .append('g')
      .attr('fill', 'none')
      .selectAll('path')
      .data(links)
      .join('path')
      .attr('d', sankeyLinkHorizontal()) // sankey 提供的贝塞尔曲线生成器
      .attr('stroke', d => '#555')
      .attr('stroke-width', d => Math.max(1, d.width))   // d.width 是 sankey 计算好的连线宽度
      .attr('opacity', 0.7);

    // 5. 绘制 node
    const node = svg
      .append('g')
      .selectAll('g')
      .data(nodes)
      .join('g');

    // 节点矩形
    node
      .append('rect')
      .attr('x', d => d.x0)
      .attr('y', d => d.y0)
      .attr('width', d => d.x1 - d.x0) 
      .attr('height', d => d.y1 - d.y0)
      .attr('fill', '#222')
      .attr('opacity', 0.8);

    // 节点文字
    node
      .append('text')
      .attr('x', d => d.x0 < width / 2 ? d.x1 + 6 : d.x0 - 6) // 如果节点在左边，就把文本放在右侧，否则放左侧
      .attr('y', d => (d.y1 + d.y0) / 2)
      .attr('dy', '0.35em')
      .attr('text-anchor', d => d.x0 < width / 2 ? 'start' : 'end')
      .attr('fill', '#000')
      .text(d => d.name);

  }, [width, height]);

  return <svg ref={svgRef} />;
};

export default StrategyMap;