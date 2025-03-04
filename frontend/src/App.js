import { useEffect, useState } from "react";
import _ from "lodash";
import axios from "axios";
import Candle from "./Views/Candle";
import "./App.scss";
import CodeEditor from "./Views/CodeEditor";
import { Indicator, Evaluation } from "./utils/ClassDefinitions";
import { Layout, Button, Flex, Radio } from "antd";
import { CloseOutlined, CodeOutlined } from "@ant-design/icons";
import CurveBoxplot from "./Views/CurveBoxplot";
import Comparison from "./Views/Comparison";
import ParallelCoordinatesChart from "./Views/ParallelCoordinatesChart";
import SunburstChart from "./Views/SunburstChart";
import StockSelection from "./Views/StockSelection";

const currentStrategyData = [
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

function App() {
  const API_URL = "http://localhost:5000";
  const test1 = require("./case/test1.json");

  const [data, setData] = useState(null);
  const [code, setCode] = useState(JSON.stringify(test1, null, 2));
  const [trade, setTrade] = useState(null);
  const [tradeByIndicators, setTradeByIndicators] = useState(null);
  const [backtest, setBacktest] = useState(null);
  const [selectStock, setSelectStock] = useState("600893.SH");
  const [stockList, setStockList] = useState([
    "600893.SH",
    "000651.SZ",
    "002241.SZ",
    "002555.SZ",
    "002594.SZ",
  ]);
  const [stockPerformance, setStockPerformance] = useState([]);
  const [curveBoxplotData, setCurveBoxplotData] = useState(null);
  const [curveBoxplotDataForStocks, setCurveBoxplotDataForStocks] =
    useState(null);
  const [examplerData, setExamplerData] = useState(null);
  const [ringDataIndicatorStock, setRingDataIndicatorStock] = useState(null);
  const [ringDataStockIndicator, setRingDataStockIndicator] = useState(null);
  const [anovaIndicatorStock, setAnovaIndicatorStock] = useState(null);
  const [anovaStockIndicator, setAnovaStockIndicator] = useState(null);

  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState("current stock");
  const [colorAssignments, setColorAssignments] = useState([]);

  // 定义 antd 色板（12 个主色组，每组 10 个颜色），参考官方文档：https://ant.design/docs/spec/colors-cn
  const antdPalette = [
    // 10: Magenta
    [
      "#fff0f6",
      "#ffd6e7",
      "#ffadd2",
      "#ff85c0",
      "#f759ab",
      "#eb2f96",
      "#c41d7f",
      "#9e1068",
      "#780650",
      "#520339",
    ],
    // 6: Cyan
    [
      "#e6fffb",
      "#b5f5ec",
      "#87e8de",
      "#5cdbd3",
      "#36cfc9",
      "#13c2c2",
      "#08979c",
      "#006d75",
      "#00474f",
      "#02323d",
    ],
    // 9: Purple
    [
      "#f9f0ff",
      "#efdbff",
      "#d3adf7",
      "#b37feb",
      "#9254de",
      "#722ed1",
      "#531dab",
      "#391085",
      "#22075e",
      "#120338",
    ],
    // 1: Volcano
    [
      "#fff2e8",
      "#ffd8bf",
      "#ffbb96",
      "#ff9c6e",
      "#ff7a45",
      "#fa541c",
      "#d4380d",
      "#ad2102",
      "#871400",
      "#610b00",
    ],
    // 4: Lime
    [
      "#fcffe6",
      "#f4ffb8",
      "#eaff8f",
      "#d3f261",
      "#bae637",
      "#a0d911",
      "#7cb305",
      "#5b8c00",
      "#3f6600",
      "#254000",
    ],
    // 3: Gold
    [
      "#fffbe6",
      "#fff1b8",
      "#ffe58f",
      "#ffd666",
      "#ffc53d",
      "#faad14",
      "#d48806",
      "#ad6800",
      "#874d00",
      "#613400",
    ],
    // 2: Orange
    [
      "#fff7e6",
      "#ffe7ba",
      "#ffd591",
      "#ffc069",
      "#ffa940",
      "#fa8c16",
      "#d46b08",
      "#ad4e00",
      "#873800",
      "#612500",
    ],
    // 5: Green
    [
      "#f6ffed",
      "#d9f7be",
      "#b7eb8f",
      "#95de64",
      "#73d13d",
      "#52c41a",
      "#389e0d",
      "#237804",
      "#135200",
      "#092b00",
    ],
    // 7: Blue
    [
      "#e6f7ff",
      "#bae7ff",
      "#91d5ff",
      "#69c0ff",
      "#40a9ff",
      "#1890ff",
      "#096dd9",
      "#0050b3",
      "#003a8c",
      "#002766",
    ],
    // 8: GeekBlue
    [
      "#f0f5ff",
      "#d6e4ff",
      "#adc6ff",
      "#85a5ff",
      "#597ef7",
      "#2f54eb",
      "#1d39c4",
      "#10239e",
      "#061178",
      "#030852",
    ],
    // 11: Gray
    [
      "#ffffff",
      "#fafafa",
      "#f5f5f5",
      "#f0f0f0",
      "#d9d9d9",
      "#bfbfbf",
      "#8c8c8c",
      "#595959",
      "#434343",
      "#262626",
    ],
    // 0: Red
    [
      "#fff1f0",
      "#ffccc7",
      "#ffa39e",
      "#ff7875",
      "#ff4d4f",
      "#f5222d",
      "#cf1322",
      "#a8071a",
      "#820014",
      "#5c0011",
    ],
  ];

  // 创建策略实例并计算
  const indicators = JSON.parse(code).indicators.map((strategyData) => {
    const indicator = new Indicator(strategyData);
    return {
      name: indicator.name,
      exprLong: indicator.exprLong(),
      exprShort: indicator.exprShort(),
      variable: indicator.getVariables(),
      exprVariable: indicator
        .getVariables()
        .map((item) => indicator.exprVariables(item)),
    };
  });

  const evaluationData = JSON.parse(code).evaluation;

  // 创建 Evaluation 实例
  const evaluation = new Evaluation(evaluationData.period, evaluationData.stop);

  const updateCode = (newValue) => {
    setCode(newValue);
  };

  const onSelectStock = (newValue) => {
    setSelectStock(newValue);
  };

  const onStockListChange = (newValue) => {
    setStockList(newValue);
  };

  /**
   * 根据子节点数量及可选颜色索引数组，从当前主色组中选取间隔较大的衍生色。
   * @param {number} num - 子节点数量
   * @param {Array<number>} availableIndices - 可用衍生色下标数组
   * @param {Array<string>} groupPalette - 当前主色组（10 个颜色的数组）
   * @returns {Array<string>} - 分配的颜色数组
   */
  function getChildColorsForIndicator(num, availableIndices, groupPalette) {
    if (num === 1) {
      const mid = availableIndices[Math.floor(availableIndices.length / 2)];
      return [groupPalette[mid]];
    }
    const step = (availableIndices.length - 1) / (num - 1);
    const indices = [];
    for (let i = 0; i < num; i++) {
      indices.push(availableIndices[Math.round(i * step)]);
    }
    return indices.map((i) => groupPalette[i]);
  }

  /**
   * 为指标数据及其子节点分配颜色。
   * 每个指标依次分配一个主色组，并使用该组中序号为6的衍生色作为指标颜色；
   * 子节点颜色则从该主色组中除去主色后均匀分配。
   * @param {Array} nodes - 当前策略数据（根节点数组）。
   * @param {Object} sharedChildrenMap - 共享子节点映射表。
   */
  function assignColors(nodes, sharedChildrenMap) {
    nodes.forEach((indicator, idx) => {
      // 为当前指标分配主色组，按顺序循环分配
      const groupIndex = idx % antdPalette.length;
      const groupPalette = antdPalette[groupIndex];
      // 指标颜色使用序号为5的衍生色
      indicator.color = groupPalette[4];

      // 子节点可选颜色下标，排除当前指标的主色下标6和浅色下标
      const availableIndices = [2, 3, 5, 6, 7, 8, 9];

      // 如果指标下有直接子节点，则为子节点分配颜色
      if (indicator.children && indicator.children.length > 0) {
        const childColors = getChildColorsForIndicator(
          indicator.children.length,
          availableIndices,
          groupPalette
        );
        indicator.children.forEach((child, index) => {
          child.color = childColors[index];
          // 如果子节点有共享子节点，则从 sharedChildrenMap 中取出对应数据并分配颜色
          if (child.sharedKey && sharedChildrenMap[child.sharedKey]) {
            const sharedChildren = sharedChildrenMap[child.sharedKey];
            const sharedColors = getChildColorsForIndicator(
              sharedChildren.length,
              availableIndices,
              groupPalette
            );
            sharedChildren.forEach((schild, idx2) => {
              schild.color = sharedColors[idx2];
            });
            // 将共享子节点挂载到当前子节点上
            child.children = sharedChildren;
          }
        });
      }
    });
  }

  // 递归遍历节点，将节点名称和颜色保存到一个二维数组中
  function collectColorAssignments(nodes, result, visited = new WeakSet()) {
    nodes.forEach((node) => {
      if (visited.has(node)) return; // 避免重复
      visited.add(node);
      result.push([node.name, node.color]);
      if (node.children && node.children.length > 0) {
        collectColorAssignments(node.children, result, visited);
      }
    });
  }

  // 计算指标交易序列和收益，更新回测和exampler
  async function processStrategies() {
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
    // console.log(exprVariableList);
    try {
      // 等待axios请求完成并获取响应数据
      const response = await axios.post(`${API_URL}/process_stock`, {
        indicatorName,
        exprLongList,
        exprShortList,
        selectStock,
        stockList,
        startDate,
        endDate,
        getStopLossThreshold,
        getTakeProfitThreshold,
        getAheadStopTime,
      });
      // console.log(response.data);
      setTradeByIndicators(response.data[0]);
      var t = [];
      for (let i = 0; i < response.data[0][0].length; i++) {
        var cur = 0;
        for (let j = 0; j < response.data[0].length; j++) {
          cur += response.data[0][j][i];
        }
        if (cur > 0) {
          t.push(1);
        } else if (cur < 0) {
          t.push(-1);
        } else {
          t.push(0);
        }
      }
      setTrade(t);
      // 提取 indicators 中的必要字段并更新 backtest
      const newBacktest = response.data[1].map((indicator) => ({
        name: indicator[0],
        totalTrades: indicator[1],
        successRate: indicator[2],
        avgReturn: indicator[3],
        totalProfit: indicator[4],
      }));
      setBacktest(newBacktest);
      // 更新curveBoxplotData
      setCurveBoxplotData(response.data[2]);
      const performance = response.data[3].map((stock) => ({
        name: stock[0],
        totalTrades: stock[1],
        successRate: stock[2],
        avgReturn: stock[3],
        totalProfit: stock[4],
      }));
      // console.log(performance);
      setStockPerformance(performance);
      setCurveBoxplotDataForStocks(response.data[4]);
      setRingDataIndicatorStock(response.data[5]);
      setRingDataStockIndicator(response.data[6]);
      setAnovaIndicatorStock(response.data[7]);
      setAnovaStockIndicator(response.data[8]);
    } catch (error) {
      console.error("Error:", error);
    }

    try {
      // 等待axios请求完成并获取响应数据
      const response = await axios.post(`${API_URL}/process_exampler`, {
        indicatorName,
        selectStock,
        variableList,
        exprVariableList,
        startDate,
        endDate,
      });
      setExamplerData(response.data);
    } catch (error) {
      console.error("Error:", error);
    }
  }

  // 更新选中股票数据，代码更新时执行策略
  useEffect(() => {
    assignColors(currentStrategyData, sharedChildrenMap);
    // 保存颜色分配结果到一个数组中
    const tmpColorAssignments = [];
    collectColorAssignments(currentStrategyData, tmpColorAssignments);
    setColorAssignments(tmpColorAssignments);

    axios
      .post(`${API_URL}/update_single_stock_data`, { selectStock })
      .then((response) => {
        setData(response.data);
      })
      .catch((error) => {
        console.error("Error:", error);
      });
    processStrategies();
  }, [selectStock, stockList, code]);

  // 切换 CodeEditor 展开/收起状态
  const toggleEditor = () => {
    setVisible(!visible);
  };

  return (
    <Layout>
      <div className="page-title">TAVis</div>
      <Layout
        style={{
          background: "white",
        }}
      >
        <Flex gap="middle">
          <Flex vertical="true" className="view-box" style={{ maxheight: 870 }}>
            <div className="view-title">Candlestick View</div>
            {trade && examplerData && (
              <Candle
                data={data}
                trade={trade}
                indicatorsTrade={tradeByIndicators}
                startDate={evaluation.startDate}
                endDate={evaluation.endDate}
                width={530}
                height={820}
                examplerData={examplerData}
                colorAssignments={colorAssignments}
              />
            )}
          </Flex>
          <Flex vertical="true" gap="middle">
            <Flex vertical="true" className="view-box">
              <div className="view-title">Evaluation View</div>
              <Flex gap="small">
                <Flex
                  style={{ border: "1px solid #ddd", borderRadius: "15px" }}
                >
                  <Flex vertical>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "center",
                        paddingTop: "10px",
                      }}
                    >
                      <Radio.Group
                        size="small"
                        value={position}
                        onChange={(e) => setPosition(e.target.value)}
                      >
                        <Radio.Button value="current stock">
                          indicators
                        </Radio.Button>
                        <Radio.Button value="selected stocks">
                          stocks
                        </Radio.Button>
                      </Radio.Group>
                    </div>
                    {backtest && position === "current stock" && (
                      <div style={{ padding: "5px", overflowY: "auto" }}>
                        <ParallelCoordinatesChart
                          data={backtest}
                          width={250}
                          height={340}
                          colorAssignments={colorAssignments}
                        />
                      </div>
                    )}
                    {stockPerformance && position === "selected stocks" && (
                      <div style={{ padding: "5px", overflowY: "auto" }}>
                        <ParallelCoordinatesChart
                          data={stockPerformance}
                          width={250}
                          height={340}
                          colorAssignments={colorAssignments}
                        />
                      </div>
                    )}
                  </Flex>
                  <div
                    style={{
                      width: 180,
                      maxHeight: 380,
                      overflowY: "auto",
                      paddingTop: "10px",
                    }}
                  >
                    {curveBoxplotData &&
                      position === "current stock" &&
                      curveBoxplotData.map((item) => (
                        <CurveBoxplot
                          boxplotData={item}
                          width={160}
                          height={120}
                        />
                      ))}
                    {curveBoxplotDataForStocks &&
                      position === "selected stocks" &&
                      curveBoxplotDataForStocks.map((item) => (
                        <CurveBoxplot
                          boxplotData={item}
                          width={160}
                          height={120}
                        />
                      ))}
                  </div>
                  {position === "current stock" && (
                    <SunburstChart
                      data={ringDataIndicatorStock}
                      anova={anovaIndicatorStock}
                      width={330}
                      height={380}
                      colorAssignments={colorAssignments}
                    />
                  )}
                  {position === "selected stocks" && (
                    <SunburstChart
                      data={ringDataStockIndicator}
                      anova = {anovaStockIndicator}
                      width={330}
                      height={380}
                      colorAssignments={colorAssignments}
                    />
                  )}
                </Flex>
                <Flex
                  style={{ border: "1px solid #ddd", borderRadius: "15px" }}
                >
                  <StockSelection
                    indicators={indicators}
                    evaluation={evaluation}
                    selectStock={selectStock}
                    stockList={stockList}
                    onSelectStock={onSelectStock}
                    onStockListChange={onStockListChange}
                  />
                </Flex>
              </Flex>
            </Flex>
            <Flex vertical="true" className="view-box">
              <div className="view-title">Comparison View</div>
              <Flex>
                <div style={{}}>
                  <Comparison
                    initialCode={code}
                    indicators={indicators}
                    evaluation={evaluation}
                    stockList={stockList}
                    onSelectCode={(code) => {
                      setCode(code);
                    }}
                  />
                </div>
              </Flex>
            </Flex>
          </Flex>
          <Flex>
            {visible && (
              <div
                style={{
                  position: "fixed",
                  right: 20, // 与页面右侧距离，可根据需要调整
                  bottom: 80, // 离底部留出一定距离，避免与按钮重叠
                  zIndex: 1000,
                  background: "#fff",
                  border: "1px solid #e8e8e8",
                  padding: "10px",
                  borderRadius: "4px",
                  boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15)",
                }}
              >
                <CodeEditor code={code} onCodeChange={updateCode} />
              </div>
            )}
            <Button
              type="primary"
              shape="circle"
              size="large"
              style={{
                position: "fixed",
                right: 20,
                bottom: 20,
                zIndex: 1001,
              }}
              onClick={toggleEditor}
            >
              {visible ? <CloseOutlined /> : <CodeOutlined />}
            </Button>
          </Flex>
        </Flex>
      </Layout>
    </Layout>
  );
}

export default App;
