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

const evaluationData = [
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

const indicatorsLinks = [{ row: 0, source: "MACD", target: "boll", count: 2 }];

const evaluationLinks = [{ source: "period", target: "stop", count: 4 }];

const sideLinks = [
  { row: 0, source: "boll", target: "stop" },
  { row: 1, source: "boll", target: "stop" },
  { row: 2, source: "rsi", target: "stop" },
];

// ============ 辅助函数 ==============

// 递归初始化整棵树；若节点类型为 extend，则默认设置 collapsed = true
function initTree(node) {
  if (node.type === "extend") {
    node.collapsed = true;
  }
  if (node.children) {
    node.children.forEach((child) => initTree(child));
  }
  return node;
}

// 递归获得当前树中所有“可见”节点（根据 collapsed 状态判断是否展开子节点）
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
    const words = text.text().split(/\s+/).reverse();
    let word;
    let line = [];
    let lineNumber = 0;
    const lineHeight = 1.1; // 行高，单位为 em
    const y = text.attr("y");
    const dy = parseFloat(text.attr("dy") || 0);
    let tspan = text
      .text(null)
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
 * MultiBarcodeTree 组件将多个数据组分别显示 indicatorsData 与 evaluationData，
 * 采用横向排列：
 * - 对于每个部分，**行**代表不同数据组，**列**代表该部分出现过的树名称，
 *   这样相同树名称在不同数据组中能够**垂直对齐**；
 * - 指标部分和评价部分分别绘制，且各自的单元格尺寸根据可用区域和行列数动态计算。
 */
const MultiBarcodeTree = ({ width, height, margin, gap }) => {
  const svgRef = useRef(null);
  // 将指标数据分为3个策略
  const [indicatorsGroups, setIndicatorsGroups] = useState([]);
  // 评价数据直接使用
  const [evaluationGroups, setEvaluationGroups] = useState([]);

  // 初始化 groups（深拷贝并调用 initTree 进行初始化）
  useEffect(() => {
    const indicators = [indicatorsData1, indicatorsData2, indicatorsData3];
    const evaluation = [evaluationData];
    const newIndicatorsGroups = indicators.map((treeArray) =>
      treeArray.map((tree) => initTree(JSON.parse(JSON.stringify(tree))))
    );
    setIndicatorsGroups(newIndicatorsGroups);
    const newEvaluationGroups = evaluation.map((treeArray) =>
      treeArray.map((tree) => initTree(JSON.parse(JSON.stringify(tree))))
    );
    setEvaluationGroups(newEvaluationGroups);
  }, []);

  useEffect(() => {
    if (!indicatorsGroups.length || !evaluationGroups.length) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    // 整体可用区域
    const rightMargin = 50;
    const availableWidth = width - margin - rightMargin;
    const availableHeight = height - margin * 2;
    // 分成两个部分（指标和评价），中间留 sectionGap
    const R1 = indicatorsGroups.length;
    const R2 = evaluationGroups.length;
    const totalRows = R1 + R2;
    const sectionGap = 20;
    const cellHeight = (availableHeight - sectionGap) / totalRows;
    const indicatorsSectionHeight = R1 * cellHeight;
    const evaluationSectionHeight = R2 * cellHeight;

    // 保存盒子位置信息
    const indicatorPositions = {}; // 键格式："row_treeName"，保存左右边缘中心位置
    const evaluationPositions = {}; // 键：treeName，保存左右边缘中心位置

    // 对于指标部分：行 = 数据组数，列 = union(指标树名称)
    let indicatorNames = [];
    indicatorsGroups.forEach((group) => {
      group.forEach((tree) => {
        if (!indicatorNames.includes(tree.name)) {
          indicatorNames.push(tree.name);
        }
      });
    });

    const numIndicatorCols = indicatorNames.length;
    const colGap = 20;
    const cellWidthIndicators =
      (availableWidth - (numIndicatorCols - 1) * colGap) / numIndicatorCols;

    // 对于评价部分：行 = 数据组数，列 = union(评价树名称)
    let evaluationNames = [];
    evaluationGroups.forEach((group) => {
      group.forEach((tree) => {
        if (!evaluationNames.includes(tree.name)) {
          evaluationNames.push(tree.name);
        }
      });
    });

    const numEvaluationCols = evaluationNames.length;
    const cellWidthEvaluation =
      (availableWidth - (numEvaluationCols - 1) * colGap) / numEvaluationCols;

    // 预先定义颜色比例尺（复用同一实例）
    const barColor = d3.scaleOrdinal(d3.schemeCategory10);
    const tsColor = d3.scaleOrdinal(d3.schemeCategory10);

    // ======= 绘制指标（indicatorsData）部分 =======
    // 每一行对应一个数据组（rowIndex），每一列对应一个指标名称（colIndex）
    indicatorsGroups.forEach((group, rowIndex) => {
      indicatorNames.forEach((indicatorName, colIndex) => {
        const x0 = margin + colIndex * (cellWidthIndicators + colGap);
        const y0 = margin + rowIndex * cellHeight;
        const cellGroup = svg
          .append("g")
          .attr("transform", `translate(${x0}, ${y0})`);
        // 查找当前组中是否存在该指标树
        const tree = group.find((t) => t.name === indicatorName);
        if (tree) {
          const visibleNodes = getVisibleNodes(tree);
          const totalWeight = d3.sum(visibleNodes, (d) => d.weight);
          const n = visibleNodes.length;
          const xScale = d3
            .scaleLinear()
            .domain([0, totalWeight])
            .range([0, cellWidthIndicators - (n - 1) * gap]);
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
              // 内部绘制柱状图，不设背景色
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
              .attr("height", cellHeight)
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
                      setIndicatorsGroups([...indicatorsGroups]);
                      return;
                    }
                  }
                  node.collapsed = !node.collapsed;
                  setIndicatorsGroups([...indicatorsGroups]);
                }
              });

            if (node.type === "extend") {
              const textElem = gNode
                .append("text")
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
                  gNode
                    .append("rect")
                    .attr("x", x + idx * barWidth)
                    .attr("y", cellHeight - barH)
                    .attr("width", barWidth - 1)
                    .attr("height", barH)
                    .attr("fill", barColor(k));
                });
              }
            } else {
              const textElem = gNode
                .append("text")
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
        // 保存指标盒子位置：保存左边缘和右边缘中心
        indicatorPositions[`${rowIndex}_${indicatorName}`] = {
          left: { x: x0, y: y0 + cellHeight / 2 },
          right: { x: x0 + cellWidthIndicators, y: y0 + cellHeight / 2 },
        };
      });
    });

    // ======= 绘制评价（evaluationData）部分 =======
    // 每一行代表一个数据组，列代表评价树的名称
    evaluationGroups.forEach((group, rowIndex) => {
      evaluationNames.forEach((evalName, colIndex) => {
        const x0 = margin + colIndex * (cellWidthEvaluation + colGap);
        const y0 =
          margin + indicatorsSectionHeight + sectionGap + rowIndex * cellHeight;
        const cellGroup = svg
          .append("g")
          .attr("transform", `translate(${x0}, ${y0})`);
        const tree = group.find((t) => t.name === evalName);
        if (tree) {
          const visibleNodes = getVisibleNodes(tree);
          const totalWeight = d3.sum(visibleNodes, (d) => d.weight);
          const n = visibleNodes.length;
          const xScale = d3
            .scaleLinear()
            .domain([0, totalWeight])
            .range([0, cellWidthEvaluation - (n - 1) * gap]);
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
              // 内部绘制柱状图
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
              .attr("height", cellHeight)
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
                      setEvaluationGroups([...evaluationGroups]);
                      return;
                    }
                  }
                  node.collapsed = !node.collapsed;
                  setEvaluationGroups([...evaluationGroups]);
                }
              });

            if (node.type === "extend") {
              gNode
                .append("text")
                .attr("x", x + rectWidth / 2)
                .attr("y", cellHeight / 2)
                .attr("dy", ".35em")
                .attr("text-anchor", "middle")
                .text(node.name)
                .style("pointer-events", "none");
            } else if (node.type === "function") {
              if (node.value) {
                const keys = Object.keys(node.value);
                const barWidth = rectWidth / keys.length;
                keys.forEach((k, idx) => {
                  const barH = cellHeight * node.value[k];
                  gNode
                    .append("rect")
                    .attr("x", x + idx * barWidth)
                    .attr("y", cellHeight - barH)
                    .attr("width", barWidth - 1)
                    .attr("height", barH)
                    .attr("fill", barColor(k));
                });
              }
            } else {
              const textElem = gNode
                .append("text")
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
        evaluationPositions[evalName] = {
          left: { x: x0, y: y0 + cellHeight / 2 },
          right: { x: x0 + cellWidthEvaluation, y: y0 + cellHeight / 2 },
        };
      });
    });
    // ----- 绘制连线 -----
    // 根据 indicatorsLinks 绘制指标部分的直线连线
    indicatorsLinks.forEach((link) => {
      const row = link.row;
      const sourceKey = `${row}_${link.source}`;
      const targetKey = `${row}_${link.target}`;
      const sourcePos = indicatorPositions[sourceKey];
      const targetPos = indicatorPositions[targetKey];
      if (sourcePos && targetPos) {
        for (let i = 0; i < link.count; i++) {
          const offset = (i - (link.count - 1) / 2) * 5;
          svg
            .append("line")
            .attr("x1", sourcePos.right.x)
            .attr("y1", sourcePos.right.y + offset)
            .attr("x2", targetPos.left.x)
            .attr("y2", targetPos.left.y + offset)
            .attr("stroke", "black")
            .attr("stroke-width", 1);
        }
      }
    });

    // 根据 evaluationLinks 绘制评价部分直线
    evaluationLinks.forEach((link) => {
      const sourcePos = evaluationPositions[link.source];
      const targetPos = evaluationPositions[link.target];
      if (sourcePos && targetPos) {
        for (let i = 0; i < link.count; i++) {
          const offset = (i - (link.count - 1) / 2) * 5;
          svg
            .append("line")
            .attr("x1", sourcePos.right.x)
            .attr("y1", sourcePos.right.y + offset)
            .attr("x2", targetPos.left.x)
            .attr("y2", targetPos.left.y + offset)
            .attr("stroke", "black")
            .attr("stroke-width", 1);
        }
      }
    });

    sideLinks.forEach((link) => {
      const row = link.row;
      const sourceKey = `${row}_${link.source}`;
      const sourcePos = indicatorPositions[sourceKey];    // 指标区位置
      const targetPos = evaluationPositions[link.target]; // 评价区位置
    
      if (sourcePos && targetPos) {
        // 先找出源与目标的右 x 坐标，再加一个额外距离
        const pathRight = Math.max(sourcePos.right.x, targetPos.right.x) + 10;
    
        // 路径分段：
        // 1. 从 source 的右侧 (sx, sy) 出发
        // 2. 水平到 pathRight
        // 3. 垂直到 target 的 y
        // 4. 水平回到 target 的右侧
        const pathData = [
          `M ${sourcePos.right.x} ${sourcePos.right.y}`, // 起点
          `H ${pathRight}`,                               // 先向右
          `V ${targetPos.right.y}`,                       // 再垂直
          `H ${targetPos.right.x}`                        // 回到目标 right.x
        ].join(" ");
    
        svg
          .append("path")
          .attr("d", pathData)
          .attr("fill", "none")
          .attr("stroke", "black")
          .attr("stroke-width", 1);
      }
    });
    
  }, [indicatorsGroups, evaluationGroups, width, height, margin, gap]);

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
