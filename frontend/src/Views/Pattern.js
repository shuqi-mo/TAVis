import { useEffect, useState } from "react";
import { Popover, Button, Slider, Card, Tag, Typography } from "antd";
import axios from "axios";
import SunburstChart from "./SunburstChart";

const { Text } = Typography;

function Pattern({
  selectStock,
  trade,
  startDate,
  endDate,
  indicatorPerformance,
}) {
  const API_URL = "http://localhost:5000";
  const [minsup, setMinsup] = useState(25);
  const [patterns, setPatterns] = useState(null);
  const [patternPerformance, setPatternPerformance] = useState(null);
  const [popoverVisible, setPopoverVisible] = useState(false);

  const handleSliderChange = (value) => {
    setMinsup(value); // 更新 minsup 值
  };

  useEffect(() => {
    axios
      .post(`${API_URL}/process_pattern`, {
        selectStock,
        minsup,
        trade,
        startDate,
        endDate,
        indicatorPerformance,
      })
      .then((response) => {
        setPatterns(response.data[0]);
        setPatternPerformance(response.data[1]);
      })
      .catch((error) => {
        console.error("Error:", error);
      });
  }, [selectStock, minsup, startDate, endDate, trade, indicatorPerformance]);

  return (
    // 外层容器设置为相对定位
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {/* 左上角悬浮按钮，定位在 Pattern 组件内部 */}
      <Popover
        content={
          <Card
            style={{
              width: 200,
            }}
          >
            <Text strong>minsup: {minsup}</Text>
            <Slider
              min={0}
              max={200}
              value={minsup}
              onChange={handleSliderChange}
            />
            <div style={{ marginTop: 8 }}>
              {patterns &&
                patterns.map((pattern, index) => (
                  <Tag key={index}>
                    p{index + 1}: {pattern}
                  </Tag>
                ))}
            </div>
          </Card>
        }
        trigger="click"
        visible={popoverVisible}
        onVisibleChange={(visible) => setPopoverVisible(visible)}
        placement="bottomLeft"
      >
        <Button
          type="primary"
          shape="circle"
          size="large"
          style={{
            position: "absolute", // 使用绝对定位
            top: 20, // 距离外层容器顶部20px
            left: 20, // 距离外层容器左侧20px
            zIndex: 1000,
          }}
        >
          ☰
        </Button>
      </Popover>

      <div style={{ width: 100, height: 300 }}>
        {patternPerformance && (
          <SunburstChart data={patternPerformance} width={300} height={360} />
        )}
      </div>
    </div>
  );
}

export default Pattern;
