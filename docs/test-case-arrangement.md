# 测试用例编排说明

本文档描述 PhonePilot 自动化测试中各助记词用例的测试目的和覆盖范围。

---

## 一、标准助记词测试 (12/18/24 词)

### 用例 ID
- `one-normal-12` / `two-normal-12` / `three-normal-12`
- `one-normal-18` / `two-normal-18` / `three-normal-18`
- `one-normal-24` / `two-normal-24` / `three-normal-24`

### 测试内容
- 批量地址测试
- 批量公钥测试
- 批量变种地址测试
- 开启 Passphrase 的相关验证

---

## 二、SLIP39 助记词测试 (20/33 词)

### 用例 ID
- `count20_one_normal` / `count20_two_normal` / `count20_three_normal`
- `count33_one_normal` / `count33_two_normal`

### 测试内容
- 批量地址测试
- 开启 Passphrase 的相关验证

---

## 三、API 签名方法测试

### 用例 ID
- `api-normal-12`

### 测试内容
- Passphrase 测试
- 安全测试
- 功能测试
- 链方法批量测试

---

## 四、单地址测试

### 用例 ID
- `new-normal-12`
- `new-normal-18`
- `new-normal-24`
- `new-normal-20`

### 测试内容
- 单个地址测试
- 开启 Passphrase 的相关验证

---

## 测试覆盖矩阵

| 用例类型 | 批量地址 | 批量公钥 | 变种地址 | 单地址 | Passphrase | 安全测试 | 功能测试 | 链方法批量 |
|---------|:-------:|:-------:|:-------:|:-----:|:----------:|:-------:|:-------:|:---------:|
| normal-12/18/24 | ✅ | ✅ | ✅ | - | ✅ | - | - | - |
| count20/33 | ✅ | - | - | - | ✅ | - | - | - |
| api-normal-12 | - | - | - | - | ✅ | ✅ | ✅ | ✅ |
| new-normal-* | - | - | - | ✅ | ✅ | - | - | - |
