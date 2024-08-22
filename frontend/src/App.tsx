import React, { useEffect } from 'react';
import { createChart } from 'lightweight-charts';
import { AdvancedChart } from './components/AdvancedChart'
import './App.css';
// Lightweight Charts™ Example: Realtime updates
// https://tradingview.github.io/lightweight-charts/tutorials/demos/realtime-updates


function App() {
  return (
    <AdvancedChart widgetProps={{ "theme": "dark" }} />
  );
}

export default App;
