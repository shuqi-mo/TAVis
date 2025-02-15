import React, { useRef, useEffect } from "react";
import * as d3 from "d3";

// const data = {
//   name: "root",
//   children: [
//     {
//       name: "MACD",
//       value: 0,
//       children: [
//         {
//           name: "p1",
//           value: 11,
//           profitStats: {
//             min: -9.5,
//             q1: -2.49,
//             median: -0.05,
//             q3: 6.4,
//             max: 7.95,
//           },
//         },
//         {
//           name: "p2",
//           value: 7,
//           profitStats: { min: -1, q1: 0, median: 1.5, q3: 2, max: 4 },
//         },
//         {
//           name: "p3",
//           value: 13,
//           profitStats: {
//             min: -2.52,
//             q1: 2.155,
//             median: 6.83,
//             q3: 8.275,
//             max: 9.72,
//           },
//         },
//       ],
//     },
//     {
//       name: "RSI",
//       value: 0,
//       children: [
//         {
//           name: "p1",
//           value: 13,
//           profitStats: { min: -3, q1: -2, median: 0, q3: 1, max: 3 },
//         },
//         {
//           name: "p2",
//           value: 7,
//           profitStats: { min: -4, q1: -1, median: 0, q3: 2, max: 6 },
//         },
//         {
//           name: "p3",
//           value: 8,
//           profitStats: {
//             min: -2.51,
//             q1: 0.14,
//             median: 6.25,
//             q3: 6.55,
//             max: 6.88,
//           },
//         },
//       ],
//     },
//     {
//       name: "BOLL",
//       value: 0,
//       children: [
//         {
//           name: "p1",
//           value: 3,
//           profitStats: {
//             min: -3.5,
//             q1: -2.105,
//             median: -0.71,
//             q3: 3.085,
//             max: 6.88,
//           },
//         },
//         {
//           name: "p2",
//           value: 7,
//           profitStats: {
//             min: -5.18,
//             q1: -1.8375,
//             median: 1.505,
//             q3: 4.8475,
//             max: 8.19,
//           },
//         },
//         {
//           name: "p3",
//           value: 5,
//           profitStats: {
//             min: -8.42,
//             q1: -8.42,
//             median: -8.42,
//             q3: -8.42,
//             max: -8.42,
//           },
//         },
//       ],
//     },
//   ],
// };

