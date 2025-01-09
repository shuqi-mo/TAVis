import numpy as np
import math

class PatternMatcher:
    def __init__(self, pattern_size=10000, txt_size=50000, max_val=256, minsup=25):
        self.count = 0
        self.frequent_num = 0
        self.candidate_num = 0
        self.compnum = 2
        self.PATTERN_SIZE = pattern_size
        self.TXT_SIZE = txt_size
        self.Max = max_val
        self.minsup = minsup
        self.L2 = np.zeros((900, 900), dtype=int)
        self.C = np.zeros((2000, 2000), dtype=int)
        self.L = np.zeros((900, 900), dtype=int)
        self.pattern = np.zeros(self.PATTERN_SIZE, dtype=int)
        self.sorted_pat = np.zeros(self.PATTERN_SIZE, dtype=int)
        self.aux = np.zeros(self.PATTERN_SIZE, dtype=int)
        self.trans_text = np.zeros(self.TXT_SIZE - 1, dtype=int)
        self.trans_pattern = np.zeros(self.PATTERN_SIZE - 1, dtype=int)
        self.pattern_num = 0
        self.fre_pattern_list = []

    def radix_sort(self, arr, length):
        for pass_ in range(4):
            countArr = np.zeros(256, dtype=np.uint8)
            copyArr = np.zeros(length, dtype=np.uint32)
            for i in range(length):
                countArr[(arr[i] >> (8 * pass_)) & 255] += 1
            for i in range(1, 256):
                countArr[i] += countArr[i - 1]
            for i in range(length - 1, -1, -1):
                copyArr[countArr[(arr[i] >> (8 * pass_)) & 255] - 1] = arr[i]
                countArr[(arr[i] >> (8 * pass_)) & 255] -= 1
            for i in range(length):
                arr[i] = copyArr[i]

    def gen_aux(self, arr, length):
        for i in range(length):
            for j in range(length):
                if self.sorted_pat[i] == self.pattern[j]:
                    arr[i] = j + 1

    def transform_text(self, txt, txt_length):
        for loop in range(txt_length):
            self.trans_text[loop] = 1 if txt[loop] < txt[loop + 1] else 0

    def transform_pattern(self, pat, pat_length):
        for loop in range(pat_length):
            self.trans_pattern[loop] = 1 if pat[loop] < pat[loop + 1] else 0

    def BNDM(self, txt, pat, txt_length, pat_length):
        self.pattern_num = 0
        flag = 0
        f = 0
        B = np.zeros(self.Max, dtype=np.uint32)
        pos = 0
        for i in range(pat_length):
            B[pat[i]] |= 1 << (pat_length - i - 1)
        while pos <= txt_length - pat_length:
            j = pat_length - 1
            last = pat_length
            D = -1
            while D:
                D &= B[txt[pos + j]]
                if D & (1 << (pat_length - 1)):
                    if j > 0:
                        last = j
                    else:
                        len_cand = pos + pat_length
                        cand = pos
                        k = 0
                        for x in range(pos, len_cand):
                            if self.data[cand - 1 + self.aux[k]] >= self.data[cand - 1 + self.aux[k + 1]]:
                                f = 0
                                break
                            else:
                                f = 1
                            k += 1
                        if f > 0:
                            flag = 1
                            self.pattern_num += 1
                j -= 1
                D <<= 1
            pos += last

    def matching1(self, text, pattern, txt_size, pattern_size):
        self.sorted_pat[:pattern_size] = pattern[:pattern_size]
        self.radix_sort(self.sorted_pat, pattern_size)
        self.gen_aux(self.aux, pattern_size)
        self.transform_text(text, txt_size - 1)
        self.transform_pattern(pattern, pattern_size - 1)
        self.BNDM(self.trans_text, self.trans_pattern, txt_size - 1, pattern_size - 1)
        return self.pattern_num

    def generate_candL2(self, m):
        C2 = np.array([[1, 2], [2, 1]])
        for j in range(2):
            m[:2] = C2[j]
            support_full = self.matching1(self.data, m, len(self.data), 2)
            if support_full >= self.minsup:
                self.count += 1
                self.fre_pattern_list.append(list(C2[j]))
                self.frequent_num += 1
                self.L2[j, :2] = C2[j]

    def sort(self, src):
        slen = 0
        y = 0
        while y < 50:
            if src[y] != 0:
                slen += 1
            y += 1
        sort_array = [0] * slen
        for i in range(slen):
            k = src[i]
            level = 1
            for x in range(slen):
                if k > src[x]:
                    level += 1
            sort_array[i] = level
            level = 1
        return sort_array

    def generate_fre(self, min_, fre):
        slen = 0
        Q = [0] * 100
        R = [0] * 100
        y = 0
        while y < 50:
            if fre[0][y] != 0:
                slen += 1
            y += 1
        for i in range(self.frequent_num):
            Q[:slen-1] = fre[i, 1:slen]  # 复制数组
            q = self.sort(Q)  # 排序
            for j in range(self.frequent_num):
                R[:slen-1] = fre[j, :slen-1]  # 复制数组
                r = self.sort(R)  # 排序
                if q != r:
                    continue

                if fre[i][0] == fre[j][slen-1]:
                    self.C[self.candidate_num][0] = fre[i][0]
                    self.C[self.candidate_num+1][0] = fre[i][0] + 1
                    self.C[self.candidate_num][slen] = fre[i][0] + 1
                    self.C[self.candidate_num+1][slen] = fre[i][0]
                    for t in range(1, slen):
                        if fre[i][t] > fre[j][slen-1]:
                            self.C[self.candidate_num][t] = fre[i][t] + 1
                            self.C[self.candidate_num+1][t] = fre[i][t] + 1
                        else:
                            self.C[self.candidate_num][t] = fre[i][t]
                            self.C[self.candidate_num+1][t] = fre[i][t]
                    self.candidate_num += 2
                    self.compnum += 2
                elif fre[i][0] < fre[j][slen-1]:
                    self.C[self.candidate_num][0] = fre[i][0]
                    self.C[self.candidate_num][slen] = fre[j][slen-1] + 1
                    for t in range(1, slen):
                        if fre[i][t] > fre[j][slen-1]:
                            self.C[self.candidate_num][t] = fre[i][t] + 1
                        else:
                            self.C[self.candidate_num][t] = fre[i][t]
                    self.candidate_num += 1
                    self.compnum += 1
                else:
                    self.C[self.candidate_num][0] = fre[i][0] + 1
                    self.C[self.candidate_num][slen] = fre[j][slen-1]
                    for t in range(0, slen-1):
                        if fre[j][t] > fre[i][0]:
                            self.C[self.candidate_num][t+1] = fre[j][t] + 1
                        else:
                            self.C[self.candidate_num][t+1] = fre[j][t]
                    self.candidate_num += 1
                    self.compnum += 1

    def SBNDM(self, txt, pat, txt_length, pat_length):
        self.pattern_num = 0
        flag = 0
        f = 0
        B = np.zeros(self.Max, dtype=int)
        for j in range(pat_length):
            B[pat[j]] |= (1 << (pat_length - j - 1))
        pos = pat_length - 1
        while pos <= txt_length - 1:
            D = (B[txt[pos - 1]]) & (B[txt[pos]] << 1)
            if D != 0:
                j = pos - pat_length + 1
                while D != 0:
                    pos -= 1
                    if pos == 0:
                        D = 0
                    else:
                        D = (D << 1) & B[txt[pos - 1]]
                if j == pos:
                    len_cand = j + pat_length
                    k = 0
                    f = 1
                    cand = j
                    for x in range(j, len_cand):
                        if self.data[cand - 1 + self.aux[k]] >= self.data[cand - 1 + self.aux[k + 1]]:
                            f = 0
                            break
                        k += 1
                    if f > 0:
                        flag = 1
                        self.pattern_num += 1
                    pos += 1
            pos += pat_length - 1

    def matching2(self, text, pattern, txt_size, pattern_size):
        self.sorted_pat[:pattern_size] = pattern[:pattern_size]
        self.radix_sort(self.sorted_pat, pattern_size)
        self.gen_aux(self.aux, pattern_size)
        self.transform_text(text, txt_size - 1)
        self.transform_pattern(pattern, pattern_size - 1)
        self.SBNDM(self.trans_text, self.trans_pattern, txt_size - 1, pattern_size - 1)
        return self.pattern_num

    def Cancalute(self, max_):
        self.frequent_num = 0
        len_ = 0
        r = 0
        while self.candidate_num != 0:
            while r < 50:
                if self.C[0, r] != 0:
                    len_ += 1
                r += 1
            for v in range(self.candidate_num):
                max_[:len_] = self.C[v, :len_]  # 复制数组
                support_full = self.matching2(self.data, self.C[v, :len_], len(self.data), len_)
                if support_full >= self.minsup:
                    self.count += 1
                    self.fre_pattern_list.append(list(self.C[v, :len_]))
                    self.L[self.frequent_num, :len_] = self.C[v, :len_]  # 复制数组
                    self.frequent_num += 1
            r = 0
            len_ = 0
            self.C.fill(0)  # 清空C数组
            self.candidate_num = 0
            self.generate_fre(max_, self.L)
            self.L.fill(0)  # 清空L数组
            self.frequent_num = 0
    
    def process_patterns(self):
        # 统计不同长度的元素个数
        length_counts = {}
        for pattern in self.fre_pattern_list:
            length = len(pattern)
            if length not in length_counts:
                length_counts[length] = 1
            else:
                length_counts[length] += 1

        # 根据条件从patterns中去除特定长度的元素
        new_patterns = self.fre_pattern_list[:]
        for length, count in length_counts.items():
            if count == math.factorial(length):
                # 去除长度为length-1的所有元素
                new_patterns = [pattern for pattern in new_patterns if len(pattern) != length - 1]
        self.fre_pattern_list = new_patterns[:]
    
    def find_pattern_subsequences(self):
        from collections import defaultdict

        pattern_dict = defaultdict(list)

        # 将模式转换为元组，以便作为字典的键
        pattern_tuples = [tuple(p) for p in self.fre_pattern_list]

        for pattern in pattern_tuples:
            n = len(pattern)
            if n > len(self.data):
                # 如果模式长度大于数据长度，跳过
                continue
            for i in range(len(self.data) - n + 1):
                window = self.data[i:i+n]
                # 检查窗口内是否有重复元素
                if len(set(window)) != n:
                    # 如果有重复元素，跳过该窗口
                    continue
                # 对窗口进行排序，分配排名
                sorted_window = sorted(window)
                rank = [sorted_window.index(x) + 1 for x in window]
                if rank == list(pattern):
                    pattern_dict[pattern].append([i, i+n-1])
        return dict(pattern_dict)