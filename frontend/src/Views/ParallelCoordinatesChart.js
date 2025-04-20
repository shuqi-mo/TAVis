import React, { useRef, useState, useEffect } from "react";
import * as d3 from "d3";

const ParallelCoordinatesChart = ({ data, width, height, colorAssignments }) => {
  const svgRef = useRef(null);
  const [activeDimensions, setActiveDimensions] = useState([
    "totalTrades",
    "successRate",
    "avgReturn",
    "totalProfit",
  ]);

  useEffect(() => {
    if (!colorAssignments) return;

    const margin = { top: 30, right: 5, bottom: 50, left: 0 };
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const colorScale = d3
      .scaleOrdinal(d3.schemeCategory10)
      .domain(data.map((d) => d.name));

    const yScales = {};
    activeDimensions.forEach((dim) => {
      yScales[dim] = d3
        .scaleLinear()
        .domain(d3.extent(data, (d) => d[dim]))
        .range([height - margin.bottom, margin.top]);
    });

    const xScale = d3
      .scalePoint()
      .range([margin.left, width - margin.right])
      .padding(0.5)
      .domain(activeDimensions);

    const lineGenerator = d3.line();
    const path = (d) => {
      return lineGenerator(
        activeDimensions.map((dim) => [xScale(dim), yScales[dim](d[dim])])
      );
    };

    svg
      .selectAll(".data-line")
      .data(data)
      .enter()
      .append("path")
      .attr("class", "data-line")
      .attr("d", path)
      .attr("fill", "none")
      .attr("stroke", (d) => {
        const colorMatch = colorAssignments.find(
          (item) => item[0] === d.name
        );
        return colorMatch ? colorMatch[1] : colorScale(d.name);
      })
      .attr("stroke-width", 1)
      .attr("opacity", 0.7);

    activeDimensions.forEach((dim) => {
      svg
        .append("g")
        .attr("transform", `translate(${xScale(dim)}, 0)`)
        .call(d3.axisLeft(yScales[dim]).ticks(5))
        .append("text")
        .attr("y", margin.top - 10)
        .attr("x", 0)
        .attr("text-anchor", "middle")
        .attr("fill", "black")
        .text(dim);
    });

    const uniqueNames = [...new Set(data.map((d) => d.name))];
    const legendG = svg
      .append("g")
      .attr("class", "legend")
      .attr(
        "transform",
        `translate(${margin.left}, ${height - margin.bottom + 15})`
      );

    const measureG = svg
      .append("g")
      .attr("class", "measure-temp")
      .attr("opacity", 0);

    let currentX = 0;
    let currentY = 0;
    const lineHeight = 15;
    const maxLegendWidth = width - margin.left - margin.right;

    uniqueNames.forEach((name, i) => {
      const tempText = measureG.append("text").attr("font-size", 10).text(name);
      const bbox = tempText.node().getBBox();
      const textWidth = bbox.width;
      const itemWidth = textWidth + 12 + 8 + 10;

      if (currentX + itemWidth > maxLegendWidth) {
        currentX = 0;
        currentY += lineHeight;
      }

      const itemG = legendG
        .append("g")
        .attr("transform", `translate(${currentX}, ${currentY})`);

      itemG
        .append("rect")
        .attr("x", 0)
        .attr("y", -6)
        .attr("width", 12)
        .attr("height", 12)
        .style("fill", () => {
          const colorMatch = colorAssignments.find(
            (item) => item[0] === name
          );
          return colorMatch ? colorMatch[1] : colorScale(name);
        });

      itemG
        .append("text")
        .attr("x", 15)
        .attr("y", 0)
        .attr("font-size", 10)
        .attr("alignment-baseline", "middle")
        .text(name);

      currentX += itemWidth;
      tempText.remove();
    });

    measureG.remove();
  }, [data, colorAssignments, activeDimensions]);

  const handleDimensionClick = (dim) => {
    setActiveDimensions((prev) =>
      prev.includes(dim)
        ? prev.filter((dimension) => dimension !== dim)
        : [...prev, dim]
    );
  };

  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ display: "flex", justifyContent: "center" }}>
        {["totalTrades", "successRate", "avgReturn", "totalProfit"].map(
          (dim) => (
            <div
              key={dim}
              onClick={() => handleDimensionClick(dim)}
              style={{
                margin: "0 10px",
                cursor: "pointer",
                color: activeDimensions.includes(dim) ? "black" : "gray",
              }}
            >
              {dim}
            </div>
          )
        )}
      </div>
      <svg ref={svgRef} width={width} height={height} />
    </div>
  );
};

export default ParallelCoordinatesChart;
