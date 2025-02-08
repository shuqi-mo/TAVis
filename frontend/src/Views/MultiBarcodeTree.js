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
        value: {
          trend: 0.6,
          seasonal: 0.2,
          residual: 0.1,
        },
      },
      {
        name: "EMA(close,26)",
        type: "function",
        value: {
          trend: 0.7,
          seasonal: 0.2,
          residual: 0.1,
        },
      },
    ],
  },
  {
    name: "boll",
    type: "extend",
    children: [
      {
        name: "close",
        type: "timeseries",
      },
      {
        name: "up",
        type: "extend",
        children: [
          {
            name: "EMA(close,20)",
            type: "function",
            value: {
              trend: 0.6,
              seasonal: 0.2,
              residual: 0.1,
            },
          },
          {
            name: "movingstd(mid, 20)",
            type: "function",
            value: {
              trend: 0.2,
              seasonal: 0.6,
              residual: 0.1,
            },
          },
          {
            name: "2",
            type: "constant",
          },
        ],
      },
      {
        name: "down",
        type: "extend",
        children: [
          {
            name: "up",
            type: "link",
          },
        ],
      },
    ],
  },
];

const evaluationData1 = [
  {
    name: "period",
    type: "extend",
    children: [
      {
        name: "2023-07-01 2024-07-01",
        type: "context",
      },
    ],
  },
  {
    name: "stop",
    type: "extend",
    children: [
      {
        name: "ahead",
        type: "extend",
        children: [
          {
            name: "-1",
            type: "context",
          },
        ],
      },
    ],
  },
];

const indicatorsData2 = [
  {
    name: "boll",
    type: "extend",
    children: [
      {
        name: "close",
        type: "timeseries",
      },
      {
        name: "up",
        type: "extend",
        children: [
          {
            name: "EMA(close,20)",
            type: "function",
            value: {
              trend: 0.6,
              seasonal: 0.2,
              residual: 0.1,
            },
          },
          {
            name: "movingstd(mid, 20)",
            type: "function",
            value: {
              trend: 0.2,
              seasonal: 0.6,
              residual: 0.1,
            },
          },
          {
            name: "2",
            type: "constant",
          },
        ],
      },
      {
        name: "down",
        type: "extend",
        children: [
          {
            name: "up",
            type: "link",
          },
        ],
      },
    ],
  },
];

const evaluationData2 = [
  {
    name: "period",
    type: "extend",
    children: [
      {
        name: "2023-07-01 2024-07-01",
        type: "context",
      },
    ],
  },
  {
    name: "stop",
    type: "extend",
    children: [
      {
        name: "ahead",
        type: "extend",
        children: [
          {
            name: "-1",
            type: "context",
          },
        ],
      },
    ],
  },
];

const indicatorsData3 = [
  {
    name: "rsi",
    type: "extend",
    children: [
      {
        name: "70",
        type: "constant",
      },
      {
        name: "30",
        type: "constant",
      },
      {
        name: "rsi(close,14)",
        type: "function",
        value: {
          trend: 0.5,
          seasonal: 0.1,
          residual: 0.2,
        },
      },
    ],
  },
];

const evaluationData3 = [
  {
    name: "period",
    type: "extend",
    children: [
      {
        name: "2023-07-01 2024-07-01",
        type: "context",
      },
    ],
  },
  {
    name: "stop",
    type: "extend",
    children: [
      {
        name: "ahead",
        type: "extend",
        children: [
          {
            name: "-1",
            type: "context",
          },
        ],
      },
    ],
  },
];

// ============ 辅助函数 ==============

// 递归初始化整个树（包括根节点）；若节点类型为 extend，则默认设置 collapsed = true
function initTree(node) {
  if (node.type === "extend") {
    node.collapsed = true;
  }
  if (node.children) {
    node.children.forEach((child) => initTree(child));
  }
  return node;
}

