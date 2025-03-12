import ast
import re
import copy

# ─────────────────────────────
# BarcodeTree Parser：将策略json转成树
# 利用 AST 提取表达式中的变量名称
def extract_vars(expr):
    try:
        tree = ast.parse(expr, mode='eval')
    except Exception:
        return []
    vars_found = []
    class VarVisitor(ast.NodeVisitor):
        def visit_Name(self, node):
            vars_found.append(node.id)
        def visit_Call(self, node):
            # 不将函数名本身作为依赖，只遍历参数
            for arg in node.args:
                self.visit(arg)
    VarVisitor().visit(tree.body)
    return vars_found

# 根据表达式判断类型
def determine_type(expr):
    if isinstance(expr, (int, float)):
        return "constant"
    if isinstance(expr, str):
        s = expr.strip()
        # 判断是否为函数调用形式，如 "EMA(close,12)" 或 "rsi(close,14)"
        if re.match(r'^[A-Za-z_]\w*\s*\(.*\)$', s):
            return "function"
        # 若包含算术运算符，则认为需要解析其依赖（extend 类型）
        if any(op in s for op in ['+', '-', '*', '/']):
            return "extend"
        # 否则视为价格时间序列
        return "timeseries"
    return "constant"

# 处理指标中的单个变量（依赖）
def process_variable(key, indicator, cache):
    if key in cache:
        return cache[key]
    expr = indicator[key]
    node = {}
    t = determine_type(expr)
    if t == "constant":
        node["name"] = str(expr).replace(" ", "")
        node["type"] = "timeseries"
    elif t in ["function", "timeseries"]:
        node["name"] = expr.replace(" ", "")
        node["type"] = t
    elif t == "extend":
        node["name"] = key
        node["type"] = "extend"
        # 解析表达式中的依赖变量
        deps = extract_vars(expr)
        ordered = []
        # 按照 indicator 中键的顺序（排除 name、long、short）选取依赖
        for k in indicator:
            if k not in ["name", "long", "short"] and k in deps:
                ordered.append(k)
        children = []
        for dep in ordered:
            child = process_variable(dep, indicator, cache)
            children.append(child)
        node["children"] = children
    else:
        node["name"] = str(expr)
        node["type"] = t
    cache[key] = node
    return node

# 类型优先级（用于排序顶层依赖节点，仅作为参考）
def type_priority(t):
    mapping = {
        "function": 1,
        "timeseries": 2,
        "extend": 3,
        "context": 4
    }
    return mapping.get(t, 99)

# 处理单个指标（indicator）
def process_indicator(indicator):
    cache = {}
    node = {"name": indicator["name"], "type": "extend"}
    # 提取 "long" 与 "short" 表达式中引用的变量
    deps_set = set()
    for key_expr in ["long", "short"]:
        if key_expr in indicator:
            deps_set.update(extract_vars(indicator[key_expr]))
    deps = []
    # 根据 indicator 中的键顺序，选择在 long/short 中出现的依赖
    for k in indicator:
        if k not in ["name", "long", "short"] and k in deps_set:
            deps.append(k)
    children = []
    for dep in deps:
        child_node = process_variable(dep, indicator, cache)
        children.append(child_node)
    # 对顶层指标节点的 children 按类型优先级排序（例如 rsi 的常数先于函数）
    children = sorted(children, key=lambda child: type_priority(child["type"]))
    node["children"] = children
    return node

# 处理 evaluation 部分，输出为数组形式
def process_evaluation(evaluation):
    eval_list = []
    for key, value in evaluation.items():
        if key == "period":
            node = {"name": key, "type": "extend", "children": []}
            if isinstance(value, list) and len(value) == 2:
                # 格式为 "[start,end]"
                node["children"].append({"name": f"{value[0]} {value[1]}", "type": "context"})
            eval_list.append(node)
        else:
            node = {"name": key, "type": "extend", "children": []}
            if isinstance(value, list):
                for item in value:
                    if isinstance(item, dict):
                        for subkey, subvalue in item.items():
                            subnode = {
                                "name": subkey,
                                "type": "extend",
                                "children": [{"name": subvalue, "type": "context"}]
                            }
                            node["children"].append(subnode)
            eval_list.append(node)
    return eval_list

# 将多个策略（每个策略包含 indicators 与 evaluation）转换为树结构
def process_strategies(codes):
    strategies = []
    for code in codes:
        indicators_tree = []
        for indicator in code.get("indicators", []):
            node = process_indicator(indicator)
            indicators_tree.append(node)
        evaluation_tree = process_evaluation(code.get("evaluation", {}))
        strategies.append([indicators_tree, evaluation_tree])
    return strategies

