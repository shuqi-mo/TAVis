import { useEffect, useState } from "react";
import { Flex, Slider, Card, Tag, Typography } from "antd";
import axios from "axios";
import SunburstChart from "./SunburstChart";

const { Text } = Typography;

function Pattern({ selectStock, trade, startDate, endDate, indicatorPerformance }) {
  const API_URL = "http://localhost:5000";
  const [minsup, setMinsup] = useState(25);
  const [patterns, setPatterns] = useState(null);

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
        console.log(response.data[1]);
      })
      .catch((error) => {
        console.error("Error:", error);
      });
  }, [selectStock, minsup, startDate, endDate, trade, indicatorPerformance]);

  return (
    <Flex>
      <Card
        style={{
          width: 180,
          height: 350,
          maxHeight: 350,
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
      <div style={{ width: 300, height: 350 }}>
        <div style={{ width: 300, height: 300 }}>
          <SunburstChart/>
        </div>
      </div>
    </Flex>
  );
}

export default Pattern;
