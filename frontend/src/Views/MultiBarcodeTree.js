import React, { useRef, useEffect, useState } from "react";
import * as d3 from "d3";

// ============ 示例输入数据 ==============

const indicatorsData1 = [
  {
    name: "MACD",
    type: "extend",
    children: [
      {
        name: "EMA(close,12)",
        type: "function",
        value: { trend: 0.6, seasonal: 0.2, residual: 0.1 },
      },
      {
        name: "EMA(close,26)",
        type: "function",
        value: { trend: 0.7, seasonal: 0.2, residual: 0.1 },
      },
    ],
  },
  {
    name: "boll",
    type: "extend",
    children: [
      { name: "close", type: "timeseries" },
      {
        name: "up",
        type: "extend",
        children: [
          {
            name: "EMA(close,20)",
            type: "function",
            value: { trend: 0.6, seasonal: 0.2, residual: 0.1 },
          },
          {
            name: "movingstd(mid,20)",
            type: "function",
            value: { trend: 0.2, seasonal: 0.6, residual: 0.1 },
          },
          { name: "2", type: "constant" },
        ],
      },
      {
        name: "down",
        type: "extend",
        children: [{ name: "up", type: "link" }],
      },
    ],
  },
];

const evaluationData1 = [
  {
    name: "period",
    type: "extend",
    children: [{ name: "2023-07-01 2024-07-01", type: "context" }],
  },
  {
    name: "stop",
    type: "extend",
    children: [
      {
        name: "ahead",
        type: "extend",
        children: [{ name: "-1", type: "context" }],
      },
    ],
  },
];

const indicatorsData2 = [
  {
    name: "boll",
    type: "extend",
    children: [
      { name: "close", type: "timeseries" },
      {
        name: "up",
        type: "extend",
        children: [
          {
            name: "EMA(close,20)",
            type: "function",
            value: { trend: 0.6, seasonal: 0.2, residual: 0.1 },
          },
          {
            name: "movingstd(mid,20)",
            type: "function",
            value: { trend: 0.2, seasonal: 0.6, residual: 0.1 },
          },
          { name: "2", type: "constant" },
        ],
      },
      {
        name: "down",
        type: "extend",
        children: [{ name: "up", type: "link" }],
      },
    ],
  },
];

const evaluationData2 = [
  {
    name: "period",
    type: "extend",
    children: [{ name: "2023-07-01 2024-07-01", type: "context" }],
  },
  {
    name: "stop",
    type: "extend",
    children: [
      {
        name: "ahead",
        type: "extend",
        children: [{ name: "-1", type: "context" }],
      },
    ],
  },
];

const indicatorsData3 = [
  {
    name: "rsi",
    type: "extend",
    children: [
      { name: "70", type: "constant" },
      { name: "30", type: "constant" },
      {
        name: "rsi(close,14)",
        type: "function",
        value: { trend: 0.5, seasonal: 0.1, residual: 0.2 },
      },
    ],
  },
];

const evaluationData3 = [
  {
    name: "period",
    type: "extend",
    children: [{ name: "2023-07-01 2024-07-01", type: "context" }],
  },
  {
    name: "stop",
    type: "extend",
    children: [
      {
        name: "ahead",
        type: "extend",
        children: [{ name: "-1", type: "context" }],
      },
    ],
  },
];

// ============ 辅助函数 ==============

// 递归初始化整个树；若节点类型为 extend，则默认设置 collapsed = true
function initTree(node) {
  if (node.type === "extend") {
    node.collapsed = true;
  }
  if (node.children) {
    node.children.forEach(child => initTree(child));
  }
  return node;
}

// 递归获得当前树中所有“可见”节点（根据 collapsed 状态判断是否展开子节点）
function getVisibleNodes(node, level = 0) {
  const BASE_WEIGHT = 5;
  node.level = level;
  node.weight = Math.max(1, BASE_WEIGHT - level);
  let arr = [node];
  if (node.type === "extend" && node.collapsed) return arr;
  if (node.children && node.children.length > 0) {
    node.children.forEach(child => {
      arr = arr.concat(getVisibleNodes(child, level + 1));
    });
  }
  return arr;
}

