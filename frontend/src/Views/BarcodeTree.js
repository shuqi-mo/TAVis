import React, { useRef, useEffect, useState } from "react";
import * as d3 from "d3";

// ============ 输入数据 ==============
const indicatorsData = [
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

const evaluationData = [
  {
    name: "period",
    type: "extend",
    children: [
      {
        name: "[2023-07-01,2024-07-01]",
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

// 递归初始化整个树（包括根节点）；若节点类型为 extend，则默认折叠 collapsed = true
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

// ============ BarcodeTree 组件 ==============
const BarcodeTree = ({ width = 600, height = 400, margin = 20, gap = 4 }) => {
  const svgRef = useRef(null);
  const [indTrees, setIndTrees] = useState(null);
  const [evalTrees, setEvalTrees] = useState(null);

  // 初始化数据
  useEffect(() => {
    const indTreesCopy = indicatorsData.map((tree) => {
      const t = JSON.parse(JSON.stringify(tree));
      return initTree(t);
    });
    const evalTreesCopy = evaluationData.map((tree) => {
      const t = JSON.parse(JSON.stringify(tree));
      return initTree(t);
    });
    setIndTrees(indTreesCopy);
    setEvalTrees(evalTreesCopy);
  }, []);

  // 每次状态更新时重绘 SVG
  useEffect(() => {
    if (!indTrees || !evalTrees) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    // 总体布局设置
    const totalHeight = height - margin * 2;
    const separatorHeight = 20;
    const gapBetweenGroup = 10; // 指标组与横线之间预留间隔
    const groupHeight = (totalHeight - separatorHeight - gapBetweenGroup) / 2;
    const treeWidth = width - margin * 2;

    // 定义色板
    const barColor = d3.scaleOrdinal(d3.schemeCategory10);
    const tsColor = d3.scaleOrdinal(d3.schemeCategory10);

    // ======== 绘制 indicators 部分 ========
    const numIndTrees = indTrees.length;
    const rowHeightInd = groupHeight / numIndTrees;
    const gInd = svg
      .append("g")
      .attr("transform", `translate(${margin}, ${margin})`);

    indTrees.forEach((tree, treeIndex) => {
      const visibleNodes = getVisibleNodes(tree);
      const totalWeight = d3.sum(visibleNodes, (d) => d.weight);
      const n = visibleNodes.length;
      const xScale = d3
        .scaleLinear()
        .domain([0, totalWeight])
        .range([0, treeWidth - (n - 1) * gap]);
      let cumulative = 0;
      const treeGroup = gInd
        .append("g")
        .attr("transform", `translate(0, ${treeIndex * rowHeightInd})`);

      visibleNodes.forEach((node, i) => {
        const start = cumulative;
        cumulative += node.weight;
        const x = xScale(start) + i * gap;
        const rectWidth = xScale(cumulative) - xScale(start);
        const gNode = treeGroup.append("g").attr("class", "node");
        let stroke = "black";
        let dash = null;
        let fill = "none";

        if (node.type === "extend") {
          fill = "#ADD8E6";
        } else if (node.type === "function") {
          // 无背景；后续内部绘制柱状图
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
          .attr("height", rowHeightInd)
          .attr("fill", fill)
          .attr("stroke", stroke)
          .attr("stroke-dasharray", dash)
          .on("click", (event) => {
            if (node.type === "extend") {
              // 若存在 link 类型子节点，则查找目标节点展开其子树
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
                  setIndTrees([...indTrees]);
                  return;
                }
              }
              node.collapsed = !node.collapsed;
              setIndTrees([...indTrees]);
            }
          });

        if (node.type === "extend") {
          gNode
            .append("text")
            .attr("x", x + rectWidth / 2)
            .attr("y", rowHeightInd / 2)
            .attr("dy", ".35em")
            .attr("text-anchor", "middle")
            .text(node.name)
            .style("pointer-events", "none");
        } else if (node.type === "function") {
          if (node.value) {
            const keys = Object.keys(node.value);
            const barWidth = rectWidth / keys.length;
            keys.forEach((k, idx) => {
              const barH = rowHeightInd * node.value[k];
              gNode
                .append("rect")
                .attr("x", x + idx * barWidth)
                .attr("y", rowHeightInd - barH)
                .attr("width", barWidth - 1)
                .attr("height", barH)
                .attr("fill", barColor(k));
            });
          }
        } else {
          gNode
            .append("text")
            .attr("x", x + rectWidth / 2)
            .attr("y", rowHeightInd / 2)
            .attr("dy", ".35em")
            .attr("text-anchor", "middle")
            .text(node.name)
            .style("pointer-events", "none");
        }
      });
    });

    // 绘制 indicators 与 evaluation 部分之间的分隔横线
    const separatorY = margin + groupHeight + gapBetweenGroup;
    svg
      .append("line")
      .attr("x1", margin)
      .attr("y1", separatorY)
      .attr("x2", margin + treeWidth)
      .attr("y2", separatorY)
      .attr("stroke", "black");

    // ======== 绘制 evaluation 部分 ========
    const numEvalTrees = evalTrees.length;
    const rowHeightEval = groupHeight / numEvalTrees;
    const evalTop = margin + groupHeight + gapBetweenGroup + separatorHeight;
    const gEval = svg
      .append("g")
      .attr("transform", `translate(${margin}, ${evalTop})`);

    evalTrees.forEach((tree, treeIndex) => {
      const visibleNodes = getVisibleNodes(tree);
      const totalWeight = d3.sum(visibleNodes, (d) => d.weight);
      const n = visibleNodes.length;
      const xScale = d3
        .scaleLinear()
        .domain([0, totalWeight])
        .range([0, treeWidth - (n - 1) * gap]);
      let cumulative = 0;
      const treeGroup = gEval
        .append("g")
        .attr("transform", `translate(0, ${treeIndex * rowHeightEval})`);

      visibleNodes.forEach((node, i) => {
        const start = cumulative;
        cumulative += node.weight;
        const x = xScale(start) + i * gap;
        const rectWidth = xScale(cumulative) - xScale(start);
        const gNode = treeGroup.append("g").attr("class", "node");
        let stroke = "black";
        let dash = null;
        let fill = "none";

        if (node.type === "extend") {
          fill = "#ADD8E6";
        } else if (node.type === "function") {
          // 无背景
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
          .attr("height", rowHeightEval)
          .attr("fill", fill)
          .attr("stroke", stroke)
          .attr("stroke-dasharray", dash)
          .on("click", (event) => {
            if (node.type === "extend") {
              node.collapsed = !node.collapsed;
              setEvalTrees([...evalTrees]);
            }
          });

        if (node.type === "extend") {
          gNode
            .append("text")
            .attr("x", x + rectWidth / 2)
            .attr("y", rowHeightEval / 2)
            .attr("dy", ".35em")
            .attr("text-anchor", "middle")
            .text(node.name)
            .style("pointer-events", "none");
        } else if (node.type === "function") {
          if (node.value) {
            const keys = Object.keys(node.value);
            const barWidth = rectWidth / keys.length;
            keys.forEach((k, idx) => {
              const barH = rowHeightEval * node.value[k];
              gNode
                .append("rect")
                .attr("x", x + idx * barWidth)
                .attr("y", rowHeightEval - barH)
                .attr("width", barWidth - 1)
                .attr("height", barH)
                .attr("fill", barColor(k));
            });
          }
        } else {
          gNode
            .append("text")
            .attr("x", x + rectWidth / 2)
            .attr("y", rowHeightEval / 2)
            .attr("dy", ".35em")
            .attr("text-anchor", "middle")
            .text(node.name)
            .style("pointer-events", "none");
        }
      });
    });
  }, [indTrees, evalTrees, width, height, margin, gap]);

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
