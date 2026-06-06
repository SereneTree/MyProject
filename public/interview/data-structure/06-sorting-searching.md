# 排序与查找——面试高频考点

## 知识框架

```
排序与查找
├── 比较排序
│   ├── 交换排序: 冒泡排序、快速排序
│   ├── 插入排序: 直接插入、希尔排序
│   ├── 选择排序: 简单选择、堆排序
│   └── 归并排序
├── 非比较排序
│   ├── 计数排序
│   ├── 桶排序
│   └── 基数排序
└── 查找算法
    ├── 二分查找
    ├── 插值查找
    └── 斐波那契查找
```

---

## 一、十大排序算法速查表

| 排序算法 | 平均时间 | 最好时间 | 最坏时间 | 空间 | 稳定性 |
|----------|---------|---------|---------|------|--------|
| 冒泡排序 | O(n²) | O(n) | O(n²) | O(1) | ✅ 稳定 |
| 选择排序 | O(n²) | O(n²) | O(n²) | O(1) | ❌ 不稳定 |
| 插入排序 | O(n²) | O(n) | O(n²) | O(1) | ✅ 稳定 |
| 希尔排序 | O(n^1.3) | O(n) | O(n²) | O(1) | ❌ 不稳定 |
| **归并排序** | **O(nlogn)** | O(nlogn) | O(nlogn) | **O(n)** | ✅ 稳定 |
| **快速排序** | **O(nlogn)** | O(nlogn) | **O(n²)** | O(logn) | ❌ 不稳定 |
| **堆排序** | **O(nlogn)** | O(nlogn) | O(nlogn) | **O(1)** | ❌ 不稳定 |
| 计数排序 | O(n+k) | O(n+k) | O(n+k) | O(k) | ✅ 稳定 |
| 桶排序 | O(n+k) | O(n) | O(n²) | O(n+k) | ✅ 稳定 |
| 基数排序 | O(d×(n+k)) | O(d×(n+k)) | O(d×(n+k)) | O(n+k) | ✅ 稳定 |

> **面试必背**：快排/归并/堆排是三大 O(nlogn) 排序；稳定排序记"归冒插计桶基"

---

## 二、快速排序 (面试最高频！)

### 2.1 核心思想

```
分治策略：
1. 选择 pivot (基准元素)
2. 分区 (partition): 小于pivot放左边，大于放右边
3. 递归排序左右两部分

特点：原地排序、不稳定、平均O(nlogn)、最坏O(n²)
```

### 2.2 代码实现

```java
void quickSort(int[] arr, int left, int right) {
    if (left >= right) return;
    int pivotIndex = partition(arr, left, right);
    quickSort(arr, left, pivotIndex - 1);
    quickSort(arr, pivotIndex + 1, right);
}

int partition(int[] arr, int left, int right) {
    int pivot = arr[right]; // 选最后一个为基准
    int i = left;           // i指向小于pivot区域的右边界
    for (int j = left; j < right; j++) {
        if (arr[j] < pivot) {
            swap(arr, i, j);
            i++;
        }
    }
    swap(arr, i, right);    // pivot放到正确位置
    return i;
}
```

### 2.3 快排优化

| 优化方式 | 说明 |
|----------|------|
| 三数取中 | pivot取left/mid/right的中位数，避免最坏情况 |
| 随机化 | 随机选pivot，期望时间O(nlogn) |
| 小数组插入排序 | 数据量<10-15时切换为插入排序 |
| 三路快排 | 分为<pivot、=pivot、>pivot三部分，处理大量重复 |
| 尾递归优化 | 先递归短的一半，长的用循环代替 |

### 2.4 快排 vs 归并 vs 堆排

