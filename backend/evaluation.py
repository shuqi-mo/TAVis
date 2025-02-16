import pandas as pd
import numpy as np

def updatePeriod(stock, trade_origin, startDate=None, endDate=None):
    trade_origin = pd.Series(trade_origin)
    mask = (stock['trade_date'] >= startDate) & (stock['trade_date'] <= endDate)
    price = stock[mask]["close"].reset_index(drop=True)
    trade = trade_origin[mask].reset_index(drop=True)
    return price, trade

def calBacktest(price, trade, ahead = -1):
    success = []
    profit = []
    profitpent = []
    boxplotData = []
    totalprofit = 0
    positionAndProfit = []
    for i in range(len(trade)):
        # 多头进场
        if trade[i] == 1:
            item = []
            if ahead == -1:
                for j in range(i+1,len(trade)):
                    item.append((price[j]-price[i])/price[i])
                    if trade[j] == -1:
                        if price[i] < price[j]:
                            success.append(1)
                        else:
                            success.append(0)
                        totalprofit += price[j] - price[i]
                        profit.append(totalprofit)
                        profitpent.append((price[j]-price[i])/price[i])
                        boxplotData.append(item)
                        positionAndProfit.append([i, price[j] - price[i]])
                        break
            else:
                if i + ahead >= len(trade):
                    break
                if price[i] < price[i+ahead]:
                    success.append(1)
                else:
                    success.append(0)
                totalprofit += price[i+ahead] - price[i]
                profit.append(totalprofit)
                profitpent.append((price[i+ahead]-price[i])/price[i])
                positionAndProfit.append([i, price[i+ahead] - price[i]])
                for j in range(1,ahead+1):
                    item.append((price[j]-price[i])/price[i])
                boxplotData.append(item)
        # 空头进场
        if trade[i] == -1:
            item = []
            if ahead == -1:
                for j in range(i+1,len(trade)):
                    item.append((price[i]-price[j])/price[i])
                    if trade[j] == 1:
                        if price[i] > price[j]:
                            success.append(1)
                        else:
                            success.append(0)
                        totalprofit += price[i] - price[j]
                        profit.append(totalprofit)
                        profitpent.append((price[i]-price[j])/price[i])
                        positionAndProfit.append([i, price[i] - price[j]])
                        boxplotData.append(item)
                        break
            else:
                if i + ahead >= len(trade):
                    break
                if price[i] > price[i+ahead]:
                    success.append(1)
                else:
                    success.append(0)
                totalprofit += price[i] - price[i+ahead]
                profit.append(totalprofit)
                profitpent.append((price[i]-price[i+ahead])/price[i])
                positionAndProfit.append([i, price[i] - price[i+ahead]])
                for j in range(1,ahead+1):
                    item.append((price[i]-price[j])/price[i])
                boxplotData.append(item)
    return [success,profit,profitpent,boxplotData,positionAndProfit]

def transform_data_ring(ring_indicator_stock):
    result = {"name": "root", "children": []}
    # 遍历每个元素
    for indicator, stock_list in ring_indicator_stock.items():
        indicator_node = {
            "name": indicator.upper(),  # 将指标名称大写，如 'rsi' -> 'RSI'
            "value": 0,
            "children": []
        }   
        # 遍历该指标下的所有股票数据
        for stock_entry in stock_list:
            stock_code = stock_entry[0]
            profit_arr = stock_entry[1]
            # 如果 profit_arr 非空，则计算统计值
            if profit_arr:
                arr = np.array(profit_arr)
                min_val = float(np.min(arr))
                max_val = float(np.max(arr))
                median_val = float(np.percentile(arr, 50))
                q1 = float(np.percentile(arr, 25))
                q3 = float(np.percentile(arr, 75))
            else:
                min_val = max_val = median_val = q1 = q3 = None
            
            stock_node = {
                "name": stock_code,
                "value": len(profit_arr),
                "profitStats": {
                    "min": min_val,
                    "q1": q1,
                    "median": median_val,
                    "q3": q3,
                    "max": max_val,
                }
            }
            indicator_node["children"].append(stock_node)
        result["children"].append(indicator_node)
    return result