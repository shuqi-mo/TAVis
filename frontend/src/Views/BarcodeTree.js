import React, { useRef, useEffect, useState } from "react";
import * as d3 from "d3";

function computeSubtreeSizes(node) {
  if (!node.children || node.children.length === 0) {
    node.subtreeSize = 1;
    return 1;
  }
  let sum = 1;
  node.children.forEach((child) => {
    sum += computeSubtreeSizes(child);
  });
  node.subtreeSize = sum;
  return sum;
}

function getDFSOrder(node) {
  const result = [];
  function dfs(n) {
    result.push(n);
    (n.children || []).forEach((c) => dfs(c));
  }
  dfs(node);
  return result;
}

const data = {
  name: "Root",
  children: [
    {
      name: "Child A",
      children: [
        { name: "Grandchild A1", children: [] },
        {
          name: "Grandchild A2",
          children: [
            { name: "GreatGrandchild A2-1", children: [] },
            { name: "GreatGrandchild A2-2", children: [] },
          ],
        },
      ],
    },
    {
      name: "Child B",
      children: [
        { name: "Grandchild B1", children: [] },
        { name: "Grandchild B2", children: [] },
      ],
    },
  ],
};

const BarcodeTree = ({ width = 600, height = 80, margin = 20, gap = 2}) => {
  const svgRef = useRef(null);
  const [dfsNodes, setDfsNodes] = useState([]);

  useEffect(() => {
    // 1) 计算子树大小
    computeSubtreeSizes(data);

    // 2) 得到 DFS 顺序
    const nodesInOrder = getDFSOrder(data);
    setDfsNodes(nodesInOrder);
  }, [data]);

  useEffect(() => {
    if (!dfsNodes.length) return;

    // 3) 在这里用 D3 绘制
    const svg = d3.select(svgRef.current);
    // 先清空
    svg.selectAll("*").remove();

    // 条形码区域的可用宽度
    const innerWidth = width - margin * 2;
    const innerHeight = height - margin * 2;
    // 在条形区域内我们从 (margin, margin) 开始往右画

    // 4) 计算所有节点 subtreeSize 的总和
    const totalSize = d3.sum(dfsNodes, (d) => d.subtreeSize || 1);

    // 5) 计算“总间隙” & “有效宽度”
    //    如果有 n 个条形，则条形之间有 (n - 1) 个缝隙
    const n = dfsNodes.length;
    const totalGap = (n - 1) * gap;
    const effectiveWidth = innerWidth - totalGap;

   // 6) 为 DFS 顺序里的每个节点生成其在 [0, totalSize] 上的区间
   let cumulative = 0;
   const barData = dfsNodes.map((node) => {
     const nodeSize = node.subtreeSize || 1;
     const start = cumulative;
     cumulative += nodeSize;
     const end = cumulative;
     return { node, start, end };
   });

   // 7) 构建线性比例尺
   const xScale = d3
     .scaleLinear()
     .domain([0, totalSize])
     .range([0, effectiveWidth]);

   // 8) 绘制
   const g = svg
     .append("g")
     .attr("transform", `translate(${margin}, ${margin})`);

   // 生成矩形
   // 这里要注意：绘制第 i 个矩形时，x 位置要在原本 xScale(d.start) 的基础上
   // 再加 (i * gap)，让它向右挪一点
   g.selectAll("rect")
     .data(barData)
     .enter()
     .append("rect")
     .attr("x", (d, i) => xScale(d.start) + i * gap)
     .attr("y", 0)
     .attr("width", (d) => xScale(d.end) - xScale(d.start))
     .attr("height", innerHeight)
     .attr("fill", "#333");

 }, [dfsNodes, width, height, margin, gap]);

  return (
    <svg
      ref={svgRef}
      width={width}
      height={height}
      style={{ border: "1px solid #ccc" }}
    />
  );
};

export default BarcodeTree;
