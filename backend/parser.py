import ast
import re

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
# RL：将策略json转成策略配置
def add_suffix(key: str, suffix: str) -> str:
    """
    将参数项 key 插入指标名称后缀
    例如 "shortterm_parameter" 与 "MACD" → "shortterm_MACD_parameter"
    """
    if "_" in key:
        parts = key.split('_', 1)
        return f"{parts[0]}_{suffix}_{parts[1]}"
    else:
        return f"{key}_{suffix}"

def parse_function_call(expr: str):
    """
    检查 expr 是否为函数调用格式，格式为：FUNC(arg1, arg2)
    返回 (function_name, arg1, arg2) 或 None
    """
    m = re.match(r'^\s*(\w+)\s*\(\s*([^,\s]+)\s*,\s*([^)]+)\s*\)\s*$', expr)
    if m:
        function_name = m.group(1)
        arg1 = m.group(2)
        arg2 = m.group(3)
        return function_name, arg1, arg2
    return None

def generate_basic_config(variable_name, value):
    """
    根据单个基本元素生成配置项。
    如果是函数调用则解析出函数名、价格与参数默认值，自动生成：
      - 参数配置：键为 {variable_name}_parameter，类型、默认值及取值范围（简单采用默认值的50%下浮/上浮）
      - 价格配置：键为 {variable_name}_price，固定选项及默认值
      - 若函数名包含 MA，还生成 {variable_name}_ma_type 配置
    对于非函数调用，根据是否为数字或字符串分别生成配置。
    
    返回一个二元组：(config字典, meta信息字典)
    meta 信息用于后续合并同组函数调用的配置。
    """
    meta = {"is_function": False}
    config = {}
    if isinstance(value, str):
        # 判断是否为函数调用
        parsed = parse_function_call(value)
        if parsed:
            meta["is_function"] = True
            function_name, price_val, param_default_str = parsed
            meta["function_name"] = function_name
            meta["price"] = price_val
            # 尝试将参数默认值转换为数值
            try:
                param_default = int(param_default_str)
                param_type = "int"
            except:
                try:
                    param_default = float(param_default_str)
                    param_type = "float"
                except:
                    param_default = param_default_str
                    param_type = "str"
            # 计算参数取值范围：这里简单取默认值的 50%下浮与上浮
            if param_type in ["int", "float"]:
                if param_type == "int":
                    param_min = int(param_default * 0.5)
                    param_max = int(param_default * 1.5)
                else:
                    param_min = param_default * 0.5
                    param_max = param_default * 1.5
                config[variable_name + "_parameter"] = {
                    "min": param_min,
                    "max": param_max,
                    "type": param_type,
                    "default": param_default
                }
            else:
                config[variable_name + "_parameter"] = {
                    "type": param_type,
                    "default": param_default
                }
            # 价格配置固定
            config[variable_name + "_price"] = {
                "options": ["close", "open", "high", "low"],
                "default": price_val
            }
            # 若函数名包含 MA（忽略大小写），增加 ma_type 配置
            if "MA" in function_name.upper():
                config[variable_name + "_ma_type"] = {
                    "options": ["SMA", "EMA", "WMA", "SMMA"],
                    "default": "EMA"
                }
        else:
            # 非函数调用：若值为价格（如 "close"）则生成价格配置
            if value in ["close", "open", "high", "low"]:
                config[variable_name] = {
                    "options": ["close", "open", "high", "low"],
                    "default": value
                }
            else:
                # 否则按字符串参数处理
                config[variable_name] = {
                    "type": "str",
                    "default": value
                }
    elif isinstance(value, (int, float)):
        # 数值型参数
        param_type = "int" if isinstance(value, int) else "float"
        if param_type == "int":
            param_min = int(value * 0.5)
            param_max = int(value * 1.5)
        else:
            param_min = value * 0.5
            param_max = value * 1.5
        config[variable_name] = {
            "min": param_min,
            "max": param_max,
            "type": param_type,
            "default": value
        }
    else:
        # 其他类型转为字符串
        config[variable_name] = {
            "type": "str",
            "default": str(value)
        }
    return config, meta

def get_used_variables(indicator):
    """
    根据指标的 long 与 short 表达式提取出用到的变量名称，
    仅保留在原始指标定义（除 name, long, short 之外）的变量。
    """
    tokens = set()
    for key in ["long", "short"]:
        expr = indicator.get(key, "")
        found = re.findall(r'\b[a-zA-Z_][a-zA-Z0-9_]*\b', expr)
        # 排除函数 cross
        for token in found:
            if token != "cross":
                tokens.add(token)
    raw_keys = set(indicator.keys()) - {"name", "long", "short"}
    used = {}
    for token in tokens:
        if token in raw_keys:
            used[token] = indicator[token]
        else:
            # 若 long/short 中出现未定义的变量，直接使用该 token
            used[token] = token
    return used

