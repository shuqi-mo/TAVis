import React, { useEffect, useRef } from "react";
import * as d3 from "d3";

const TreeGraph = ({ data, onNodeClick }) => {
  const svgRef = useRef();

  useEffect(() => {
    const width = 400;
    const height = 400;

    const svg = d3
      .select(svgRef.current)
      .attr("width", width)
      .attr("height", height)
      .style("border", "1px solid black");

    const forceSimulation = d3
      .forceSimulation(data.nodes)
      .force(
        "link",
        d3
          .forceLink(data.links)
          .id((d) => d.id)
          .distance(100)
      )
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(width / 2, height / 2))

      // 强制垂直分布节点
      .force(
        "y",
        d3
          .forceY((d) => {
            // 通过节点类型（name）来分配垂直位置
            if (d.id === "long" || d.id === "short") {
              return 100; // top layer
            } else if (d.id === "up" || d.id === "price" || d.id === "down") {
              return height / 2; // middle layer
            } else {
              return height - 150; // bottom layer
            }
          })
          .strength(0.5)
      ); // 调整力的强度，影响节点的分布范围

    const link = svg
      .selectAll(".link")
      .data(data.links)
      .enter()
      .append("line")
      .attr("class", "link")
      .attr("stroke", "#aaa");

    const node = svg
      .selectAll(".node")
      .data(data.nodes)
      .enter()
      .append("circle")
      .attr("class", "node")
      .attr("r", 20)
      .attr("fill", d => {
        // 初始状态，根据节点类型设置颜色
        if (d.id === "up" || d.id === "down" || d.id === "price") {
          return "#87CEEB"; // 初始颜色
        }
        return "#69b3a2";
      })
      .call(
        d3.drag().on("start", dragStart).on("drag", dragging).on("end", dragEnd)
      )
      .on("click", (event, d) => onNodeClick(d["name"]));
    // 添加文本节点，用于显示节点名称
    svg
      .selectAll(".text")
      .data(data.nodes)
      .enter()
      .append("text")
      .attr("class", "text")
      .attr("dx", 0) // 水平对齐，保持居中
      .attr("dy", 30) // 垂直偏移量，放在节点下方
      .attr("text-anchor", "middle")  // 水平居中对齐
      .text((d) => d.name);

    node.append("title").text((d) => d);

    forceSimulation.on("tick", () => {
      link
        .attr("x1", (d) => d.source.x)
        .attr("y1", (d) => d.source.y)
        .attr("x2", (d) => d.target.x)
        .attr("y2", (d) => d.target.y);

      node.attr("cx", (d) => d.x).attr("cy", (d) => d.y);

      svg
        .selectAll(".text")
        .attr("x", (d) => d.x)
        .attr("y", (d) => d.y);
    });
    function dragStart(event) {
      if (!event.active) forceSimulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    }

    function dragging(event) {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    }

    function dragEnd(event) {
      if (!event.active) forceSimulation.alphaTarget(0);
      event.subject.fx = null;
      event.subject.fy = null;
    }
  }, [data, onNodeClick]);

  return <svg ref={svgRef}></svg>;
};

export default TreeGraph;
