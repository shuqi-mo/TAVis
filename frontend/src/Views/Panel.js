import { List, Button } from "antd";
import { useState } from "react";
import axios from "axios";

function Panel({ stockList, onUpdateValue, onUpdateStock }) {
  const [selectedStock, setSelectedStock] = useState("600893.SH");
  const API_URL = "http://localhost:5000";

  const handleItemClick = (item) => {
    setSelectedStock(item);
    onUpdateStock(item);
    axios
    .post(`${API_URL}/update_single_stock_data`, { item })
    .then((response) => {
      onUpdateValue(response.data);
    })
    .catch((error) => {
      console.error("Error:", error);
    });
  };

  return (
    <div>
      <div>
        <List
          header={<div>Stocklist</div>}
          dataSource={stockList}
          renderItem={(item) => (
            <List.Item
              actions={[selectedStock === item ? '': <Button type="link" onClick={() => handleItemClick(item)}>Select</Button>]}
            >
              {item}
            </List.Item>
          )}
        />
      </div>
    </div>
  );
}

export default Panel;