// 在整个树集合中查找名称相同且 type 不为 link 的目标节点
function findTargetNode(trees, name) {
  let target = null;
  const search = node => {
    if (node.name === name && node.type !== "link") {
      target = node;
      return;
    }
    if (node.children) {
      for (let child of node.children) {
        search(child);
        if (target) return;
      }
    }
  };
  trees.forEach(tree => {
    if (!target) search(tree);
  });
  return target;
}

/**
 * 自动换行函数
 * @param {d3.Selection} textSelection - d3 选择的 <text> 元素
 * @param {number} width - 单行最大宽度（像素）
 */
function wrapText(textSelection, width) {
  textSelection.each(function () {
    const text = d3.select(this);
    const words = text.text().split(/\s+/).reverse();
    let word, line = [], lineNumber = 0;
    const lineHeight = 1.1;
    const y = text.attr("y");
    const dy = parseFloat(text.attr("dy") || 0);
    let tspan = text.text(null)
      .append("tspan")
      .attr("x", text.attr("x"))
      .attr("y", y)
      .attr("dy", dy + "em");
    while ((word = words.pop())) {
      line.push(word);
      tspan.text(line.join(" "));
      if (tspan.node().getComputedTextLength() > width) {
        line.pop();
        tspan.text(line.join(" "));
        line = [word];
        tspan = text.append("tspan")
          .attr("x", text.attr("x"))
          .attr("y", y)
          .attr("dy", ++lineNumber * lineHeight + dy + "em")
          .text(word);
      }
    }
  });
}

// ============ MultiBarcodeTree 组件 ==============

/**
 * MultiBarcodeTree 组件将多个数据组分别显示 indicatorsData 与 evaluationData，
 * 并将 evaluationData 部分放到 indicatorsData 部分的右边，
 * 且两部分使用统一的单元格宽度（横向总列数 = 指标列数 + 评价列数）。
 * 每一行代表一个数据组，所有单元格宽度一致，从而保证各矩形宽度统一。
 */
