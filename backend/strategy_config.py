import re
import copy

def extract_parameters_from_indicators(strategy):
    """
    1. 对策略 JSON 的 indicators 部分提取参数：
       对表达式中包含 MA 的函数、价格字段（close/open/high/low）及数字替换为占位符，
       并生成参数配置项。
    2. 为每个指标增加 include 参数（默认 "true"）。
    3. 根据已有指标生成组合指标，每个组合指标为两个指标的有序组合（如 MACD&rsi、rsi&MACD 等）：
       - 对于组合指标，两个参与指标的信号相关字段都会加上后缀（如 _MACD、_rsi）。
       - 组合指标的 long 信号为：主指标 long 表达式 & (副指标【反向】的条件)，副指标反向条件规则为：原短信号表达式中将 cross(A,B) 转为 "A > B"；
       - 组合指标的 short 信号为：主指标 short 表达式 & (副指标【反向】的条件)，副指标反向条件规则为：原长信号表达式中将 cross(A,B) 转为 "A > B"；
       - 组合指标中的占位符参数将重新编号，参数值与原指标保持一致，生成新的 param_config。
    返回替换后的策略 JSON 和参数配置字典。
    """
    new_strategy = copy.deepcopy(strategy)
    param_config = {}
    counter = 0  # 参数编号计数器

    # --- 第一部分：处理原有指标 ---
    def replace_in_value(val, context):
        nonlocal counter
        if isinstance(val, str):
            # 1. 提取函数名中包含 "MA" 的部分（保留左括号）
            pattern_ma = re.compile(r'\b(\w*MA\w*)(\()')

            def ma_replacer(match):
                nonlocal counter
                param_key = f"param_{counter}"
                counter += 1
                func_name = match.group(1)
                param_config[param_key] = {
                    "value": func_name,
                    "options": ["SMA", "EMA", "WMA", "SMMA"],
                    "type": "str",
                    "context": context
                }
                return "${" + param_key + "}" + match.group(2)

            val = pattern_ma.sub(ma_replacer, val)

            # 2. 提取价格字段中的 close/open/high/low
            pattern_price = re.compile(r'\b(close|open|high|low)\b')

            def price_replacer(match):
                nonlocal counter
                param_key = f"param_{counter}"
                counter += 1
                token = match.group(1)
                param_config[param_key] = {
                    "value": token,
                    "options": ["close", "open", "high", "low"],
                    "type": "str",
                    "context": context
                }
                return "${" + param_key + "}"

            val = pattern_price.sub(price_replacer, val)

            # 3. 提取数字（包括负数、小数）
            pattern_num = re.compile(r'(?<![a-zA-Z0-9_])(-?\d+(\.\d+)?)(?![a-zA-Z0-9_])')

            def num_replacer(match):
                nonlocal counter
                param_key = f"param_{counter}"
                counter += 1
                num_val = match.group(1)
                try:
                    if '.' in num_val:
                        param_val = float(num_val)
                        param_type = "float"
                    else:
                        param_val = int(num_val)
                        param_type = "int"
                except Exception:
                    param_val = num_val
                    param_type = "str"
                param_config[param_key] = {
                    "value": param_val,
                    "min": param_val * 0.5,
                    "max": param_val * 1.5,
                    "type": param_type,
                    "context": context
                }
                return "${" + param_key + "}"

            val = pattern_num.sub(num_replacer, val)

            return val
        elif isinstance(val, (int, float)):
            param_key = f"param_{counter}"
            counter += 1
            param_val = val
            param_type = "float" if isinstance(val, float) else "int"
            param_config[param_key] = {
                "value": param_val,
                "min": param_val * 0.5,
                "max": param_val * 1.5,
                "type": param_type,
                "context": context
            }
            return "${" + param_key + "}"
        elif isinstance(val, list):
            return [replace_in_value(item, f"{context}[{i}]") for i, item in enumerate(val)]
        elif isinstance(val, dict):
            new_dict = {}
            for k, v in val.items():
                new_dict[k] = replace_in_value(v, f"{context}.{k}")
            return new_dict
        else:
            return val

    # 只处理 indicators 部分
    if "indicators" in new_strategy:
        new_strategy["indicators"] = replace_in_value(new_strategy["indicators"], "indicators")
        if isinstance(new_strategy["indicators"], list):
            for idx, indicator in enumerate(new_strategy["indicators"]):
                if isinstance(indicator, dict):
                    param_key = f"param_{counter}"
                    counter += 1
                    param_config[param_key] = {
                        "value": "true",
                        "options": ["true", "false"],
                        "type": "str",
                        "context": f"indicators[{idx}].include"
                    }
                    indicator["include"] = "${" + param_key + "}"

    # --- 第二部分：生成组合指标 ---
    # 辅助函数：为某个指标的信号相关字段（除 name、long、short、include）增加后缀
    def rename_indicator_fields(indicator, suffix):
        """
        为某个指标的信号相关字段（除 name、long、short、include）增加后缀，
        并处理字段值中引用其他字段的情况。

        参数:
        indicator (dict): 要处理的指标
        suffix (str): 要添加的后缀

        返回:
        dict: 包含处理后字段的新字典
        """
        new_fields = {}
        exclude_keys = {"name", "long", "short", "include"}

        # 第一步：收集所有需要被重命名的字段名
        original_keys = [k for k in indicator.keys() if k not in exclude_keys]

        # 第二步：为每个字段创建新的名称（添加后缀）
        for key in original_keys:
            new_key = f"{key}_{suffix}"
            value = indicator[key]

            # 如果字段值是字符串，可能包含对其他字段的引用，但暂时不处理
            new_fields[new_key] = value

        # 第三步：处理每个新字段的值，替换其中可能引用的其他字段名
        for new_key in list(new_fields.keys()):
            value = new_fields[new_key]
            if isinstance(value, str):
                # 对字符串类型的值，替换所有可能引用的字段名
                new_value = value
                for original_key in original_keys:
                    # 使用正则表达式确保只替换完整的字段名（避免部分匹配）
                    new_value = re.sub(r'\b' + re.escape(original_key) + r'\b',
                                       f"{original_key}_{suffix}", new_value)
                new_fields[new_key] = new_value

        return new_fields

    # 辅助函数：对表达式中指定的变量名加后缀（用于 long/short 表达式的处理）
    def rename_expression(expr, suffix, keys):
        new_expr = expr
        for k in keys:
            new_expr = re.sub(r'\b' + re.escape(k) + r'\b', f"{k}_{suffix}", new_expr)
        return new_expr

    # 辅助函数：将形如 cross(A,B) 的表达式转换为 "A > B"
    def transform_condition(cond_str):
        pattern = re.compile(r'cross\(\s*([^,]+?)\s*,\s*([^)]+?)\s*\)')
        return pattern.sub(r'\1 > \2', cond_str)

    def has_three_variables(shortExpr, longExpr):
        """
        检查两个表达式中唯一参数的总数是否为3

        参数:
        shortExpr (str): 第一个表达式
        longExpr (str): 第二个表达式

        返回:
        bool: 如果唯一参数总数为3，返回True，否则返回False
        """
        # 提取第一个表达式中的参数
        short_params = []
        if "(" in shortExpr and ")" in shortExpr:
            # 获取括号内的内容
            params_str = shortExpr[shortExpr.find("(") + 1:shortExpr.rfind(")")]
            # 按逗号分割并去除空白
            short_params = [param.strip() for param in params_str.split(",")]

        # 提取第二个表达式中的参数
        long_params = []
        if "(" in longExpr and ")" in longExpr:
            # 获取括号内的内容
            params_str = longExpr[longExpr.find("(") + 1:longExpr.rfind(")")]
            # 按逗号分割并去除空白
            long_params = [param.strip() for param in params_str.split(",")]

        # 合并参数并去重
        all_params = set(short_params + long_params)

        # 检查唯一参数数量是否为3
        return len(all_params) == 3

    # 辅助函数：重新编号组合指标中的占位符
    # 对于组合指标中的每个字符串，扫描所有形如 ${param_x} 的占位符，
    # 为每个原占位符生成一个新的占位符，参数配置项复制原来的值，且追加组合指标上下文
    def reassign_params_in_obj(obj, local_mapping):
        nonlocal counter  # 添加此行，声明counter为nonlocal
        if isinstance(obj, str):
            pattern = re.compile(r'\$\{(param_\d+)\}')

            def replacer(match):
                nonlocal counter  # 添加此行，在replacer中声明counter为nonlocal
                old_key = match.group(1)
                # 如果该占位符已经是组合指标生成的（context 中包含 "combination_"），则不重新赋值
                if old_key in param_config and "combination_" in param_config[old_key]["context"]:
                    return match.group(0)
                if old_key in local_mapping:
                    return "${" + local_mapping[old_key] + "}"
                else:
                    new_key = f"param_{counter}"
                    counter += 1
                    local_mapping[old_key] = new_key
                    # 复制原参数配置项
                    if old_key in param_config:
                        new_param = param_config[old_key].copy()
                        new_param["context"] = new_param["context"] + " (from combination)"
                        param_config[new_key] = new_param
                    else:
                        # 如果原占位符不存在，则直接使用原字符串
                        return match.group(0)
                    return "${" + new_key + "}"

            return pattern.sub(replacer, obj)
        elif isinstance(obj, list):
            return [reassign_params_in_obj(item, local_mapping) for item in obj]
        elif isinstance(obj, dict):
            new_obj = {}
            for k, v in obj.items():
                new_obj[k] = reassign_params_in_obj(v, local_mapping)
            return new_obj
        else:
            return obj

    original_indicators = new_strategy.get("indicators", [])
    combination_indicators = []

    # 对于每一对不同的原指标，生成组合指标
    for i, primary in enumerate(original_indicators):
        for j, secondary in enumerate(original_indicators):
            if i == j:
                continue
            comb_indicator = {}
            primary_name = primary.get("name", f"ind{i}")
            secondary_name = secondary.get("name", f"ind{j}")
            comb_indicator["name"] = f"{primary_name}&{secondary_name}"
            # 生成主副两侧的字段，字段名添加后缀
            primary_fields = rename_indicator_fields(primary, primary_name)
            secondary_fields = rename_indicator_fields(secondary, secondary_name)
            comb_indicator.update(primary_fields)
            comb_indicator.update(secondary_fields)
            # 处理主指标的 long/short 表达式
            primary_keys = [k for k in primary.keys() if k not in {"name", "long", "short", "include"}]
            primary_long = rename_expression(primary.get("long", ""), primary_name, primary_keys)
            primary_short = rename_expression(primary.get("short", ""), primary_name, primary_keys)
            # 副指标取反信号：取副指标原 short（用于组合 long）和原 long（用于组合 short）
            secondary_keys = [k for k in secondary.keys() if k not in {"name", "long", "short", "include"}]
            secondary_short = rename_expression(secondary.get("short", ""), secondary_name, secondary_keys)
            secondary_long = rename_expression(secondary.get("long", ""), secondary_name, secondary_keys)
            # 将副指标的 cross 表达式转换为比较表达式
            secondary_short_cond = transform_condition(secondary_short)
            secondary_long_cond = transform_condition(secondary_long)

            should_reverse = has_three_variables(secondary_short, secondary_long)
            if should_reverse:
                # 组合指标 long 信号：主指标 long & (副指标 short转换后的条件)
                comb_indicator["long"] = primary_long + " & (" + secondary_short_cond + ")"
                # 组合指标 short 信号：主指标 short & (副指标 long转换后的条件)
                comb_indicator["short"] = primary_short + " & (" + secondary_long_cond + ")"
            else:
                # 组合指标 long 信号：主指标 long & (副指标 long转换后的条件)
                comb_indicator["long"] = primary_long + " & (" + secondary_long_cond + ")"
                # 组合指标 short 信号：主指标 short & (副指标 short转换后的条件)
                comb_indicator["short"] = primary_short + " & (" + secondary_short_cond + ")"
            # 为组合指标增加 include 参数（新编号）
            param_key = f"param_{counter}"
            counter += 1
            param_config[param_key] = {
                "value": "false",
                "options": ["true", "false"],
                "type": "str",
                "context": f"indicators[combination_{primary_name}_{secondary_name}].include"
            }
            comb_indicator["include"] = "${" + param_key + "}"
            # 对组合指标中所有字段重新扫描占位符，生成新的编号（参数值保持与原指标一致）
            comb_indicator = reassign_params_in_obj(comb_indicator, {})
            combination_indicators.append(comb_indicator)

    # 将组合指标追加到原有指标列表中
    if "indicators" not in new_strategy:
        new_strategy["indicators"] = []
    new_strategy["indicators"].extend(combination_indicators)
    return new_strategy, param_config


