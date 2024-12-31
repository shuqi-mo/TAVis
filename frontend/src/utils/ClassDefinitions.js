class Indicator {
  constructor(data) {
    this.name = data.name;
    this.type = data.type;
    this.long = data.long;
    this.short = data.short;

    // 存储中间变量（除了name, type, long, short以外的所有元素）
    this.variables = {};

    // 预处理变量：首先处理所有的中间变量
    for (let key in data) {
      if (!["name", "long", "short"].includes(key)) {
        // 对变量的表达式进行预替换，确保它们能正确展开
        this.variables[key] = this.preprocessVariable(data[key]);
      }
    }
  }

  // 预替换函数，递归展开变量
  preprocessVariable(expression) {
    let newExpression = expression;
    if (typeof newExpression === "string") {
      // 替换所有中间变量
      for (let key in this.variables) {
        // 递归替换，直到替换完成
        newExpression = newExpression.replace(
          new RegExp(`\\b${key}\\b`, "g"),
          `${this.variables[key]}`
        );
      }
    }
    return newExpression;
  }

  // 计算 long 和 short 的方法
  exprLong() {
    // 根据类中存储的变量来动态计算long
    return this.long.replace(/(\w+)/g, (match) => {
      // 替换变量为对应的值
      if (this.variables[match]) {
        return this.variables[match];
      }
      return match;
    });
  }

  exprShort() {
    // 根据类中存储的变量来动态计算short
    return this.short.replace(/(\w+)/g, (match) => {
      // 替换变量为对应的值
      if (this.variables[match]) {
        return this.variables[match];
      }
      return match;
    });
  }
}

class Evaluation {
  constructor(period, stopConditions) {
    this.startDate = period[0]; // 评估开始日期
    this.endDate = period[1]; // 评估结束日期
    this.stopConditions = stopConditions; // 包含止损、止盈和提前停止条件的数组
  }
  // 获取止损阈值（负值表示止损，正值表示止盈）
  getStopLossThreshold() {
    const lossCondition = this.stopConditions.find(condition => condition.loss);
    return lossCondition ? parseFloat(lossCondition.loss) : null;
  }

  // 获取止盈阈值（百分比）
  getTakeProfitThreshold() {
    const gainCondition = this.stopConditions.find(condition => condition.gain);
    return gainCondition ? parseFloat(gainCondition.gain) : null;
  }

  // 获取提前停止的时间（如果有）
  getAheadStopTime() {
    const aheadCondition = this.stopConditions.find(condition => condition.ahead);
    return aheadCondition ? parseInt(aheadCondition.ahead) : null;
  }
}

export { Indicator, Evaluation };
