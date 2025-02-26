import React, { useRef, useEffect, useState } from "react";
import * as d3 from "d3";

// ============ 辅助函数 ==============
function initTree(node) {
  if (node.type === "extend") {
    node.collapsed = true;
    node.expanded = false; // 新增：标记节点是否处于展开视图状态
  }
  if (node.children) {
    node.children.forEach((child) => {
      initTree(child);
      // 设置父节点引用，用于后续恢复展示
      child.parent = node;
    });
  }
  return node;
}

// 获取节点深度
function getNodeDepth(node) {
  if (!node.children || node.children.length === 0) {
    return 1;
  }
  return 1 + Math.max(...node.children.map(getNodeDepth));
}

// 计算节点的所有子节点数量
function countChildNodes(node) {
  if (!node.children || node.children.length === 0) {
    return 0;
  }
  let count = node.children.length;
  for (const child of node.children) {
    count += countChildNodes(child);
  }
  return count;
}

function getVisibleNodes(node, level = 0, trees, parentPath = []) {
  // 保存节点的层级信息
  node.level = level;
  node.parentPath = [...parentPath];

  // 注意: 使用固定宽度，高度基于层级
  node.width = 1; // 固定宽度为1单位

  // 如果是extend节点，计算深度和子节点数量
  if (node.type === "extend") {
    node.depth = getNodeDepth(node);
    node.childCount = countChildNodes(node);
  }

  // 处理已展开状态的节点 - 只返回子节点，不包含父节点
  if (node.type === "extend" && node.expanded) {
    let arr = [];
    if (node.children && node.children.length > 0) {
      node.children.forEach((child) => {
        // 为子节点添加标记，表明它们属于已展开的父节点
        child.hasExpandedParent = true;
        child.expandedParent = node;
        const newParentPath = [...parentPath, node];
        arr = arr.concat(
          getVisibleNodes(child, level + 1, trees, newParentPath)
        );
      });
    }
    return arr;
  }

  // 处理折叠状态的节点
  let arr = [node];
  if (node.type === "extend" && node.collapsed) return arr;

  // 处理未折叠状态的节点
  if (node.children && node.children.length > 0) {
    node.children.forEach((child) => {
      const newParentPath = [...parentPath, node];
      arr = arr.concat(getVisibleNodes(child, level + 1, trees, newParentPath));
    });
  }
  return arr;
}

// 查找具有相同索引的所有节点
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