# 递归计算并添加 level, depth 与 childCount
def assign_levels_and_counts(node, level=0):
    node["level"] = level
    if "children" in node and node["children"]:
        for child in node["children"]:
            assign_levels_and_counts(child, level + 1)
        node["depth"] = 1 + max(child["depth"] for child in node["children"])
        node["childCount"] = sum(1 + child.get("childCount", 0) for child in node["children"])
    else:
        node["depth"] = 1
        node["childCount"] = 0

# 为基准策略递归分配 index（顶级指标 index 为 "1","2",...；子节点 index 为 "父index-序号"）
def assign_index_rec(node, prefix):
    if "children" in node and node["children"]:
        for i, child in enumerate(node["children"], start=1):
            child["index"] = prefix + "-" + str(i)
            assign_index_rec(child, child["index"])

def assign_index_baseline(indicators):
    for i, node in enumerate(indicators, start=1):
        node["index"] = str(i)
        assign_index_rec(node, node["index"])

def assign_index_evaluation(evaluations):
    for i, node in enumerate(evaluations, start=1):
        node["index"] = str(i)
        assign_index_rec(node, node["index"])

# 归一化结构：对于 extend 节点，仅比较 children 结构；其它节点比较 type 与 name
def normalized_structure(node):
    t = node["type"]
    if t == "extend":
        children = node.get("children")
        if children:
            return (t, tuple(normalized_structure(child) for child in children))
        else:
            return (t, ())
    else:
        return (t, None)

# 判断两个节点结构是否一致（对于 extend 节点，忽略自身 name，只比较 children 结构）
def same_structure(baseline, node):
    if baseline["type"] != node["type"]:
        return False
    if baseline["type"] == "extend":
        b_children = baseline.get("children", [])
        n_children = node.get("children", [])
        if len(b_children) != len(n_children):
            return False
        return all(same_structure(bc, nc) for bc, nc in zip(b_children, n_children))
    else:
        return True

# 递归比较节点：若结构一致，则赋予基准节点的 index；对于非 extend 节点，若名称不同则标记 diff
def compare_and_assign_symmetric(baseline, node, strategies):
    # 同步赋予非基准节点基准的 index
    node["index"] = baseline.get("index")
    
    # 对于叶子节点或 context 节点
    if baseline["type"] != "extend":
        if baseline.get("name") != node.get("name"):
            # 基准节点添加 diff 标记
            baseline["diff"] = node.get("index")
            node["diff"] = baseline.get("index")
            
            # 遍历其他策略，同样在相同位置的节点添加 diff
            for strat in strategies:
                for strat_node in strat[0]:  # 遍历所有指标树
                    if normalized_structure(strat_node) == normalized_structure(baseline):
                        strat_node["diff"] = baseline["index"]
                for strat_node in strat[1]:  # 遍历所有评估树
                    if normalized_structure(strat_node) == normalized_structure(baseline):
                        strat_node["diff"] = baseline["index"]

    # 递归比较 children
    b_children = baseline.get("children", [])
    n_children = node.get("children", [])
    if b_children and n_children and len(b_children) == len(n_children):
        for bc, nc in zip(b_children, n_children):
            compare_and_assign_symmetric(bc, nc, strategies)

# 更新 collapse 属性：若直接子节点中有 diff，则 collapse 为 false，否则为 true
def update_collapse(node):
    if "children" in node and node["children"]:
        node["collapse"] = False if any("diff" in child for child in node["children"]) else True
        for child in node["children"]:
            update_collapse(child)

# 对同级 extend 节点进行去重：若 children 结构相同则生成 sharedKey，并将该子树存入全局 sharedChildrenMap
def deduplicate_children(node, shared_map, counter):
    if "children" in node and node["children"]:
        groups = {}
        for child in node["children"]:
            if child["type"] == "extend" and "children" in child and child.get("children"):
                key = tuple(normalized_structure(c) for c in child["children"])
                groups.setdefault(key, []).append(child)
        for group in groups.values():
            if len(group) > 1:
                # 若组内节点名称依次为 "up" 和 "down"，则使用 "upDownChildren"
                names = [child["name"] for child in group]
                if names == ["up", "down"]:
                    shared_key = "upDownChildren"
                else:
                    shared_key = "sharedKey" + str(counter[0])
                    counter[0] += 1
                # 将组内节点 children 提取出来（以第一个为准）
                shared_children = group[0].pop("children", [])
                for child in group:
                    child["sharedKey"] = shared_key
                    if "children" in child:
                        child.pop("children")
                if shared_key not in shared_map:
                    # 调整 shared children 的 level（设为组内节点 level+1）
                    for sc in shared_children:
                        sc["level"] = group[0]["level"] + 1
                        assign_levels_and_counts(sc, sc["level"])
                    shared_map[shared_key] = shared_children
        for child in node.get("children", []):
            deduplicate_children(child, shared_map, counter)

# ─────────────────────────────
# RL：策略json和策略配置的相互转换
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