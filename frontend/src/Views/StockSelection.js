import React, { useState, useEffect } from "react";
import axios from "axios";
import { Select, Button, Popover, Slider, Spin, Transfer } from "antd";
import {
  FilterOutlined,
  SettingOutlined,
  PlayCircleOutlined,
  StarFilled,
  StarOutlined,
  RedoOutlined,
} from "@ant-design/icons";
import * as d3 from "d3";
import ScatterPlot from "./ScatterPlot";

const { Option } = Select;

/* -------------------------------
   FilterMetric：针对单个指标的过滤模块
   - 左右输入框显示当前选中区间
   - 使用 antd Slider 实现滑动条（range 模式）
   - 下方使用 d3.area 绘制数据分布的面积图，并标出当前选择区域
-------------------------------- */
function FilterMetric({ metric, data, value, onChange }) {
  const dmin = d3.min(data);
  const dmax = d3.max(data);
  const stepValue =
    metric === "successRate" || metric === "avgReturn" ? 0.01 : 1;
  const [range, setRange] = useState(value || [dmin, dmax]);

  // 当外部 value 变化时更新本地状态
  React.useEffect(() => {
    setRange(value || [dmin, dmax]);
  }, [value, dmin, dmax]);

  const handleSliderChange = (newRange) => {
    setRange(newRange);
    onChange(newRange);
  };

  // 计算面积图：使用 d3.bin 计算数据分布（分为 30 个区间）
  const bins = d3.bin().domain([dmin, dmax]).thresholds(30)(data);
  const maxBinCount = d3.max(bins, (d) => d.length);
  const areaChartWidth = 200;
  const areaChartHeight = 50;
  const xScaleArea = d3
    .scaleLinear()
    .domain([dmin, dmax])
    .range([0, areaChartWidth]);
  const yScaleArea = d3
    .scaleLinear()
    .domain([0, maxBinCount])
    .range([areaChartHeight, 0]);
  const areaGenerator = d3
    .area()
    .x((d) => xScaleArea(d.x0) + (xScaleArea(d.x1) - xScaleArea(d.x0)) / 2)
    .y0(areaChartHeight)
    .y1((d) => yScaleArea(d.length))
    .curve(d3.curveMonotoneX);
  const areaPath = areaGenerator(bins);

  return (
    <div style={{ marginBottom: 20, paddingBottom: 10 }}>
      <div style={{ marginBottom: 4, fontWeight: "bold" }}>{metric}</div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 4,
        }}
      >
        <input
          type="number"
          value={range[0]}
          style={{ width: 60 }}
          onChange={(e) => {
            const newVal = Number(e.target.value);
            const newRange = [newVal, range[1]];
            setRange(newRange);
            onChange(newRange);
          }}
        />
        <Slider
          range
          min={dmin}
          max={dmax}
          value={range}
          step={stepValue}
          onChange={handleSliderChange}
          style={{ flex: 1 }}
        />
        <input
          type="number"
          value={range[1]}
          style={{ width: 60 }}
          onChange={(e) => {
            const newVal = Number(e.target.value);
            const newRange = [range[0], newVal];
            setRange(newRange);
            onChange(newRange);
          }}
        />
      </div>
      <svg width={areaChartWidth} height={areaChartHeight}>
        <path
          d={areaPath}
          fill="lightblue"
          stroke="steelblue"
          strokeWidth={1}
        />
        {/* 在面积图上绘制选中区域 */}
        <rect
          x={xScaleArea(range[0])}
          y={0}
          width={xScaleArea(range[1]) - xScaleArea(range[0])}
          height={areaChartHeight}
          fill="orange"
          opacity={0.2}
        />
      </svg>
    </div>
  );
}

/** -------------------------------
 * FilterPopoverContent：弹出层中整体过滤 UI，
 * 包含针对四项指标的 FilterMetric 和一个 Confirm 按钮
 * -------------------------------- */
