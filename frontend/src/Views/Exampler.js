import React, { useEffect, useRef } from "react";
import * as d3 from "d3";

const Exampler = ({ data, legend }) => {
  const chartRef = useRef();

  useEffect(() => {
    if (!data || data.length !== legend.length) {
        console.error('Data length and lineNames length must match.');
        return;
      }

    // Clear previous chart
    d3.select(chartRef.current).selectAll("*").remove();

    // Set dimensions and margins
    const width = 400;
    const height = 150;
    const margin = { top: 20, right: 30, bottom: 50, left: 50 };

    // Create SVG container
    const svg = d3
      .select(chartRef.current)
      .append("svg")
      .attr("width", width)
      .attr("height", height);

    // Create scales
    const xScale = d3
      .scaleLinear()
      .domain([0, data[0].length - 1]) // X-axis based on data length
      .range([margin.left, width - margin.right]);

    const yScale = d3
      .scaleLinear()
      .domain([
        d3.min(data.flat()), // Get minimum value from all data
        d3.max(data.flat()), // Get maximum value from all data
      ])
      .nice()
      .range([height - margin.bottom, margin.top]);

    // Create axes
    const xAxis = d3.axisBottom(xScale).ticks(10);
    const yAxis = d3.axisLeft(yScale);

    // Append axes
    svg
      .append("g")
      .attr("transform", `translate(0, ${height - margin.bottom})`)
      .call(xAxis)
      .append("text")
      .attr("fill", "black")
      .attr("x", width / 2)
      .attr("y", 40)
      .attr("text-anchor", "middle");

    svg
      .append("g")
      .attr("transform", `translate(${margin.left}, 0)`)
      .call(yAxis)
      .append("text")
      .attr("fill", "black")
      .attr("x", -height / 2)
      .attr("y", -40)
      .attr("text-anchor", "middle")
      .attr("transform", "rotate(-90)");

    // Define line generator
    const line = d3
      .line()
      .x((_, i) => xScale(i))
      .y((d) => yScale(d));

    // Generate color scale for multiple lines
    const colorScale = d3.scaleOrdinal(d3.schemeCategory10).domain(legend);

    // Add lines
    data.forEach((dataset, index) => {
      svg
        .append("path")
        .datum(dataset)
        .attr("fill", "none")
        .attr("stroke", colorScale(legend[index]))
        .attr("stroke-width", 2)
        .attr("d", line);

      // Add legend
      svg
        .append("text")
        .attr("x", width - margin.right - 100)
        .attr("y", margin.top + index * 20)
        .attr("fill", colorScale(legend[index]))
        .style("font-size", "12px")
        .text(legend[index]);
    });
  }, [data, legend]);

  return <div ref={chartRef}></div>;
};

export default Exampler;