// 根据层级设置权重，根节点层级为 0
function getVisibleNodes(node, level = 0) {
  const BASE_WEIGHT = 5; // 可根据需要调整基准权重
  node.level = level;
  node.weight = Math.max(1, BASE_WEIGHT - level);
  let arr = [node];
  if (node.type === "extend" && node.collapsed) {
    return arr;
  }
  if (node.children && node.children.length > 0) {
    node.children.forEach((child) => {
      arr = arr.concat(getVisibleNodes(child, level + 1));
    });
  }
  return arr;
}

// 在整个树集合中查找名称相同且 type 不为 link 的目标节点
function findTargetNode(trees, name) {
  let target = null;
  const search = (node) => {
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
  trees.forEach((tree) => {
    if (!target) search(tree);
  });
  return target;
}

/**
 * 自动换行函数
 * @param {d3.Selection} textSelection - d3 选择的 <text> 元素
 * @param {number} width - 单行的最大宽度（单位：像素）
 */
function wrapText(textSelection, width) {
  textSelection.each(function () {
    const text = d3.select(this);
    // 将文本拆分为单词（可以根据实际情况调整拆分规则）
    const words = text.text().split(/\s+/).reverse();
    let word;
    let line = [];
    let lineNumber = 0;
    const lineHeight = 1.1; // 行高，单位为 em
    const y = text.attr("y");
    const dy = parseFloat(text.attr("dy") || 0);
    // 清空原始文本，并添加第一个 tspan
    let tspan = text
      .text(null)
      .append("tspan")
      .attr("x", text.attr("x"))
      .attr("y", y)
      .attr("dy", dy + "em");

    while ((word = words.pop())) {
      line.push(word);
      tspan.text(line.join(" "));
      // 如果当前 tspan 的宽度超出给定宽度，则换行
      if (tspan.node().getComputedTextLength() > width) {
        line.pop();
        tspan.text(line.join(" "));
        line = [word];
        tspan = text
          .append("tspan")
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
 * MultiBarcodeTree 组件实现了多组 BarcodeTree 的横向对齐对比，
 * 其中包括 indicatorsData 与 evaluationData 两个部分分别对齐。
 * 每一“列”对应一组输入数据，每一“行”对应一个树名称（例如：MACD、boll、rsi；或 period、stop）。
 */
const MultiBarcodeTree = ({
  width = 900,
  height = 400,
  margin = 20,
  gap = 4,
}) => {
  const svgRef = useRef(null);
  // groups 数组中每一项包含 { indicatorsData, evaluationData }
  const [groups, setGroups] = useState(null);

  // 初始化 groups 状态，分别对三个输入数据进行深拷贝与初始化
  useEffect(() => {
    const groupsData = [
      { indicatorsData: indicatorsData1, evaluationData: evaluationData1 },
      { indicatorsData: indicatorsData2, evaluationData: evaluationData2 },
      { indicatorsData: indicatorsData3, evaluationData: evaluationData3 },
    ];
    const newGroups = groupsData.map((group) => ({
      indicatorsData: group.indicatorsData.map((tree) =>
        initTree(JSON.parse(JSON.stringify(tree)))
      ),
      evaluationData: group.evaluationData.map((tree) =>
        initTree(JSON.parse(JSON.stringify(tree)))
      ),
    }));
    setGroups(newGroups);
  }, []);

  // 每次 groups 状态更新时重绘 SVG
  useEffect(() => {
    if (!groups) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    // 整体布局：将 SVG 垂直分为两部分，分别显示 indicatorsData 与 evaluationData，
    // 中间预留 sectionGap 的间隙
    const sectionGap = 30;
    const availableHeight = height - margin * 2;
    // const sectionHeight = (availableHeight - sectionGap) / 2;

    const numGroups = groups.length;
    const cellWidth = (width - margin * 2) / numGroups;

    // 色板
    const barColor = d3.scaleOrdinal(d3.schemeCategory10);
    const tsColor = d3.scaleOrdinal(d3.schemeCategory10);

    // ======= 绘制 indicatorsData 部分 =======
    let indicatorNames = [];
    groups.forEach((group) => {
      group.indicatorsData.forEach((tree) => {
        if (!indicatorNames.includes(tree.name)) {
          indicatorNames.push(tree.name);
        }
      });
    });
    let evaluationNames = [];
    groups.forEach((group) => {
      group.evaluationData.forEach((tree) => {
        if (!evaluationNames.includes(tree.name)) {
          evaluationNames.push(tree.name);
        }
      });
    });
    const numIndicators = indicatorNames.length;
    const numEvaluations = evaluationNames.length;
    const totalRows = numIndicators + numEvaluations;
    // 统一单元格高度：扣除两部分间隙后，均分总行数
    const commonCellHeight = (availableHeight - sectionGap) / totalRows;
    // const indicatorsCellHeight = sectionHeight / numIndicators;

    indicatorNames.forEach((indicatorName, rowIndex) => {
      groups.forEach((group, colIndex) => {
        // 查找当前组中是否存在该指标的树
        const tree = group.indicatorsData.find((t) => t.name === indicatorName);
        // 每个单元格的原点为 (margin + colIndex*cellWidth, margin + rowIndex*indicatorsCellHeight)
        const cellGroup = svg
          .append("g")
          .attr(
            "transform",
            `translate(${margin + colIndex * cellWidth}, ${
              margin + rowIndex * commonCellHeight
            })`
          );
        if (tree) {
          const visibleNodes = getVisibleNodes(tree);
          const totalWeight = d3.sum(visibleNodes, (d) => d.weight);
          const n = visibleNodes.length;
          const xScale = d3
            .scaleLinear()
            .domain([0, totalWeight])
            .range([0, cellWidth - (n - 1) * gap]);
          let cumulative = 0;
          visibleNodes.forEach((node, i) => {
            const start = cumulative;
            cumulative += node.weight;
            const x = xScale(start) + i * gap;
            const rectWidth = xScale(cumulative) - xScale(start);
            const gNode = cellGroup.append("g").attr("class", "node");
            let stroke = "black";
            let dash = null;
            let fill = "none";

            if (node.type === "extend") {
              fill = "#ADD8E6";
            } else if (node.type === "function") {
              // 无背景色，内部绘制柱状图
            } else if (node.type === "constant") {
              dash = "4,2";
              const num = parseFloat(node.name);
              const density = isNaN(num)
                ? 5
                : Math.max(2, Math.floor(10 - num / 10));
              const patternId = `diagonalPattern-${density}`;
              if (svg.select(`#${patternId}`).empty()) {
                const pattern = svg
                  .append("defs")
                  .append("pattern")
                  .attr("id", patternId)
                  .attr("patternUnits", "userSpaceOnUse")
                  .attr("width", density)
                  .attr("height", density)
                  .attr("patternTransform", "rotate(45)");
                pattern
                  .append("line")
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

            gNode
              .append("rect")
              .attr("x", x)
              .attr("y", 0)
              .attr("width", rectWidth)
              .attr("height", commonCellHeight)
              .attr("fill", fill)
              .attr("stroke", stroke)
              .attr("stroke-dasharray", dash)
              .on("click", () => {
                if (node.type === "extend") {
                  // 如果存在 link 类型子节点，则查找目标节点展开其子树
                  if (
                    node.children &&
                    node.children.some((child) => child.type === "link")
                  ) {
                    const linkChild = node.children.find(
                      (child) => child.type === "link"
                    );
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
              gNode
                .append("text")
                .attr("x", x + rectWidth / 2)
                .attr("y", commonCellHeight / 2)
                .attr("dy", ".35em")
                .attr("text-anchor", "middle")
                .text(node.name)
                .style("pointer-events", "none");
            } else if (node.type === "function") {
              if (node.value) {
                const keys = Object.keys(node.value);
                const barWidth = rectWidth / keys.length;
                keys.forEach((k, idx) => {
                  const barH = commonCellHeight * node.value[k];
                  gNode
                    .append("rect")
                    .attr("x", x + idx * barWidth)
                    .attr("y", commonCellHeight - barH)
                    .attr("width", barWidth - 1)
                    .attr("height", barH)
                    .attr("fill", barColor(k));
                });
              }
            } else {
              const textElem = gNode
                .append("text")
                .attr("x", x + rectWidth / 2)
                .attr("y", commonCellHeight / 2)
                .attr("dy", ".35em")
                .attr("text-anchor", "middle")
                .text(node.name)
                .style("pointer-events", "none");
              wrapText(textElem, rectWidth);
            }
          });
        }
      });
    });

    // ======= 绘制 evaluationData 部分 =======
    evaluationNames.forEach((evalName, rowIndex) => {
      groups.forEach((group, colIndex) => {
        const tree = group.evaluationData.find((t) => t.name === evalName);
        const cellGroup = svg
          .append("g")
          .attr(
            "transform",
            `translate(${margin + colIndex * cellWidth}, ${
                numIndicators * commonCellHeight + sectionGap + rowIndex * commonCellHeight
            })`
          );
        if (tree) {
          const visibleNodes = getVisibleNodes(tree);
          const totalWeight = d3.sum(visibleNodes, (d) => d.weight);
          const n = visibleNodes.length;
          const xScale = d3
            .scaleLinear()
            .domain([0, totalWeight])
            .range([0, cellWidth - (n - 1) * gap]);
          let cumulative = 0;
          visibleNodes.forEach((node, i) => {
            const start = cumulative;
            cumulative += node.weight;
            const x = xScale(start) + i * gap;
            const rectWidth = xScale(cumulative) - xScale(start);
            const gNode = cellGroup.append("g").attr("class", "node");
            let stroke = "black";
            let dash = null;
            let fill = "none";

            if (node.type === "extend") {
              fill = "#ADD8E6";
            } else if (node.type === "function") {
              // 无背景色，内部绘制柱状图
            } else if (node.type === "constant") {
              dash = "4,2";
              const num = parseFloat(node.name);
              const density = isNaN(num)
                ? 5
                : Math.max(2, Math.floor(10 - num / 10));
              const patternId = `diagonalPattern-${density}`;
              if (svg.select(`#${patternId}`).empty()) {
                const pattern = svg
                  .append("defs")
                  .append("pattern")
                  .attr("id", patternId)
                  .attr("patternUnits", "userSpaceOnUse")
                  .attr("width", density)
                  .attr("height", density)
                  .attr("patternTransform", "rotate(45)");
                pattern
                  .append("line")
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

            gNode
              .append("rect")
              .attr("x", x)
              .attr("y", 0)
              .attr("width", rectWidth)
              .attr("height", commonCellHeight)
              .attr("fill", fill)
              .attr("stroke", stroke)
              .attr("stroke-dasharray", dash)
              .on("click", () => {
                if (node.type === "extend") {
                  if (
                    node.children &&
                    node.children.some((child) => child.type === "link")
                  ) {
                    const linkChild = node.children.find(
                      (child) => child.type === "link"
                    );
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
              gNode
                .append("text")
                .attr("x", x + rectWidth / 2)
                .attr("y", commonCellHeight / 2)
                .attr("dy", ".35em")
                .attr("text-anchor", "middle")
                .text(node.name)
                .style("pointer-events", "none");
            } else if (node.type === "function") {
              if (node.value) {
                const keys = Object.keys(node.value);
                const barWidth = rectWidth / keys.length;
                keys.forEach((k, idx) => {
                  const barH = commonCellHeight * node.value[k];
                  gNode
                    .append("rect")
                    .attr("x", x + idx * barWidth)
                    .attr("y", commonCellHeight - barH)
                    .attr("width", barWidth - 1)
                    .attr("height", barH)
                    .attr("fill", barColor(k));
                });
              }
            } else {
              const textElem = gNode
                .append("text")
                .attr("x", x + rectWidth / 2)
                .attr("y", commonCellHeight / 2)
                .attr("dy", ".35em")
                .attr("text-anchor", "middle")
                .text(node.name)
                .style("pointer-events", "none");
              wrapText(textElem, rectWidth);
            }
          });
        }
      });
    });
  }, [groups, width, height, margin, gap]);

  return (
    <svg
      ref={svgRef}
      width={width}
      height={height}
      style={{ border: "1px solid #ccc" }}
    />
  );
};

export default MultiBarcodeTree;
