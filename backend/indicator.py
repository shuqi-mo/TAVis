import numpy as np

def MA(price, days):
    n = len(price)
    res = []
    for i in range(n):
        if i < days:
            res.append(0)
            continue
        else:
            t = 0
            for j in range(days+1):
                t += price[i-j]
            res.append(round(t/days,2))
    return res

def bolling(price, days):
    n = len(price)
    mid = MA(price, days)
    std = np.zeros(n)
    for i in range(n-days):
        if i < days:
            continue
        w = price[i:i+days]
        std[i:i+days] = np.std(w)
    up = mid + 2 * std
    down = mid - 2 * std
    for i in range(days):
        up[i] = 0
        down[i] = 0
    return up, down