function FilterPopoverContent({ performance, onConfirm, initialFilters }) {
  const metrics = ["totalTrades", "successRate", "avgReturn", "totalProfit"];
  const metricIndex = {
    totalTrades: 1,
    successRate: 2,
    avgReturn: 3,
    totalProfit: 4,
  };

  // 从 performance 中提取各指标数据数组
  const availableData = {};
  metrics.forEach((metric) => {
    availableData[metric] = performance
      ? performance.map((item) => Number(item[metricIndex[metric]]))
      : [];
  });

  // 初始过滤范围：若 initialFilters 存在，则使用之；否则取当前数据的全范围
  const computeInitFilters = () => {
    const init = {};
    metrics.forEach((metric) => {
      const dataArr = availableData[metric];
      init[metric] = [d3.min(dataArr), d3.max(dataArr)];
    });
    return init;
  };

  const [localFilters, setLocalFilters] = useState(
    initialFilters || computeInitFilters()
  );

  // 当 performance 数据更新后，重置过滤范围为全数据范围
  useEffect(() => {
    setLocalFilters(computeInitFilters());
  }, [performance]);

  const handleFilterChange = (metric, range) => {
    setLocalFilters((prev) => ({ ...prev, [metric]: range }));
  };

  return (
    <div style={{ width: 250 }}>
      {metrics.map((metric) => (
        <FilterMetric
          key={metric}
          metric={metric}
          data={availableData[metric]}
          value={localFilters[metric]}
          onChange={(range) => handleFilterChange(metric, range)}
        />
      ))}
      <Button type="primary" onClick={() => onConfirm(localFilters)}>
        Confirm
      </Button>
    </div>
  );
}

// color legend 组件（使用从绿色到红色的渐变）
function ColorLegend({ minVal, maxVal, medianVal, valueKey }) {
  if (!minVal || !maxVal || !medianVal) {
    minVal = 0;
    maxVal = 0;
    medianVal = 0;
  }
  const legendWidth = 70;
  const legendHeight = 6;
  // 构造 diverging color scale，注意：使用反转插值使得最小值为绿色，最大值为红色
  const colorScale = d3
    .scaleDiverging()
    .domain([minVal, medianVal, maxVal])
    .interpolator((t) => d3.interpolateRdYlGn(1 - t));
  const leftColor = colorScale(minVal);
  const rightColor = colorScale(maxVal);

  // 格式化数值（可根据指标调整）
  const formatValue = (value, key) => {
    if (value === undefined || value === null) return "-";
    if (key === "successRate" || key === "avgReturn") {
      return (value * 100).toFixed(2) + "%";
    } else if (key === "totalProfit") {
      return value.toFixed(2);
    } else {
      return value;
    }
  };

  return (
    <div style={{ marginLeft: 5 }}>
      <div style={{ fontWeight: "bold", marginBottom: 2, fontSize: "12px" }}>
        {valueKey}
      </div>
      <div
        style={{
          position: "relative",
          width: legendWidth,
          height: legendHeight,
          background: `linear-gradient(to right, ${leftColor}, ${rightColor})`,
        }}
      />
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          width: legendWidth,
          fontSize: "10px",
        }}
      >
        <span>{formatValue(minVal, valueKey)}</span>
        <span>{formatValue(maxVal, valueKey)}</span>
      </div>
    </div>
  );
}

function StockTransfer({
  allStocks,
  targetKeys,
  selectStock,
  onSelectStock,
  onChange,
}) {
  const dataSource = allStocks.map((stock) => ({ key: stock, title: stock }));
  return (
    <Transfer
      dataSource={dataSource}
      titles={["All Stocks", "Selected Stocks"]}
      targetKeys={targetKeys}
      onChange={onChange}
      render={(item) => {
        const isCurrent = item.key === selectStock;
        return (
          <div style={{ display: "flex", alignItems: "center" }}>
            {isCurrent ? (
              <StarFilled
                style={{ color: "yellow", cursor: "pointer" }}
                onClick={() => onSelectStock(item.key)}
              />
            ) : (
              <StarOutlined
                style={{ cursor: "pointer" }}
                onClick={() => onSelectStock(item.key)}
              />
            )}
            <span style={{ marginLeft: 8 }}>{item.title}</span>
          </div>
        );
      }}
      oneWay
      listStyle={{
        width: 200,
        height: 300,
      }}
    />
  );
}

