import React, { useRef, useEffect, useState } from "react";
import * as d3 from "d3";

// ============ 数据部分 ==============
const data = [
  [
    [
      {
        name: "MACD",
        type: "extend",
        index: "1",
        level: 0,
        collapse: false,
        depth: 2, // 根节点深度 2
        childCount: 2, // 有两个直接子节点
        children: [
          {
            name: "EMA(close,12)",
            type: "function",
            level: 1,
            depth: 1,
            childCount: 0,
            diff: ["1-1", 0],
          },
          {
            name: "EMA(close,26)",
            type: "function",
            level: 1,
            depth: 1,
            childCount: 0,
            diff: ["1-2", 0],
          },
        ],
      },
      {
        name: "rsi",
        type: "extend",
        index: "2",
        level: 0,
        collapse: true,
        depth: 2,
        childCount: 3,
        children: [
          {
            name: "rsi(close,14)",
            type: "function",
            level: 1,
            depth: 1,
            childCount: 0,
          },
          {
            name: "70",
            type: "timeseries",
            level: 1,
            depth: 1,
            childCount: 0,
          },
          {
            name: "30",
            type: "timeseries",
            level: 1,
            depth: 1,
            childCount: 0,
          },
        ],
      },
      {
        name: "boll",
        type: "extend",
        index: "3",
        level: 0,
        collapse: false,
        depth: 3,
        childCount: 9,
        children: [
          {
            name: "close",
            type: "timeseries",
            level: 1,
            depth: 1,
            childCount: 0,
            diff: ["3-1", 0],
          },
          {
            name: "up",
            type: "extend",
            index: "3-1",
            level: 1,
            collapse: true,
            depth: 2,
            sharedKey: "upDownChildren",
          },
          {
            name: "down",
            type: "extend",
            index: "3-2",
            level: 1,
            collapse: true,
            depth: 2,
            sharedKey: "upDownChildren",
          },
        ],
      },
    ],
    [
      {
        name: "period",
        type: "extend",
        index: "1",
        level: 0,
        collapse: false,
        depth: 2,
        childCount: 1,
        children: [
          {
            name: "2023-07-01 2024-07-01",
            type: "context",
            level: 1,
            depth: 1,
            childCount: 0,
            diff: ["evaluation-1", 0],
          },
        ],
      },
      {
        name: "stop",
        type: "extend",
        index: "2",
        level: 0,
        collapse: true,
        depth: 2,
        childCount: 1,
        children: [
          {
            name: "ahead",
            type: "extend",
            index: "2-1",
            level: 1,
            collapse: true,
            depth: 2,
            childCount: 1,
            children: [
              {
                name: "-1",
                type: "context",
                level: 2,
                depth: 1,
                childCount: 0,
              },
            ],
          },
        ],
      },
    ],
  ],
  [
    [
      {
        name: "MACD",
        type: "extend",
        index: "1",
        level: 0,
        collapse: false,
        depth: 2,
        childCount: 2,
        children: [
          {
            name: "EMA(close,20)",
            type: "function",
            level: 1,
            depth: 1,
            childCount: 0,
            diff: ["1-1", 0.4],
          },
          {
            name: "EMA(close,30)",
            type: "function",
            level: 1,
            depth: 1,
            childCount: 0,
            diff: ["1-2", 0.2],
          },
        ],
      },
      {
        name: "boll",
        type: "extend",
        index: "3",
        level: 0,
        collapse: false,
        depth: 3,
        childCount: 9,
        children: [
          {
            name: "open",
            type: "timeseries",
            level: 1,
            depth: 1,
            childCount: 0,
            diff: ["3-1", 0.6],
          },
          {
            name: "up",
            type: "extend",
            index: "3-1",
            level: 1,
            collapse: true,
            depth: 2,
            sharedKey: "upDownChildren",
          },
          {
            name: "down",
            type: "extend",
            index: "3-2",
            level: 1,
            collapse: true,
            depth: 2,
            sharedKey: "upDownChildren",
          },
        ],
      },
    ],
    [
      {
        name: "period",
        type: "extend",
        index: "1",
        level: 0,
        collapse: false,
        depth: 2,
        childCount: 1,
        children: [
          {
            name: "2022-07-01 2024-07-01",
            type: "context",
            level: 1,
            depth: 1,
            childCount: 0,
            diff: ["evaluation-1", 0.5],
          },
        ],
      },
      {
        name: "stop",
        type: "extend",
        index: "2",
        level: 0,
        collapse: true,
        depth: 2,
        childCount: 1,
        children: [
          {
            name: "ahead",
            type: "extend",
            index: "2-1",
            level: 1,
            collapse: true,
            depth: 2,
            childCount: 1,
            children: [
              {
                name: "-1",
                type: "context",
                level: 2,
                depth: 1,
                childCount: 0,
              },
            ],
          },
        ],
      },
    ],
  ],
];