const MultiBarcodeTree = ({ width = 900, height = 400, margin = 20 }) => {
  const svgRef = useRef(null);
  // 每个数据组包含 { indicatorsData, evaluationData }
  const [groups, setGroups] = useState(null);

  useEffect(() => {
    const groupsData = [
      { indicatorsData: indicatorsData1, evaluationData: evaluationData1 },
      { indicatorsData: indicatorsData2, evaluationData: evaluationData2 },
      { indicatorsData: indicatorsData3, evaluationData: evaluationData3 },
    ];
    const newGroups = groupsData.map(group => ({
      indicatorsData: group.indicatorsData.map(tree => initTree(JSON.parse(JSON.stringify(tree)))),
      evaluationData: group.evaluationData.map(tree => initTree(JSON.parse(JSON.stringify(tree)))),
    }));
    setGroups(newGroups);
  }, []);

  useEffect(() => {
    if (!groups) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    // 可用区域
    const availableWidth = width - margin * 2;
    const availableHeight = height - margin * 2;
    // 行数 = 数据组数
    const numRows = groups.length;
    const cellHeight = availableHeight / numRows;

    // 分别获得各组中出现的指标树名称与评价树名称
    let indicatorNames = [];
    groups.forEach(group => {
      group.indicatorsData.forEach(tree => {
        if (!indicatorNames.includes(tree.name)) indicatorNames.push(tree.name);
      });
    });
    let evaluationNames = [];
    groups.forEach(group => {
      group.evaluationData.forEach(tree => {
        if (!evaluationNames.includes(tree.name)) evaluationNames.push(tree.name);
      });
    });
    const numIndicatorCols = indicatorNames.length;
    const numEvaluationCols = evaluationNames.length;
    const totalCols = numIndicatorCols + numEvaluationCols;
    // 统一单元格宽度：所有列共用
    const unifiedCellWidth = availableWidth / totalCols;

    // 预先定义颜色比例尺
    const barColor = d3.scaleOrdinal(d3.schemeCategory10);
    const tsColor = d3.scaleOrdinal(d3.schemeCategory10);

    // ======= 绘制指标（indicatorsData）部分 =======
    // 指标部分位于前 numIndicatorCols 列
    groups.forEach((group, rowIndex) => {
      indicatorNames.forEach((indicatorName, colIndex) => {
        const x0 = margin + colIndex * unifiedCellWidth;
        const y0 = margin + rowIndex * cellHeight;
        const cellGroup = svg.append("g")
          .attr("transform", `translate(${x0}, ${y0})`);
        const tree = group.indicatorsData.find(t => t.name === indicatorName);
        if (tree) {
          const visibleNodes = getVisibleNodes(tree);
          const totalWeight = d3.sum(visibleNodes, d => d.weight);
          const n = visibleNodes.length;
          // 根据当前单元格宽度计算 gap 值（总间隔取单元格宽度的 5%）
          const gapValue = n > 1 ? (unifiedCellWidth * 0.05) / (n - 1) : 0;
          const xScale = d3.scaleLinear()
            .domain([0, totalWeight])
            .range([0, unifiedCellWidth - (n - 1) * gapValue]);
          let cumulative = 0;
          visibleNodes.forEach((node, i) => {
            const start = cumulative;
            cumulative += node.weight;
            const x = xScale(start) + i * gapValue;
            const rectWidth = xScale(cumulative) - xScale(start);
            const gNode = cellGroup.append("g").attr("class", "node");
            let stroke = "black", dash = null, fill = "none";
            if (node.type === "extend") {
              fill = "#ADD8E6";
            } else if (node.type === "function") {
              // 内部绘制柱状图，无背景
            } else if (node.type === "constant") {
              dash = "4,2";
              const num = parseFloat(node.name);
              const density = isNaN(num) ? 5 : Math.max(2, Math.floor(10 - num / 10));
              const patternId = `diagonalPattern-${density}`;
              if (svg.select(`#${patternId}`).empty()) {
                const pattern = svg.append("defs").append("pattern")
                  .attr("id", patternId)
                  .attr("patternUnits", "userSpaceOnUse")
                  .attr("width", density)
                  .attr("height", density)
                  .attr("patternTransform", "rotate(45)");
                pattern.append("line")
                  .attr("x1", 0)
                  .attr("y1", 0)
                  .attr("x2", 0)
                  .attr("y2", density)
                  .attr("stroke", "#ccc")
                  .attr("stroke-width", 1);
              }
              fill = `url(#${patternId})`;
            } else if (node.type === "timeseries") {
              dash = "4,2";
              fill = tsColor(node.name);
            } else if (node.type === "context") {
              dash = "4,2";
            }
            gNode.append("rect")
              .attr("x", x)
              .attr("y", 0)
              .attr("width", rectWidth)
              .attr("height", cellHeight)
              .attr("fill", fill)
              .attr("stroke", stroke)
              .attr("stroke-dasharray", dash)
              .on("click", () => {
                if (node.type === "extend") {
                  if (node.children && node.children.some(child => child.type === "link")) {
                    const linkChild = node.children.find(child => child.type === "link");
                    const target = findTargetNode([tree], linkChild.name);
                    if (target) {
                      target.collapsed = false;
                      setGroups([...groups]);
                      return;
                    }
                  }
                  node.collapsed = !node.collapsed;
                  setGroups([...groups]);
                }
              });
            if (node.type === "extend") {
              const textElem = gNode.append("text")
                .attr("x", x + rectWidth / 2)
                .attr("y", cellHeight / 2)
                .attr("dy", ".35em")
                .attr("text-anchor", "middle")
                .text(node.name)
                .style("pointer-events", "none");
              wrapText(textElem, rectWidth);
            } else if (node.type === "function") {
              if (node.value) {
                const keys = Object.keys(node.value);
                const barWidth = rectWidth / keys.length;
                keys.forEach((k, idx) => {
                  const barH = cellHeight * node.value[k];
                  gNode.append("rect")
                    .attr("x", x + idx * barWidth)
                    .attr("y", cellHeight - barH)
                    .attr("width", barWidth - 1)
                    .attr("height", barH)
                    .attr("fill", barColor(k));
                });
              }
            } else {
              const textElem = gNode.append("text")
                .attr("x", x + rectWidth / 2)
                .attr("y", cellHeight / 2)
                .attr("dy", ".35em")
                .attr("text-anchor", "middle")
                .text(node.name)
                .style("pointer-events", "none");
              wrapText(textElem, rectWidth);
            }
          });
        } else {
        }
      });
    });

    // ======= 绘制右侧 evaluationData 部分 =======
    // 右侧区域对应横向第 indicatorNames.length 到 totalCols-1 列
    groups.forEach((group, rowIndex) => {
      evaluationNames.forEach((evalName, evalColIndex) => {
        const x0 = margin + (numIndicatorCols + evalColIndex) * unifiedCellWidth;
        const y0 = margin + rowIndex * cellHeight;
        const cellGroup = svg.append("g")
          .attr("transform", `translate(${x0}, ${y0})`);
        const tree = group.evaluationData.find(t => t.name === evalName);
        if (tree) {
          const visibleNodes = getVisibleNodes(tree);
          const totalWeight = d3.sum(visibleNodes, d => d.weight);
          const n = visibleNodes.length;
          const gapValue = n > 1 ? (unifiedCellWidth * 0.05) / (n - 1) : 0;
          const xScale = d3.scaleLinear()
            .domain([0, totalWeight])
            .range([0, unifiedCellWidth - (n - 1) * gapValue]);
          let cumulative = 0;
          visibleNodes.forEach((node, i) => {
            const start = cumulative;
            cumulative += node.weight;
            const x = xScale(start) + i * gapValue;
            const rectWidth = xScale(cumulative) - xScale(start);
            const gNode = cellGroup.append("g").attr("class", "node");
            let stroke = "black", dash = null, fill = "none";
            if (node.type === "extend") {
              fill = "#ADD8E6";
            } else if (node.type === "function") {
              // 内部绘制柱状图
            } else if (node.type === "constant") {
              dash = "4,2";
              const num = parseFloat(node.name);
              const density = isNaN(num) ? 5 : Math.max(2, Math.floor(10 - num / 10));
              const patternId = `diagonalPattern-${density}`;
              if (svg.select(`#${patternId}`).empty()) {
                const pattern = svg.append("defs").append("pattern")
                  .attr("id", patternId)
                  .attr("patternUnits", "userSpaceOnUse")
                  .attr("width", density)
                  .attr("height", density)
                  .attr("patternTransform", "rotate(45)");
                pattern.append("line")
                  .attr("x1", 0)
                  .attr("y1", 0)
                  .attr("x2", 0)
                  .attr("y2", density)
                  .attr("stroke", "#ccc")
                  .attr("stroke-width", 1);
              }
              fill = `url(#${patternId})`;
            } else if (node.type === "timeseries") {
              dash = "4,2";
              fill = tsColor(node.name);
            } else if (node.type === "context") {
              dash = "4,2";
            }
            gNode.append("rect")
              .attr("x", x)
              .attr("y", 0)
              .attr("width", rectWidth)
              .attr("height", cellHeight)
              .attr("fill", fill)
              .attr("stroke", stroke)
              .attr("stroke-dasharray", dash)
              .on("click", () => {
                if (node.type === "extend") {
                  if (node.children && node.children.some(child => child.type === "link")) {
                    const linkChild = node.children.find(child => child.type === "link");
                    const target = findTargetNode([tree], linkChild.name);
                    if (target) {
                      target.collapsed = false;
                      setGroups([...groups]);
                      return;
                    }
                  }
                  node.collapsed = !node.collapsed;
                  setGroups([...groups]);
                }
              });
            if (node.type === "extend") {
              const textElem = gNode.append("text")
                .attr("x", x + rectWidth / 2)
                .attr("y", cellHeight / 2)
                .attr("dy", ".35em")
                .attr("text-anchor", "middle")
                .text(node.name)
                .style("pointer-events", "none");
              wrapText(textElem, rectWidth);
            } else if (node.type === "function") {
              if (node.value) {
                const keys = Object.keys(node.value);
                const barWidth = rectWidth / keys.length;
                keys.forEach((k, idx) => {
                  const barH = cellHeight * node.value[k];
                  gNode.append("rect")
                    .attr("x", x + idx * barWidth)
                    .attr("y", cellHeight - barH)
                    .attr("width", barWidth - 1)
                    .attr("height", barH)
                    .attr("fill", barColor(k));
                });
              }
            } else {
              const textElem = gNode.append("text")
                .attr("x", x + rectWidth / 2)
                .attr("y", cellHeight / 2)
                .attr("dy", ".35em")
                .attr("text-anchor", "middle")
                .text(node.name)
                .style("pointer-events", "none");
              wrapText(textElem, rectWidth);
            }
          });
        } else {
        }
      });
    });

  }, [groups, width, height, margin]);

  return (
    <svg ref={svgRef} width={width} height={height} style={{ border: "1px solid #ccc" }} />
  );
};

export default MultiBarcodeTree;
