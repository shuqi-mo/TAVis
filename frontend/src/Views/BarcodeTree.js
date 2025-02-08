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
        name: "from 2023-07-01 to 2024-07-01",
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

// 计算节点“可见”大小  
// 若 extend 节点处于折叠状态，则只计算自身；  
// 对于 link 节点，仅统计自身（不复制目标子树），避免重复复制
function computeVisibleSize(node, trees) {
  let size = 1;
  if (node.type === "extend" && node.collapsed) {
    node.visibleSize = 1;
    return 1;
  }
  if (node.children && node.children.length > 0) {
    node.children.forEach((child) => {
      if (child.type === "link") {
        // 仅统计 link 节点本身，不累加目标子树
        size += 1;
      } else {
        size += computeVisibleSize(child, trees);
      }
    });
  }
  node.visibleSize = size;
  return size;
}

// 返回按深度优先顺序的可见节点数组  
// 对于 link 节点，仅返回该节点本身，不展开目标节点的子节点
function getVisibleNodes(node, trees) {
  let arr = [node];
  if (node.type === "extend" && node.collapsed) {
    return arr;
  }
  if (node.children && node.children.length > 0) {
    node.children.forEach((child) => {
      if (child.type === "link") {
        arr.push(child);
      } else {
        arr = arr.concat(getVisibleNodes(child, trees));
      }
    });
  }
  return arr;
}