const sharedChildrenMap = {
  upDownChildren: [
    {
      name: "EMA(close,20)",
      type: "function",
      level: 2,
      depth: 1,
      childCount: 0,
    },
    {
      name: "movingstd(mid,20)",
      type: "function",
      level: 2,
      depth: 1,
      childCount: 0,
    },
    {
      name: "2",
      type: "timeseries",
      level: 2,
      depth: 1,
      childCount: 0,
    },
  ],
};

// ============ 辅助函数 ==============

// 仅设置 level、collapse 状态和父节点，不计算 depth 和 childCount（这些值直接写在 data 中）
function initTree(node, level = 0) {
  node.level = level;
  if (node.type === "extend") {
    node.collapsed = typeof node.collapse === "boolean" ? node.collapse : true;
    node.expanded = !node.collapsed;
  }
  if (node.children && node.children.length > 0) {
    node.children.forEach((child) => {
      initTree(child, level + 1);
      child.parent = node;
    });
  }
  return node;
}

// 在 getVisibleNodes 中直接使用数据中的 depth 与 childCount
function getVisibleNodes(node, trees, sharedChildrenMap, parentPath = []) {
  node.parentPath = [...parentPath];
  node.width = 1; // 固定宽度为1单位

  if (node.type === "extend" && node.expanded) {
    let arr = [];
    if (node.sharedKey && sharedChildrenMap[node.sharedKey]) {
      sharedChildrenMap[node.sharedKey].forEach((child) => {
        child.hasExpandedParent = true;
        child.expandedParent = node;
        const newParentPath = [...parentPath, node];
        arr = arr.concat(
          getVisibleNodes(child, trees, sharedChildrenMap, newParentPath)
        );
      });
      return arr;
    }
    if (node.children && node.children.length > 0) {
      node.children.forEach((child) => {
        child.hasExpandedParent = true;
        child.expandedParent = node;
        const newParentPath = [...parentPath, node];
        arr = arr.concat(
          getVisibleNodes(child, trees, sharedChildrenMap, newParentPath)
        );
      });
    }
    return arr;
  }

  let arr = [node];
  if (node.type === "extend" && node.collapsed) return arr;
  if (node.children && node.children.length > 0) {
    node.children.forEach((child) => {
      const newParentPath = [...parentPath, node];
      arr = arr.concat(
        getVisibleNodes(child, trees, sharedChildrenMap, newParentPath)
      );
    });
  }
  return arr;
}

function findNodesWithSameIndex(trees, targetIndex) {
  const result = [];
  trees.forEach((tree) => {
    const findNodes = (node) => {
      if (node.index === targetIndex) {
        result.push(node);
      }
      if (node.children) {
        node.children.forEach((child) => findNodes(child));
      }
    };
    findNodes(tree);
  });
  return result;
}

function toggleNodeExpansion(node, trees) {
  if (node.type !== "extend") return;

  node.expanded = true;
  node.collapsed = false;
  if (node.sharedKey) {
    // 找到同一个父节点下，sharedKey 一样的兄弟
    const parent = node.parent;
    if (parent && parent.children) {
      parent.children.forEach((sibling) => {
        if (sibling !== node && sibling.sharedKey === node.sharedKey) {
          // 把对方隐藏起来
          // sibling.hidden = node.expanded;
          // 同时把对方折叠
          sibling.expanded = false;
          sibling.collapsed = true;
        }
      });
    }
  }
  if (node.index) {
    const sameIndexNodes = findNodesWithSameIndex(trees, node.index);
    sameIndexNodes.forEach((n) => {
      if (n !== node && n.type === "extend") {
        n.expanded = true;
        n.collapsed = false;
      }
      if (n.sharedKey) {
        const p = n.parent;
        if (p && p.children) {
          p.children.forEach((sibling) => {
            if (sibling !== n && sibling.sharedKey === n.sharedKey) {
              // 把对方隐藏起来
              // sibling.hidden = n.expanded;
              // 同时把对方折叠
              sibling.expanded = false;
              sibling.collapsed = true;
            }
          });
        }
      }
    });
  }
}

