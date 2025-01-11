import pandas as pd

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
    scatterData = []
    for i in range(len(trade)):
        if i == 0:
            scatterData.append(0)
        if trade[i] == 0:
            if len(scatterData) == i:
                scatterData.append(scatterData[i-1])
            continue
        # 多头进场
        if trade[i] == 1:
            item = []
            if len(scatterData) == i:
                scatterData.append(scatterData[i-1])
            if ahead == -1:
                for j in range(i+1,len(trade)):
                    item.append((price[j]-price[i])/price[i])
                    if len(scatterData) > j:
                        scatterData[j] = scatterData[j] + price[j] - price[i]
                    else:
                        scatterData.append(scatterData[j-1] + price[j] - price[i])
                    if trade[j] == -1:
                        if price[i] < price[j]:
                            success.append(1)
                        else:
                            success.append(0)
                        totalprofit += price[j] - price[i]
                        profit.append(totalprofit)
                        profitpent.append((price[j]-price[i])/price[i])
                        boxplotData.append(item)
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
                for j in range(1,ahead+1):
                    item.append((price[j]-price[i])/price[i])
                    scatterData.append(scatterData[i-1] + price[j] - price[i])
                boxplotData.append(item)
        # 空头进场
        if trade[i] == -1:
            item = []
            if len(scatterData) == i:
                scatterData.append(scatterData[i-1])
            if ahead == -1:
                for j in range(i+1,len(trade)):
                    item.append((price[i]-price[j])/price[i])
                    if len(scatterData) > j:
                        scatterData[j] = scatterData[j] + price[i] - price[j]
                    else:
                        scatterData.append(scatterData[j-1] + price[i] - price[j])
                    if trade[j] == 1:
                        if price[i] > price[j]:
                            success.append(1)
                        else:
                            success.append(0)
                        totalprofit += price[i] - price[j]
                        profit.append(totalprofit)
                        profitpent.append((price[i]-price[j])/price[i])
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
                for j in range(1,ahead+1):
                    item.append((price[i]-price[j])/price[i])
                    scatterData.append(scatterData[i-1] + price[i] - price[j])
                boxplotData.append(item)
    return [success,profit,profitpent,boxplotData,scatterData]