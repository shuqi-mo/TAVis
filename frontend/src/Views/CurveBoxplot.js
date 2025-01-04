import React, { useEffect, useRef } from "react";
import * as d3 from "d3";

const CurveBoxplot = ({ boxplotData }) => {
  const svgRef = useRef();
  const title = boxplotData[0];
  const data = boxplotData[1];

  useEffect(() => {
    const margin = { top: 10, right: 30, bottom: 10, left: 40 };
    const width = 200 - margin.left - margin.right;
    const height = 150 - margin.top - margin.bottom;

    const svg = d3
      .select(svgRef.current)
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Add title
    svg
      .append("text")
      .attr("x", margin.right) // Center horizontally
      .attr("y", margin.top / 20) // Place above the chart area
      .attr("text-anchor", "middle") // Center text alignment
      .style("font-size", "10px")
      .style("font-weight", "bold")
      .text(title);

    // Compute statistics for the curve boxplot
    const maxLength = d3.max(data.map((curve) => curve.length));

    // Transpose data to compute pointwise statistics
    const transposed = Array.from({ length: maxLength }, (_, i) =>
      data.map((curve) => curve[i]).filter((v) => v !== undefined)
    );

    // Compute median, IQR (central region), and whiskers
    const median = transposed.map((values) => d3.median(values));
    const iqr = transposed.map((values) => [
      d3.quantile(values, 0.25),
      d3.quantile(values, 0.75),
    ]);
    const whiskers = transposed.map((values) => [
      d3.min(values),
      d3.max(values),
    ]);

    // Identify outliers
    const outliers = data.filter((curve) =>
      curve.some(
        (value, index) =>
          value < whiskers[index]?.[0] || value > whiskers[index]?.[1]
      )
    );

    // X and Y scales
    const x = d3
      .scaleLinear()
      .domain([0, maxLength - 1])
      .range([0, width]);
    // X and Y scales: handle negative values by ensuring the Y domain covers the full range
    const yMin = d3.min(data.flat());
    const yMax = d3.max(data.flat());
    const y = d3.scaleLinear().domain([yMin, yMax]).range([height, 0]);

    const yZeroPos = y(0); // Get the position of y = 0 on the y-axis

    // Area generators
    const areaCentral = d3
      .area()
      .x((_, i) => x(i))
      .y0((d) => y(d[0]))
      .y1((d) => y(d[1]));

    const areaWhiskers = d3
      .area()
      .x((_, i) => x(i))
      .y0((d) => y(d[0]))
      .y1((d) => y(d[1]));

    // Line generator for curves
    const line = d3
      .line()
      .x((_, i) => x(i))
      .y((d) => y(d));

    // Draw whiskers
    svg
      .append("path")
      .datum(whiskers)
      .attr("fill", "#e0e0e0")
      .attr("d", areaWhiskers);

    // Draw central region
    svg
      .append("path")
      .datum(iqr)
      .attr("fill", "#cce5ff")
      .attr("d", areaCentral);

    // Draw median
    svg
      .append("path")
      .datum(median)
      .attr("fill", "none")
      .attr("stroke", "blue")
      .attr("stroke-width", 2)
      .attr("d", line);

    // Draw all curves
    data.forEach((curve) => {
      svg
        .append("path")
        .datum(curve)
        .attr("fill", "none")
        .attr("stroke", "black")
        .attr("stroke-width", 1)
        .attr("opacity", 0.2)
        .attr("d", line);
    });

    // Highlight outliers
    outliers.forEach((curve) => {
      svg
        .append("path")
        .datum(curve)
        .attr("fill", "none")
        .attr("stroke", "red")
        .attr("stroke-width", 1.5)
        .attr("opacity", 0.7)
        .attr("d", line);
    });

    // Add axes
    svg.append("g").call(d3.axisLeft(y));
    // Add custom X Axis at the zero value of the y-axis (position calculated above)
    svg
      .append("g")
      .attr("transform", `translate(0,${yZeroPos})`) // Position the axis at the y=0 position
      .call(
        d3
          .axisBottom(x)
          .ticks(maxLength)
          .tickFormat((d) => d + 1)
      )
      .selectAll(".tick text")
      .style("text-anchor", "middle");

    return () => {
      d3.select(svgRef.current).selectAll("*").remove();
    };
  }, [data]);

  return <svg ref={svgRef}></svg>;
};

export default CurveBoxplot;