def generate_single_indicator_config(indicator):
    """
    针对单个指标（name 中不含 "&"）自动生成配置。
    1. 从 long 与 short 中提取出实际使用的变量；
    2. 对每个变量生成配置（函数调用时自动解析价格、参数及可能的 ma_type）；
    3. 若同一指标中存在多个函数调用，其函数名与价格相同，则将价格（及 ma_type）配置合并。
    最后增加 include 项，并返回形如：
      { "name": <指标名称>, "parameters": { ... } }
    """
    name = indicator.get("name")
    used_vars = get_used_variables(indicator)
    config_items = {}
    meta_items = {}  # 保存每个变量对应的 meta 信息
    # 分析每个用到的变量
    for var, value in used_vars.items():
        conf, meta = generate_basic_config(var, value)
        for key, item in conf.items():
            config_items[key] = item
        meta_items[var] = meta

    # 对于函数调用类型，检查是否存在同组（函数名与价格相同）的变量，合并其价格（和 ma_type）配置
    groups = {}
    for var, meta in meta_items.items():
        if meta.get("is_function"):
            group_key = (meta.get("function_name"), meta.get("price"))
            groups.setdefault(group_key, []).append(var)
    for group_key, var_list in groups.items():
        if len(var_list) > 1:
            # 合并价格配置，键名为各变量名用 "_" 拼接后加后缀 _price
            merged_price_key = "_".join(var_list) + "_price"
            price_default = meta_items[var_list[0]]["price"]
            merged_price_config = {
                "options": ["close", "open", "high", "low"],
                "default": price_default
            }
            # 若函数名包含 MA，则合并 ma_type 配置
            function_name = group_key[0]
            if "MA" in function_name.upper():
                merged_ma_key = "_".join(var_list) + "_ma_type"
                merged_ma_config = {
                    "options": ["SMA", "EMA", "WMA", "SMMA"],
                    "default": "EMA"
                }
                for var in var_list:
                    key = var + "_ma_type"
                    if key in config_items:
                        del config_items[key]
                config_items[merged_ma_key] = merged_ma_config
            # 删除各变量单独生成的价格配置，并添加合并后的价格配置
            for var in var_list:
                key = var + "_price"
                if key in config_items:
                    del config_items[key]
            config_items[merged_price_key] = merged_price_config
    # 增加 include 配置
    config_items["include"] = {"options": ["true", "false"], "default": "true"}
    return {"name": name, "parameters": config_items}

def generate_composite_config(single_configs):
    """
    根据所有单指标配置生成组合指标配置。
    对于任意两个不同单指标，组合指标的名称为 "指标1&指标2"，其配置为：
      - 将各单指标的参数项（不包括 include）加上指标名称后缀后合并，
      - 并增加 include 项。
    返回一个字典，键为组合指标名称，值为配置。
    """
    composite_configs = {}
    names = list(single_configs.keys())
    for i in range(len(names)):
        for j in range(len(names)):
            if i == j:
                continue
            name1 = names[i]
            name2 = names[j]
            comp_name = f"{name1}&{name2}"
            comp_params = {}
            for key, value in single_configs[name1]["parameters"].items():
                if key == "include":
                    continue
                new_key = add_suffix(key, name1)
                comp_params[new_key] = value
            for key, value in single_configs[name2]["parameters"].items():
                if key == "include":
                    continue
                new_key = add_suffix(key, name2)
                comp_params[new_key] = value
            comp_params["include"] = {"options": ["true", "false"], "default": "true"}
            composite_configs[comp_name] = {"name": comp_name, "parameters": comp_params}
    return composite_configs

def convert_strategy(strategy_json: dict) -> dict:
    """
    主函数：根据输入的策略 JSON 自动生成策略配置变量。
    
    处理流程：
      1. 对于 name 中不含 "&" 的单指标，自动解析其内部用到的变量，生成配置（自动解析函数调用、价格、参数范围及合并）
      2. 对于 JSON 中已存在的组合指标（name 中含 "&"），也利用同样逻辑生成配置
      3. 根据所有单指标自动生成所有有序组合指标配置（重命名各配置项以包含指标名称）
      4. 将单指标与组合指标配置合并后返回
    """
    indicators = strategy_json.get("indicators", [])
    single_indicators = {}
    composite_from_json = {}
    for ind in indicators:
        name = ind.get("name", "")
        if "&" in name:
            # 如果 JSON 中已有组合指标，自动生成其配置
            composite_from_json[name] = generate_single_indicator_config(ind)
        else:
            single_indicators[name] = generate_single_indicator_config(ind)
    # 自动生成所有有序组合指标配置
    auto_composites = generate_composite_config(single_indicators)
    # 合并 JSON 中给出的组合指标与自动生成的组合指标
    all_composites = {**auto_composites, **composite_from_json}
    final_list = list(single_indicators.values()) + list(all_composites.values())
    return {"indicators": final_list}