function wrapText(textSelection, width, boxHeight) {
  textSelection.each(function () {
    const text = d3.select(this);
    const textString = text.text();
    const originalX = text.attr("x") || 0;
    const originalY = text.attr("y") || 0;
    const textAnchor = text.attr("text-anchor") || "start";
    text.text("");
    let lines = [];
    let words = textString.split(/\s+/);
    if (words.length === 1) {
      let chars = words[0].split("");
      let currentLine = "";
      for (let i = 0; i < chars.length; i++) {
        const testLine = currentLine + chars[i];
        const tempTspan = text.append("tspan").text(testLine);
        const lineWidth = tempTspan.node().getComputedTextLength();
        tempTspan.remove();
        if (lineWidth > width && currentLine) {
          lines.push(currentLine);
          currentLine = chars[i];
        } else {
          currentLine = testLine;
        }
      }
      if (currentLine) {
        lines.push(currentLine);
      }
    } else {
      let currentLine = "";
      for (let i = 0; i < words.length; i++) {
        const word = words[i];
        const testLine = currentLine ? currentLine + " " + word : word;
        const tempTspan = text.append("tspan").text(testLine);
        const lineWidth = tempTspan.node().getComputedTextLength();
        tempTspan.remove();
        if (lineWidth > width && currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }
      if (currentLine) {
        lines.push(currentLine);
      }
    }
    const lineHeight = 1.2;
    const fontSize = parseFloat(window.getComputedStyle(this).fontSize);
    const totalTextHeight = lines.length * lineHeight * fontSize;
    const startY = originalY - totalTextHeight / 2 + fontSize / 2;
    lines.forEach((line, i) => {
      text
        .append("tspan")
        .attr("x", originalX)
        .attr("y", startY + i * lineHeight * fontSize)
        .attr("text-anchor", textAnchor)
        .text(line);
    });
  });
}

function drawTriangle(nodeGroup, x, width, nodeHeight, node, trees) {
  if (node.type === "extend" && !node.collapsed) return;
  if (node.type !== "extend" || !node.collapsed) return;
  const depth = node.depth || 1;
  const childCount = node.childCount || 0;
  const triangleHeight = Math.min(15, depth * 5);
  const avgWidth = childCount > 0 ? childCount / depth : 1;
  const triangleWidth = Math.min(width * 0.7, avgWidth * 8);
  const colorScale = d3
    .scaleLinear()
    .domain([0, 20])
    .range(["#FFFFFF", "#000000"])
    .clamp(true);
  const triangleColor = colorScale(childCount);
  nodeGroup
    .append("path")
    .attr("d", () => {
      const centerX = x + width / 2;
      const topY = -5;
      return `M ${centerX - triangleWidth / 2} ${topY - triangleHeight}
              L ${centerX + triangleWidth / 2} ${topY - triangleHeight}
              L ${centerX} ${topY}
              Z`;
    })
    .attr("fill", triangleColor)
    .attr("stroke", "black")
    .attr("stroke-width", 1);
}

function processExpandedNodes(visibleNodes, nodeWidth, gap) {
  const nodesMap = {};
  const expandedParents = new Map();
  visibleNodes.forEach((node, i) => {
    if (!node.hasExpandedParent) return;
    const x = i * (nodeWidth + gap);
    const rightEdge = x + nodeWidth;
    let currentParent = node.expandedParent;
    while (currentParent) {
      if (currentParent.expanded) {
        const parentKey = `${currentParent.name}-${currentParent.index || ""}`;
        if (!expandedParents.has(parentKey)) {
          expandedParents.set(parentKey, {
            parent: currentParent,
            minX: x,
            maxX: rightEdge,
            children: [],
          });
        } else {
          const parentInfo = expandedParents.get(parentKey);
          parentInfo.minX = Math.min(parentInfo.minX, x);
          parentInfo.maxX = Math.max(parentInfo.maxX, rightEdge);
        }
        const parentInfo = expandedParents.get(parentKey);
        if (!parentInfo.children.includes(node)) {
          parentInfo.children.push(node);
        }
      }
      currentParent = currentParent.parent;
    }
  });
  return { nodesMap, expandedParents: Array.from(expandedParents.values()) };
}

function drawExpandedConnector(
  svg,
  expandedParents,
  cellHeight,
  maxHeight,
  onCollapseClick,
  allTrees
) {
  const calculateHeight = (level, maxHeight) => {
    if (level === 0) {
      return maxHeight;
    }
    const LEVEL_DECREASE_RATIO = 0.2;
    return Math.max(20, maxHeight * (1 - level * LEVEL_DECREASE_RATIO));
  };

  const sortedConnectors = [...expandedParents]
    .filter((info) => {
      return (
        info &&
        info.parent &&
        info.minX !== undefined &&
        info.maxX !== undefined &&
        info.minX < info.maxX &&
        info.children &&
        info.children.length > 0
      );
    })
    .sort((a, b) => {
      const levelA = a && a.parent ? a.parent.level || 0 : 0;
      const levelB = b && b.parent ? b.parent.level || 0 : 0;
      return levelB - levelA;
    });

  sortedConnectors.forEach((group) => {
    const { parent, minX, maxX, children } = group;
    if (minX === undefined || maxX === undefined || minX >= maxX) return;
    const parentHeight = calculateHeight(parent.level || 0, maxHeight);
    const circleRadius = Math.max(4, parentHeight * 0.05);
    const circleX = minX + (maxX - minX) / 2;
    const firstChild = children[0];
    const childLevel = firstChild.level || 0;
    const childHeight = calculateHeight(childLevel, maxHeight);
    const childY = cellHeight - childHeight;
    const circleY = childY - circleRadius;
    svg
      .append("line")
      .attr("x1", minX)
      .attr("y1", circleY)
      .attr("x2", maxX)
      .attr("y2", circleY)
      .attr("stroke", "#666")
      .attr("stroke-width", 1.5);
    svg
      .append("line")
      .attr("x1", minX)
      .attr("y1", circleY)
      .attr("x2", minX)
      .attr("y2", circleY + circleRadius)
      .attr("stroke", "#666")
      .attr("stroke-width", 1.5);
    svg
      .append("line")
      .attr("x1", maxX)
      .attr("y1", circleY)
      .attr("x2", maxX)
      .attr("y2", circleY + circleRadius)
      .attr("stroke", "#666")
      .attr("stroke-width", 1.5);
    svg
      .append("rect")
      .attr("x", circleX - (maxX - minX) / 8)
      .attr("y", circleY - circleRadius)
      .attr("width", (maxX - minX) / 4)
      .attr("height", circleRadius * 2)
      .attr("fill", "black")
      .attr("stroke", "#666")
      .attr("stroke-width", 1)
      .attr("cursor", "pointer")
      .on("click", () => {
        if (parent.index && allTrees) {
          allTrees.forEach((tree) => {
            const findAndCollapse = (node) => {
              if (node.index === parent.index && node.type === "extend") {
                node.expanded = false;
                node.collapsed = true;
                if (node.sharedKey) {
                  const parent = node.parent;
                  if (parent && parent.children) {
                    parent.children.forEach((sibling) => {
                      if (
                        sibling !== node &&
                        sibling.sharedKey === node.sharedKey
                      ) {
                        // sibling.hidden = false; // 恢复兄弟节点
                        sibling.expanded = false;
                        sibling.collapsed = true;
                      }
                    });
                  }
                }
              }
              if (node.children) {
                node.children.forEach((child) => findAndCollapse(child));
              }
            };
            findAndCollapse(tree);
          });
        } else {
          parent.expanded = false;
          parent.collapsed = true;
        }
        onCollapseClick(parent);
      });
      // gNode
      // .append("rect")
      // .attr("x", x)
      // .attr("y", y)
      // .attr("width", nodeWidth)
      // .attr("height", nodeHeight)
      // .attr("fill", fill)
      // .attr("stroke", stroke)
      // .attr("stroke-dasharray", dash)
      // .attr("cursor", "pointer")
      // .on("click", () => {
      //   if (node.type === "extend") {
      //     toggleNodeExpansion(node, allTrees);
      //     setGroups([...groups]);
      //   }
      // });
  });
}

// ============ MultiBarcodeTree 组件 ==============
const MultiBarcodeTree = ({
  width = 900,
  height = 400,
  margin = 20,
  gap = 4,
}) => {
  const svgRef = useRef(null);
  const [groups, setGroups] = useState(null);

  const calculateHeight = (level, maxHeight) => {
    if (level === 0) return maxHeight;
    const LEVEL_DECREASE_RATIO = 0.2;
    return Math.max(20, maxHeight * (1 - level * LEVEL_DECREASE_RATIO));
  };

  useEffect(() => {
    if (!data) return;
    const groupsData = data.map((item) => ({
      indicatorsData: item[0],
      evaluationData: item[1],
    }));
    const newGroups = groupsData.map((group) => ({
      indicatorsData: group.indicatorsData.map((tree) =>
        initTree(JSON.parse(JSON.stringify(tree)), 0)
      ),
      evaluationData: group.evaluationData.map((tree) =>
        initTree(JSON.parse(JSON.stringify(tree)), 0)
      ),
    }));
    setGroups(newGroups);
  }, [data]);

  useEffect(() => {
    if (!groups) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const rightMargin = 20;
    const availableWidth = width - margin - rightMargin;
    const availableHeight = height - margin * 2;
    const sectionGap = 20;
    const indicatorsSectionHeight = (availableHeight - sectionGap) / 2;
    const evaluationSectionHeight = (availableHeight - sectionGap) / 2;
    let indicatorNames = [];
    groups.forEach((group) => {
      group.indicatorsData.forEach((tree) => {
        if (!indicatorNames.includes(tree.name)) {
          indicatorNames.push(tree.name);
        }
      });
    });
    const numIndicatorRows = groups.length;
    const numIndicatorCols = indicatorNames.length;
    const colGap = 5;
    const cellWidthIndicators =
      (availableWidth - (numIndicatorCols - 1) * colGap) / numIndicatorCols;
    const cellHeightIndicators = indicatorsSectionHeight / numIndicatorRows;
    let evaluationNames = [];
    groups.forEach((group) => {
      group.evaluationData.forEach((tree) => {
        if (!evaluationNames.includes(tree.name)) {
          evaluationNames.push(tree.name);
        }
      });
    });
    const numEvaluationRows = groups.length;
    const numEvaluationCols = evaluationNames.length;
    const cellWidthEvaluation =
      (availableWidth - (numEvaluationCols - 1) * colGap) / numEvaluationCols;
    const cellHeightEvaluation = evaluationSectionHeight / numEvaluationRows;

    // ======= 绘制指标部分 =======
    groups.forEach((group, rowIndex) => {
      indicatorNames.forEach((indicatorName, colIndex) => {
        const x0 = margin + colIndex * (cellWidthIndicators + colGap);
        const y0 = margin + rowIndex * cellHeightIndicators;
        const cellGroup = svg
          .append("g")
          .attr("transform", `translate(${x0}, ${y0})`);
        const tree = group.indicatorsData.find((t) => t.name === indicatorName);
        if (tree) {
          const allTrees = groups.map((g) => g.indicatorsData).flat();
          const visibleNodes = getVisibleNodes(
            tree,
            allTrees,
            sharedChildrenMap
          );
          const n = visibleNodes.length;
          const nodeWidth = (cellWidthIndicators - (n - 1) * gap) / n;
          const { nodesMap, expandedParents } = processExpandedNodes(
            visibleNodes,
            nodeWidth,
            gap
          );
          visibleNodes.forEach((node, i) => {
            const x = i * (nodeWidth + gap);
            const nodeId = node.name + (node.index || "") + "-" + i;
            nodesMap[nodeId] = {
              node,
              x,
              width: nodeWidth,
            };
          });
          visibleNodes.forEach((node, i) => {
            const x = i * (nodeWidth + gap);
            const nodeHeight = calculateHeight(
              node.level,
              cellHeightIndicators
            );
            const y = cellHeightIndicators - nodeHeight;
            const gNode = cellGroup.append("g").attr("class", "node");
            let stroke = "black",
              dash = null,
              fill = "none";
            if (node.type === "extend") {
              fill = "white";
            } else if (node.type === "function") {
              fill = "white";
            } else {
              fill = "white";
            }

            if (
              node.diff &&
              Array.isArray(node.diff) &&
              node.diff.length === 2
            ) {
              const diffCategory = node.diff[0];
              const diffValue = node.diff[1];
              // const baseColor = baseColorScale(diffCategory);
              // fill = d3.interpolateLab(baseColor, "black")(diffValue);
            }

            gNode
              .append("rect")
              .attr("x", x)
              .attr("y", y)
              .attr("width", nodeWidth)
              .attr("height", nodeHeight)
              .attr("fill", fill)
              .attr("stroke", stroke)
              .attr("stroke-dasharray", dash)
              .attr("cursor", "pointer")
              .on("click", () => {
                if (node.type === "extend") {
                  toggleNodeExpansion(node, allTrees);
                  setGroups([...groups]);
                }
              });
            if (
              rowIndex === 0 &&
              (node.type === "extend")
            ) {
              drawTriangle(gNode, x, nodeWidth, nodeHeight, node, allTrees);
            }
            const textElem = gNode
              .append("text")
              .attr("x", x + nodeWidth / 2)
              .attr("y", y + nodeHeight / 2)
              .attr("dy", ".35em")
              .attr("text-anchor", "middle")
              .attr("fill", "black")
              .text(node.name)
              .style("pointer-events", "none");
            wrapText(textElem, nodeWidth, nodeHeight);
          });
          if (expandedParents.length > 0) {
            drawExpandedConnector(
              cellGroup,
              expandedParents,
              cellHeightIndicators,
              cellHeightIndicators,
              (parent) => {
                parent.expanded = false;
                parent.collapsed = true;
                setGroups([...groups]);
              },
              allTrees
            );
          }
        }
      });
    });

    // ======= 绘制评价部分 =======
    groups.forEach((group, rowIndex) => {
      evaluationNames.forEach((evalName, colIndex) => {
        const x0 = margin + colIndex * (cellWidthEvaluation + colGap);
        const y0 =
          margin +
          indicatorsSectionHeight +
          sectionGap +
          rowIndex * cellHeightEvaluation;
        const cellGroup = svg
          .append("g")
          .attr("transform", `translate(${x0}, ${y0})`);
        const tree = group.evaluationData.find((t) => t.name === evalName);
        if (tree) {
          const allTrees = groups.map((g) => g.evaluationData).flat();
          const visibleNodes = getVisibleNodes(
            tree,
            allTrees,
            sharedChildrenMap
          );
          const n = visibleNodes.length;
          const nodeWidth = (cellWidthEvaluation - (n - 1) * gap) / n;
          const { nodesMap, expandedParents } = processExpandedNodes(
            visibleNodes,
            nodeWidth,
            gap
          );
          visibleNodes.forEach((node, i) => {
            const x = i * (nodeWidth + gap);
            const nodeId = node.name + (node.index || "");
            nodesMap[nodeId] = {
              node,
              x,
              width: nodeWidth,
            };
            if (node.hasExpandedParent && node.expandedParent) {
              if (!expandedParents.includes(node.expandedParent)) {
                expandedParents.push(node.expandedParent);
              }
            }
          });
          visibleNodes.forEach((node, i) => {
            const x = i * (nodeWidth + gap);
            const nodeHeight = calculateHeight(
              node.level,
              cellHeightEvaluation
            );
            const y = cellHeightEvaluation - nodeHeight;
            const gNode = cellGroup.append("g").attr("class", "node");
            let stroke = "black",
              dash = null,
              fill = "none";
            if (node.type === "extend") {
              fill = "white";
            } else if (node.type === "function") {
              fill = "white";
            } else {
              fill = "white";
            }

            if (
              node.diff &&
              Array.isArray(node.diff) &&
              node.diff.length === 2
            ) {
              const diffCategory = node.diff[0];
              const diffValue = node.diff[1];
              // const baseColor = baseColorScale(diffCategory);
              // fill = d3.interpolateLab(baseColor, "black")(diffValue);
            }

            gNode
              .append("rect")
              .attr("x", x)
              .attr("y", y)
              .attr("width", nodeWidth)
              .attr("height", nodeHeight)
              .attr("fill", fill)
              .attr("stroke", stroke)
              .attr("stroke-dasharray", dash)
              .attr("cursor", "pointer")
              .on("click", () => {
                if (node.type === "extend") {
                  toggleNodeExpansion(node, allTrees);
                  setGroups([...groups]);
                }
              });
            if (
              rowIndex === 0 &&
              (node.type === "extend" || node.type === "link")
            ) {
              drawTriangle(gNode, x, nodeWidth, nodeHeight, node, allTrees);
            }
            const textElem = gNode
              .append("text")
              .attr("x", x + nodeWidth / 2)
              .attr("y", y + nodeHeight / 2)
              .attr("dy", ".35em")
              .attr("text-anchor", "middle")
              .attr("fill", "black")
              .text(node.name)
              .style("pointer-events", "none");
            wrapText(textElem, nodeWidth, nodeHeight);
          });
          if (expandedParents.length > 0) {
            drawExpandedConnector(
              cellGroup,
              expandedParents,
              cellHeightIndicators,
              cellHeightIndicators,
              (parent) => {
                parent.expanded = false;
                parent.collapsed = true;
                setGroups([...groups]);
              },
              allTrees
            );
          }
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
