# 图片资源说明

这个目录包含以下图片资源：

## 目录结构

```
static/images/
├── tabs/               # 底部标签栏图标
│   ├── tab-home.png        # 首页图标（正常状态）
│   ├── tab-home-active.png # 首页图标（选中状态）
│   ├── tab-config.png      # 配置图标（正常状态）
│   ├── tab-config-active.png # 配置图标（选中状态）
│   ├── tab-plans.png       # 方案图标（正常状态）
│   ├── tab-plans-active.png # 方案图标（选中状态）
│   ├── tab-profile.png     # 我的图标（正常状态）
│   └── tab-profile-active.png # 我的图标（选中状态）
├── brands/             # 品牌图标
│   ├── intel-logo.png      # 英特尔品牌图标
│   ├── amd-logo.png        # AMD品牌图标
│   └── nvidia-logo.png     # NVIDIA品牌图标
├── categories/         # 分类图标
│   ├── icon-gaming.png     # 游戏分类图标
│   ├── icon-work.png       # 工作分类图标
│   ├── icon-office.png     # 办公分类图标
│   └── icon-accessories.png # 配件分类图标
└── banners/            # 轮播图图片
    ├── banner1.jpg         # 首页轮播图片1
    ├── banner2.jpg         # 首页轮播图片2
    └── banner3.jpg         # 首页轮播图片3
```

## 1. 底部标签栏图标 (tabs/)

- `tab-home.png` 与 `tab-home-active.png` - 首页图标（正常状态和选中状态）
- `tab-config.png` 与 `tab-config-active.png` - 配置图标（正常状态和选中状态）
- `tab-plans.png` 与 `tab-plans-active.png` - 方案图标（正常状态和选中状态）
- `tab-profile.png` 与 `tab-profile-active.png` - 我的图标（正常状态和选中状态）

## 2. 品牌图标 (brands/)

- `intel-logo.png` - 英特尔品牌图标
- `amd-logo.png` - AMD品牌图标
- `nvidia-logo.png` - NVIDIA品牌图标

## 3. 轮播图图片 (banners/)

- `banner1.jpg`、`banner2.jpg`、`banner3.jpg` - 首页轮播图片

## 4. 分类图标 (categories/)

- `icon-gaming.png` - 游戏分类图标
- `icon-work.png` - 工作分类图标
- `icon-office.png` - 办公分类图标
- `icon-accessories.png` - 配件分类图标

## 图标要求

- 标签栏图标：推荐尺寸为48px × 48px或96px × 96px（@2x）
- 品牌图标：SVG格式或者高分辨率PNG，白色或彩色
- 轮播图：推荐尺寸为750px × 300px的JPG或PNG图片
- 分类图标：推荐尺寸为50px × 50px或100px × 100px（@2x）

## 图标规范

为了保持小程序的统一风格，图标应遵循以下规范：

1. **底部导航图标**：线条风格，选中状态为主题色（橙色#ff8c00），未选中状态为灰色（#8a8a8a）
2. **品牌图标**：保持原品牌标识色，背景透明
3. **分类图标**：扁平化设计，简洁线条，主题色调（橙色系）

## 获取图标的方法

1. 访问 [IconFont](https://www.iconfont.cn/) 搜索并下载相关图标
2. 使用 [Flaticon](https://www.flaticon.com/) 或 [Icons8](https://icons8.com/) 下载免费图标
3. 使用微信开发者工具中的小程序示例项目，复制其中的图标资源

## 已有图标处理

目前项目中已有的通用图标可以做如下处理：
- `icon_API_HL.png`、`icon_component.png` 等基础图标可复用于相应场景
- `tabbar_icon_chat_active.png`、`tabbar_icon_chat_default.png` 等可作为底部导航图标参考
- 其余图标根据实际需求使用 