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

function App() {
  const API_URL = "http://localhost:5000";
  const test1 = require("./case/test1.json");

  const [data, setData] = useState(null);
  const [code, setCode] = useState(JSON.stringify(test1, null, 2));
  const [trade, setTrade] = useState(null);
  const [tradeByIndicators, setTradeByIndicators] = useState(null);
  const [backtest, setBacktest] = useState(null);
  const [selectStock, setSelectStock] = useState("600893.SH");
  const [stockList, setStockList] = useState(["600893.SH", "000651.SZ", "002241.SZ", "002555.SZ", "002594.SZ"]);
  const [stockPerformance, setStockPerformance] = useState([]);
  const [curveBoxplotData, setCurveBoxplotData] = useState(null);
  const [curveBoxplotDataForStocks, setCurveBoxplotDataForStocks] =
    useState(null);
  const [examplerData, setExamplerData] = useState(null);
  const [ringDataIndicatorStock, setRingDataIndicatorStock] = useState(null);
  const [ringDataStockIndicator, setRingDataStockIndicator] = useState(null);

  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState("current stock");

  // 创建策略实例并计算
  const indicators = JSON.parse(code).indicators.map((strategyData) => {
    const indicator = new Indicator(strategyData);
    return {
      name: indicator.name,
      exprLong: indicator.exprLong(),
      exprShort: indicator.exprShort(),
      variable: indicator.getSortedVariables(),
      exprVariable: indicator
        .getSortedVariables()
        .map((item) => indicator.exprVariables(item)),
    };
  });

  // console.log(indicators);

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
      // console.log(response.data);
      setExamplerData(response.data);
    } catch (error) {
      console.error("Error:", error);
    }
  }

  // 更新选中股票数据，代码更新时执行策略
  useEffect(() => {
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
        <Flex gap="small">
          <Flex vertical="true">
            <div className="view-title">Candlestick View</div>
            {trade && examplerData && (
              <Candle
                data={data}
                trade={trade}
                indicatorsTrade={tradeByIndicators}
                startDate={evaluation.startDate}
                endDate={evaluation.endDate}
                width={550}
                height={840}
                examplerData={examplerData}
              />
            )}
          </Flex>
          <Flex vertical="true">
            <div className="view-title">Evaluation View</div>
            <Flex>
              <Flex vertical>
                <div style={{ display: "flex", justifyContent: "center" }}>
                  <Radio.Group
                    size="small"
                    value={position}
                    onChange={(e) => setPosition(e.target.value)}
                  >
                    <Radio.Button value="current stock">
                      indicators
                    </Radio.Button>
                    <Radio.Button value="selected stocks">stocks</Radio.Button>
                  </Radio.Group>
                </div>
                {backtest && position === "current stock" && (
                  <div style={{ padding: "5px", overflowY: "auto" }}>
                    <ParallelCoordinatesChart
                      data={backtest}
                      width={250}
                      height={350}
                    />
                  </div>
                )}
                {stockPerformance && position === "selected stocks" && (
                  <div style={{ padding: "5px", overflowY: "auto" }}>
                    <ParallelCoordinatesChart
                      data={stockPerformance}
                      width={250}
                      height={350}
                    />
                  </div>
                )}
              </Flex>
              <div style={{ width: 180, maxHeight: 400, overflowY: "auto" }}>
                {curveBoxplotData &&
                  position === "current stock" &&
                  curveBoxplotData.map((item) => (
                    <CurveBoxplot boxplotData={item} width={160} height={120} />
                  ))}
                {curveBoxplotDataForStocks &&
                  position === "selected stocks" &&
                  curveBoxplotDataForStocks.map((item) => (
                    <CurveBoxplot boxplotData={item} width={160} height={120} />
                  ))}
              </div>
              {position === "current stock" && (
                <SunburstChart
                  data={ringDataIndicatorStock}
                  width={300}
                  height={400}
                />
              )}
              {position === "selected stocks" && (
                <SunburstChart
                  data={ringDataStockIndicator}
                  width={300}
                  height={400}
                />
              )}
              <StockSelection
                indicators={indicators}
                evaluation={evaluation}
                selectStock={selectStock}
                stockList={stockList}
                onSelectStock={onSelectStock}
                onStockListChange={onStockListChange}
              />
            </Flex>
            <Flex vertical="true">
              <div className="view-title">Comparison View</div>
              <Flex>
                <div style={{ }}>
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
