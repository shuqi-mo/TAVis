import { useEffect, useState } from "react";
import { Flex, Slider, Card, Tag, Typography } from "antd";
import axios from "axios";
import SunburstChart from "./SunburstChart";

const { Text } = Typography;

function Pattern({ selectStock, trade, startDate, endDate, indicatorPerformance }) {
  const API_URL = "http://localhost:5000";
  const [minsup, setMinsup] = useState(25);
  const [patterns, setPatterns] = useState(null);
  const [patternPerformance, setPatternPerformance] = useState(null);

  const handleSliderChange = (value) => {
    setMinsup(value); // 更新minsup值
  };

  useEffect(() => {
    axios
      .post(`${API_URL}/process_pattern`, {
        selectStock,
        minsup,
        trade,
        startDate,
        endDate,
        indicatorPerformance
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
    <Flex>
      <Card
        style={{
          width: 120,
          height: 360,
          maxHeight: 360,
          overflowY: "auto",
        }}
      >
        <Text strong>minsup: {minsup}</Text>
        <Slider
          min={0}
          max={200}
          value={minsup}
          onChange={handleSliderChange}
        />
        <Flex gap="4px 0" wrap>
          {patterns &&
            patterns.map((pattern, index) => (
              <Tag>
                p{index + 1}: {pattern}
              </Tag>
            ))}
        </Flex>
      </Card>
      <div style={{ width: 300, height: 360 }}>
        <div style={{ width: 300, height: 300 }}>
          {patternPerformance && <SunburstChart data={patternPerformance}  width={300} height={360}/>}
        </div>
      </div>
    </Flex>
  );
}

export default Pattern;