// 切换节点的展开/折叠状态
function toggleNodeExpansion(node, trees) {
  if (node.type !== "extend") return;

  // 如果节点已展开，则恢复到折叠状态
  if (node.expanded) {
    node.expanded = false;
    node.collapsed = true; // 恢复为折叠状态
    return;
  }

  // 否则，展开节点
  node.expanded = true;
  node.collapsed = false;

  // 如果有索引，则同步所有相同索引的节点状态
  if (node.index) {
    const sameIndexNodes = findNodesWithSameIndex(trees, node.index);
    sameIndexNodes.forEach((n) => {
      if (n !== node && n.type === "extend") {
        n.expanded = true;
        n.collapsed = false;
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

    // 清空原内容
    text.text("");

    // 预处理步骤：计算文本需要多少行
    let lines = [];
    let words = textString.split(/\s+/);

    // 如果只有一个词，考虑按字符拆分
    if (words.length === 1) {
      let chars = words[0].split("");
      let currentLine = "";

      for (let i = 0; i < chars.length; i++) {
        const testLine = currentLine + chars[i];
        // 创建临时tspan测量宽度
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
      // 多个词的情况
      let currentLine = "";

      for (let i = 0; i < words.length; i++) {
        const word = words[i];
        const testLine = currentLine ? currentLine + " " + word : word;

        // 创建临时tspan测量宽度
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

    // 计算文本区域的总高度
    const lineHeight = 1.2; // em
    const fontSize = parseFloat(window.getComputedStyle(this).fontSize);
    const totalTextHeight = lines.length * lineHeight * fontSize;

    // 计算文本区域的起始y坐标，使其在矩形中垂直居中
    const startY = originalY - totalTextHeight / 2 + fontSize / 2;

    // 添加每一行文本
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

// 绘制三角形的函数
function drawTriangle(nodeGroup, x, width, nodeHeight, node, trees) {
  // 只为extend节点且处于collapse状态的绘制三角形
  if (node.type === "extend" && !node.collapsed) return;

  // 对于link类型节点，寻找对应的目标节点
  let baseNode = node;
  let triangleNode = node;

  // 如果三角形节点不是extend类型或者没有折叠，则不绘制三角形
  if (triangleNode.type !== "extend" || !triangleNode.collapsed) return;

  // 计算三角形的尺寸
  const depth = baseNode.depth || 1;
  const childCount = baseNode.childCount || 0;

  // 计算三角形的高度和宽度
  const triangleHeight = Math.min(15, depth * 5); // 限制最大高度
  const avgWidth = childCount > 0 ? childCount / depth : 1;
  const triangleWidth = Math.min(width * 0.7, avgWidth * 8); // 限制最大宽度为矩形的70%

  // 计算颜色 - 基于子节点数量从白到黑渐变
  const colorScale = d3
    .scaleLinear()
    .domain([0, 20]) // 假设最多20个子节点，可以根据实际情况调整
    .range(["#FFFFFF", "#000000"])
    .clamp(true);

  const triangleColor = colorScale(childCount);

  // 绘制倒三角形
  // 三角形坐标：中心点在矩形上方，三个点分别是顶点和底边两端
  nodeGroup
    .append("path")
    .attr("d", () => {
      const centerX = x + width / 2;
      const topY = -5; // 距离矩形顶部5px

      return `M ${centerX - triangleWidth / 2} ${topY - triangleHeight}
              L ${centerX + triangleWidth / 2} ${topY - triangleHeight}
              L ${centerX} ${topY}
              Z`;
    })
    .attr("fill", triangleColor)
    .attr("stroke", "black")
    .attr("stroke-width", 1);
}

// Now, let's update how we track expanded nodes and their boundaries
function processExpandedNodes(visibleNodes, nodeWidth, gap) {
  // Create a map to store position info for all nodes
  const nodesMap = {};
  const expandedParents = new Map();

  // First pass: get basic position info for all nodes
  visibleNodes.forEach((node, i) => {
    if (!node.hasExpandedParent) return;

    const x = i * (nodeWidth + gap);
    const rightEdge = x + nodeWidth;

    // Start with immediate parent and traverse up the hierarchy
    let currentParent = node.expandedParent;
    while (currentParent) {
      if (currentParent.expanded) {
        // Use unique parent ID based on name and index
        const parentKey = `${currentParent.name}-${currentParent.index || ""}`;

        if (!expandedParents.has(parentKey)) {
          expandedParents.set(parentKey, {
            parent: currentParent,
            minX: x,
            maxX: rightEdge,
            children: [],
          });
        } else {
          // Update existing parent's boundaries
          const parentInfo = expandedParents.get(parentKey);
          parentInfo.minX = Math.min(parentInfo.minX, x);
          parentInfo.maxX = Math.max(parentInfo.maxX, rightEdge);
        }

        // Track this node as child of the parent
        const parentInfo = expandedParents.get(parentKey);
        if (!parentInfo.children.includes(node)) {
          parentInfo.children.push(node);
        }
      }

      // Move up the hierarchy
      currentParent = currentParent.parentNode;
    }
  });

  return { nodesMap, expandedParents: Array.from(expandedParents.values()) };
}

// 绘制展开节点的连接器（圆形+线）
function drawExpandedConnector(
  svg,
  expandedParents,
  cellHeight,
  maxHeight,
  onCollapseClick,
  allTrees
) {
  // 基于层级的高度计算函数
  const calculateHeight = (level, maxHeight) => {
    if (level === 0) {
      return maxHeight;
    }
    const LEVEL_DECREASE_RATIO = 0.2;
    return Math.max(20, maxHeight * (1 - level * LEVEL_DECREASE_RATIO));
  };
  
  // Sort connectors by level (deepest children first, then work upward)
  const sortedConnectors = [...expandedParents].filter(info => {
    // 过滤掉无效的连接器信息
    return info && info.parent && info.minX !== undefined && 
           info.maxX !== undefined && info.minX < info.maxX &&
           info.children && info.children.length > 0;
  }).sort((a, b) => {
    // 安全地获取 level 属性 - 如果 parent 不存在或 level 不存在，使用默认值 0
    const levelA = a && a.parent ? (a.parent.level || 0) : 0;
    const levelB = b && b.parent ? (b.parent.level || 0) : 0;
    return levelB - levelA; // 从深到浅排序
  });
  // 为每个展开的父节点绘制连接器
  sortedConnectors.forEach((group) => {
    const { parent, minX, maxX, children } = group;

    // Skip if invalid range
    if (minX === undefined || maxX === undefined || minX >= maxX) return;

    // Calculate sizes
    const parentHeight = calculateHeight(parent.level || 0, maxHeight);
    const circleRadius = Math.max(4, parentHeight * 0.05);

    // Calculate position
    const circleX = minX + (maxX - minX) / 2;

    // Use first child's level for vertical positioning
    const firstChild = children[0];
    const childLevel = firstChild.level || 0;
    const childHeight = calculateHeight(childLevel, maxHeight);
    const childY = (cellHeight - childHeight) / 2;
    const circleY = childY - circleRadius;

    // 绘制连接线
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

    // 绘制圆形
    svg
      .append("circle")
      .attr("cx", circleX)
      .attr("cy", circleY)
      .attr("r", circleRadius)
      .attr("fill", "#4A86E8")
      .attr("stroke", "#666")
      .attr("stroke-width", 1)
      .attr("cursor", "pointer")
      .on("click", () => {
        // 同步所有具有相同索引的节点
        if (parent.index && allTrees) {
          // 找到所有具有相同索引的节点
          allTrees.forEach((tree) => {
            const findAndCollapse = (node) => {
              if (node.index === parent.index && node.type === "extend") {
                node.expanded = false;
                node.collapsed = true;
              }
              if (node.children) {
                node.children.forEach((child) => findAndCollapse(child));
              }
            };
            findAndCollapse(tree);
          });
        } else {
          // 如果没有索引或allTrees，只恢复当前父节点
          parent.expanded = false;
          parent.collapsed = true;
        }

        // 调用回调函数
        onCollapseClick(parent);
      });
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
  const [data, setData] = useState([
    [
      [
        {
          name: "MACD",
          type: "extend",
          index: "1",
          children: [
            {
              name: "EMA(close,12)",
              type: "function",
            },
            {
              name: "EMA(close,26)",
              type: "function",
            },
          ],
        },
        {
          name: "rsi",
          type: "extend",
          index: "2",
          children: [
            {
              name: "rsi(close,14)",
              type: "function",
            },
            {
              name: "70",
              type: "timeseries",
            },
            {
              name: "30",
              type: "timeseries",
            },
          ],
        },
        {
          name: "boll",
          type: "extend",
          index: "3",
          children: [
            {
              name: "close",
              type: "timeseries",
            },
            {
              name: "up",
              type: "extend",
              index: "3-1",
              children: [
                {
                  name: "EMA(close,20)",
                  type: "function",
                },
                {
                  name: "movingstd(mid,20)",
                  type: "function",
                },
                {
                  name: "2",
                  type: "timeseries",
                },
              ],
            },
            {
              name: "down",
              type: "extend",
              index: "3-2",
              children: [
                {
                  name: "EMA(close,20)",
                  type: "function",
                },
                {
                  name: "movingstd(mid,20)",
                  type: "function",
                },
                {
                  name: "2",
                  type: "timeseries",
                },
              ],
            },
          ],
        },
      ],
      [
        {
          name: "period",
          type: "extend",
          index: "1",
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
          index: "2",
          children: [
            {
              name: "ahead",
              type: "extend",
              index: "2-1",
              children: [
                {
                  name: "-1",
                  type: "context",
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
          children: [
            {
              name: "EMA(close,12)",
              type: "function",
            },
            {
              name: "EMA(close,26)",
              type: "function",
            },
          ],
        },
        {
          name: "boll",
          type: "extend",
          index: "3",
          children: [
            {
              name: "close",
              type: "timeseries",
            },
            {
              name: "up",
              type: "extend",
              index: "3-1",
              children: [
                {
                  name: "EMA(close,20)",
                  type: "function",
                },
                {
                  name: "movingstd(mid,20)",
                  type: "function",
                },
                {
                  name: "2",
                  type: "timeseries",
                },
              ],
            },
            {
              name: "down",
              type: "extend",
              index: "3-2",
              children: [
                {
                  name: "EMA(close,20)",
                  type: "function",
                },
                {
                  name: "movingstd(mid,20)",
                  type: "function",
                },
                {
                  name: "2",
                  type: "timeseries",
                },
              ],
            },
          ],
        },
      ],
      [
        {
          name: "period",
          type: "extend",
          index: "1",
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
          index: "2",
          children: [
            {
              name: "ahead",
              type: "extend",
              index: "2-1",
              children: [
                {
                  name: "-1",
                  type: "context",
                },
              ],
            },
          ],
        },
      ],
    ],
  ]);

  // 基于层级的高度计算函数
  const calculateHeight = (level, maxHeight) => {
    // 如果是level 0(最高层节点)，使用最大高度
    if (level === 0) {
      return maxHeight;
    }

    // 否则，根据层级递减
    const LEVEL_DECREASE_RATIO = 0.2; // 每层级减少20%的高度
    return Math.max(20, maxHeight * (1 - level * LEVEL_DECREASE_RATIO));
  };

  useEffect(() => {
    if (!data) return;

    const groupsData = data.map((item) => {
      return { indicatorsData: item[0], evaluationData: item[1] };
    });

    const newGroups = groupsData.map((group) => ({
      indicatorsData: group.indicatorsData.map((tree) =>
        initTree(JSON.parse(JSON.stringify(tree)))
      ),
      evaluationData: group.evaluationData.map((tree) =>
        initTree(JSON.parse(JSON.stringify(tree)))
      ),
    }));

    setGroups(newGroups);
  }, [data]);

  useEffect(() => {
    if (!groups) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    // 右侧额外间距设置
    const rightMargin = 20;

    // 整体可用区域
    const availableWidth = width - margin - rightMargin;
    const availableHeight = height - margin * 2;

    // 分成两个部分（指标和评价），中间留 sectionGap
    const sectionGap = 20;
    const indicatorsSectionHeight = (availableHeight - sectionGap) / 2;
    const evaluationSectionHeight = (availableHeight - sectionGap) / 2;

    // 对于指标部分：行 = 数据组数，列 = union(指标树名称)
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
    const colGap = 0; // 每列之间间距10像素
    const cellWidthIndicators =
      (availableWidth - (numIndicatorCols - 1) * colGap) / numIndicatorCols;
    const cellHeightIndicators = indicatorsSectionHeight / numIndicatorRows;

    // 对于评价部分：行 = 数据组数，列 = union(评价树名称)
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

    // ======= 绘制指标（indicatorsData）部分 =======
    groups.forEach((group, rowIndex) => {
      indicatorNames.forEach((indicatorName, colIndex) => {
        const x0 = margin + colIndex * (cellWidthIndicators + colGap);
        const y0 = margin + rowIndex * cellHeightIndicators;

        // 为每个单元格创建一个组
        const cellGroup = svg
          .append("g")
          .attr("transform", `translate(${x0}, ${y0})`);

        const tree = group.indicatorsData.find((t) => t.name === indicatorName);
        if (tree) {
          const allTrees = groups.map((g) => g.indicatorsData).flat();
          const visibleNodes = getVisibleNodes(tree, 0, allTrees);
          const n = visibleNodes.length;

          // 节点等宽，使用高度表示层级
          const nodeWidth = (cellWidthIndicators - (n - 1) * gap) / n;

          // Process nodes and track hierarchical relationships
          const { nodesMap, expandedParents } = processExpandedNodes(
            visibleNodes,
            nodeWidth,
            gap
          );

          // 首先，收集所有节点的位置信息
          visibleNodes.forEach((node, i) => {
            const x = i * (nodeWidth + gap);

            // 保存节点信息到映射
            const nodeId = node.name + (node.index || "") + "-" + i;
            nodesMap[nodeId] = {
              node,
              x,
              width: nodeWidth,
            };
          });

          // 然后绘制节点
          visibleNodes.forEach((node, i) => {
            const x = i * (nodeWidth + gap);

            // 基于层级计算节点的高度
            const nodeHeight = calculateHeight(
              node.level,
              cellHeightIndicators
            );

            // 计算垂直居中的y位置
            const y = (cellHeightIndicators - nodeHeight) / 2;

            const gNode = cellGroup.append("g").attr("class", "node");
            let stroke = "black",
              dash = null,
              fill = "none";
            if (node.type === "extend") {
              fill = "#4A86E8"; // 使用蓝色填充extend节点
            } else if (node.type === "function") {
              // 函数节点使用白色填充
              fill = "white";
            } else if (node.type === "constant") {
              dash = null;
              fill = "white";
            } else if (node.type === "timeseries") {
              dash = null;
              fill = "white";
            } else if (node.type === "context") {
              dash = null;
              fill = "white";
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
                  // 处理展开/折叠逻辑
                  toggleNodeExpansion(node, allTrees);
                  setGroups([...groups]); // 触发重绘
                }
              });

            // 为折叠状态的extend节点绘制三角形
            if (
              rowIndex === 0 &&
              (node.type === "extend" || node.type === "link")
            ) {
              drawTriangle(gNode, x, nodeWidth, nodeHeight, node, allTrees);
            }

            // 绘制文本标签
            const textElem = gNode
              .append("text")
              .attr("x", x + nodeWidth / 2)
              .attr("y", y + nodeHeight / 2)
              .attr("dy", ".35em")
              .attr("text-anchor", "middle")
              .attr("fill", node.type === "extend" ? "white" : "black") // extend节点使用白色文本
              .text(node.name)
              .style("pointer-events", "none");
            wrapText(textElem, nodeWidth, nodeHeight);
          });

          // 绘制展开节点的连接器
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

    // ======= 绘制评价（evaluationData）部分 =======
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
          const visibleNodes = getVisibleNodes(tree, 0, allTrees);
          const n = visibleNodes.length;

          // 节点等宽，使用高度表示层级
          const nodeWidth = (cellWidthEvaluation - (n - 1) * gap) / n;

          // Process nodes and track hierarchical relationships
          const { nodesMap, expandedParents } = processExpandedNodes(
            visibleNodes,
            nodeWidth,
            gap
          );

          // 首先，收集所有节点的位置信息
          visibleNodes.forEach((node, i) => {
            const x = i * (nodeWidth + gap);

            // 保存节点信息到映射
            const nodeId = node.name + (node.index || "");
            nodesMap[nodeId] = {
              node,
              x,
              width: nodeWidth,
            };

            // 如果节点有展开的父节点，记录下来
            if (node.hasExpandedParent && node.expandedParent) {
              if (!expandedParents.includes(node.expandedParent)) {
                expandedParents.push(node.expandedParent);
              }
            }
          });

          // 然后绘制节点
          visibleNodes.forEach((node, i) => {
            const x = i * (nodeWidth + gap);

            // 基于层级计算节点的高度
            const nodeHeight = calculateHeight(
              node.level,
              cellHeightEvaluation
            );

            // 计算垂直居中的y位置
            const y = (cellHeightEvaluation - nodeHeight) / 2;

            const gNode = cellGroup.append("g").attr("class", "node");
            let stroke = "black",
              dash = null,
              fill = "none";
            if (node.type === "extend") {
              fill = "#4A86E8"; // 使用蓝色填充extend节点
            } else if (node.type === "function") {
              // 函数节点使用白色填充
              fill = "white";
            } else if (node.type === "constant") {
              dash = null;
              fill = "white";
            } else if (node.type === "timeseries") {
              dash = null;
              fill = "white";
            } else if (node.type === "context") {
              dash = null;
              fill = "white";
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
                  // 处理展开/折叠逻辑
                  toggleNodeExpansion(node, allTrees);
                  setGroups([...groups]); // 触发重绘
                }
              });

            // 为折叠状态的extend节点绘制三角形
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
              .attr("fill", node.type === "extend" ? "white" : "black") // extend节点使用白色文本
              .text(node.name)
              .style("pointer-events", "none");
            wrapText(textElem, nodeWidth, nodeHeight);
          });

          // 绘制展开节点的连接器
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
