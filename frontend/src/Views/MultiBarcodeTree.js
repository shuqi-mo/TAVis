import React, { useRef, useEffect, useState } from "react";
import * as d3 from "d3";

// ============ 辅助函数 ==============

function initTree(node) {
  if (node.type === "extend") {
    node.collapsed = true;
  }
  if (node.children) {
    node.children.forEach((child) => initTree(child));
  }
  return node;
}

function getVisibleNodes(node, level = 0) {
  const BASE_WEIGHT = 5;
  node.level = level;
  node.weight = Math.max(1, BASE_WEIGHT - level);
  let arr = [node];
  if (node.type === "extend" && node.collapsed) return arr;
  if (node.children && node.children.length > 0) {
    node.children.forEach((child) => {
      arr = arr.concat(getVisibleNodes(child, level + 1));
    });
  }
  return arr;
}

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

function wrapText(textSelection, width, boxHeight) {
  textSelection.each(function () {
    const text = d3.select(this);
    const textString = text.text();
    // 清空原内容
    text.text("");
    
    let lineNumber = 0;
    const lineHeight = 1.1; // 行高（单位：em），可根据实际情况调整
    const x = text.attr("x") || 0;
    const y = text.attr("y") || 0;
    const dy = parseFloat(text.attr("dy") || 0);
    
    // 新建第一个 tspan
    let tspan = text.append("tspan")
      .attr("x", x)
      .attr("y", y)
      .attr("dy", dy + "em")
      .text("");
    
    let currentLine = "";
    for (let i = 0; i < textString.length; i++) {
      currentLine += textString[i];
      tspan.text(currentLine);
      if (tspan.node().getComputedTextLength() > width) {
        // 超出宽度，去掉最后一个字符后换行
        currentLine = currentLine.slice(0, -1);
        tspan.text(currentLine);
        currentLine = textString[i];
        tspan = text.append("tspan")
          .attr("x", x)
          .attr("y", y)
          .attr("dy", ++lineNumber * lineHeight + dy + "em")
          .text(currentLine);
      }
    }
    
    // 计算整个文本的包围盒高度，并计算垂直偏移，使文本整体居中
    const bbox = text.node().getBBox();
    const offset = (boxHeight - bbox.height) / 2 - bbox.y;
    text.attr("transform", `translate(0, ${offset})`);
  });
}

// ============ MultiBarcodeTree 组件 ==============

/**
 * MultiBarcodeTree 组件采用横向排列显示，每一行代表一个数据组，
 * 每一列代表该部分出现过的树（指标或评价），同时在不同列之间增加列间距，
 * 并在图的右侧增加额外的空白区域（rightMargin）。
 */
