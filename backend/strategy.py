import numpy as np

def minMaxNormalize(data):
    n = len(data)
    res = np.zeros(n)
    minNum = min(data)
    maxNum = max(data)
    for i in range(n):
        if data[i] == 0:
            continue
        if data[i] == 1:
            res[i] = 1
        else:
            res[i] = 1 - round((data[i] - minNum) / (maxNum - minNum),2)
    return res

def single(price, thres):
    n = len(price)
    trade = np.zeros(n)
    cur = price[0]
    for i in range(1,n):
        flux = abs((price[i] - cur) / cur)
        if flux >= thres:
            trade[i] = 1
            cur = price[i]
        else:
            trade[i] = round(flux / thres,2)
    return trade

def longShortTrend(short, long):
    n = len(short)
    trade = np.zeros(n)
    for i in range(n-1):
        if long[i] == 0:
            continue
        if (short[i]-long[i])*(short[i+1]-long[i+1]) < 0:
            trade[i+1] = 1
        else:
            trade[i+1] = abs(short[i+1]-long[i+1])
    return minMaxNormalize(trade)
    
def TBR(price, up, down):
    n = len(price)
    trade = np.zeros(n)
    for i in range(n):
        if up[i] == 0:
            continue
        if price[i] > up[i] or price[i] < down[i]:
            trade[i] = 1
        else:
            dis = max(abs(price[i]-up[i]),abs(price[i]-down[i]))
            trade[i] = round(dis/(up[i]-down[i]),2)
    return trade

def cross(short, long):
    n = len(short)
    trade = np.zeros(n)
    for i in range(n-1):
        if long[i] == 0:
            continue
        if short[i] < long[i] and short[i+1] > long[i+1]:
            trade[i+1] = 1
    return trade