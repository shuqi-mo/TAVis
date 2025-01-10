import { useEffect, useState } from "react";
import { Flex, Slider, Card, Tag, Typography } from "antd";
import axios from "axios";
import BarChart from "./BarChart";

const { Text } = Typography;

function Pattern({ selectStock, trade, startDate, endDate }) {
  const API_URL = "http://localhost:5000";
  const [minsup, setMinsup] = useState(25);
  const [patterns, setPatterns] = useState(null);
  const [barchartData, setBarchartData] = useState(null);

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
      })
      .then((response) => {
        setPatterns(response.data[0]);
        const barchart = Object.entries(response.data[1]).map(
          ([key, value]) => ({
            key,
            value,
          })
        );
        setBarchartData(barchart);
      })
      .catch((error) => {
        console.error("Error:", error);
      });
  }, [selectStock, minsup, startDate, endDate, trade]);

  return (
    <Flex>
      <Card
        style={{
          width: 180,
          height: 450,
          maxHeight: 450,
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
      <div style={{ width: 450, height: 450 }}>
        <div style={{ width: 450, height: 180 }}>
          {barchartData && <BarChart data={barchartData} />}
        </div>
      </div>
    </Flex>
  );
}

export default Pattern;