def restore_indicators(strategy_with_placeholders, param_config):
    """
    根据参数配置，将策略 JSON 中 indicators 部分的占位符（格式：${param_x}）替换为实际参数值，
    并根据 include 参数决定是否包含该指标，最终还原成原始指标配置，其他部分保持不变。
    """
    def restore_value(val):
        if isinstance(val, str):
            pattern = re.compile(r'\$\{(param_\d+)\}')
            def replacer(match):
                key = match.group(1)
                param_value = param_config.get(key)
                if param_value is None:
                    return match.group(0)
                if isinstance(param_value, dict):
                    return str(param_value.get("value", match.group(0)))
                else:
                    return str(param_value)
            return pattern.sub(replacer, val)
        elif isinstance(val, list):
            return [restore_value(item) for item in val]
        elif isinstance(val, dict):
            return {k: restore_value(v) for k, v in val.items()}
        else:
            return val

    new_strategy = copy.deepcopy(strategy_with_placeholders)
    if "indicators" in new_strategy and isinstance(new_strategy["indicators"], list):
        # 先还原所有占位符
        restored_indicators = restore_value(new_strategy["indicators"])
        # 根据 include 参数过滤指标，并移除 include 字段
        filtered_indicators = []
        for indicator in restored_indicators:
            if isinstance(indicator, dict):
                # 如果 include 不存在，则默认包含
                include_val = indicator.get("include", "true")
                if include_val == "true":
                    indicator.pop("include", None)
                    filtered_indicators.append(indicator)
                # 如果 include 为 false，则该指标不加入最终结果
            else:
                filtered_indicators.append(indicator)
        new_strategy["indicators"] = filtered_indicators
    return new_strategy