| 对比维度 | 快排 | 归并排序 | 堆排序 |
|----------|------|---------|--------|
| 平均时间 | O(nlogn) | O(nlogn) | O(nlogn) |
| 最坏时间 | O(n²) | O(nlogn) | O(nlogn) |
| 空间 | O(logn) 栈 | O(n) 临时数组 | O(1) |
| 稳定性 | ❌ | ✅ | ❌ |
| 缓存友好 | ✅ (顺序访问) | ✅ | ❌ (跳跃访问) |
| 实际速度 | **最快** | 次之 | 较慢 |
| 适用场景 | 通用排序(内排序) | 需要稳定性、外排序 | 空间极度受限 |

---

## 三、归并排序

### 3.1 代码实现

```java
void mergeSort(int[] arr, int left, int right) {
    if (left >= right) return;
    int mid = left + (right - left) / 2;
    mergeSort(arr, left, mid);
    mergeSort(arr, mid + 1, right);
    merge(arr, left, mid, right);
}

void merge(int[] arr, int left, int mid, int right) {
    int[] temp = new int[right - left + 1];
    int i = left, j = mid + 1, k = 0;
    while (i <= mid && j <= right) {
        if (arr[i] <= arr[j]) temp[k++] = arr[i++];  // <= 保证稳定性
        else temp[k++] = arr[j++];
    }
    while (i <= mid) temp[k++] = arr[i++];
    while (j <= right) temp[k++] = arr[j++];
    System.arraycopy(temp, 0, arr, left, temp.length);
}
```

### 3.2 归并排序的应用

| 应用 | 说明 |
|------|------|
| 外部排序 | 大文件无法装入内存时，分块排序+多路归并 |
| 求逆序对 | 归并过程中统计逆序数 (剑指Offer经典题) |
| 链表排序 | 链表归并排序空间O(1)，且不需要随机访问 |
| TimSort | Java/Python 默认排序 = 归并+插入混合 |

---

## 四、堆排序

```java
void heapSort(int[] arr) {
    int n = arr.length;
    // 建堆 O(n)
    for (int i = n/2 - 1; i >= 0; i--)
        siftDown(arr, n, i);
    // 排序 O(nlogn)
    for (int i = n - 1; i > 0; i--) {
        swap(arr, 0, i);       // 最大值放末尾
        siftDown(arr, i, 0);   // 恢复堆
    }
}

void siftDown(int[] arr, int n, int i) {
    int largest = i;
    int l = 2*i+1, r = 2*i+2;
    if (l < n && arr[l] > arr[largest]) largest = l;
    if (r < n && arr[r] > arr[largest]) largest = r;
    if (largest != i) {
        swap(arr, i, largest);
        siftDown(arr, n, largest);
    }
}
```

---

## 五、二分查找 (面试超高频！)

### 5.1 基本模板

```java
// 标准二分: 查找target
int binarySearch(int[] nums, int target) {
    int left = 0, right = nums.length - 1;
    while (left <= right) {
        int mid = left + (right - left) / 2;  // 防溢出
        if (nums[mid] == target) return mid;
        else if (nums[mid] < target) left = mid + 1;
        else right = mid - 1;
    }
    return -1;
}
```

### 5.2 左边界 & 右边界

```java
// 查找第一个 >= target 的位置 (左边界)
int lowerBound(int[] nums, int target) {
    int left = 0, right = nums.length;
    while (left < right) {
        int mid = left + (right - left) / 2;
        if (nums[mid] < target) left = mid + 1;
        else right = mid;
    }
    return left;
}

// 查找第一个 > target 的位置 (上界)
int upperBound(int[] nums, int target) {
    int left = 0, right = nums.length;
    while (left < right) {
        int mid = left + (right - left) / 2;
        if (nums[mid] <= target) left = mid + 1;
        else right = mid;
    }
    return left;
}
```

### 5.3 二分查找变体题

| 题目 | 思路 |
|------|------|
| 旋转数组查找 | 判断哪半有序，收缩范围 |
| 求平方根 | 二分答案，mid²与x比较 |
| 查找峰值 | mid与mid+1比较确定上升/下降 |
| 吃香蕉速度 | 二分答案，验证是否满足条件 |
| 分割数组最大值 | 二分答案+贪心验证 |

---