const MultiBarcodeTree = ({
  data,
  width = 900,
  height = 400,
  margin = 20,
  gap = 4,
}) => {
  const svgRef = useRef(null);
  const [groups, setGroups] = useState(null);

  useEffect(() => {
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
    const rightMargin = 20; // 新增右侧间距50像素

    // 整体可用区域（左边 margin 和右边 rightMargin 均需保留）
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

    const barColor = d3.scaleOrdinal(d3.schemeCategory10);
    const tsColor = d3.scaleOrdinal(d3.schemeCategory10);

    // ======= 绘制指标（indicatorsData）部分 =======
    groups.forEach((group, rowIndex) => {
      indicatorNames.forEach((indicatorName, colIndex) => {
        const x0 = margin + colIndex * (cellWidthIndicators + colGap);
        const y0 = margin + rowIndex * cellHeightIndicators;
        const cellGroup = svg
          .append("g")
          .attr("transform", `translate(${x0}, ${y0})`);
        const tree = group.indicatorsData.find((t) => t.name === indicatorName);
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
            let stroke = "black",
              dash = null,
              fill = "none";
            if (node.type === "extend") {
              fill = "#ADD8E6";
            } else if (node.type === "function") {
              // 内部绘制柱状图，不设背景色
            } else if (node.type === "constant") {
              dash = "4,2";
              // const num = parseFloat(node.name);
              // const density = isNaN(num)
              //   ? 5
              //   : Math.max(2, Math.floor(10 - num / 10));
              // const patternId = `diagonalPattern-${density}`;
              // if (svg.select(`#${patternId}`).empty()) {
              //   const pattern = svg
              //     .append("defs")
              //     .append("pattern")
              //     .attr("id", patternId)
              //     .attr("patternUnits", "userSpaceOnUse")
              //     .attr("width", density)
              //     .attr("height", density)
              //     .attr("patternTransform", "rotate(45)");
              //   pattern
              //     .append("line")
              //     .attr("x1", 0)
              //     .attr("y1", 0)
              //     .attr("x2", 0)
              //     .attr("y2", density)
              //     .attr("stroke", "#ccc")
              //     .attr("stroke-width", 1);
              // }
              // fill = `url(#${patternId})`;
            } else if (node.type === "timeseries") {
              dash = "4,2";
              // fill = tsColor(node.name);
              fill = "none";
            } else if (node.type === "context") {
              dash = "4,2";
            }
            gNode
              .append("rect")
              .attr("x", x)
              .attr("y", 0)
              .attr("width", rectWidth)
              .attr("height", cellHeightIndicators)
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
              const textElem = gNode
                .append("text")
                .attr("x", x + rectWidth / 2)
                .attr("y", cellHeightIndicators / 2)
                .attr("dy", ".35em")
                .attr("text-anchor", "middle")
                .text(node.name)
                .style("pointer-events", "none");
              wrapText(textElem, rectWidth, cellHeightIndicators);
            } else if (node.type === "function") {
              // if (node.value) {
              //   const keys = Object.keys(node.value);
              //   const barWidth = rectWidth / keys.length;
              //   keys.forEach((k, idx) => {
              //     const barH = cellHeightIndicators * node.value[k];
              //     gNode
              //       .append("rect")
              //       .attr("x", x + idx * barWidth)
              //       .attr("y", cellHeightIndicators - barH)
              //       .attr("width", barWidth - 1)
              //       .attr("height", barH)
              //       .attr("fill", barColor(k));
              //   });
              // }
              const textElem = gNode
                .append("text")
                .attr("x", x + rectWidth / 2)
                .attr("y", cellHeightIndicators / 2)
                .attr("dy", ".35em")
                .attr("text-anchor", "middle")
                .text(node.name)
                .style("pointer-events", "none");
              wrapText(textElem, rectWidth, cellHeightIndicators);
            } else {
              const textElem = gNode
                .append("text")
                .attr("x", x + rectWidth / 2)
                .attr("y", cellHeightIndicators / 2)
                .attr("dy", ".35em")
                .attr("text-anchor", "middle")
                .text(node.name)
                .style("pointer-events", "none");
              wrapText(textElem, rectWidth, cellHeightIndicators);
            }
          });
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
              // const num = parseFloat(node.name);
              // const density = isNaN(num)
              //   ? 5
              //   : Math.max(2, Math.floor(10 - num / 10));
              // const patternId = `diagonalPattern-${density}`;
              // if (svg.select(`#${patternId}`).empty()) {
              //   const pattern = svg
              //     .append("defs")
              //     .append("pattern")
              //     .attr("id", patternId)
              //     .attr("patternUnits", "userSpaceOnUse")
              //     .attr("width", density)
              //     .attr("height", density)
              //     .attr("patternTransform", "rotate(45)");
              //   pattern
              //     .append("line")
              //     .attr("x1", 0)
              //     .attr("y1", 0)
              //     .attr("x2", 0)
              //     .attr("y2", density)
              //     .attr("stroke", "#ccc")
              //     .attr("stroke-width", 1);
              // }
              // fill = `url(#${patternId})`;
            } else if (node.type === "timeseries") {
              dash = "4,2";
              // fill = tsColor(node.name);
              fill = "none";
            } else if (node.type === "context") {
              dash = "4,2";
            }
            gNode
              .append("rect")
              .attr("x", x)
              .attr("y", 0)
              .attr("width", rectWidth)
              .attr("height", cellHeightEvaluation)
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
              const textElem = gNode
                .append("text")
                .attr("x", x + rectWidth / 2)
                .attr("y", cellHeightEvaluation / 2)
                .attr("dy", ".35em")
                .attr("text-anchor", "middle")
                .text(node.name)
                .style("pointer-events", "none");
              wrapText(textElem, rectWidth, cellHeightEvaluation);
            } else if (node.type === "function") {
              // if (node.value) {
              //   const keys = Object.keys(node.value);
              //   const barWidth = rectWidth / keys.length;
              //   keys.forEach((k, idx) => {
              //     const barH = cellHeightEvaluation * node.value[k];
              //     gNode
              //       .append("rect")
              //       .attr("x", x + idx * barWidth)
              //       .attr("y", cellHeightEvaluation - barH)
              //       .attr("width", barWidth - 1)
              //       .attr("height", barH)
              //       .attr("fill", barColor(k));
              //   });
              // }
              const textElem = gNode
                .append("text")
                .attr("x", x + rectWidth / 2)
                .attr("y", cellHeightIndicators / 2)
                .attr("dy", ".35em")
                .attr("text-anchor", "middle")
                .text(node.name)
                .style("pointer-events", "none");
              wrapText(textElem, rectWidth, cellHeightEvaluation);
            } else {
              const textElem = gNode
                .append("text")
                .attr("x", x + rectWidth / 2)
                .attr("y", cellHeightEvaluation / 2)
                .attr("dy", ".35em")
                .attr("text-anchor", "middle")
                .text(node.name)
                .style("pointer-events", "none");
              wrapText(textElem, rectWidth, cellHeightEvaluation);
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
