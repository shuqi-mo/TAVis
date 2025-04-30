import { useEffect, useRef } from "react";
import * as d3 from "d3";

function Candle({
  data,
  trade,
  tradeSummarization,
  indicatorsTrade,
  startDate,
  endDate,
  width,
  height,
  examplerData,
  colorAssignments,
}) {
  // 原主图边距
  const margin = { top: 20, right: 10, bottom: 0, left: 25 };
  // 副图（Exampler）边距
  const subMargin = { top: 20, right: 10, bottom: 20, left: 25 };
  // --- 新布局参数 --- //
  // 固定主图区域高度
  const mainChartHeight = 350;
  // 固定刷选区域（上下文区域）高度
  const brushChartHeight = 40;
  // 主图与刷选区域之间的间隔
  const gapBetweenMainAndBrush = 30;
  // 刷选区域与副图区域之间的间隔
  const gapBetweenBrushAndExampler = 30;
  // 副图区域起始 y 坐标
  const examplerRegionY =
    margin.top +
    mainChartHeight +
    gapBetweenMainAndBrush +
    brushChartHeight +
    gapBetweenBrushAndExampler;
  // 副图区域可用总高度
  const examplerTotalHeight = height - examplerRegionY - margin.bottom;

  const d3Node = useRef(null);
  const getSvg = () => d3.select(d3Node.current);
  const checkElementExist = (element) => {
    if (element) element.remove();
  };

  // 构造用于绘图的数据，同时记录每个数据项的原始索引
  const n = data.data.length;
  const stackData = [];
  for (let i = 0; i < n; i++) {
    stackData.push({
      index: i,
      open: data.data[i][1],
      close: data.data[i][2],
      max: data.data[i][3],
      min: data.data[i][4],
      trade: trade[i],
    });
  }

  // 定义交易标记相关常量（可调整以获得更美观的效果）
  const markerOffset = 5; // K 线极值与标记之间的间距
  const rectHeight = 10; // 标记矩形高度
  const triangleHeight = 5; // 标记三角形高度（用于主图的买入/卖出标记）
  const horizontalPadding = 2; // 水平方向的额外补白

  useEffect(() => {
    if (!colorAssignments) return;
    checkElementExist(getSvg().selectAll("svg"));

    let selectedIndicator = null; // 当前选中的副图指标索引

    function highlightMainChart(selectedIndex) {
      // 更新主图交易标记：对于买入标记
      d3.selectAll(".buy-marker-rect").each(function (d) {
        // 如果对应指标交易信号为 1，则恢复橙色，否则改为灰色
        if (indicatorsTrade[selectedIndex][d.index] === 1) {
          d3.select(this).attr("fill", getArrowColor(d.index));
        } else {
          d3.select(this).attr("fill", "white");
        }
      });
      d3.selectAll(".buy-marker-triangle").each(function (d) {
        if (indicatorsTrade[selectedIndex][d.index] === 1) {
          d3.select(this).attr("fill", getArrowColor(d.index));
        } else {
          d3.select(this).attr("fill", "white");
        }
      });
      // 对于卖出标记
      d3.selectAll(".sell-marker-rect").each(function (d) {
        if (indicatorsTrade[selectedIndex][d.index] === -1) {
          d3.select(this).attr("fill", getArrowColor(d.index));
        } else {
          d3.select(this).attr("fill", "white");
        }
      });
      d3.selectAll(".sell-marker-triangle").each(function (d) {
        if (indicatorsTrade[selectedIndex][d.index] === -1) {
          d3.select(this).attr("fill", getArrowColor(d.index));
        } else {
          d3.select(this).attr("fill", "white");
        }
      });
    }

    function resetMainChartMarkers() {
      // 恢复主图所有交易标记的原始颜色（根据tradeSummarization）
      d3.selectAll(".buy-marker-rect").each(function (d) {
        d3.select(this).attr("fill", getArrowColor(d.index));
      });
      d3.selectAll(".buy-marker-triangle").each(function (d) {
        d3.select(this).attr("fill", getArrowColor(d.index));
      });
      d3.selectAll(".sell-marker-rect").each(function (d) {
        d3.select(this).attr("fill", getArrowColor(d.index));
      });
      d3.selectAll(".sell-marker-triangle").each(function (d) {
        d3.select(this).attr("fill", getArrowColor(d.index));
      });
    }

    let svg = getSvg()
      .append("svg")
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", [0, 0, width, height]);

    // 绘制图表标题（k 线图标题），居中显示
    svg
      .append("text")
      .text(data.name)
      .attr("x", margin.left)
      .attr("y", margin.top / 2)
      .attr("text-anchor", "start")
      .attr("dominant-baseline", "hanging")
      .style("font-size", "12px");

    // 从数据中提取日期、最高价和最低价
    const dates = d3.map(data.data, (d) => d[0]);
    const highPrices = d3.map(data.data, (d) => d[3]);
    const lowPrices = d3.map(data.data, (d) => d[4]);
    const pricePending = Math.round(d3.max(highPrices) / 20);

    // 根据传入的 startDate 与 endDate 在日期数组中查找索引
    const bisectDate = d3.bisector((d) => d).left;
    const startIndex = bisectDate(dates, startDate);
    const endIndex = bisectDate(dates, endDate);

    // 定义横向比例尺：主图使用 xScale，刷选区域使用 xScale2（区间相同）
    const xScale = d3
      .scaleLinear()
      .domain([0, data.data.length])
      .range([0, width - margin.left - margin.right]);
    const xScale2 = d3
      .scaleLinear()
      .domain([0, data.data.length])
      .range([0, width - margin.left - margin.right]);

    // 定义日期格式化函数
    const formatYear = d3.timeFormat("%Y");
    const formatMonth = d3.timeFormat("%-m");

    // 判断数据是否跨年份（取整个数据集的首尾日期）
    const firstDate = new Date(dates[0]);
    const lastDate = new Date(dates[dates.length - 1]);
    const isMultiYear = firstDate.getFullYear() !== lastDate.getFullYear();

    // 定义更新 x 轴的函数，确保左侧（原点）刻度显示年份
    function updateXAxis() {
      // 先获取 xScale.ticks(10) 生成的刻度数组（数值数组）
      const ticks = xScale.ticks(10);
      const leftValue = xScale.domain()[0];
      // 如果第一个 tick 与当前左边界不一致，则将左边界插入到 ticks 数组的首位
      if (Math.abs(ticks[0] - leftValue) > 1e-6) {
        ticks.unshift(leftValue);
      }
      if (isMultiYear) {
        xAxis.tickValues(ticks).tickFormat((v, i) => {
          const idx = Math.round(v);
          const d = new Date(dates[idx]);
          // 第一个 tick 始终显示年份（以1月1日为基础）
          if (i === 0) {
            return formatYear(new Date(d.getFullYear(), 0, 1));
          }
          // 对于后续 tick，如果当前 tick 的年份与前一个 tick 的年份不同，则认为是新一年的开始，强制显示1月对应的年份
          const prevIdx = Math.round(ticks[i - 1]);
          const prevD = new Date(dates[prevIdx]);
          if (d.getFullYear() > prevD.getFullYear()) {
            return formatYear(new Date(d.getFullYear(), 0, 1));
          } else {
            return formatMonth(d);
          }
        });
      } else {
        // 单年份时：保留原有逻辑
        let ticks2 = xScale.ticks(10);
        if (Math.abs(ticks2[0] - leftValue) > 1e-6) {
          ticks2.unshift(leftValue);
        }
        xAxis.tickValues(ticks2).tickFormat((v) => {
          const idx = Math.round(v);
          const d = new Date(dates[idx]);
          if (Math.abs(v - leftValue) < 1e-6) {
            return formatYear(d);
          }
          return d.getMonth() === 0 ? formatYear(d) : formatMonth(d);
        });
      }
      svg.select(".axis--x").call(xAxis);
    }

    function updateXAxis2() {
      // 先获取 xScale2.ticks(10) 生成的刻度数组（数值数组）
      const ticks = xScale2.ticks(10);
      const leftValue = xScale2.domain()[0];
      // 如果第一个 tick 与当前左边界不一致，则将左边界插入到 ticks 数组的首位
      if (Math.abs(ticks[0] - leftValue) > 1e-6) {
        ticks.unshift(leftValue);
      }
      if (isMultiYear) {
        xAxis2.tickValues(ticks).tickFormat((v, i) => {
          const idx = Math.round(v);
          const d = new Date(dates[idx]);
          // 第一个 tick 始终显示年份（以1月1日为基础）
          if (i === 0) {
            return formatYear(new Date(d.getFullYear(), 0, 1));
          }
          // 对于后续 tick，如果当前 tick 的年份与前一个 tick 的年份不同，则认为是新一年的开始，强制显示1月对应的年份
          const prevIdx = Math.round(ticks[i - 1]);
          const prevD = new Date(dates[prevIdx]);
          if (d.getFullYear() > prevD.getFullYear()) {
            return formatYear(new Date(d.getFullYear(), 0, 1));
          } else {
            return formatMonth(d);
          }
        });
      } else {
        // 单年份时，保留原有逻辑
        let ticks2 = xScale2.ticks(10);
        if (Math.abs(ticks2[0] - leftValue) > 1e-6) {
          ticks2.unshift(leftValue);
        }
        xAxis2.tickValues(ticks2).tickFormat((v) => {
          const idx = Math.round(v);
          const d = new Date(dates[idx]);
          if (Math.abs(v - leftValue) < 1e-6) {
            return formatYear(d);
          }
          return d.getMonth() === 0 ? formatYear(d) : formatMonth(d);
        });
      }
      context.select(".axis--x").call(xAxis2);
    }

    // Add this function after the candlestickWidth() function
    function getArrowColor(index) {
      // Default color is blue (Neural)
      let color = "blue";

      if (tradeSummarization && tradeSummarization.length > 0) {
        // Find matching trade signal in tradeSummarization
        const tradeSignal = tradeSummarization.find(
          (signal) => signal[2] === index
        );

        if (tradeSignal) {
          const classification = tradeSignal[7];
          switch (classification) {
            case "Weakly Contradictive":
              color = "lightgreen";
              break;
            case "Strongly Contradictive":
              color = "darkgreen";
              break;
            case "Weakly Supportive":
              color = "lightcoral";
              break;
            case "Strongly Supportive":
              color = "darkred";
              break;
            default:
              color = "blue"; // Neural
          }
        }
      }

      return color;
    }

    // Add this function to handle the click event on trade arrows
    function handleArrowClick(event, d) {
      event.stopPropagation();
      // Remove any existing highlight rectangle
      focus.selectAll(".trade-highlight-rect").remove();

      // Find matching trade signal in tradeSummarization
      if (!tradeSummarization) return;

      const tradeSignal = tradeSummarization.find(
        (signal) => signal[2] === d.index // 查找以当前箭头索引作为起始索引的交易信号
      );

      if (tradeSignal) {
        const startIndex = tradeSignal[2];
        const endIndex = tradeSignal[3];
        const color = getArrowColor(d.index);
        // Draw transparent rectangle from start to end time
        focus
          .append("rect")
          .attr("class", "trade-highlight-rect")
          .datum(tradeSignal)
          .attr("x", xScale(startIndex))
          .attr("y", 0)
          .attr("width", xScale(endIndex) - xScale(startIndex))
          .attr("height", mainChartHeight)
          .attr("fill", color)
          .attr("fill-opacity", 0.2);
      }
    }

    // 定义 x 轴（主图）及上下文区域 x 轴的刻度格式
    const xAxis = d3.axisBottom(xScale);
    const xAxis2 = d3.axisBottom(xScale2);

    // 定义 y 轴比例尺（主图）及上下文区域 y 轴比例尺（保持一致）
    const yScale = d3
      .scaleLinear()
      .domain([
        d3.min(lowPrices) - pricePending,
        d3.max(highPrices) + pricePending,
      ])
      .range([mainChartHeight, 0]);
    const yScale2 = d3
      .scaleLinear()
      .domain([
        d3.min(lowPrices) - pricePending,
        d3.max(highPrices) + pricePending,
      ])
      .range([brushChartHeight, 0]);
    const yAxis = d3.axisLeft(yScale).ticks(10);

    // 绘制 y 轴（显示在图的左侧）
    svg
      .append("g")
      .attr("class", "axis--y")
      .attr("transform", `translate(${margin.left}, ${margin.top})`)
      .call(yAxis);

    // 定义刷选（brush），使用 xScale2 的区间
    var brush = d3
      .brushX()
      .extent([
        [0, 0],
        [width - margin.left - margin.right, brushChartHeight],
      ])
      .on("brush end", brushed);

    // 绘制主图 x 轴
    svg
      .append("g")
      .attr("class", "axis--x")
      .attr(
        "transform",
        `translate(${margin.left}, ${margin.top + mainChartHeight})`
      )
      .call(xAxis);

    updateXAxis();

    // 定义 clipPath 用于裁剪主图区域
    svg
      .append("defs")
      .append("clipPath")
      .attr("id", "clip")
      .append("rect")
      .attr("width", width - margin.left - margin.right)
      .attr("height", mainChartHeight);

    // 创建主图区域，并应用 clipPath
    const focus = svg
      .append("g")
      .attr("transform", `translate(${margin.left}, ${margin.top})`)
      .attr("clip-path", "url(#clip)");

    const candlestick = focus.append("g");

    // 辅助函数：计算当前每根 K 线的宽度
    function candlestickWidth() {
      return ((width - margin.left - margin.right) / data.data.length) * 0.7;
    }

    // 绘制 K 线细线
    candlestick
      .selectAll(".candle-line")
      .data(stackData)
      .enter()
      .append("line")
      .attr("class", "candle-line")
      .attr("x1", (d) => xScale(d.index) + candlestickWidth() / 2)
      .attr("y1", (d) => yScale(d.max))
      .attr("x2", (d) => xScale(d.index) + candlestickWidth() / 2)
      .attr("y2", (d) => yScale(d.min))
      .attr("stroke", (d) => (d.open > d.close ? "green" : "red"))
      .attr("stroke-width", 1);

    // 绘制 K 线实体矩形
    candlestick
      .selectAll(".candle-bar")
      .data(stackData)
      .enter()
      .append("rect")
      .attr("class", "candle-bar")
      .attr("width", (d) => candlestickWidth())
      .attr("height", (d) => Math.abs(yScale(d.open) - yScale(d.close)))
      .attr("x", (d) => xScale(d.index))
      .attr("y", (d) => yScale(Math.max(d.open, d.close)))
      .attr("rx", 1)
      .attr("stroke", (d) => (d.open > d.close ? "green" : "red"))
      .attr("stroke-width", 0.3)
      .attr("fill", (d) => (d.open > d.close ? "green" : "red"));

    // —— 绘制主图中的交易信号标记 —— //

    const sellMarkers = candlestick
      .append("g")
      .attr("class", "sell-markers-group")
      .style("pointer-events", "all");
    // 卖出标记：矩形（位于 K 线最高价上方）
    sellMarkers
      .selectAll(".sell-marker-rect")
      .data(stackData.filter((d) => d.trade === -1))
      .enter()
      .append("rect")
      .attr("class", "sell-marker-rect")
      .attr("width", (d) => candlestickWidth())
      .attr("height", rectHeight)
      .attr("x", (d) => xScale(d.index))
      .attr("y", (d) => yScale(d.max) - markerOffset - rectHeight)
      .attr("fill", (d) => getArrowColor(d.index))
      .style("cursor", "pointer")
      .on("click", handleArrowClick);

    // 卖出标记：三角形（尖角朝下）
    sellMarkers
      .selectAll(".sell-marker-triangle")
      .data(stackData.filter((d) => d.trade === -1))
      .enter()
      .append("polygon")
      .attr("class", "sell-marker-triangle")
      .attr("points", (d) => {
        const x1 = xScale(d.index) - horizontalPadding;
        const x2 = xScale(d.index) + candlestickWidth() + horizontalPadding;
        const baseY = yScale(d.max) - markerOffset;
        const tipY = baseY + triangleHeight;
        const tipX = (x1 + x2) / 2;
        return `${x1},${baseY} ${x2},${baseY} ${tipX},${tipY}`;
      })
      .attr("fill", (d) => getArrowColor(d.index))
      .style("cursor", "pointer")
      .on("click", handleArrowClick);

    // 买入标记：矩形（位于 K 线最低价下方）
    // 买入标记：矩形和三角形应该放在最上层
    const buyMarkers = candlestick
      .append("g")
      .attr("class", "buy-markers-group")
      .style("pointer-events", "all"); // 确保该组能接收鼠标事件

    buyMarkers
      .selectAll(".buy-marker-rect")
      .data(stackData.filter((d) => d.trade === 1))
      .enter()
      .append("rect")
      .attr("class", "buy-marker-rect")
      .attr("width", (d) => candlestickWidth())
      .attr("height", rectHeight)
      .attr("x", (d) => xScale(d.index))
      .attr("y", (d) => yScale(d.min) + markerOffset)
      .attr("fill", (d) => getArrowColor(d.index))
      .style("cursor", "pointer")
      .on("click", handleArrowClick);

    // 买入标记：三角形（尖角朝上）
    buyMarkers
      .selectAll(".buy-marker-triangle")
      .data(stackData.filter((d) => d.trade === 1))
      .enter()
      .append("polygon")
      .attr("class", "buy-marker-triangle")
      .attr("points", (d) => {
        const x1 = xScale(d.index) - horizontalPadding;
        const x2 = xScale(d.index) + candlestickWidth() + horizontalPadding;
        const baseY = yScale(d.min) + markerOffset;
        const tipY = baseY - triangleHeight;
        const tipX = (x1 + x2) / 2;
        return `${x1},${baseY} ${x2},${baseY} ${tipX},${tipY}`;
      })
      .attr("fill", (d) => getArrowColor(d.index))
      .style("cursor", "pointer")
      .on("click", handleArrowClick);

    // —— 绘制上下文（刷选）区域 —— //

    const context = svg
      .append("g")
      .attr("class", "context")
      .attr(
        "transform",
        `translate(${margin.left}, ${
          margin.top + mainChartHeight + gapBetweenMainAndBrush
        })`
      );

    context
      .append("g")
      .attr("class", "axis axis--x")
      .attr("transform", `translate(0, ${brushChartHeight})`)
      .call(xAxis2);

    updateXAxis2();

    // 绘制刷选区域
    if (indicatorsTrade && indicatorsTrade.length) {
      const nIndicators = indicatorsTrade.length;
      const bandH = brushChartHeight / nIndicators; // 每条带的高度
      
      function buildSpans(tradeArr) {
        const spans = [];
        let cur = null;  // 当前持仓
        let prevTrade = null;  // 上一个平仓信号，用于处理反向信号的平仓
        
        tradeArr.forEach((v, idx) => {
          if (v === 1 || v === -1) {  // 处理开仓信号
            if (!cur) {  // 如果当前没有持仓，建立新仓位
              cur = { type: v, start: idx };
            } else if (v === -cur.type) {  // 反向信号，平仓当前持仓
              const priceStart = data.data[cur.start][2];  // 用收盘价判断盈亏
              const priceEnd = data.data[idx][2];
              const success = cur.type === 1
                ? priceEnd > priceStart  // long → short 成功
                : priceEnd < priceStart;  // short → long 成功
              spans.push({ start: cur.start, end: idx, success });
              cur = null;  // 平仓后，清空当前持仓
            }
            // 无论是否平仓，都重新开仓
            cur = { type: v, start: idx };  // 开新的仓位
          }
        });
        // 最后一个交易信号处理：若仍然有未平仓的持仓，忽略
        if (cur) {
          const priceStart = data.data[cur.start][2];
          const priceEnd = data.data[tradeArr.length - 1][2];
          const success = cur.type === 1
            ? priceEnd > priceStart  // long → short 成功
            : priceEnd < priceStart;  // short → long 成功
          spans.push({ start: cur.start, end: tradeArr.length - 1, success });
        }
        
        return spans;
      }      

      const stripG = context.append("g").attr("class", "trade-strips");

      indicatorsTrade.forEach((tArr, i) => {
        const spans = buildSpans(tArr);
        console.log(spans);
        const y0 = i * bandH;
        stripG
          .selectAll(".span-" + i)
          .data(spans)
          .enter()
          .append("rect")
          .attr("class", "span-" + i)
          .attr("x", (d) => xScale2(d.start))
          .attr("y", y0)
          .attr("width", (d) => xScale2(d.end) - xScale2(d.start))
          .attr("height", bandH - 1) // -1 px 看得见分隔线
          .attr("fill", (d) => (d.success ? "#ff4d4f" : "#52c41a"))
          .attr("fill-opacity", 0.55);
      });
    }

    // 在上下文区域外绘制刷选框底部的三角形
    const textOffset = 10;
    svg
      .selectAll(".deal-triangle-bottom")
      .data(stackData.filter((d) => d.trade !== 0))
      .enter()
      .append("polygon")
      .attr("class", "deal-triangle-bottom")
      .attr("points", (d) => {
        const x1 = margin.left + xScale2(d.index) - 2;
        const x2 = margin.left + xScale2(d.index) + candlestickWidth() + 2;
        const tipY =
          margin.top +
          mainChartHeight +
          gapBetweenMainAndBrush +
          brushChartHeight +
          textOffset;
        const baseY = tipY + triangleHeight;
        const tipX = (x1 + x2) / 2;
        return `${x1},${baseY} ${x2},${baseY} ${tipX},${tipY}`;
      })
      .attr("fill", (d) =>
        d.trade === 1 ? "red" : d.trade === -1 ? "green" : "white"
      );

    // 在上下文区域添加刷选（brush），初始范围使用 xScale2
    context
      .append("g")
      .attr("class", "brush")
      .call(brush)
      .call(brush.move, [xScale2(startIndex), xScale2(endIndex)]);

    // —— 在主图（k 线图）添加交互 —— //

    // 添加用于捕获鼠标事件的 overlay（绑定鼠标移动和滚轮事件，注意：滚轮事件不再绑定在刷选区域）
    const overlay = focus
      .append("rect")
      .attr("class", "overlay")
      .attr("width", width - margin.left - margin.right)
      .attr("height", mainChartHeight)
      .style("fill", "none")
      .style("pointer-events", "all")
      .on("mouseover", () => {
        crosshair.style("display", null);
        tooltipTop.style("display", null);
        tooltipBottomGroup.style("display", null);
      })
      .on("mouseout", () => {
        crosshair.style("display", "none");
        tooltipTop.style("display", "none");
        tooltipBottomGroup.style("display", "none");
      })
      .on("mousemove", mousemove)
      .on("wheel", wheelHandler)
      .on("click", function () {
        focus.selectAll(".trade-highlight-rect").remove();
      });

    overlay.lower(); // 将overlay移到底层

    // 十字线组（用于显示垂直和水平线）
    const crosshair = focus
      .append("g")
      .attr("class", "crosshair")
      .style("display", "none");

    crosshair
      .append("line")
      .attr("id", "crosshairX")
      .attr("stroke", "black")
      .attr("stroke-dasharray", "3,3");

    crosshair
      .append("line")
      .attr("id", "crosshairY")
      .attr("stroke", "black")
      .attr("stroke-dasharray", "3,3");

    // tooltip-top：显示在图表顶部居中，字体与标题一致
    const tooltipTop = svg
      .append("text")
      .attr("class", "tooltip-top")
      .attr("x", width / 2)
      .attr("y", margin.top)
      .attr("text-anchor", "middle")
      .style("font-size", "12px")
      .style("display", "none");

    // tooltip-bottom：以黑框白字形式显示在 x 轴正上方，跟随十字线移动
    const tooltipBottomGroup = svg
      .append("g")
      .attr("class", "tooltip-bottom-group")
      .style("display", "none");

    const tooltipBottomRect = tooltipBottomGroup
      .append("rect")
      .attr("fill", "black")
      .attr("rx", 3)
      .attr("ry", 3);

    const tooltipBottomText = tooltipBottomGroup
      .append("text")
      .attr("fill", "white")
      .attr("text-anchor", "middle")
      .attr("alignment-baseline", "middle")
      .style("font-size", "12px");

    // ===============================
    // 绘制副图区域（exampler）—— 在刷选区域下方
    // ===============================
    // 当指标个数<=3时，每个副图高度均分 examplerTotalHeight
    const numExamplers = examplerData ? examplerData.length : 0;
    const visibleCount = numExamplers <= 3 ? numExamplers : 3;
    const eachExamplerHeightFixed = examplerTotalHeight / visibleCount;

    // 这里将原先的 totalExamplerContentHeight 改为加上副图间距
    const totalExamplerContentHeight = eachExamplerHeightFixed * numExamplers;

    // 定义 clipPath 用于副图容器
    svg
      .append("defs")
      .append("clipPath")
      .attr("id", "clip-exampler-container")
      .append("rect")
      .attr("x", -margin.left)
      .attr("y", 0)
      .attr("width", width - margin.right)
      .attr("height", eachExamplerHeightFixed * visibleCount);

    // 创建副图容器组，应用 clipPath
    const examplerContainer = svg
      .append("g")
      .attr("class", "exampler-container")
      .attr("clip-path", "url(#clip-exampler-container)")
      .attr("transform", `translate(${margin.left}, ${examplerRegionY})`);

    // 在容器内再创建一个内容组，用于承载所有副图
    const examplerContentGroup = examplerContainer
      .append("g")
      .attr("class", "exampler-content-group")
      .attr("transform", `translate(0,0)`);

    // 创建滚动条组（与内容组同级，不受 clipPath 裁剪），放在容器内右侧
    const containerWidth = width - margin.left - margin.right;
    const visibleHeight = eachExamplerHeightFixed * visibleCount;
    const scrollbarWidth = 10;
    // 如果总内容高度大于可见高度，则显示滚动条
    if (totalExamplerContentHeight > visibleHeight) {
      const thumbHeight =
        visibleHeight * (visibleHeight / totalExamplerContentHeight);
      const scrollbarGroup = examplerContainer
        .append("g")
        .attr("class", "scrollbar")
        .attr("transform", `translate(${containerWidth - scrollbarWidth}, 0)`);
      // 滚动条轨道
      scrollbarGroup
        .append("rect")
        .attr("class", "scrollbar-track")
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", scrollbarWidth)
        .attr("height", visibleHeight)
        .attr("fill", "#eee");
      // 滚动条滑块
      const thumb = scrollbarGroup
        .append("rect")
        .attr("class", "scrollbar-thumb")
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", scrollbarWidth)
        .attr("height", thumbHeight)
        .attr("fill", "#999")
        .call(
          d3.drag().on("drag", function (event) {
            let newY = +d3.select(this).attr("y") + event.dy;
            // 限制 newY 在 [0, visibleHeight - thumbHeight]
            newY = Math.max(0, Math.min(visibleHeight - thumbHeight, newY));
            d3.select(this).attr("y", newY);
            // 根据滚动条位置计算内容组偏移量：
            // 最大平移量 = totalExamplerContentHeight - visibleHeight
            const maxScroll = totalExamplerContentHeight - visibleHeight;
            // 当前偏移量 = - newY / (visibleHeight - thumbHeight) * maxScroll
            const scrollY = -(newY / (visibleHeight - thumbHeight)) * maxScroll;
            examplerContentGroup.attr("transform", `translate(0, ${scrollY})`);
          })
        );
    }

    if (examplerData && numExamplers > 0) {
      examplerData.forEach((indicator, i) => {
        // indicator 格式：[指标名称, 折线数据数组, 折线名称数组]
        const title = indicator[0];
        const linesData = indicator[1]; // 数组：每个元素是一条折线的数据（长度与主图相同）
        const lineNames = indicator[2]; // 数组：每条折线的名称
        // 针对当前指标的每条折线，取刷选区间 [startIndex, endIndex]
        const slicedLinesData = linesData.map((line) =>
          line.slice(startIndex, endIndex + 1)
        );
        const allValues = slicedLinesData.flat();
        const yMin = d3.min(allValues);
        const yMax = d3.max(allValues);
        const yScaleSub = d3
          .scaleLinear()
          .domain([yMin, yMax])
          .nice()
          .range([eachExamplerHeightFixed - subMargin.bottom, subMargin.top]);
        // 创建一个副图组，位置在 examplerRegionY + i * eachExamplerHeight
        const subChart = examplerContentGroup
          .append("g")
          .attr("class", "exampler-chart")
          .attr("transform", `translate(0, ${i * eachExamplerHeightFixed})`);

        // 添加一个透明覆盖矩形，捕获点击事件
        subChart
          .append("rect")
          .attr("class", "subchart-overlay")
          .attr("x", 0)
          .attr("y", 0)
          .attr("width", width - margin.left - margin.right)
          .attr("height", eachExamplerHeightFixed)
          .style("fill", "transparent")
          .style("pointer-events", "all")
          .on("click", function (event) {
            event.stopPropagation(); // 阻止事件冒泡到全局
            selectedIndicator = i; // 设置当前选中的副图指标索引
            examplerContentGroup.selectAll(".selected-border").remove(); // 移除所有副图中的已选边框
            // 在当前副图中添加边框
            d3.select(this.parentNode)
              .append("rect")
              .attr("class", "selected-border")
              .attr("x", -margin.left)
              .attr("y", 0)
              .attr("width", width - margin.right)
              .attr("height", eachExamplerHeightFixed)
              .attr("fill", "none")
              .attr("stroke", "#8c8c8c")
              .attr("stroke-width", 3)
              .style("pointer-events", "none");
            highlightMainChart(i); // 调用更新主图交易标记的函数
          });

        // 将当前副图的 yScale 挂载到 DOM 元素上
        subChart.node().yScale = yScaleSub;

        // 根据指标标题从 colorAssignments 找到对应颜色（若未找到，则默认黑色）
        let titleColor = "black";
        if (colorAssignments && Array.isArray(colorAssignments)) {
          const match = colorAssignments.find((item) => item[0] === title);
          if (match) {
            titleColor = match[1];
          }
        }

        // 绘制副图标题（指标名称）
        subChart
          .append("text")
          .text(title)
          .attr("x", subMargin.left)
          .attr("y", subMargin.top / 2)
          .style("font-size", "12px")
          .attr("dominant-baseline", "middle")
          .style("font-weight", "bold")
          .style("fill", titleColor);

        // 绘制副图 x 轴（与主图保持一致）
        subChart
          .append("g")
          .attr("class", "axis axis--x")
          .attr(
            "transform",
            `translate(0, ${eachExamplerHeightFixed - subMargin.bottom})`
          )
          .call(xAxis);

        // 绘制副图 y 轴
        const yAxisSub = d3.axisLeft(yScaleSub).ticks(3);
        subChart
          .append("g")
          .attr("class", "axis axis--y")
          .attr("transform", `translate(0,0)`)
          .call(yAxisSub);

        // 创建一个内容组，用于绘制折线，并应用 clipPath，只裁剪折线部分
        const clipId = "clip-exampler-" + i;
        // 在副图组中添加 defs 定义 clipPath
        subChart
          .append("defs")
          .append("clipPath")
          .attr("id", clipId)
          .append("rect")
          .attr("x", 0)
          .attr("y", subMargin.top)
          .attr("width", width - margin.left - margin.right)
          .attr(
            "height",
            eachExamplerHeightFixed - subMargin.top - subMargin.bottom
          );
        // 创建内容组，并应用 clipPath
        const contentGroup = subChart
          .append("g")
          .attr("class", "exampler-content")
          .attr("clip-path", `url(#${clipId})`);

        // 定义折线生成器，使用共享的 xScale 和当前副图的 yScaleSub
        const lineGeneratorSub = d3
          .line()
          .x((d, i) => xScale(i))
          .y((d) => yScaleSub(d));

        // 绘制该指标下的每条折线，并统一加上 class "exampler-line" 便于后续更新
        linesData.forEach((lineData, j) => {
          // 默认使用 d3.schemeCategory10
          let strokeColor = d3.schemeCategory10[j % 10];
          // 如果 colorAssignments 存在，则查找与当前折线名称匹配的颜色
          if (colorAssignments && Array.isArray(colorAssignments)) {
            const match = colorAssignments.find(
              (item) => item[0] === lineNames[j]
            );
            if (match) {
              strokeColor = match[1];
            }
          }
          contentGroup
            .append("path")
            .datum(lineData)
            .attr("class", "exampler-line")
            .attr("fill", "none")
            .attr("stroke", strokeColor)
            .attr("stroke-width", 1.5)
            .attr("d", lineGeneratorSub);
        });

        if (indicatorsTrade && indicatorsTrade[i]) {
          const tradeArray = indicatorsTrade[i]; // 该指标的交易信号数组
          // 计算矩形宽度，这里采用与主图相似的计算方法
          const rectWidth =
            ((width - margin.left - margin.right) / data.data.length) * 0.7;
          // 为每个交易信号数据（含索引）添加矩形
          contentGroup
            .selectAll(".indicator-trade-rect")
            .data(tradeArray.map((val, idx) => ({ val, idx })))
            .enter()
            .filter((d) => d.val !== 0) // 只对非0信号绘制矩形
            .append("rect")
            .attr("class", "indicator-trade-rect")
            .attr("x", (d) => xScale(d.idx))
            .attr("y", subMargin.top) // 从绘图区上边界开始
            .attr("width", rectWidth)
            .attr(
              "height",
              eachExamplerHeightFixed - subMargin.top - subMargin.bottom
            )
            .attr("fill", (d) => (d.val === 1 ? "red" : "green"));
        }

        // 绘制图例
        const subWidth = width - margin.left - margin.right;
        const legendItemWidth = 80;
        const legendPaddingRight = 10;
        const totalLegendWidth = lineNames.length * legendItemWidth;
        const legendXStart = subWidth - totalLegendWidth - legendPaddingRight;
        const legendY = subMargin.top / 2; // 图例 y 坐标，位于副图上边距的一半位置
        lineNames.forEach((name, j) => {
          // 根据折线名称匹配 colorAssignments 中的颜色
          let legendColor = d3.schemeCategory10[j % 10];
          if (colorAssignments && Array.isArray(colorAssignments)) {
            const match = colorAssignments.find((item) => item[0] === name);
            if (match) {
              legendColor = match[1];
            }
          }
          subChart
            .append("rect")
            .attr("x", legendXStart + j * legendItemWidth)
            .attr("y", legendY)
            .attr("width", 10)
            .attr("height", 10)
            .attr("fill", legendColor);
          subChart
            .append("text")
            .attr("x", legendXStart + j * legendItemWidth + 12)
            .attr("y", legendY + 10)
            .text(name)
            .style("font-size", "10px")
            .attr("fill", legendColor);
        });
      });
    }

    svg.on("click", function (event) {
      // 检查点击目标是否在副图中（可通过查找最近的父节点是否包含 "exampler-chart" 类）
      // 如果不在副图内，则取消高亮效果
      if (!event.target.closest(".exampler-chart")) {
        selectedIndicator = null;
        examplerContentGroup.selectAll(".selected-border").remove();
        resetMainChartMarkers();
      }
    });

    // 鼠标移动事件：更新十字线和 tooltip 位置
    function mousemove(event) {
      const [mx, my] = d3.pointer(event);
      // 根据当前 xScale 计算最近的 K 线索引
      let index = Math.round(xScale.invert(mx));
      index = Math.max(0, Math.min(index, data.data.length - 1));
      // 计算当前可见数据个数和每根 K 线宽度
      const visibleDataCount = xScale.domain()[1] - xScale.domain()[0];
      const currentCandlestickWidth =
        ((width - margin.left - margin.right) / visibleDataCount) * 0.7;
      // 垂直线定位到该 K 线中点
      const cx = xScale(index) + currentCandlestickWidth / 2;
      crosshair
        .select("#crosshairX")
        .attr("x1", cx)
        .attr("y1", 0)
        .attr("x2", cx)
        .attr("y2", mainChartHeight);
      // 水平线随鼠标纵坐标移动
      crosshair
        .select("#crosshairY")
        .attr("x1", 0)
        .attr("y1", my)
        .attr("x2", width - margin.left - margin.right)
        .attr("y2", my);
      // 更新 tooltip-top 文本（显示该根 K 线的 OHLC 信息）
      const d = data.data[index];
      tooltipTop.text(`O: ${d[1]}  C: ${d[2]}  H: ${d[3]}  L: ${d[4]}`);
      // 更新 tooltip-bottom 文本（显示日期），并根据文本宽高更新黑底矩形
      tooltipBottomText.text(d[0]);
      const textNode = tooltipBottomText.node();
      const bbox = textNode.getBBox();
      const padding = 4;
      tooltipBottomRect
        .attr("width", bbox.width + padding * 2)
        .attr("height", bbox.height + padding * 2)
        .attr("x", -(bbox.width + padding * 2) / 2)
        .attr("y", -(bbox.height + padding * 2) / 2);
      // 将 tooltip-bottom 组定位于 x 轴正上方，并使其中心对齐十字线
      tooltipBottomGroup.attr(
        "transform",
        `translate(${cx}, ${mainChartHeight + margin.top - 10})`
      );
    }

    // 滚轮事件处理函数（在主图 overlay 上触发）
    function wheelHandler(event) {
      event.preventDefault();
      const brushSelection = d3.brushSelection(context.select(".brush").node());
      if (!brushSelection) return;
      const [x0, x1] = brushSelection;
      const currentWidth = x1 - x0;
      // deltaY < 0 放大，deltaY > 0 缩小
      const zoomFactor = event.deltaY < 0 ? 0.9 : 1.1;
      const newWidth = currentWidth * zoomFactor;
      // 以鼠标位置为中心缩放
      const mouseX = d3.pointer(event)[0];
      let newX0 = mouseX - (mouseX - x0) * zoomFactor;
      let newX1 = newX0 + newWidth;
      const minX = 0,
        maxX = width - margin.left - margin.right;
      if (newX0 < minX) {
        newX0 = minX;
        newX1 = newX0 + newWidth;
      }
      if (newX1 > maxX) {
        newX1 = maxX;
        newX0 = newX1 - newWidth;
      }
      context.select(".brush").call(brush.move, [newX0, newX1]);
    }

    // 刷选事件：拖动刷选框时更新主图
    function brushed(event) {
      const s = event.selection || xScale2.range();
      const start = Math.round(xScale2.invert(Math.round(s[0])));
      const end = Math.round(xScale2.invert(Math.round(s[1])));
      const arr = data.data.slice(start, end + 1);
      const highPricesUpdate = d3.max(arr, (v) => v[3]);
      const lowPricesUpdate = d3.min(arr, (v) => v[4]);
      const pricePendingUpdate = Math.round(highPricesUpdate / 20);
      yScale.domain([
        lowPricesUpdate - pricePendingUpdate,
        highPricesUpdate + pricePendingUpdate,
      ]);
      xScale.domain(s.map(xScale2.invert, xScale2));
      // 重新设置 x 轴的 tickFormat，以使用当前 xScale 计算的左侧 tick 值
      updateXAxis();

      // 更新主图中各元素的位置和宽度
      focus
        .selectAll(".candle-bar")
        .attr("height", (d) => Math.abs(yScale(d.open) - yScale(d.close)))
        .attr("x", (d) => xScale(d.index))
        .attr("y", (d) => yScale(Math.max(d.open, d.close)))
        .attr("width", getCandlestickWidth(end - start));
      focus
        .selectAll(".candle-line")
        .attr(
          "x1",
          (d) => xScale(d.index) + getCandlestickWidth(end - start) / 2
        )
        .attr("y1", (d) => yScale(d.max))
        .attr(
          "x2",
          (d) => xScale(d.index) + getCandlestickWidth(end - start) / 2
        )
        .attr("y2", (d) => yScale(d.min));

      focus
        .selectAll(".sell-marker-rect")
        .attr("x", (d) => xScale(d.index))
        .attr("y", (d) => yScale(d.max) - markerOffset - rectHeight)
        .attr("width", getCandlestickWidth(end - start));
      focus.selectAll(".sell-marker-triangle").attr("points", (d) => {
        const x1 = xScale(d.index) - horizontalPadding;
        const x2 =
          xScale(d.index) +
          getCandlestickWidth(end - start) +
          horizontalPadding;
        const baseY = yScale(d.max) - markerOffset;
        const tipY = baseY + triangleHeight;
        const tipX = (x1 + x2) / 2;
        return `${x1},${baseY} ${x2},${baseY} ${tipX},${tipY}`;
      });

      focus
        .selectAll(".buy-marker-rect")
        .attr("x", (d) => xScale(d.index))
        .attr("y", (d) => yScale(d.min) + markerOffset)
        .attr("width", getCandlestickWidth(end - start));
      focus.selectAll(".buy-marker-triangle").attr("points", (d) => {
        const x1 = xScale(d.index) - horizontalPadding;
        const x2 =
          xScale(d.index) +
          getCandlestickWidth(end - start) +
          horizontalPadding;
        const baseY = yScale(d.min) + markerOffset;
        const tipY = baseY - triangleHeight;
        const tipX = (x1 + x2) / 2;
        return `${x1},${baseY} ${x2},${baseY} ${tipX},${tipY}`;
      });

      // 在brushed函数末尾添加
      // 更新交易高亮矩形（如果存在）
      focus.selectAll(".trade-highlight-rect").each(function () {
        const signal = d3.select(this).datum();
        if (!signal) return;
        const signalStart = signal[2];
        const signalEnd = signal[3];

        // 如果当前信号完全不在刷选区间内，则设置宽度为 0（或可选择隐藏）
        if (signalEnd < start || signalStart > end) {
          d3.select(this).attr("width", 0);
        } else {
          // 计算信号与可见区间的交集
          const newStart = Math.max(signalStart, start);
          const newEnd = Math.min(signalEnd, end);
          d3.select(this)
            .attr("x", xScale(newStart))
            .attr("width", xScale(newEnd) - xScale(newStart));
        }
      });

      // —— 更新副图（exampler）区域 —— //
      // 副图的 x 轴与主图 xScale 保持一致
      d3.selectAll(".exampler-chart").each(function () {
        const subChart = d3.select(this);
        // 更新副图的 x 轴，使其与主图一致
        subChart.select(".axis--x").call(xAxis);
        // 通过 DOM 获取挂载的 yScale
        const yScaleSub = subChart.node().yScale;
        // 遍历当前副图内所有折线数据，计算刷选区间内的最小值和最大值
        let newMin = Infinity,
          newMax = -Infinity;
        // 这里假设每条折线数据为一个数组，且数据顺序与主图相同
        subChart
          .select(".exampler-content")
          .selectAll(".exampler-line")
          .each(function (d) {
            const sliced = d.slice(start, end + 1);
            const m = d3.min(sliced);
            const M = d3.max(sliced);
            if (m < newMin) newMin = m;
            if (M > newMax) newMax = M;
          });
        // 更新该副图的 yScale domain（可根据需要加入 padding）
        yScaleSub.domain([newMin, newMax]).nice();
        // 更新副图 y 轴
        subChart.select(".axis--y").call(d3.axisLeft(yScaleSub).ticks(4));
        // 更新折线生成器并重绘副图内所有折线
        const newLineGenerator = d3
          .line()
          .x((d, i) => xScale(i))
          .y((d) => yScaleSub(d));
        subChart
          .select(".exampler-content")
          .selectAll(".exampler-line")
          .attr("d", newLineGenerator);
      });

      // 更新副图中的交易信号矩形
      d3.selectAll(".exampler-chart").each(function () {
        const subChart = d3.select(this);
        subChart
          .select(".exampler-content")
          .selectAll(".indicator-trade-rect")
          .attr("x", (d) => xScale(d.idx))
          .attr(
            "width",
            ((width - margin.left - margin.right) / data.data.length) * 0.7
          );
      });
    }

    // 辅助函数：根据当前显示数据个数计算每根 K 线宽度
    function getCandlestickWidth(dataLength) {
      return ((width - margin.left - margin.right) / dataLength) * 0.7;
    }
  }, [data, trade, startDate, endDate, width, height, examplerData]);

  return (
    <div>
      <div ref={d3Node} />
    </div>
  );
}

export default Candle;