## 六、排序算法选择指南

```
面试答题思路——"场景选排序"：

┌─────────────────────────────────────────────────┐
│ 数据量小(<50): 插入排序 (常数小, 自适应)         │
│ 通用排序:      快排 (实际最快, 大多数语言默认)     │
│ 要求稳定:      归并排序                           │
│ 空间受限:      堆排序 (O(1)空间)                  │
│ 数据接近有序:  插入排序 O(n)                      │
│ 数据范围小:    计数排序 (如年龄0-150)             │
│ 超大数据/外排: 归并排序 (多路归并)                │
│ 链表排序:      归并排序 (不需要随机访问)           │
└─────────────────────────────────────────────────┘
```

---

## 七、面试真题与话术

### Q1: 快速排序的原理？最坏情况是什么？如何优化？

> **答**：快排基于分治：选一个pivot，将数组分为小于和大于pivot两部分，递归排序。平均O(nlogn)。最坏O(n²)发生在每次pivot选到最大/最小值(已排序数组+选首/尾)，此时分区极度不均。优化：①三数取中选pivot；②随机化pivot；③对小数组切换插入排序；④三路快排处理重复元素。

### Q2: 归并排序和快排的区别？各自什么场景更好？

> **答**：归并是稳定排序、最坏也是O(nlogn)，但需要O(n)额外空间。快排不稳定、最坏O(n²)但平均更快(常数小、缓存友好)且原地O(logn)空间。通用场景选快排(各语言sort默认)；需要稳定性选归并(如Java的Arrays.sort对对象用TimSort)；外部排序(大文件)必须归并。

### Q3: 稳定排序和不稳定排序的区别？为什么要关注稳定性？

> **答**：稳定排序保证相等元素的相对顺序不变。稳定的有：归并、冒泡、插入、计数、桶、基数；不稳定的有：快排、堆排、希尔、选择。稳定性重要场景：多关键字排序(先按age排，再按name排，希望name相同的仍按age有序)；数据库排序等要求确定性结果的场景。

### Q4: 二分查找的条件？常见的边界错误？

> **答**：前提：数组有序且支持随机访问。常见错误：①mid计算溢出(应写`left+(right-left)/2`而非`(left+right)/2`)；②循环条件写错(left<=right vs left<right取决于区间定义)；③更新left/right时±1错误(闭区间mid±1，开区间不变)。建议统一用左闭右开写法避免混乱。

### Q5: 为什么快排实际比堆排序快？

> **答**：虽然都是O(nlogn)，但快排的常数更小。原因：①快排顺序访问数组(缓存友好)，堆排需要跳跃式访问父子节点(缓存不友好)；②快排的比较和交换集中在局部，堆排每次siftDown都要跳到远处；③快排的递归结构更适合编译器优化。实测快排通常比堆排快2-3倍。

### Q6: Top K问题怎么解？

> **答**：三种方案：①堆：维护大小K的小顶堆，时间O(nlogK)空间O(K)——最通用(数据流场景)；②快速选择(QuickSelect)：基于partition的O(n)平均算法——数组场景最快；③全排序：O(nlogn)——数据量小时最简单。面试推荐：先说堆(稳定O(nlogK))，再提快速选择(最优O(n))，展现思维深度。

---

## 八、复杂度速查卡

### 排序算法记忆口诀

```
时间复杂度:
  O(n²) 三兄弟: 冒泡、选择、插入 (简单但慢)
  O(nlogn) 三剑客: 快排、归并、堆排 (面试核心)
  O(n) 三线性: 计数、桶、基数 (非比较,有条件限制)

稳定性口诀:
  "归冒插计桶基" 稳定 → 记"龟帽插几桶鸡"
  "快堆希选" 不稳定 → 记"快对西瓜" (选西瓜快一堆)

空间复杂度:
  O(1): 冒泡、选择、插入、希尔、堆排
  O(logn): 快排(递归栈)
  O(n): 归并
  O(n+k): 计数、桶、基数
```