def recursive_substitute(expr, subs):
    """
    对表达式 expr 进行递归替换：
    当 expr 中出现 subs 字典中的变量名时，
    替换成其对应的表达式，并继续递归替换
    """
    # 构造正则：只匹配整个单词（变量名）
    pattern = re.compile(r'\b(' + '|'.join(map(re.escape, subs.keys())) + r')\b')
    prev_expr = None
    while prev_expr != expr:
        prev_expr = expr
        expr = pattern.sub(lambda m: subs[m.group(0)], expr)
    return expr

def process_indicators(data):
    """
    对每个指标的 long 与 short 表达式做递归变量替换：
    如果指标名称为 "boll"，则保留其它属性（如 price, mid, ...）,
    否则只保留 name, long 和 short 三个属性
    """
    processed = []
    for indicator in data.get('indicators', []):
        # 构造替换字典：除去 name、long、short
        subs = {k: indicator[k] for k in indicator if k not in ['name', 'long', 'short']}
        # 对替换字典中每个表达式进行递归替换（支持嵌套变量）
        for k in subs:
            subs[k] = recursive_substitute(subs[k], subs)
        # 分别对 long 与 short 表达式做替换
        long_expr = recursive_substitute(indicator['long'], subs)
        short_expr = recursive_substitute(indicator['short'], subs)
        # 对 boll 指标保留全部属性，其它指标只保留 name, long, short
        if indicator['name'].lower() == 'boll':
            new_indicator = indicator.copy()
            new_indicator['long'] = long_expr
            new_indicator['short'] = short_expr
        else:
            new_indicator = {
                'name': indicator['name'],
                'long': long_expr,
                'short': short_expr
            }
        processed.append(new_indicator)
    return processed

def process_evaluation(data):
    """
    将 evaluation 部分转换为：
      {
          'startDate': '2023-07-01',
          'endDate': '2024-07-01',
          'ahead': -1
      }
    """
    evaluation = data.get('evaluation', {})
    if evaluation:
        period = evaluation.get('period', [])
        startDate = period[0] if len(period) > 0 else None
        endDate = period[1] if len(period) > 1 else None
        # 假设 stop 是列表，取第一个字典中的 ahead 字段，并转换为整数
        stop_list = evaluation.get('stop', [])
        ahead_val = None
        if stop_list:
            ahead_str = stop_list[0].get('ahead', None)
            if ahead_str is not None:
                try:
                    ahead_val = int(ahead_str)
                except ValueError:
                    try:
                        ahead_val = float(ahead_str)
                    except ValueError:
                        ahead_val = ahead_str
        return {'startDate': startDate, 'endDate': endDate, 'ahead': ahead_val}
    else:
        return {}

def process_data(data):
    """
    处理输入数据，返回包含指标和评价信息的字典
    """
    indicators = process_indicators(data)
    evaluation = process_evaluation(data)
    return {'indicators': indicators, 'evaluation': evaluation}