// 在整个树集合中查找名称相同且 type 不为 link 的目标节点  
// 注意：此处可传入局部数组，如 [tree]，以限定搜索范围
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
  // 分别保存 indicators 与 evaluation 部分的树数据（数组）
  const [indTrees, setIndTrees] = useState(null);
  const [evalTrees, setEvalTrees] = useState(null);
  const tooltipRef = useRef(null);

  // 初始化数据：深拷贝输入数组，并对每棵树（包括根节点）调用 initTree
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

    // 创建 tooltip（以 div 形式）
    let tooltip = d3.select(tooltipRef.current);
    if (tooltip.empty()) {
      tooltip = d3
        .select("body")
        .append("div")
        .attr("class", "tooltip")
        .style("position", "absolute")
        .style("pointer-events", "none")
        .style("background", "lightgray")
        .style("padding", "4px")
        .style("border-radius", "4px")
        .style("opacity", 0);
      tooltipRef.current = tooltip.node();
    }

    // 总体布局设置
    const totalHeight = height - margin * 2;
    const separatorHeight = 20;
    const gapBetweenGroup = 10; // 指标组与横线之间预留间隔
    // 两组占用 (totalHeight - separatorHeight - gapBetweenGroup)
    const groupHeight = (totalHeight - separatorHeight - gapBetweenGroup) / 2;
    const treeWidth = width - margin * 2;

    // 定义色板
    const barColor = d3.scaleOrdinal(d3.schemeCategory10);
    const tsColor = d3.scaleOrdinal(d3.schemeCategory10);

    // ======== 绘制 indicators 部分 ========
    const numIndTrees = indTrees.length;
    const rowHeightInd = groupHeight / numIndTrees;
    const gInd = svg.append("g").attr("transform", `translate(${margin}, ${margin})`);

    indTrees.forEach((tree, treeIndex) => {
      computeVisibleSize(tree, indTrees);
      const visibleNodes = getVisibleNodes(tree, indTrees);
      const totalSize = d3.sum(visibleNodes, (d) => d.visibleSize);
      const n = visibleNodes.length;
      const xScale = d3.scaleLinear().domain([0, totalSize]).range([0, treeWidth - (n - 1) * gap]);
      let cumulative = 0;
      // 每棵树所在行的分组
      const treeGroup = gInd
        .append("g")
        .attr("transform", `translate(0, ${treeIndex * rowHeightInd})`);

      visibleNodes.forEach((node, i) => {
        const start = cumulative;
        cumulative += node.visibleSize;
        // 节点在该行中的水平位置
        const x = xScale(start) + i * gap;
        const rectWidth = xScale(cumulative) - xScale(start);
        const gNode = treeGroup.append("g").attr("class", "node");
        let stroke = "black";
        let dash = null;
        let fill = "none";

        if (node.type === "extend") {
          fill = "#ADD8E6"; // 实线边框 + 统一背景色
        } else if (node.type === "function") {
          // 无背景；内部后续绘制柱状图
        } else if (node.type === "constant") {
          dash = "4,2";
          const num = parseFloat(node.name);
          // 修改：将 density 转为整数，避免 id 中出现小数点
          const density = isNaN(num) ? 5 : Math.max(2, Math.floor(10 - num / 10));
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

        // 修改 onClick 交互逻辑
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
              // 针对 boll 树中 down 节点的特殊交互：
              // 如果当前树为 boll 且 node.name 为 "down"，且其子节点中存在 link 类型，则查找当前 boll 树中
              // 名称与 link 节点相同（例如 "up"）的目标节点，并展开该目标节点的子树
              if (
                tree.name === "boll" &&
                node.name === "down" &&
                node.children &&
                node.children.some((child) => child.type === "link")
              ) {
                const linkChild = node.children.find((child) => child.type === "link");
                const target = findTargetNode([tree], linkChild.name);
                if (target) {
                  target.collapsed = false; // 展开 up 节点的子树
                  setIndTrees([...indTrees]);
                  return;
                }
              } else {
                node.collapsed = !node.collapsed;
                setIndTrees([...indTrees]);
              }
            }
          })
          .on("mouseover", (event) => {
            if (node.type === "context") {
              tooltip
                .transition()
                .duration(200)
                .style("opacity", 0.9);
              tooltip
                .html(node.name)
                .style("left", event.pageX + 5 + "px")
                .style("top", event.pageY - 28 + "px");
            }
          })
          .on("mouseout", () => {
            if (node.type === "context") {
              tooltip.transition().duration(500).style("opacity", 0);
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
    // 横线绘制在 indicators 部分底部预留 gapBetweenGroup 后的位置
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
    const gEval = svg.append("g").attr("transform", `translate(${margin}, ${evalTop})`);

    evalTrees.forEach((tree, treeIndex) => {
      computeVisibleSize(tree, evalTrees);
      const visibleNodes = getVisibleNodes(tree, evalTrees);
      const totalSize = d3.sum(visibleNodes, (d) => d.visibleSize);
      const n = visibleNodes.length;
      const xScale = d3.scaleLinear().domain([0, totalSize]).range([0, treeWidth - (n - 1) * gap]);
      let cumulative = 0;
      const treeGroup = gEval
        .append("g")
        .attr("transform", `translate(0, ${treeIndex * rowHeightEval})`);

      visibleNodes.forEach((node, i) => {
        const start = cumulative;
        cumulative += node.visibleSize;
        const x = xScale(start) + i * gap;
        const rectWidth = xScale(cumulative) - xScale(start);
        const gNode = treeGroup.append("g").attr("class", "node");
        let stroke = "black";
        let dash = null;
        let fill = "none";

        if (node.type === "extend") {
          fill = "#ADD8E6";
        } else if (node.type === "function") {
          // 无背景；内部后续绘制柱状图
        } else if (node.type === "constant") {
          dash = "4,2";
          const num = parseFloat(node.name);
          const density = isNaN(num) ? 5 : Math.max(2, Math.floor(10 - num / 10));
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
          })
          .on("mouseover", (event) => {
            if (node.type === "context") {
              tooltip
                .transition()
                .duration(200)
                .style("opacity", 0.9);
              tooltip
                .html(node.name)
                .style("left", event.pageX + 5 + "px")
                .style("top", event.pageY - 28 + "px");
            }
          })
          .on("mouseout", () => {
            if (node.type === "context") {
              tooltip.transition().duration(500).style("opacity", 0);
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