const StockSelection = ({
  indicators,
  evaluation,
  selectStock,
  stockList,
  onSelectStock,
  onStockListChange,
}) => {
  const API_URL = "http://localhost:5000";
  const [defaultData, setDefaultData] = useState([]);
  const [stocksPerformance, setStocksPerformance] = useState(null);
  const [valueKey, setValueKey] = useState("totalProfit");
  const [filterCriteria, setFilterCriteria] = useState(null);
  const [filterPopoverVisible, setFilterPopoverVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [allStocks, setAllStocks] = useState([]);
  const [redoVisible, setRedoVisible] = useState(false);
  const [redoSelection, setRedoSelection] = useState([
    "mean_log_return",
    "industry_embedding",
  ]);

  // mapping: 性能数据中各指标在数组中的位置
  const metricIndex = {
    totalTrades: 1,
    successRate: 2,
    avgReturn: 3,
    totalProfit: 4,
  };

  // 根据 stocksPerformance 和当前选中的指标计算最小值、最大值和中位数
  let minVal, maxVal, medianVal;
  if (stocksPerformance) {
    const metricValues = stocksPerformance
      .map((item) => parseFloat(item[metricIndex[valueKey]]))
      .filter((v) => !isNaN(v));
    if (metricValues.length > 0) {
      minVal = d3.min(metricValues);
      maxVal = d3.max(metricValues);
      medianVal = d3.median(metricValues);
    }
  }

  // 获取后端数据的函数
  const fetchData = async () => {
    axios
      .get(`${API_URL}/get_scatterdata_default`)
      .then((response) => {
        setDefaultData(response.data);
      })
      .catch((error) => {
        console.error("Error:", error);
      });
  };

  const handleExecute = async () => {
    setLoading(true); // 开始加载

    let indicatorName = [];
    let exprLongList = [];
    let exprShortList = [];
    let exprVariableList = [];
    let variableList = [];

    const startDate = evaluation.startDate;
    const endDate = evaluation.endDate;
    const getStopLossThreshold = evaluation.getStopLossThreshold();
    const getTakeProfitThreshold = evaluation.getTakeProfitThreshold();
    const getAheadStopTime = evaluation.getAheadStopTime();

    for (let i = 0; i < indicators.length; i++) {
      indicatorName.push(indicators[i].name);
      exprLongList.push(indicators[i].exprLong);
      exprShortList.push(indicators[i].exprShort);
      exprVariableList.push(indicators[i].exprVariable);
      variableList.push(indicators[i].variable);
    }
    try {
      // 等待axios请求完成并获取响应数据
      const response = await axios.post(`${API_URL}/process_stock_all`, {
        indicatorName,
        exprLongList,
        exprShortList,
        startDate,
        endDate,
        getStopLossThreshold,
        getTakeProfitThreshold,
        getAheadStopTime,
      });
      setStocksPerformance(response.data);
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllStocks = async () => {
    axios
      .get(`${API_URL}/get_all_stocks`)
      .then((response) => {
        // 假设返回数据格式为数组，每个元素包含 { key, title }
        setAllStocks(response.data);
      })
      .catch((error) => {
        console.error("Error:", error);
      });
  };

  // 定义确认按钮的处理函数，将选项传给后端
  const handleRedoConfirm = async () => {
    setLoading(true);
    try {
      const response = await axios.post(`${API_URL}/get_scatterdata`, {
        options: redoSelection,
      });
      setDefaultData(response.data);
    } catch (error) {
      console.error("Redo error:", error);
    } finally {
      // 确认后关闭弹出层
      setRedoVisible(false);
      setLoading(false);
    }
  };

  // 组件加载时自动获取数据
  useEffect(() => {
    fetchData();
    fetchAllStocks();
  }, []);

  return (
    <div>
      {/* 按钮区域 */}
      <div
        style={{
          display: "flex",
          gap: "5px",
          marginBottom: "10px",
          paddingTop: "10px",
          marginLeft: "5px",
        }}
      >
        <Popover
          content={
            <div>
              <Select
                mode="multiple"
                style={{ width: 200 }}
                value={redoSelection}
                onChange={(value) => setRedoSelection(value)}
              >
                <Option value="mean_price">mean_price</Option>
                <Option value="std_price">std_price</Option>
                <Option value="mean_log_return">mean_log_return</Option>
                <Option value="std_log_return">std_log_return</Option>
                <Option value="industry_embedding">industry_embedding</Option>
              </Select>
              <Button
                type="primary"
                onClick={handleRedoConfirm}
                style={{ marginTop: 8, marginLeft: 5 }}
              >
                Confirm
              </Button>
            </div>
          }
          title="Stock embedding recalculation"
          trigger="click"
          visible={redoVisible}
          onVisibleChange={(visible) => setRedoVisible(visible)}
        >
          <Button
            style={{ border: "none", background: "none", cursor: "pointer" }}
            onClick={() => setRedoVisible(true)}
          >
            <RedoOutlined style={{ fontSize: "12px" }} />
          </Button>
        </Popover>
        <Button
          onClick={() => handleExecute()}
          style={{ border: "none", background: "none", cursor: "pointer" }}
        >
          <PlayCircleOutlined style={{ fontSize: "12px" }} />
        </Button>
        {/* 将 FilterOutlined 按钮用 Popover 包裹 */}
        <Popover
          content={
            <FilterPopoverContent
              performance={stocksPerformance}
              initialFilters={filterCriteria}
              onConfirm={(filters) => {
                setFilterCriteria(filters);
                setFilterPopoverVisible(false);
              }}
            />
          }
          trigger="click"
          visible={filterPopoverVisible}
          onVisibleChange={(visible) => setFilterPopoverVisible(visible)}
        >
          <Button
            style={{ border: "none", background: "none", cursor: "pointer" }}
          >
            <FilterOutlined style={{ fontSize: "12px" }} />
          </Button>
        </Popover>
        {/* 设置按钮：点击后弹出 Transfer 穿梭框 */}
        <Popover
          content={
            <StockTransfer
              allStocks={allStocks}
              targetKeys={stockList}
              selectStock={selectStock}
              onSelectStock={onSelectStock}
              onChange={(newTargetKeys) => onStockListChange(newTargetKeys)}
            />
          }
          trigger="click"
        >
          <Button
            style={{ border: "none", background: "none", cursor: "pointer" }}
          >
            <SettingOutlined style={{ fontSize: "12px" }} />
          </Button>
        </Popover>
        {/* 单选框：选择用于散点图上色的指标 */}
        <Select
          value={valueKey}
          onChange={(val) => setValueKey(val)}
          style={{ width: 50 }}
        >
          <Option value="totalTrades">totalTrades</Option>
          <Option value="successRate">successRate</Option>
          <Option value="avgReturn">avgReturn</Option>
          <Option value="totalProfit">totalProfit</Option>
        </Select>
        {/* Color legend */}
        {
          <ColorLegend
            minVal={minVal}
            maxVal={maxVal}
            medianVal={medianVal}
            valueKey={valueKey}
          />
        }
      </div>

      {/* 散点图区域，加载时显示 Spin */}
      <Spin spinning={loading}>
        <ScatterPlot
          data={defaultData}
          performance={stocksPerformance}
          valueKey={valueKey}
          colorStats={{ min: minVal, median: medianVal, max: maxVal }}
          filters={filterCriteria}
          selectedStocks={stockList}
          width={350}
          height={330}
        />
      </Spin>
    </div>
  );
};

export default StockSelection;
