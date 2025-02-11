import { useEffect, useRef } from "react";
import * as d3 from "d3";

function Candle({ data, trade, startDate, endDate, width, height }) {
  // 主图与刷选（上下文）区域的边距设置
  const margin = { top: 20, right: 5, bottom: 120, left: 40 };
  const margin2 = { top: 260, right: 5, bottom: 50, left: 40 };
  const height2 = height - margin2.bottom - margin2.top; // 上下文区域高度

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
    checkElementExist(getSvg().selectAll("svg"));
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
        xAxis
        .tickValues(ticks)
        .tickFormat((v, i) => {
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
        xAxis2
        .tickValues(ticks)
        .tickFormat((v, i) => {
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
      .range([height - margin.bottom - margin.top, 0]);
    const yScale2 = d3
      .scaleLinear()
      .domain([
        d3.min(lowPrices) - pricePending,
        d3.max(highPrices) + pricePending,
      ])
      .range([height2, 0]);
    const yAxis = d3.axisLeft(yScale).ticks(10);

    // 绘制 y 轴（显示在图的左侧）
    svg
      .append("g")
      .attr("class", "axis--y")
      .attr("transform", `translate(${margin.left}, ${margin.top})`)
      .call(yAxis);

    // 定义上下文区域的面积图
    const area = d3
      .area()
      .curve(d3.curveMonotoneX)
      .x((d, i) => xScale2(i))
      .y0(height2)
      .y1((d, i) => yScale2(d[2]));

    // 定义刷选（brush），使用 xScale2 的区间
    var brush = d3
      .brushX()
      .extent([
        [0, 0],
        [width - margin.left - margin.right, height2],
      ])
      .on("brush end", brushed);

    // 绘制主图 x 轴
    svg
      .append("g")
      .attr("class", "axis--x")
      .attr("transform", `translate(${margin.left}, ${height - margin.bottom})`)
      .call(xAxis);

    updateXAxis();

    // 定义 clipPath 用于裁剪主图区域
    svg
      .append("defs")
      .append("clipPath")
      .attr("id", "clip")
      .append("rect")
      .attr("width", width - margin.left - margin.right)
      .attr("height", height - margin.top - margin.bottom);

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

    // 买入标记：矩形（位于 K 线最高价上方）
    candlestick
      .selectAll(".buy-marker-rect")
      .data(stackData.filter((d) => d.trade === 1))
      .enter()
      .append("rect")
      .attr("class", "buy-marker-rect")
      .attr("width", (d) => candlestickWidth())
      .attr("height", rectHeight)
      .attr("x", (d) => xScale(d.index))
      .attr("y", (d) => yScale(d.max) - markerOffset - rectHeight)
      .attr("fill", "orange");

    // 买入标记：三角形（尖角朝下）
    candlestick
      .selectAll(".buy-marker-triangle")
      .data(stackData.filter((d) => d.trade === 1))
      .enter()
      .append("polygon")
      .attr("class", "buy-marker-triangle")
      .attr("points", (d) => {
        const x1 = xScale(d.index) - horizontalPadding;
        const x2 = xScale(d.index) + candlestickWidth() + horizontalPadding;
        const baseY = yScale(d.max) - markerOffset;
        const tipY = baseY + triangleHeight;
        const tipX = (x1 + x2) / 2;
        return `${x1},${baseY} ${x2},${baseY} ${tipX},${tipY}`;
      })
      .attr("fill", "orange");

    // 卖出标记：矩形（位于 K 线最低价下方）
    candlestick
      .selectAll(".sell-marker-rect")
      .data(stackData.filter((d) => d.trade === -1))
      .enter()
      .append("rect")
      .attr("class", "sell-marker-rect")
      .attr("width", (d) => candlestickWidth())
      .attr("height", rectHeight)
      .attr("x", (d) => xScale(d.index))
      .attr("y", (d) => yScale(d.min) + markerOffset)
      .attr("fill", "blue");

    // 卖出标记：三角形（尖角朝上）
    candlestick
      .selectAll(".sell-marker-triangle")
      .data(stackData.filter((d) => d.trade === -1))
      .enter()
      .append("polygon")
      .attr("class", "sell-marker-triangle")
      .attr("points", (d) => {
        const x1 = xScale(d.index) - horizontalPadding;
        const x2 = xScale(d.index) + candlestickWidth() + horizontalPadding;
        const baseY = yScale(d.min) + markerOffset;
        const tipY = baseY - triangleHeight;
        const tipX = (x1 + x2) / 2;
        return `${x1},${baseY} ${x2},${baseY} ${tipX},${tipY}`;
      })
      .attr("fill", "blue");

    // —— 绘制上下文（刷选）区域 —— //

    const context = svg
      .append("g")
      .attr("class", "context")
      .attr("transform", `translate(${margin2.left}, ${margin2.top})`);

    context
      .append("g")
      .attr("class", "axis axis--x")
      .attr("transform", `translate(0, ${height2})`)
      .call(xAxis2);

    updateXAxis2();

    context
      .append("path")
      .attr("class", "area")
      .datum(data.data)
      .attr("d", area)
      .attr("fill", "steelblue")
      .attr("fill-opacity", 0.3);

    // 在上下文区域外绘制刷选框底部的三角形
    const textOffset = 10;
    svg
      .selectAll(".deal-triangle-bottom")
      .data(stackData.filter((d) => d.trade !== 0))
      .enter()
      .append("polygon")
      .attr("class", "deal-triangle-bottom")
      .attr("points", (d) => {
        const x1 = margin2.left + xScale2(d.index) - 2;
        const x2 = margin2.left + xScale2(d.index) + candlestickWidth() + 2;
        const tipY = margin2.top + height2 + textOffset;
        const baseY = tipY + triangleHeight;
        const tipX = (x1 + x2) / 2;
        return `${x1},${baseY} ${x2},${baseY} ${tipX},${tipY}`;
      })
      .attr("fill", (d) =>
        d.trade === 1 ? "orange" : d.trade === -1 ? "blue" : "white"
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
      .attr("height", height - margin.top - margin.bottom)
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
      .on("wheel", wheelHandler);

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
        .attr("y2", height - margin.top - margin.bottom);
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
        `translate(${cx}, ${height - margin.bottom - 10})`
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
        .selectAll(".buy-marker-rect")
        .attr("x", (d) => xScale(d.index))
        .attr("y", (d) => yScale(d.max) - markerOffset - rectHeight)
        .attr("width", getCandlestickWidth(end - start));
      focus.selectAll(".buy-marker-triangle").attr("points", (d) => {
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
        .selectAll(".sell-marker-rect")
        .attr("x", (d) => xScale(d.index))
        .attr("y", (d) => yScale(d.min) + markerOffset)
        .attr("width", getCandlestickWidth(end - start));
      focus.selectAll(".sell-marker-triangle").attr("points", (d) => {
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
    }

    // 辅助函数：根据当前显示数据个数计算每根 K 线宽度
    function getCandlestickWidth(dataLength) {
      return ((width - margin.left - margin.right) / dataLength) * 0.7;
    }
  }, [data, trade, startDate, endDate, width, height]);

  return (
    <div>
      <div ref={d3Node} />
    </div>
  );
}

export default Candle;
