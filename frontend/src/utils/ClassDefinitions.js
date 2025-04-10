class Indicator {
  constructor(data) {
    this.name = data.name;
    this.long = data.long;
    this.short = data.short;

    // 存储中间变量（除了 name, long, short 之外的所有元素）
    this.variables = {};
    // 同时保存原始变量定义，便于判断是否存在嵌套调用
    this.rawVariables = {};

    // 预处理变量：首先处理所有的中间变量
    for (let key in data) {
      if (!["name", "long", "short"].includes(key)) {
        // 保存原始定义
        this.rawVariables[key] = data[key];
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

  // 提取 long 和 short 中的变量
  extractVariables(expression) {
    const variableRegex = /\b[a-zA-Z_][a-zA-Z0-9_]*\b/g;
    return expression.match(variableRegex).filter(
      (v) => !["cross"].includes(v) // 排除 cross 函数名
    );
  }

  // 修改后的 getVariables() 实现：
  // 对于 long 和 short 中提取到的每个变量，
  // 如果在原始变量定义中存在且其原始表达式中含有其他变量调用，则直接返回变量名；
  // 否则返回预处理后的表达式（或非字符串值）。
  getVariables() {
    const longVars = this.extractVariables(this.long);
    const shortVars = this.extractVariables(this.short);
    const varNames = [...new Set([...longVars, ...shortVars])];

    return varNames.map((v) => {
      if (this.rawVariables.hasOwnProperty(v)) {
        const rawVal = this.rawVariables[v];
        if (typeof rawVal === "string") {
          // 提取原始表达式中的所有 token
          const tokens = rawVal.match(/\b[a-zA-Z_][a-zA-Z0-9_]*\b/g) || [];
          // 如果 token 中存在其他在 rawVariables 定义中的变量，则认为存在嵌套调用
          const hasNested = tokens.some((token) =>
            this.rawVariables.hasOwnProperty(token)
          );
          if (!hasNested) {
            // 叶子节点，直接返回预处理后的值
            return this.variables[v];
          } else {
            // 存在嵌套调用，返回变量名称
            return v;
          }
        } else {
          // 非字符串类型（如数值）直接返回值
          return String(rawVal);
        }
      }
      return v;
    });
  }

  exprVariables(expr) {
    // 根据类中存储的变量来动态计算short
    return expr.replace(/(\w+)/g, (match) => {
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
    const lossCondition = this.stopConditions.find(
      (condition) => condition.loss
    );
    return lossCondition ? parseFloat(lossCondition.loss) : -1;
  }

  // 获取止盈阈值（百分比）
  getTakeProfitThreshold() {
    const gainCondition = this.stopConditions.find(
      (condition) => condition.gain
    );
    return gainCondition ? parseFloat(gainCondition.gain) : -1;
  }

  // 获取提前停止的时间（如果有）
  getAheadStopTime() {
    const aheadCondition = this.stopConditions.find(
      (condition) => condition.ahead
    );
    return aheadCondition ? parseInt(aheadCondition.ahead) : -1;
  }
}

export { Indicator, Evaluation };
