import pandas as pd
import numpy as np
import scipy.stats as stats

def updatePeriod(stock, trade_origin, startDate=None, endDate=None):
    trade_origin = pd.Series(trade_origin)
    mask = (stock['trade_date'] >= startDate) & (stock['trade_date'] <= endDate)
    price = stock[mask]["close"].reset_index(drop=True)
    trade = trade_origin[mask].reset_index(drop=True)
    return price, trade

def calBacktest(price, trade, ahead = -1, maxloss = -1, maxgain = -1):
    success = []
    profit = []
    profitpent = []
    boxplotData = []
    totalprofit = 0
    positionAndProfit = []
    logboxplotData = []
    
    for i in range(len(trade)):
        # 多头进场
        if trade[i] == 1:
            item = []
            item_log = []
            if ahead == -1:
                for j in range(i+1, len(trade)):
                    # 计算当前的盈利或亏损
                    current_profit = (price[j] - price[i]) / price[i]
                    
                    # 判断止损或止盈
                    if maxloss != -1 and current_profit <= -maxloss:
                        success.append(0)  # 止损
                        totalprofit += (price[j] - price[i])
                        profit.append(totalprofit)
                        profitpent.append(current_profit)
                        positionAndProfit.append([i, price[j] - price[i]])
                        boxplotData.append(item)
                        logboxplotData.append(item_log)
                        break
                    
                    if maxgain != -1 and current_profit >= maxgain:
                        success.append(1)  # 止盈
                        totalprofit += (price[j] - price[i])
                        profit.append(totalprofit)
                        profitpent.append(current_profit)
                        positionAndProfit.append([i, price[j] - price[i]])
                        boxplotData.append(item)
                        logboxplotData.append(item_log)
                        break
                    
                    # 常规退出条件
                    if trade[j] == -1:
                        if price[i] < price[j]:
                            success.append(1)
                        else:
                            success.append(0)
                        totalprofit += (price[j] - price[i])
                        profit.append(totalprofit)
                        profitpent.append(current_profit)
                        positionAndProfit.append([i, price[j] - price[i]])
                        boxplotData.append(item)
                        logboxplotData.append(item_log)
                        break
                    
                    item.append(current_profit)
                    item_log.append(np.log(price[j] / price[i]))
                    
            else:
                if i + ahead >= len(trade):
                    break
                
                # 在ahead期间内，逐步判断止损止盈
                for j in range(1, ahead+1):
                    current_profit = (price[i+j] - price[i]) / price[i]
                    
                    # 判断止损或止盈
                    if maxloss != -1 and current_profit <= -maxloss:
                        success.append(0)  # 止损
                        totalprofit += (price[i+j] - price[i])
                        profit.append(totalprofit)
                        profitpent.append(current_profit)
                        positionAndProfit.append([i, price[i+j] - price[i]])
                        boxplotData.append(item)
                        logboxplotData.append(item_log)
                        break
                    
                    if maxgain != -1 and current_profit >= maxgain:
                        success.append(1)  # 止盈
                        totalprofit += (price[i+j] - price[i])
                        profit.append(totalprofit)
                        profitpent.append(current_profit)
                        positionAndProfit.append([i, price[i+j] - price[i]])
                        boxplotData.append(item)
                        logboxplotData.append(item_log)
                        break
                    
                    item.append(current_profit)
                    item_log.append(np.log(price[i+j] / price[i]))
                
                if j == ahead:
                    # 若没有提前止损止盈，则正常退出
                    if price[i] < price[i+ahead]:
                        success.append(1)
                    else:
                        success.append(0)
                    totalprofit += (price[i+ahead] - price[i])
                    profit.append(totalprofit)
                    profitpent.append((price[i+ahead] - price[i]) / price[i])
                    positionAndProfit.append([i, price[i+ahead] - price[i]])
                    boxplotData.append(item)
                    logboxplotData.append(item_log)
        
        # 空头进场
        if trade[i] == -1:
            item = []
            item_log = []
            if ahead == -1:
                for j in range(i+1, len(trade)):
                    # 计算当前的盈利或亏损
                    current_profit = (price[i] - price[j]) / price[i]
                    
                    # 判断止损或止盈
                    if maxloss != -1 and current_profit <= -maxloss:
                        success.append(0)  # 止损
                        totalprofit += (price[i] - price[j])
                        profit.append(totalprofit)
                        profitpent.append(current_profit)
                        positionAndProfit.append([i, price[i] - price[j]])
                        boxplotData.append(item)
                        logboxplotData.append(item_log)
                        break
                    
                    if maxgain != -1 and current_profit >= maxgain:
                        success.append(1)  # 止盈
                        totalprofit += (price[i] - price[j])
                        profit.append(totalprofit)
                        profitpent.append(current_profit)
                        positionAndProfit.append([i, price[i] - price[j]])
                        boxplotData.append(item)
                        logboxplotData.append(item_log)
                        break
                    
                    # 常规退出条件
                    if trade[j] == 1:
                        if price[i] > price[j]:
                            success.append(1)
                        else:
                            success.append(0)
                        totalprofit += (price[i] - price[j])
                        profit.append(totalprofit)
                        profitpent.append(current_profit)
                        positionAndProfit.append([i, price[i] - price[j]])
                        boxplotData.append(item)
                        logboxplotData.append(item_log)
                        break
                    
                    item.append(current_profit)
                    item_log.append(np.log(price[i] / price[j]))
                    
            else:
                if i + ahead >= len(trade):
                    break
                
                # 在ahead期间内，逐步判断止损止盈
                for j in range(1, ahead+1):
                    current_profit = (price[i] - price[i+j]) / price[i]
                    
                    # 判断止损或止盈
                    if maxloss != -1 and current_profit <= -maxloss:
                        success.append(0)  # 止损
                        totalprofit += (price[i] - price[i+j])
                        profit.append(totalprofit)
                        profitpent.append(current_profit)
                        positionAndProfit.append([i, price[i] - price[i+j]])
                        boxplotData.append(item)
                        logboxplotData.append(item_log)
                        break
                    
                    if maxgain != -1 and current_profit >= maxgain:
                        success.append(1)  # 止盈
                        totalprofit += (price[i] - price[i+j])
                        profit.append(totalprofit)
                        profitpent.append(current_profit)
                        positionAndProfit.append([i, price[i] - price[i+j]])
                        boxplotData.append(item)
                        logboxplotData.append(item_log)
                        break
                    
                    item.append(current_profit)
                    item_log.append(np.log(price[i] / price[i+j]))
                
                if j == ahead:
                    # 若没有提前止损止盈，则正常退出
                    if price[i] > price[i+ahead]:
                        success.append(1)
                    else:
                        success.append(0)
                    totalprofit += (price[i] - price[i+ahead])
                    profit.append(totalprofit)
                    profitpent.append((price[i] - price[i+ahead]) / price[i])
                    positionAndProfit.append([i, price[i] - price[i+ahead]])
                    boxplotData.append(item)
                    logboxplotData.append(item_log)
    
    return [success, profit, profitpent, boxplotData, positionAndProfit, logboxplotData]

def transform_data_ring(ring_indicator_stock):
    result = {"name": "root", "children": []}
    # 遍历每个元素
    for indicator, stock_list in ring_indicator_stock.items():
        indicator_node = {
            "name": indicator,
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

def anova_analysis(data):
    res = []

    merged_data = {}
    for indicator in data:
        for stock, values in data[indicator]:
            if stock not in merged_data:
                merged_data[stock] = []
            merged_data[stock].extend(values)
    f_stat, p_value = stats.f_oneway(*merged_data.values())
    res.append(["global", round(p_value,2)])

    for key, value in data.items():
        # 将每只股票的数据提取出来
        stock_data = [x[1] for x in value]
        # 执行ANOVA
        f_stat, p_value = stats.f_oneway(*stock_data)
        if not np.isnan(p_value):
            res.append([key, round(p_value,2)])

    return res