import { useEffect, useRef } from "react";
import _ from "lodash";
import * as d3 from "d3";

const width = 900;
const height = 450;
const margin = { top: 20, right: 30, bottom: 110, left: 80 };
const margin2 = { top: 380, right: 30, bottom: 30, left: 80 };
const height2 = height - margin2.bottom - margin2.top;
const dealHeight = 20;

function Candle({ data, trade }) {
  const d3Node = useRef(null);
  const getSvg = () => d3.select(d3Node.current);
  const checkElementExist = (element) => {
    if (element) {
      element.remove();
    }
  };
  // console.log(data);
  const n = data.data.length;
  const stackData = [];
  for (var i = 0; i < n; i++) {
    var res = {};
    res["open"] = data.data[i][1];
    res["close"] = data.data[i][2];
    res["max"] = data.data[i][3];
    res["min"] = data.data[i][4];
    res["trade"] = trade[i];
    stackData.push(res);
  }
  // console.log(stackData);

  useEffect(() => {
    checkElementExist(getSvg().selectAll("svg"));
    let svg = getSvg()
      .append("svg")
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", [0, 0, width, height]);

    const title = svg
      .append("text")
      .text(data.name)
      .attr("x", margin.left)
      .attr("y", margin.top / 2)
      .attr("text-anchor", "start")
      .attr("dominant-baseline", "hanging");

    const dates = d3.map(data.data, (v) => v[0]);
    const highPrices = d3.map(data.data, (v) => v[3]);
    const lowPrices = d3.map(data.data, (v) => v[4]);
    const pricePending = Math.round(d3.max(highPrices) / 20);

    const xScale = d3
      .scaleLinear()
      .domain([0, data.data.length])
      .range([0, width - margin.left - margin.right]);

    const xScale2 = d3
      .scaleLinear()
      .domain([0, data.data.length])
      .range([0, width - margin.left - margin.right]);

    const xAxis = d3
      .axisBottom(xScale)
      .ticks(10)
      .tickFormat((v) => {
        return dates[v];
      });

    const xAxis2 = d3
      .axisBottom(xScale2)
      .ticks(10)
      .tickFormat((v) => {
        return dates[v];
      });

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

    var area = d3
      .area()
      .curve(d3.curveMonotoneX)
      .x(function (v, i) {
        return xScale2(i);
      })
      .y0(height2)
      .y1(function (v, i) {
        return yScale2(v[2]);
      });

    var brush = d3
      .brushX()
      .extent([
        [0, 0],
        [width - margin.right - margin.left, height2],
      ])
      .on("brush end", brushed);

    svg
      .append("g")
      .attr("class", "axis--x")
      .attr(
        "transform",
        "translate(" + margin.left + "," + (height - margin.bottom) + ")"
      )
      .call(xAxis);

    svg
      .append("g")
      .attr("class", "axis--y")
      .attr(
        "transform",
        "translate(" + (margin.left - 5) + ", " + margin.top + ")"
      )
      .call(yAxis)
      .call((g) => g.select(".domain").remove())
      .call((g) => {
        g.selectAll(".tick line")
          .clone()
          .attr("stroke-opacity", 0.1)
          .attr("stroke-dasharray", 5)
          .attr("x2", width - margin.left - margin.right);
      });

    const handleStrokeColor = (v, i) => {
      if (v["open"] > v["close"]) {
        return "green";
      }
      return "red";
    };

    const getCandlestickWidth = (dataLength) =>
      ((width - margin.left - margin.right) / dataLength) * 0.7;

    const candlestickWidth = getCandlestickWidth(data.data.length);

    const focus = svg
      .append("g")
      .attr("transform", "translate(" + margin.left + ", " + margin.top + ")");

    const candlestick = focus.append("g");
    candlestick
      .selectAll("candle-line")
      .data(stackData)
      .enter()
      .append("line")
      .attr("class", "candle-line")
      .attr("x1", (v, i) => {
        return xScale(i) + candlestickWidth / 2;
      })
      .attr("y1", (v, i) => {
        return yScale(v["max"]);
      })
      .attr("x2", (v, i) => {
        return xScale(i) + candlestickWidth / 2;
      })
      .attr("y2", (v, i) => {
        return yScale(v["min"]);
      })
      .attr("stroke", handleStrokeColor)
      .attr("stroke-width", 1);

    candlestick
      .selectAll("candle-bar")
      .data(stackData)
      .enter()
      .append("rect")
      .attr("class", "candle-bar")
      .attr("width", candlestickWidth)
      .attr("height", (v) => {
        return Math.abs(yScale(v["open"]) - yScale(v["close"]));
      })
      .attr("x", (v, i) => {
        return xScale(i);
      })
      .attr("y", (v, i) => {
        return yScale(d3.max([v["open"], v["close"]]));
      })
      .attr("rx", 1)
      .attr("stroke", handleStrokeColor)
      .attr("stroke-width", 0.3)
      .attr("fill", handleStrokeColor);

    // candlestick
    //   .selectAll("candle-bar1")
    //   .data(stackData)
    //   .enter()
    //   .append("rect")
    //   .attr("class", "candle-bar1")
    //   .attr("width", candlestickWidth)
    //   .attr("height", (v) => {
    //     return (
    //       Math.abs(yScale(v["open"]) - yScale(v["close"])) * v["percentage3"]
    //     );
    //   })
    //   .attr("x", (v, i) => {
    //     return xScale(i);
    //   })
    //   .attr("y", (v, i) => {
    //     return yScale(d3.max([v["open"], v["close"]]));
    //   })
    //   .attr("rx", 1)
    //   // .attr("stroke", handleStrokeColor)
    //   // .attr("stroke-width", 0.3)
    //   .attr("fill", "rgb(20,68,106)")
    //   .attr("fill-opacity", (v) =>
    //     String(v["extend3"] ? v["extend3"] : v["extend3"] + 0.2)
    //   );

    // candlestick
    //   .selectAll("candle-bar2")
    //   .data(stackData)
    //   .enter()
    //   .append("rect")
    //   .attr("class", "candle-bar2")
    //   .attr("width", candlestickWidth)
    //   .attr("height", (v) => {
    //     return (
    //       Math.abs(yScale(v["open"]) - yScale(v["close"])) * v["percentage2"]
    //     );
    //   })
    //   .attr("x", (v, i) => {
    //     return xScale(i);
    //   })
    //   .attr("y", (v, i) => {
    //     return yScale(
    //       d3.max([v["open"], v["close"]]) -
    //         Math.abs(v["open"] - v["close"]) * v["percentage3"]
    //     );
    //   })
    //   .attr("rx", 1)
    //   // .attr("stroke", handleStrokeColor)
    //   // .attr("stroke-width", 0.3)
    //   .attr("fill", "rgb(222,125,44)")
    //   .attr("fill-opacity", (v) =>
    //     String(v["extend2"] ? v["extend2"] : v["extend2"] + 0.2)
    //   );

    // candlestick
    //   .selectAll("candle-bar3")
    //   .data(stackData)
    //   .enter()
    //   .append("rect")
    //   .attr("class", "candle-bar3")
    //   .attr("width", candlestickWidth)
    //   .attr("height", (v) => {
    //     return (
    //       Math.abs(yScale(v["open"]) - yScale(v["close"])) * v["percentage1"]
    //     );
    //   })
    //   .attr("x", (v, i) => {
    //     return xScale(i);
    //   })
    //   .attr("y", (v, i) => {
    //     return yScale(
    //       d3.max([v["open"], v["close"]]) -
    //         Math.abs(v["open"] - v["close"]) *
    //           (v["percentage3"] + v["percentage2"])
    //     );
    //   })
    //   .attr("rx", 1)
    //   // .attr("stroke", handleStrokeColor)
    //   // .attr("stroke-width", 0.3)
    //   .attr("fill", "rgb(179,168,150)")
    //   .attr("fill-opacity", (v) =>
    //     String(v["extend1"] ? v["extend1"] : v["extend1"] + 0.2)
    //   );

    candlestick
      .selectAll("deal")
      .data(stackData)
      .enter()
      .append("rect")
      .attr("class", "deal")
      .attr("width", candlestickWidth)
      .attr("height", (v, i) => {
        return dealHeight * Math.abs(v["trade"]);
      })
      .attr("x", (v, i) => {
        return xScale(i);
      })
      .attr("y", (v, i) => {
        return yScale(v["max"] + 2) - dealHeight;
      })
      .attr("rx", 1)
      .attr("fill", (v, i) => {
        if (v["trade"] === 1) return "orange";
        else if (v["trade"] === -1) return "blue";
        else return "white";
      });

    candlestick
      .selectAll("deal-triangle")
      .data(stackData)
      .enter()
      .append("polygon")
      .attr("class", "deal-triangle")
      .attr("points", (v, i) => {
        const x1 = (xScale(i) - 2) * Math.abs(v["trade"]);
        const x2 = (xScale(i) + candlestickWidth + 2) * Math.abs(v["trade"]);
        const y1 = (yScale(v["max"] + 2)) * Math.abs(v["trade"]);
        const y2 = (yScale(v["max"] + 1.5)) * Math.abs(v["trade"]);
        return (
          String(x1) +
          "," +
          String(y1) +
          " " +
          String(x2) +
          "," +
          String(y1) +
          " " +
          String((x1 + x2) / 2) +
          "," +
          String(y2)
        );
      })
      .attr("fill", (v, i) => {
        if (v["trade"] === 1) return "orange";
        else if (v["trade"] === -1) return "blue";
        else return "white";
      });

    candlestick
      .selectAll("deal-triangle-bottom")
      .data(stackData)
      .enter()
      .append("polygon")
      .attr("class", "deal-triangle-bottom")
      .attr("points", (v, i) => {
        const x1 = (xScale(i) - 2) * Math.abs(v["trade"]);
        const x2 = (xScale(i) + candlestickWidth + 2) * Math.abs(v["trade"]);
        const y1 = (height-margin2.bottom) * Math.abs(v["trade"]);
        const y2 = (height-margin2.bottom-5) * Math.abs(v["trade"]);
        return (
          String(x1) +
          "," +
          String(y1) +
          " " +
          String(x2) +
          "," +
          String(y1) +
          " " +
          String((x1 + x2) / 2) +
          "," +
          String(y2)
        );
      })
      .attr("fill", (v, i) => {
        if (v["trade"] === 1) return "orange";
        else if (v["trade"] === -1) return "blue";
        else return "white";
      });

    var context = svg
      .append("g")
      .attr("class", "context")
      .attr("transform", "translate(" + margin2.left + "," + margin2.top + ")");

    context
      .append("g")
      .attr("class", "axis axis--x")
      .attr("transform", "translate(0," + height2 + ")")
      .call(xAxis2);

    context
      .append("path")
      .attr("class", "area")
      .datum(data.data)
      .attr("d", area)
      .attr("fill", "steelblue")
      .attr("fill-opacity", 0.3);

    context
      .append("g")
      .attr("class", "brush")
      .call(brush)
      .call(brush.move, xScale.range());

    function brushed(event) {
      var s = event.selection || xScale2.range();
      const start = Math.round(xScale2.invert(Math.round(s[0])));
      const end = Math.round(xScale2.invert(Math.round(s[1])));
      var arr = data.data.slice(start, end + 1);
      const highPricesUpdate = d3.max(d3.map(arr, (v) => v[3]));
      const lowPricesUpdate = d3.min(d3.map(arr, (v) => v[4]));
      const pricePendingUpdate = Math.round(highPricesUpdate / 20);
      yScale.domain([
        lowPricesUpdate - pricePendingUpdate,
        highPricesUpdate + pricePendingUpdate,
      ]);
      xScale.domain(s.map(xScale2.invert, xScale2));
      svg.select(".axis--x").call(xAxis);
      svg
        .select(".axis--y")
        .call(yAxis)
        .call((g) => g.select(".domain").remove());
      focus
        .selectAll(".candle-bar")
        .attr("height", (v, i) => {
          if (xScale(i) >= 0 && xScale(i) <= xScale2(data.data.length))
            return Math.abs(yScale(v["open"]) - yScale(v["close"]));
        })
        .attr("x", (v, i) => {
          return xScale(i);
        })
        .attr("y", (v, i) => {
          return yScale(d3.max([v["open"], v["close"]]));
        })
        .attr("width", getCandlestickWidth(end - start));
      // focus
      //   .selectAll(".candle-bar1")
      //   .attr("height", (v, i) => {
      //     if (xScale(i) >= 0 && xScale(i) <= xScale2(data.data.length))
      //       return (
      //         Math.abs(yScale(v["open"]) - yScale(v["close"])) *
      //         v["percentage3"]
      //       );
      //   })
      //   .attr("x", (v, i) => {
      //     return xScale(i);
      //   })
      //   .attr("y", (v, i) => {
      //     return yScale(d3.max([v["open"], v["close"]]));
      //   })
      //   .attr("width", getCandlestickWidth(end - start));
      // focus
      //   .selectAll(".candle-bar2")
      //   .attr("height", (v, i) => {
      //     if (xScale(i) >= 0 && xScale(i) <= xScale2(data.data.length))
      //       return (
      //         Math.abs(yScale(v["open"]) - yScale(v["close"])) *
      //         v["percentage2"]
      //       );
      //   })
      //   .attr("x", (v, i) => {
      //     return xScale(i);
      //   })
      //   .attr("y", (v, i) => {
      //     return yScale(
      //       d3.max([v["open"], v["close"]]) -
      //         Math.abs(v["open"] - v["close"]) * v["percentage3"]
      //     );
      //   })
      //   .attr("width", getCandlestickWidth(end - start));
      // focus
      //   .selectAll(".candle-bar3")
      //   .attr("height", (v, i) => {
      //     if (xScale(i) >= 0 && xScale(i) <= xScale2(data.data.length))
      //       return (
      //         Math.abs(yScale(v["open"]) - yScale(v["close"])) *
      //         v["percentage1"]
      //       );
      //   })
      //   .attr("x", (v, i) => {
      //     return xScale(i);
      //   })
      //   .attr("y", (v, i) => {
      //     return yScale(
      //       d3.max([v["open"], v["close"]]) -
      //         Math.abs(v["open"] - v["close"]) *
      //           (v["percentage3"] + v["percentage2"])
      //     );
      //   })
      //   .attr("width", getCandlestickWidth(end - start));
      focus
        .selectAll(".deal")
        .attr("height", (v, i) => {
          // return yScale(0.5) * Math.abs(v["trade"]);
          if (xScale(i) >= 0 && xScale(i) <= xScale2(data.data.length))
            return dealHeight * Math.abs(v["trade"]);
        })
        .attr("x", (v, i) => {
          return xScale(i);
        })
        .attr("y", (v, i) => {
          return yScale(v["max"] + 2) - dealHeight;
        })
        .attr("width", getCandlestickWidth(end - start));
      focus.selectAll(".deal-triangle").attr("points", (v, i) => {
        if (xScale(i) >= 0 && xScale(i) <= xScale2(data.data.length)) {
          const x1 = (xScale(i) - 2) * Math.abs(v["trade"]);
          const x2 =
            (xScale(i) + getCandlestickWidth(end - start) + 2) *
            Math.abs(v["trade"]);
          const y1 = (yScale(v["max"] + 2)) * Math.abs(v["trade"]);
          const y2 = (yScale(v["max"] + 1.5)) * Math.abs(v["trade"]);
          return (
            String(x1) +
            "," +
            String(y1) +
            " " +
            String(x2) +
            "," +
            String(y1) +
            " " +
            String((x1 + x2) / 2) +
            "," +
            String(y2)
          );
        }
      });
      focus
        .selectAll(".candle-line")
        .attr("x1", (v, i) => {
          if (xScale(i) >= 0 && xScale(i) <= xScale2(data.data.length))
            return xScale(i) + getCandlestickWidth(end - start) / 2;
        })
        .attr("y1", (v, i) => {
          if (xScale(i) >= 0 && xScale(i) <= xScale2(data.data.length))
            return yScale(v["max"]);
        })
        .attr("x2", (v, i) => {
          if (xScale(i) >= 0 && xScale(i) <= xScale2(data.data.length))
            return xScale(i) + getCandlestickWidth(end - start) / 2;
        })
        .attr("y2", (v, i) => {
          if (xScale(i) >= 0 && xScale(i) <= xScale2(data.data.length))
            return yScale(v["min"]);
        });
    }
  }, [stackData]);

  return (
    <div>
      <div ref={d3Node} />
    </div>
  );
}

export default Candle;
