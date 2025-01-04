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
    for i in range(len(trade)):
        if trade[i] == 0:
            continue
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
                boxplotData.append(item)
    return [success,profit,profitpent,boxplotData]