const SunburstChart = ({ data, width, height }) => {
  const ref = useRef(null);
  // console.log(data);

  useEffect(() => {
    if (!data) return;

    // 清空已有内容
    d3.select(ref.current).selectAll("*").remove();

    // 构造分区
    const radius = Math.min(width, height) / 2;
    const partition = d3.partition().size([2 * Math.PI, radius]);

    const root = d3.hierarchy(data).sum((d) => d.value);
    partition(root);

    const patternNodes = root
      .descendants()
      .filter((d) => d.depth === 2 && d.data.profitStats);

    // 找到 (max - min) 最大的那个 pattern
    let referenceNode = null;
    let maxRange = -Infinity;
    patternNodes.forEach((node) => {
      const ps = node.data.profitStats;
      if (ps) {
        const range = ps.max - ps.min;
        if (range > maxRange) {
          maxRange = range;
          referenceNode = node;
        }
      }
    });

    // 如果意外没有找到任何 referenceNode，就直接退出
    if (!referenceNode) return;

    const differences = [];
    patternNodes.forEach((d) => {
      const ps = d.data.profitStats;
      if (ps) {
        differences.push(ps.q1 - ps.min); // offset
        differences.push(ps.q3 - ps.q1); // thickness
        differences.push(ps.max - ps.min); // range
      }
    });

    const globalDiffMin = d3.min(differences);
    const globalDiffMax = d3.max(differences);
    const singleScale = d3
      .scaleLinear()
      .domain([globalDiffMin, globalDiffMax])
      .range([0, 30]);
    // 基准节点的 min 半径，即“0 位置”
    const psRef = referenceNode.data.profitStats;
    const zeroVal = 0 - psRef.min;
    const zeroOffset = singleScale(zeroVal);
    const zeroRadius = referenceNode.y0 + zeroOffset;

    let dashedCircle = null;

    const arc = d3
      .arc()
      .startAngle((d) => d.x0)
      .endAngle((d) => d.x1)
      .innerRadius((d) => {
        if (d.depth === 1) {
          return d.y0 * 1.5;
        }
        const ps = d.data.profitStats;
        if (!ps) return d.y0;

        if (d === referenceNode) {
          // 基准 pattern => 保留原逻辑 offset
          const offset = singleScale(ps.q1 - ps.min);
          return d.y0 + offset;
        } else {
          // 其它 pattern => 让 profit=0 对齐 zeroRadius
          // => zeroValP = 0 - minP
          const zeroValP = 0 - ps.min;
          const zeroOffsetP = singleScale(zeroValP);
          // baseRadius = zeroRadius - zeroOffsetP => "min" for this pattern
          const baseRadius = zeroRadius - zeroOffsetP;
          // q1 => baseRadius + singleScale(q1 - minP)
          const offsetQ1 = singleScale(ps.q1 - ps.min);
          return baseRadius + offsetQ1;
        }
      })
      .outerRadius((d) => {
        if (d.depth === 1) {
          return d.y1;
        }
        const ps = d.data.profitStats;
        if (!ps) return d.y1;

        let inR; // inner radius
        if (d === referenceNode) {
          const offset = singleScale(ps.q1 - ps.min);
          inR = d.y0 + offset;
        } else {
          const zeroValP = 0 - ps.min;
          const zeroOffsetP = singleScale(zeroValP);
          const baseRadius = zeroRadius - zeroOffsetP;
          const offsetQ1 = singleScale(ps.q1 - ps.min);
          inR = baseRadius + offsetQ1;
        }
        const thickness = singleScale(ps.q3 - ps.q1);
        return inR + thickness;
      })
      // 圆角
      .cornerRadius(6);

    // 创建颜色映射
    const indicatorNames = data.children.map((child) => child.name);

    const patternSet = new Set();
    data.children.forEach((indicatorNode) => {
      indicatorNode.children.forEach((patternNode) => {
        patternSet.add(patternNode.name);
      });
    });
    const patternNames = Array.from(patternSet);

    // 为指标层定义颜色比例：domain = [MACD, RSI, BOLL, ...]
    const indicatorColorScale = d3
      .scaleOrdinal(d3.schemeCategory10)
      .domain(indicatorNames);

    // 为 pattern 层定义颜色比例：domain = [p1, p2, p3, ...]
    const patternColorScale = d3
      .scaleOrdinal(d3.schemeSet2)
      .domain(patternNames);

    // 创建SVG
    const svg = d3
      .select(ref.current)
      .append("svg")
      .attr("width", width)
      .attr("height", height);

    const gMain = svg
      .append("g")
      .attr("transform", `translate(${width / 2}, ${height / 2})`);

    //  绘制旭日图
    const nodes = root.descendants().filter((d) => d.depth > 0);
    gMain
      .selectAll("path")
      .data(nodes)
      .join("path")
      .attr("d", arc)
      .attr("fill", (d) => {
        if (d.depth === 1) {
          return indicatorColorScale(d.data.name);
        } else if (d.depth === 2) {
          const median = d.data.profitStats?.median ?? 0;
          if (median < 0) {
            return "#fff"; // 白色填充
          } else {
            return patternColorScale(d.data.name);
          }
        }
        return "none";
      })
      .attr("stroke", (d) => {
        if (d.depth === 2) {
          return patternColorScale(d.data.name);
        } else {
          return "#fff";
        }
      });

    dashedCircle = gMain
      .append("circle")
      .attr("r", zeroRadius)
      .attr("stroke", "#666")
      .attr("stroke-width", 1)
      .attr("fill", "none")
      .style("stroke-dasharray", "4 2");

    const gPatternLines = gMain
      .selectAll(".pattern-line")
      .data(patternNodes)
      .join("g")
      .attr("class", "pattern-line")
      .attr("transform", (d) => {
        const angleMid = (d.x0 + d.x1) / 2;
        const deg = (angleMid * 180) / Math.PI;
        // const [cx, cy] = arc.centroid(d);
        // return `translate(${cx}, ${cy}) rotate(${deg})`;
        return `rotate(${deg})`;
      });

    gPatternLines.each(function (d) {
      const ps = d.data.profitStats;
      if (!ps) return;

      const lineVal = ps.max - ps.min; // 线段代表 (max-min)
      const lineLen = singleScale(lineVal);
      let minRadius;
      if (d === referenceNode) {
        minRadius = d.y0;
      } else {
        const zeroValP = 0 - ps.min;
        const zeroOffsetP = singleScale(zeroValP);
        minRadius = zeroRadius - zeroOffsetP;
      }
      const strokeColor = patternColorScale(d.data.name);
      const sel = d3.select(this);

      // 竖线
      sel
        .append("line")
        .attr("x1", 0)
        .attr("y1", -minRadius)
        .attr("x2", 0)
        .attr("y2", -minRadius - lineLen)
        .attr("stroke", strokeColor)
        .attr("stroke-width", 2);

      // 顶端横杠 (可自行调节长度)
      const barLen = 6;
      sel
        .append("line")
        .attr("x1", -barLen / 2)
        .attr("y1", -minRadius - lineLen)
        .attr("x2", barLen / 2)
        .attr("y2", -minRadius - lineLen)
        .attr("stroke", strokeColor)
        .attr("stroke-width", 2);

      // 底端横杠
      sel
        .append("line")
        .attr("x1", -barLen / 2)
        .attr("y1", -minRadius)
        .attr("x2", barLen / 2)
        .attr("y2", -minRadius)
        .attr("stroke", strokeColor)
        .attr("stroke-width", 2);
    });

    // 为指标/Pattern 添加文字
    gMain
      .selectAll("text")
      .data(root.descendants())
      .join("text")
      .attr("transform", function (d) {
        const x = (d.x0 + d.x1) / 2;
        const y = (d.y0 + d.y1) / 2;
        const rotate = ((x - Math.PI / 2) / Math.PI) * 180;
        // 为了让文字在扇形内居中，做一个简单的移动和旋转
        return `translate(${arc.centroid(d)}) rotate(${rotate})`;
      })
      .attr("text-anchor", "middle")
      .attr("font-size", "10px")
      .attr("fill", "#000")
      .text((d) => (d.depth > 0 ? d.data.name : ""));
  }, [data, width, height]);

  return (
    <div
      ref={ref}
      width={width}
      height={height}
      style={{ border: "1px solid #ccc" }}
    />
  );
};

export default SunburstChart;
