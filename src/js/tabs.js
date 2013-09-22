/**
 * @file Squirrel Tabs
 * @version 0.6.0
 */

/*global
 $: false,
 SQ: true,
 Zepto: true,
 toString: true
 */

/**
 * @changelog
 * 0.6.0  * 重写 Tabs 插件，使 Tabs 插件能够在同一页面多次实例化
 * 0.5.6  * 修改组件名称为 Tabs
 * 0.5.1  * 完成选项卡基本功能
 * 0.0.1  + 新建
 */

(function ($, window) {
    /**
     * @name Tabs
     * @classdesc 选项卡交互组件
     * @constructor
     * @param {object} config 组件配置（下面的参数为配置项，配置会写入属性）
     * @param {string} config.EVE_EVENT_TYPE                        触发事件，click 或 mouseover
     * @param {string} config.DOM_TRIGGER_TARGET                    被绑定事件的 Dom 元素
     * @param {string} config.DOM_TABS                              标签 Dom 元素
     * @param {string} config.DOM_PANELS                            面板 Dom 元素
     * @param {string} config.API_URL                               API 接口① 字符串形式
     * @param {array}  config.API_URL                               API 接口② 数组形式，数组中各项对应各个选项卡
     * @param {string} config.CSS_LOADING_TIP                       loading 提示样式
     * @param {string} config.TXT_LOADING_TIP                       loading 提示文字
     * @param {number} config.NUM_ACTIVE                            初始高亮选项卡序号，0 - n
     * @param {number} config.NUM_XHR_TIMEER                        XHR 超时时间
     * @param {boolean} config.CLEAR_PANEL                          切换选项卡时是否自动清理面板数据
     * @param {function} config.trigger($tabs, $panels, tabIndex)   触发选项卡切换回调函数
     * @param {function} config.show($tabs, $panels, tabIndex)      显示选项卡时回调函数
     * @param {function} config.beforeLoad($activePanels)           异步加载前回调函数，当设定了该回调函数时，必须返回
     *                                                              true 才能继续执行，异步加载事件，可中断异步加载事件。
     *                                                              参数：$activePanels 是当前激活的面板
     * @param {function} config.loaded(data, $activePanels)         异步加载成功回调函数，参数：data 是异步加载返回数据
     *                                                              参数：$activePanels 是当前激活的面板
     * @example var tabs = new SQ.Tabs({
            EVE_EVENT_TYPE : "mouseover",
            DOM_TRIGGER_TARGET : ".J_tabs",
            DOM_TABS : ".tabs>li",
            DOM_PANELS : ".panels",
            API_URL : ["../data/content1.json", "../data/content2.json", "../data/content3.json"],
            CSS_LOADING_TIP : "tab-loading-tip",
            NUM_ACTIVE : 0,
            trigger : function () {
            
            },
            show : function () {

            },
            beforeLoad : function () {

            },
            loaded : function (data) {

            }
        });
     */
    function Tabs(config) {
        var me = this;
        var i;

        me.config = {
            NUM_ACTIVE : 0,
            NUM_XHR_TIMEER : 5000,
            TXT_LOADING_TIP : "正在加载请稍后...",     // 正在加载提示
            CLEAR_PANEL : false
        };

        for (i in config) {
            if (config.hasOwnProperty(i)) {
                me.config[i] = config[i];
            }
        }

        me.$triggerTarget = $(me.config.DOM_TRIGGER_TARGET);        // 目标元素
        me.tabsLen = me.$triggerTarget.length;   
        me.triggerFun = me.config.trigger;
        me.showFun = me.config.show;
        me.beforeLoadFun = me.config.beforeLoad;
        me.loadFun = me.config.loaded;

        me.$triggerTarget.each(function () {
            var $tabMould = $(this);
            var $tabs = $tabMould.find(me.config.DOM_TABS);
            var $panels = $tabMould.find(me.config.DOM_PANELS);
            if (me._verify()) {
                me._init($tabMould, $tabs, $panels);
            }
        });
    }
    Tabs.prototype =  {
        construtor: Tabs,
        version: "0.6.0",
        needLoadContent : false,    // 选项卡内容是否需要异步加载

        // 验证参数是否合法
        _verify : function () {
            return true;
        },
        _init : function ($tabMould, $tabs, $panels) {
            var me = this;
            var i = 0;
            // 为选项卡添加序号
            $tabs.each(function () {
                $(this).attr("data-tabIndex", i);
                i++;
            });
            // 初始化高亮
            if (me.config.NUM_ACTIVE !== undefined) {
                me.show($tabs, $panels, me.config.NUM_ACTIVE);
            }
            // 判断是否需要生成异步加载提示语
            if (me.config.API_URL && (SQ.core.isString(me.config.API_URL) || SQ.core.isArray(me.config.API_URL))) {
                me.$loadingTip = $('<div class="dpl-tabs-loadingTip"></div>');
                if (me.config.CSS_LOADING_TIP) {
                    me.$loadingTip.addClass(me.config.CSS_LOADING_TIP);
                } else {
                    me.$loadingTip.css({
                        "height" : 60,
                        "text-align" : "center",
                        "line-height" : "60px"
                    });
                }
                me.$loadingTip.text(me.config.TXT_LOADING_TIP);
                me.needLoadContent = true;
            }
            // 绑定事件
            $tabs.on(me.config.EVE_EVENT_TYPE, function () {
                var $tab = $(this);
                me._trigger($tabMould, $tabs, $panels, $tab);
            });
        },
        /**
         * 触发事件方法，在满足绑定事件条件时或满足指定触发条件的情况下调用触发方法，
         * 该方法用于集中处理触发事件，判定是否需要加载数据或者更新 UI 显示。
         */
        _trigger : function ($tabMould, $tabs, $panels, $tab) {
            var me = this;
            var tabIndex = $tab.attr("data-tabIndex");
            var isCurrentActive = $tab.hasClass("active");

            if (isCurrentActive) {
                return;
            }

            me.show($tabs, $panels, tabIndex);
            me.triggerFun && me.triggerFun($tabs, $panels, tabIndex);
        },
        _cleanPanel : function ($activePanels) {
            $activePanels.empty();
        },
        // 显示目标选项卡，可以在外部调用该方法
        show : function ($tabs, $panels, tabIndex) {
            var me = this;
            var $activeTab = $tabs.eq(tabIndex);
            var $activePanels = $panels.eq(tabIndex);
            $tabs.removeClass("active");
            $panels.removeClass("active");
            $activeTab.addClass("active");
            $activePanels.addClass("active");
            
            me.showFun && me.showFun($tabs, $panels, tabIndex);

            if (me.config.API_URL) {
                me._load($activePanels, tabIndex);
            }
        },
        _load : function ($activePanels, tabIndex) {
            var me = this;
            var api = me.config.API_URL;
            var $currentLoadTip = $activePanels.find(".dpl-tabs-loadingTip");
            var hasLoadingTip = $currentLoadTip.length > 0 ? true : false;
            var hasLoaded = $activePanels.hasClass("hasLoaded");
            
            if (hasLoaded) {
                return;
            }
            // 如果设置了 beforeLoadFun 回调函数，则 beforeLoadFun 必须返回 true 才能继续向下执行，
            // 用于人为中断 _load 事件。
            if (me.beforeLoadFun) {
                if (!me.beforeLoadFun()) {
                    return;
                }
            }

            if (SQ.core.isArray(me.config.API_URL) && me.config.API_URL[tabIndex]) {
                api = me.config.API_URL[tabIndex];
            }
            if (me.xhr) {
                me.xhr.abort();
            }
            if (me.config.CLEAR_PANEL) {
                me._cleanPanel($activePanels);
            }
            if (hasLoadingTip) {
                $currentLoadTip.show();
            } else {
                $activePanels.append(me.$loadingTip);
                $currentLoadTip = $activePanels.find(".dpl-tabs-loadingTip");
                $currentLoadTip.show();
            }

            me.xhr = $.ajax({
                type : "POST",
                url : api,
                dataType : "json",
                timeout : me.config.NUM_XHR_TIMEER,
                success : function (data) {
                    $currentLoadTip.hide();
                    $activePanels.addClass("hasLoaded");    // 为已经加载过的面板添加 .hasLoaded 标记
                    me.loadFun && me.loadFun(data, $activePanels);
                },
                error : function () {
                    me._showReloadTips($activePanels, tabIndex);
                }
            });
        },
        _showReloadTips : function ($activePanels, tabIndex) {
            var me = this;
            var $tip = $activePanels.find(".dpl-tabs-loadingTip");
            $tip.show().empty();
            var reloadHTML = '<div class="reload">' +
                    '<p style="padding:5px 0;">抱歉，加载失败，请重试</p>' +
                    '<div class="sq-btn f-grey J_reload">重新加载</div>' +
                '</div>';
            $tip.append(reloadHTML);
            $activePanels.on("click", ".J_reload", function () {
                me._load($activePanels, tabIndex);
            });
        }
    };
    SQ.Tabs = Tabs;
}($, window));